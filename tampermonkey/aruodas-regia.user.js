// ==UserScript==
// @name         Aruodas → Regia.lt (LKS-94)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Add Regia.lt button on aruodas.lt listing pages; convert Google Maps coords to LKS-94 and open in regia.lt
// @match        https://www.aruodas.lt/*
// @match        https://aruodas.lt/*
// @grant        none
// @run-at       document-idle
// @require      https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/lib/wgs84-lks94-lib.js
// ==/UserScript==

(function () {
  'use strict';

  const L = window.Lks94Wgs84;
  if (!L) {
    console.warn('[Aruodas Regia] Lks94Wgs84 library not loaded. Update the @require URL to regia-lks94-lib.js.');
    return;
  }

  const REGIA_BASE = 'https://regia.lt/map/regia2';
  const REGIA_DEFAULT_PARAMS = 'scale=1000&identify=true&sluo_ids=22,250,251,72,148,252,270,271,272,273,274,275,276,277,280,281,282,283,284,285,287,288,301,306,307,374,308,309,310,317,321,318,329,320,322,348,349,325,302,303,304,365,366,319,312,313,327,347,346,351,357,358,334,353,311,332,333,335,336,337,338,339,340,341,342,343,344,345,360,361,305,314,2315,2350,2367,2316,2323,2324,2326,2328,2330,2331,2352,2359,2363,2364,2368,2354,2355,2356,2362,2369,2370,130,131,132,133,27,190,28,29,30,31,25,135,136,137,138,139,291,140';

  function buildRegiaUrl(easting, northing) {
    const x = Math.round(easting);
    const y = Math.round(northing);
    return `${REGIA_BASE}?x=${x}&y=${y}&${REGIA_DEFAULT_PARAMS}`;
  }

  function parseGoogleMapsCoords(url) {
    if (!url || typeof url !== 'string') return null;
    const urlNorm = url.trim();
    if (!urlNorm.includes('google.com/maps') && !urlNorm.includes('maps.google')) return null;
    try {
      const u = new URL(urlNorm, 'https://www.google.com/');
      const search = u.searchParams;
      const path = u.pathname + u.search + (u.hash || '');

      const q = search.get('query');
      if (q) {
        const parsed = L.parsePair(q);
        if (parsed && L.inLithuaniaWgs84(parsed.lat, parsed.lon)) return parsed;
      }

      const vp = search.get('viewpoint');
      if (vp) {
        const parsed = L.parsePair(vp);
        if (parsed && L.inLithuaniaWgs84(parsed.lat, parsed.lon)) return parsed;
      }

      const atMatch = path.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,\d+z)?/);
      if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lon = parseFloat(atMatch[2]);
        if (L.inLithuaniaWgs84(lat, lon)) return { lat, lon };
      }

      const three = path.match(/!3d(-?\d+\.?\d*)/);
      const four = path.match(/!4d(-?\d+\.?\d*)/);
      if (three && four) {
        const lat = parseFloat(three[1]);
        const lon = parseFloat(four[1]);
        if (L.inLithuaniaWgs84(lat, lon)) return { lat, lon };
      }

      const qParam = search.get('q');
      if (qParam) {
        const locMatch = qParam.match(/loc:(-?\d+\.?\d*)[+\s]+(-?\d+\.?\d*)/);
        if (locMatch) {
          const lat = parseFloat(locMatch[1]);
          const lon = parseFloat(locMatch[2]);
          if (L.inLithuaniaWgs84(lat, lon)) return { lat, lon };
        }
        const parsed = L.parsePair(qParam);
        if (parsed && L.inLithuaniaWgs84(parsed.lat, parsed.lon)) return parsed;
      }

      return null;
    } catch (_) {
      return null;
    }
  }

  function collectAndConvert() {
    const allLinks = document.querySelectorAll('a[href]');
    const links = Array.from(allLinks).filter(
      (a) => a.href && (a.href.includes('google.com/maps') || a.href.includes('maps.google'))
    );
    const seen = new Set();
    const results = [];

    links.forEach((a) => {
      const coords = parseGoogleMapsCoords(a.href);
      if (!coords) return;
      const key = `${coords.lat.toFixed(6)},${coords.lon.toFixed(6)}`;
      if (seen.has(key)) return;
      seen.add(key);

      const lks = L.wgs84ToLks94(coords.lat, coords.lon);
      if (lks) {
        results.push({
          wgs84: coords,
          lks94: lks,
          text: `E ${lks.easting.toFixed(2)}, N ${lks.northing.toFixed(2)}`,
        });
      }
    });

    return results;
  }

  function showResults(results) {
    const existing = document.getElementById('lks94-result-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'lks94-result-panel';
    panel.style.cssText = [
      'position:fixed; top:12px; right:12px; z-index:999999;',
      'max-width:360px; max-height:80vh; overflow:auto;',
      'background:#1e1e1e; color:#e0e0e0; font-family:ui-sans-serif,sans-serif;',
      'font-size:13px; padding:12px; border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,0.4);',
      'border:1px solid #333;',
    ].join(' ');

    const title = document.createElement('div');
    title.style.cssText = 'font-weight:600; margin-bottom:8px;';
    title.textContent = 'LKS-94 (EPSG:3346)';
    panel.appendChild(title);

    if (results.length === 0) {
      const msg = document.createElement('div');
      msg.style.color = '#888';
      msg.textContent = 'No Google Maps links with coordinates found on this page.';
      panel.appendChild(msg);
    } else {
      results.forEach((r) => {
        const block = document.createElement('div');
        block.style.cssText = 'margin-bottom:10px; padding:8px; background:#2a2a2a; border-radius:4px;';
        const regiaUrl = buildRegiaUrl(r.lks94.easting, r.lks94.northing);
        block.innerHTML = [
          `<div style="margin-bottom:4px;"><strong>Easting, Northing:</strong><br><code style="user-select:all;">${r.text}</code></div>`,
          `<div style="font-size:11px; color:#999;">WGS84: ${r.wgs84.lat.toFixed(6)}, ${r.wgs84.lon.toFixed(6)}</div>`,
          `<a href="${regiaUrl}" target="_blank" rel="noopener" style="display:inline-block; margin-top:6px; font-size:12px; color:#60a5fa;">Open in regia.lt</a>`,
        ].join('');
        panel.appendChild(block);
      });
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'margin-top:8px; padding:6px 12px; cursor:pointer; background:#444; color:#fff; border:none; border-radius:4px;';
    closeBtn.onclick = () => panel.remove();
    panel.appendChild(closeBtn);

    document.body.appendChild(panel);
  }

  function onRegiaButtonClick() {
    const results = collectAndConvert();
    if (results.length === 0) {
      showResults([]);
      return;
    }
    const first = results[0];
    window.open(buildRegiaUrl(first.lks94.easting, first.lks94.northing), '_blank', 'noopener');
  }

  const regiaButtonStyle = [
    'padding:8px 12px; font-size:12px; font-weight:600;',
    'color:#fff; border:none; border-radius:6px;',
    'cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.2);',
    'font-family:ui-sans-serif,sans-serif;',
    'background:#0d9488; flex:0 0 auto;',
  ].join(' ');

  function addRegiaButton() {
    if (document.getElementById('lks94-header-wrap')) return;

    const headerText = document.querySelector('.obj-header-text');
    if (!headerText) return;

    const wrap = document.createElement('div');
    wrap.id = 'lks94-header-wrap';
    wrap.style.cssText = 'display:flex; align-items:center; gap:0.75rem; flex:0 0 100%; width:100%;';

    const regiaBtn = document.createElement('button');
    regiaBtn.id = 'lks94-regia-btn';
    regiaBtn.textContent = 'Regia.lt';
    regiaBtn.title = 'Atidaryti regia.lt';
    regiaBtn.style.cssText = regiaButtonStyle;
    regiaBtn.addEventListener('click', onRegiaButtonClick);

    headerText.parentElement.insertBefore(wrap, headerText);
    wrap.appendChild(regiaBtn);
    wrap.appendChild(headerText);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addRegiaButton);
  } else {
    addRegiaButton();
  }
})();

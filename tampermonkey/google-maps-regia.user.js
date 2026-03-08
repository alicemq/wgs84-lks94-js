// ==UserScript==
// @name         Google Maps → Regia.lt (LKS-94)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Add "Open in Regia.lt" to Google Maps right-click context menu
// @match        https://www.google.com/maps/*
// @match        https://google.com/maps/*
// @grant        none
// @run-at       document-idle
// @require      regia-lks94-lib.js
// ==/UserScript==
// Update @require to the full URL of regia-lks94-lib.js (e.g. raw GitHub or your host).

(function () {
  'use strict';

  const L = window.Lks94Wgs84;
  if (!L) {
    console.warn('[Google Maps Regia] Lks94Wgs84 library not loaded. Update the @require URL to regia-lks94-lib.js.');
    return;
  }

  const REGIA_BASE = 'https://regia.lt/map/regia2';
  const REGIA_DEFAULT_PARAMS = 'scale=1000&identify=true&sluo_ids=22,250,251,72,148,252,270,271,272,273,274,275,276,277,280,281,282,283,284,285,287,288,301,306,307,374,308,309,310,317,321,318,329,320,322,348,349,325,302,303,304,365,366,319,312,313,327,347,346,351,357,358,334,353,311,332,333,335,336,337,338,339,340,341,342,343,344,345,360,361,305,314,2315,2350,2367,2316,2323,2324,2326,2328,2330,2331,2352,2359,2363,2364,2368,2354,2355,2356,2362,2369,2370,130,131,132,133,27,190,28,29,30,31,25,135,136,137,138,139,291,140';

  function buildRegiaUrl(easting, northing) {
    const x = Math.round(easting);
    const y = Math.round(northing);
    return `${REGIA_BASE}?x=${x}&y=${y}&${REGIA_DEFAULT_PARAMS}`;
  }

  function findCoordsInMenu(menuEl) {
    if (!menuEl || !menuEl.querySelectorAll) return null;
    for (const el of menuEl.querySelectorAll('*')) {
      const coords = L.parseCoordsFromText(el.textContent);
      if (coords) {
        const coordsItem = el.getAttribute('role') === 'menuitemradio' ? el : el.closest('[role="menuitemradio"]');
        return { coords, coordsItem: coordsItem || el };
      }
    }
    return null;
  }

  function getCoordsFromMapsMenu(menuEl) {
    const found = findCoordsInMenu(menuEl);
    return found ? found.coords : null;
  }

  const DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('regiaLks94Debug') === '1';
  function debugLog(...args) {
    if (DEBUG) console.log('[Regia LKS-94]', ...args);
  }

  function isMapsContextMenu(el) {
    if (!el || typeof el.getAttribute !== 'function') return false;
    const role = el.getAttribute('role');
    const jsaction = el.getAttribute('jsaction') || '';
    const isMenuContainer = role === 'menu' || jsaction.includes('actionmenu');
    if (!isMenuContainer) return false;
    return getCoordsFromMapsMenu(el) !== null;
  }

  function findMenuCandidates(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    const byRole = root.querySelectorAll('[role="menu"]');
    const byJsaction = root.querySelectorAll('[jsaction*="actionmenu"]');
    const seen = new Set();
    const out = [];
    byRole.forEach((el) => { if (!seen.has(el)) { seen.add(el); out.push(el); } });
    byJsaction.forEach((el) => { if (!seen.has(el)) { seen.add(el); out.push(el); } });
    return out;
  }

  function injectRegiaIntoMapsMenu(menuEl) {
    if (menuEl.dataset.regiaInjected === '1') {
      debugLog('skip: already injected', menuEl);
      return;
    }
    const found = findCoordsInMenu(menuEl);
    if (!found || !found.coordsItem?.parentElement) {
      debugLog('skip: no coords row in menu (no element with "lat, lon" text)');
      return;
    }
    const { coords, coordsItem } = found;

    debugLog('injecting Regia.lt item', coords);

    const regiaItem = document.createElement('div');
    regiaItem.setAttribute('role', 'menuitemradio');
    regiaItem.setAttribute('aria-checked', 'false');
    regiaItem.setAttribute('tabindex', '0');
    regiaItem.setAttribute('data-index', 'regia');
    regiaItem.setAttribute('jsaction', 'click: actionmenu.select; keydown: actionmenu.keydown');
    regiaItem.className = 'fxNQSd';
    regiaItem.dataset.regiaItem = '1';
    regiaItem.style.cursor = 'pointer';
    const twHv4e = document.createElement('div');
    twHv4e.className = 'twHv4e';
    const mLuXec = document.createElement('div');
    mLuXec.className = 'mLuXec';
    mLuXec.textContent = 'Open in Regia.lt';
    twHv4e.appendChild(mLuXec);
    regiaItem.appendChild(twHv4e);

    regiaItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const c = getCoordsFromMapsMenu(menuEl);
      if (c) {
        const lks = L.wgs84ToLks94(c.lat, c.lon);
        if (lks) window.open(buildRegiaUrl(lks.easting, lks.northing), '_blank', 'noopener');
      }
    });

    try {
      coordsItem.parentElement.insertBefore(regiaItem, coordsItem.nextSibling);
      menuEl.dataset.regiaInjected = '1';
      debugLog('injected OK after coords row', coordsItem.parentElement?.tagName);
    } catch (err) {
      debugLog('inject failed', err);
    }
  }

  function setupMapsContextMenuObserver() {
    if (!/google\.com\/maps|maps\.google/i.test(location.href)) return;

    const observedRoots = new WeakSet();

    function collectShadowRoots(el, out) {
      if (!el || out.has(el)) return;
      out.add(el);
      if (el.shadowRoot) {
        out.add(el.shadowRoot);
        collectShadowRoots(el.shadowRoot, out);
        for (const child of el.shadowRoot.children) collectShadowRoots(child, out);
      }
      for (const child of el.children) collectShadowRoots(child, out);
    }

    function processMenu(menu) {
      if (!menu || menu.dataset.regiaInjected === '1') return false;
      if (isMapsContextMenu(menu)) {
        injectRegiaIntoMapsMenu(menu);
        return true;
      }
      debugLog('menu candidate but no coords yet', {
        role: menu.getAttribute?.('role'),
        jsaction: menu.getAttribute?.('jsaction')?.slice(0, 50),
        firstItem: menu.querySelector?.('[role="menuitemradio"]')?.textContent?.trim().slice(0, 60),
      });
      return false;
    }

    function scanRootForMenus(root) {
      const candidates = findMenuCandidates(root);
      for (const menu of candidates) {
        if (processMenu(menu)) return true;
        setTimeout(() => processMenu(menu), 50);
        setTimeout(() => processMenu(menu), 150);
      }
      return false;
    }

    function observeRoot(root) {
      if (!root || observedRoots.has(root)) return;
      try {
        observer.observe(root, { childList: true, subtree: true });
        observedRoots.add(root);
        if (DEBUG && root !== document.body) debugLog('observing new root (e.g. shadow)', root);
        if (root !== document.body) scanRootForMenus(root);
      } catch (_) {}
    }

    const observer = new MutationObserver((mutations) => {
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const roots = new Set();
          collectShadowRoots(node, roots);
          for (const root of roots) observeRoot(root);
          if (scanRootForMenus(node)) break;
          for (const root of roots) {
            if (root !== node && root !== document.body) scanRootForMenus(root);
          }
        }
      }
    });

    observeRoot(document.body);
    debugLog('observer started. Enable debug: localStorage.setItem("regiaLks94Debug","1")');
    if (DEBUG && document.querySelectorAll('iframe').length) {
      debugLog('page has', document.querySelectorAll('iframe').length, 'iframe(s).');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMapsContextMenuObserver);
  } else {
    setupMapsContextMenuObserver();
  }
})();

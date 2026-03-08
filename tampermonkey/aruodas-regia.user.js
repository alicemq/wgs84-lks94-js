// ==UserScript==
// @name         Aruodas → Regia.lt (LKS-94)
// @namespace    http://tampermonkey.net/
// @version      1.4.0
// @description  Add Regia.lt button on aruodas.lt listing pages; convert Google Maps coords to LKS-94 and open in regia.lt
// @match        https://www.aruodas.lt/*
// @match        https://aruodas.lt/*
// @grant        none
// @run-at       document-idle
// @require      https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/lib/wgs84-lks94-lib.js
// @updateURL    https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/tampermonkey/aruodas-regia.user.js
// @downloadURL  https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/tampermonkey/aruodas-regia.user.js
// @supportURL   https://github.com/alicemq/wgs84-lks94-js
// ==/UserScript==

(function () {
  'use strict';

  const L = window.Lks94Wgs84;
  if (!L) {
    console.warn('[Aruodas Regia] Lks94Wgs84 library not loaded. Update the @require URL to regia-lks94-lib.js.');
    return;
  }

  const REGIA_BASE = 'https://regia.lt/map/regia2';
  const REGIA_DEFAULT_PARAMS = 'scale=1000&identify=true&text=.&sluo_ids=22,250,251,72,148,252,270,271,272,273,274,275,276,277,280,281,282,283,284,285,287,288,301,306,307,374,308,309,310,317,321,318,329,320,322,348,349,325,302,303,304,365,366,319,312,313,327,347,346,351,357,358,334,353,311,332,333,335,336,337,338,339,340,341,342,343,344,345,360,361,305,314,2315,2350,2367,2316,2323,2324,2326,2328,2330,2331,2352,2359,2363,2364,2368,2354,2355,2356,2362,2369,2370,130,131,132,133,27,190,28,29,30,31,25,135,136,137,138,139,291,140';

  function buildRegiaUrl(easting, northing) {
    const x = Math.round(easting);
    const y = Math.round(northing);
    return `${REGIA_BASE}?x=${x}&y=${y}&${REGIA_DEFAULT_PARAMS}`;
  }

  function injectRegiaPreloadLink(easting, northing) {
    var url = buildRegiaUrl(easting, northing);
    if (document.querySelector('link[rel="preload"][href="' + url + '"]')) return;
    var link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    link.as = 'document';
    document.head.appendChild(link);
  }

  const REGIA_COMPACT_BASE = 'https://regia.lt/regiaws/map_compact.jsp';

  function buildRegiaCompactIframeSrc(easting, northing) {
    const x = Math.round(easting);
    const y = Math.round(northing);
    const ver = Date.now();
    return `${REGIA_COMPACT_BASE}?x=${x}&y=${y}&title=undefined&text=undefined&lang=0&orto=true&scale=5000&mapcentx=${x}&mapcenty=${y}&ver=${ver}`;
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

  const REGIA_FRAME_ID = 'regia_frame';
  const REGIA_CONTAINER_ID = 'lks94-regia-container';

  function injectRegiaNavStyles() {
    if (document.getElementById('lks94-regia-nav-styles')) return;
    const style = document.createElement('style');
    style.id = 'lks94-regia-nav-styles';
    style.textContent = [
      '.obj-photos.lks94-regia-visible .img-popup[data-type="visible"] { display: none !important; }',
      '.obj-photos.lks94-regia-visible .img-next, .obj-photos.lks94-regia-visible .img-back { height: 68px !important; top: 215px !important; transform: translateY(-50%) !important; bottom: auto !important; z-index: 10 !important; pointer-events: auto !important; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function injectAruodasPhotoStyles() {
    if (document.getElementById('lks94-aruodas-photo-styles')) return;
    const style = document.createElement('style');
    style.id = 'lks94-aruodas-photo-styles';
    style.textContent = [
      '.obj-thumbs__wrapper { z-index: 3 !important; position: relative !important; }',
      '.obj-photos .img-popup { top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; margin-left: 0 !important; }',
      '.obj-photos .obj-img.animate { min-height: 100vh !important; height: 100vh !important; width: 100% !important; display: block !important; }',
      '.obj-photos .obj-img.animate .obj-photo-big { width: 100% !important; height: 100% !important; display: block !important; object-fit: contain !important; object-position: center !important; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  function createRegiaThumbNode(easting, northing) {
    const a = document.createElement('a');
    a.href = '#';
    a.className = 'link-obj-thumb vector-thumb-map';
    a.setAttribute('data-type', 'regia');
    a.setAttribute('data-id', 'regia');
    a.title = 'Regia.lt žemėlapis';
    const span = document.createElement('span');
    span.className = 'obj-thumb';
    span.setAttribute('data-type', 'map-static');
    span.setAttribute('data-id', 'thumbregia');
    span.textContent = 'Regia';
    a.appendChild(span);
    return a;
  }

  function createRegiaLinkThumbNode(regiaUrl) {
    const a = document.createElement('a');
    a.href = regiaUrl;
    a.target = '_blank';
    a.rel = 'noopener';
    a.className = 'link-obj-thumb vector-thumb-map';
    a.setAttribute('data-type', 'regia-link');
    a.setAttribute('data-id', 'regia-link');
    a.title = 'Atidaryti regia.lt';
    const span = document.createElement('span');
    span.className = 'obj-thumb';
    span.setAttribute('data-type', 'map-static');
    span.setAttribute('data-id', 'thumbregialink');
    span.textContent = 'Regia.lt';
    a.appendChild(span);
    return a;
  }

  function createRegiaContainer(containerId, easting, northing) {
    const isFullscreen = containerId !== REGIA_CONTAINER_ID;
    const container = document.createElement('div');
    container.id = containerId;
    if (isFullscreen) {
      container.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; background:#f0f0f0;';
    } else {
      container.style.cssText = 'width:100%; height:100%; min-height:400px; display:flex; align-items:center; justify-content:center; background:#f0f0f0;';
    }
    const iframe = document.createElement('iframe');
    iframe.frameBorder = '0';
    iframe.scrolling = 'no';
    iframe.marginWidth = '0';
    iframe.marginHeight = '0';
    iframe.src = isFullscreen ? buildRegiaUrl(easting, northing) : buildRegiaCompactIframeSrc(easting, northing);
    iframe.id = containerId === REGIA_CONTAINER_ID ? REGIA_FRAME_ID : (containerId + '-frame');
    if (isFullscreen) {
      iframe.style.cssText = 'width:100%; height:100%; display:block; border:none;';
    } else {
      iframe.width = '100%';
      iframe.height = '430';
    }
    container.appendChild(iframe);
    return container;
  }

  const EXPANDED_PRELOAD_HOLDER_ID = 'lks94-regia-preload-expanded-holder';
  const DEFAULT_REGIA_OVERLAY_ID = 'lks94-regia-default-overlay';

  function positionDefaultOverlay(overlay, objImg) {
    if (!objImg || !overlay) return;
    var objPhotos = objImg.closest('.obj-photos');
    if (objPhotos && overlay.parentNode === objPhotos) {
      var rImg = objImg.getBoundingClientRect();
      var rParent = objPhotos.getBoundingClientRect();
      overlay.style.cssText = 'position:absolute;left:' + (rImg.left - rParent.left) + 'px;top:' + (rImg.top - rParent.top) + 'px;width:' + rImg.width + 'px;height:' + rImg.height + 'px;visibility:visible;z-index:2;overflow:hidden;background:#f0f0f0;';
    } else {
      var r = objImg.getBoundingClientRect();
      overlay.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;visibility:visible;z-index:999998;overflow:hidden;background:#f0f0f0;';
    }
  }

  function hideDefaultOverlay(overlay) {
    if (!overlay) return;
    if (overlay.parentNode && overlay.parentNode.classList && overlay.parentNode.classList.contains('obj-photos')) {
      overlay.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;z-index:-1;';
    } else {
      overlay.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;z-index:-1;';
    }
  }

  function getOrCreateDefaultOverlay(containerId, easting, northing, parentEl) {
    var overlay = document.getElementById(DEFAULT_REGIA_OVERLAY_ID);
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = DEFAULT_REGIA_OVERLAY_ID;
      hideDefaultOverlay(overlay);
      overlay.appendChild(createRegiaContainer(containerId, easting, northing));
      var appendTo = parentEl && parentEl.classList && parentEl.classList.contains('obj-photos') ? parentEl : document.body;
      if (appendTo !== document.body && !appendTo.style.position) appendTo.style.position = 'relative';
      appendTo.appendChild(overlay);
    }
    return overlay;
  }

  function createRegiaPreloadHolder(id) {
    const holder = document.createElement('div');
    if (id) holder.id = id;
    holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;';
    document.body.appendChild(holder);
    return holder;
  }

  function createExpandedPreloadHolderInViewport() {
    const holder = document.createElement('div');
    holder.id = EXPANDED_PRELOAD_HOLDER_ID;
    holder.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;visibility:visible;opacity:0;pointer-events:none;z-index:-1;';
    document.body.appendChild(holder);
    return holder;
  }

  function getOrCreateExpandedPreload(easting, northing) {
    let holder = document.getElementById(EXPANDED_PRELOAD_HOLDER_ID);
    if (!holder) {
      holder = createExpandedPreloadHolderInViewport();
      holder.appendChild(createRegiaContainer(REGIA_CONTAINER_ID + '-expanded', easting, northing));
    }
    return holder;
  }

  function positionExpandedOverlay(holder, objImg) {
    if (!objImg || !holder) return;
    var r = objImg.getBoundingClientRect();
    holder.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px;overflow:hidden;visibility:visible;opacity:1;pointer-events:auto;z-index:999999;background:#f0f0f0;';
  }

  function hideExpandedOverlay(holder) {
    if (!holder) return;
    holder.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;overflow:hidden;visibility:visible;opacity:0;pointer-events:none;z-index:-1;';
  }

  function attachDefaultOverlayScrollResize(overlay) {
    if (!overlay || overlay._scrollListener) return;
    overlay._scrollListener = function () {
      if (overlay._currentObjImg) positionDefaultOverlay(overlay, overlay._currentObjImg);
    };
    overlay._resizeListener = overlay._scrollListener;
    window.addEventListener('scroll', overlay._scrollListener, true);
    window.addEventListener('resize', overlay._resizeListener);
  }

  function detachDefaultOverlayScrollResize(overlay) {
    if (!overlay || !overlay._scrollListener) return;
    window.removeEventListener('scroll', overlay._scrollListener, true);
    window.removeEventListener('resize', overlay._resizeListener);
    overlay._scrollListener = null;
    overlay._resizeListener = null;
  }

  function hideDefaultRegiaOverlay(overlay) {
    if (!overlay || !overlay._currentObjImg) return;
    var img = overlay._currentObjImg.querySelector('.obj-photo-big');
    if (img) img.style.display = '';
    detachDefaultOverlayScrollResize(overlay);
    hideDefaultOverlay(overlay);
    overlay._currentObjImg = null;
  }

  function attachRegiaClick(regiaThumb, objImg, easting, northing, containerId, clearCurrentFn, preloadHolder) {
    const isDefault = containerId === REGIA_CONTAINER_ID;
    regiaThumb.addEventListener('click', function (e) {
      e.preventDefault();
      if (!objImg) return;
      const objPhotos = objImg.closest('.obj-photos');
      let img;
      if (isDefault) {
        var overlay = getOrCreateDefaultOverlay(containerId, easting, northing, objImg.closest('.obj-photos'));
        if (overlay._currentObjImg) {
          hideDefaultRegiaOverlay(overlay);
          if (objPhotos) objPhotos.classList.remove('lks94-regia-visible');
          regiaThumb.classList.remove('current');
          if (clearCurrentFn) clearCurrentFn();
          return;
        }
        injectRegiaNavStyles();
        positionDefaultOverlay(overlay, objImg);
        overlay._currentObjImg = objImg;
        img = objImg.querySelector('.obj-photo-big');
        if (img) img.style.display = 'none';
        if (objPhotos) objPhotos.classList.add('lks94-regia-visible');
        attachDefaultOverlayScrollResize(overlay);
        if (clearCurrentFn) clearCurrentFn();
        regiaThumb.classList.add('current');
        return;
      }
      if (preloadHolder && preloadHolder.id === EXPANDED_PRELOAD_HOLDER_ID) {
        if (preloadHolder._currentObjImg) {
          hideExpandedOverlay(preloadHolder);
          img = preloadHolder._currentObjImg.querySelector('.obj-photo-big');
          if (img) img.style.display = '';
          preloadHolder._currentObjImg = null;
          if (objPhotos) objPhotos.classList.remove('lks94-regia-visible');
          regiaThumb.classList.remove('current');
          if (clearCurrentFn) clearCurrentFn();
          return;
        }
        injectRegiaNavStyles();
        positionExpandedOverlay(preloadHolder, objImg);
        preloadHolder._currentObjImg = objImg;
        img = objImg.querySelector('.obj-photo-big');
        if (img) img.style.display = 'none';
        if (objPhotos) objPhotos.classList.add('lks94-regia-visible');
        if (clearCurrentFn) clearCurrentFn();
        regiaThumb.classList.add('current');
        return;
      }
      let container = objImg.querySelector('#' + containerId);
      if (container) {
        var isVisible = container.style.display !== 'none' && container.offsetParent !== null;
        if (isVisible) {
          if (preloadHolder) {
            preloadHolder.appendChild(container);
          } else {
            container.style.display = 'none';
          }
          img = objImg.querySelector('.obj-photo-big');
          if (img) img.style.display = '';
          if (objPhotos) objPhotos.classList.remove('lks94-regia-visible');
          regiaThumb.classList.remove('current');
          if (clearCurrentFn) clearCurrentFn();
          return;
        }
        container.style.display = containerId !== REGIA_CONTAINER_ID ? 'block' : 'flex';
        injectRegiaNavStyles();
        img = objImg.querySelector('.obj-photo-big');
        if (img) img.style.display = 'none';
        if (objPhotos) objPhotos.classList.add('lks94-regia-visible');
        if (clearCurrentFn) clearCurrentFn();
        regiaThumb.classList.add('current');
        return;
      }
      if (preloadHolder) {
        container = preloadHolder.querySelector('#' + containerId);
        if (container) preloadHolder.removeChild(container);
      }
      if (!container) container = createRegiaContainer(containerId, easting, northing);
      injectRegiaNavStyles();
      img = objImg.querySelector('.obj-photo-big');
      if (img) img.style.display = 'none';
      if (objPhotos) objPhotos.classList.add('lks94-regia-visible');
      objImg.appendChild(container);
      if (clearCurrentFn) clearCurrentFn();
      regiaThumb.classList.add('current');
    });
  }

  function addRegiaToWrapper(wrapper, mapThumb, objImg, easting, northing, thumbId, containerId, clearCurrentFn, preloadHolder) {
    const regiaThumb = createRegiaThumbNode(easting, northing);
    regiaThumb.id = thumbId;
    if (mapThumb) {
      wrapper.insertBefore(regiaThumb, mapThumb);
    } else {
      wrapper.appendChild(regiaThumb);
    }
    attachRegiaClick(regiaThumb, objImg, easting, northing, containerId, clearCurrentFn, preloadHolder);
    return regiaThumb;
  }

  function addRegiaFilmstrip() {
    const results = collectAndConvert();
    if (!results || results.length === 0) return;

    const lks = results[0].lks94;
    const easting = lks.easting;
    const northing = lks.northing;

    injectRegiaPreloadLink(easting, northing);
    getOrCreateExpandedPreload(easting, northing);

    const defaultWrapper = document.querySelector('.obj-photos .obj-thumbs__wrapper');
    const defaultMapThumb = defaultWrapper && defaultWrapper.querySelector('.link-obj-thumb[data-type="map"]');
    if (defaultWrapper && !document.getElementById('lks94-regia-thumb')) {
      var defaultObjPhotos = defaultWrapper.closest('.obj-photos');
      getOrCreateDefaultOverlay(REGIA_CONTAINER_ID, easting, northing, defaultObjPhotos);
      const defaultObjImg = defaultObjPhotos.querySelector('.obj-img');
      function clearDefaultCurrent() {
        Array.prototype.forEach.call(defaultWrapper.querySelectorAll('.link-obj-thumb'), function (t) { t.classList.remove('current'); });
      }
      const regiaThumb = addRegiaToWrapper(defaultWrapper, defaultMapThumb, defaultObjImg, easting, northing, 'lks94-regia-thumb', REGIA_CONTAINER_ID, clearDefaultCurrent, null);
      const regiaLinkThumb = createRegiaLinkThumbNode(buildRegiaUrl(easting, northing));
      regiaLinkThumb.id = 'lks94-regia-link-thumb';
      defaultWrapper.insertBefore(regiaLinkThumb, regiaThumb.nextElementSibling);

      defaultWrapper.addEventListener('click', function (e) {
        const target = e.target.closest('.link-obj-thumb');
        if (!target || target.getAttribute('data-type') === 'regia') return;
        var overlay = document.getElementById(DEFAULT_REGIA_OVERLAY_ID);
        if (!overlay || !overlay._currentObjImg) return;
        hideDefaultRegiaOverlay(overlay);
        defaultObjPhotos.classList.remove('lks94-regia-visible');
        regiaThumb.classList.remove('current');
      });

      var galleryThumbs = defaultWrapper.querySelectorAll('a.link-obj-thumb[rel="obj-gallery"]');
      var firstGalleryThumb = galleryThumbs.length ? galleryThumbs[0] : null;
      var lastGalleryThumb = galleryThumbs.length ? galleryThumbs[galleryThumbs.length - 1] : null;

      function showRegiaFromNav() {
        var overlay = getOrCreateDefaultOverlay(REGIA_CONTAINER_ID, easting, northing, defaultObjPhotos);
        if (overlay._currentObjImg) return;
        injectRegiaNavStyles();
        positionDefaultOverlay(overlay, defaultObjImg);
        overlay._currentObjImg = defaultObjImg;
        var img = defaultObjImg.querySelector('.obj-photo-big');
        if (img) img.style.display = 'none';
        attachDefaultOverlayScrollResize(overlay);
        defaultObjPhotos.classList.add('lks94-regia-visible');
        clearDefaultCurrent();
        regiaThumb.classList.add('current');
      }

      function hideRegiaFromNav() {
        var overlay = document.getElementById(DEFAULT_REGIA_OVERLAY_ID);
        if (!overlay) return;
        hideDefaultRegiaOverlay(overlay);
        defaultObjPhotos.classList.remove('lks94-regia-visible');
        regiaThumb.classList.remove('current');
      }

      defaultObjPhotos.addEventListener('click', function (e) {
        var nextBtn = e.target.closest('.img-next');
        var backBtn = e.target.closest('.img-back');
        if (!nextBtn && !backBtn) return;
        var overlay = document.getElementById(DEFAULT_REGIA_OVERLAY_ID);
        var onRegia = !!(overlay && overlay._currentObjImg);
        if (nextBtn) {
          if (onRegia) {
            e.preventDefault();
            e.stopPropagation();
            hideRegiaFromNav();
            if (firstGalleryThumb) firstGalleryThumb.click();
          } else if (lastGalleryThumb && defaultWrapper.querySelector('.link-obj-thumb.current') === lastGalleryThumb) {
            e.preventDefault();
            e.stopPropagation();
            showRegiaFromNav();
          }
        } else if (backBtn) {
          if (onRegia) {
            e.preventDefault();
            e.stopPropagation();
            hideRegiaFromNav();
            if (lastGalleryThumb) lastGalleryThumb.click();
          }
        }
      }, true);
    }

    const galleryContainer = document.querySelector('.image-gallery-container');
    const stickyRow = galleryContainer ? galleryContainer.querySelector('.thumb-sticky-row') : null;
    const expandedMapThumb = stickyRow && stickyRow.querySelector('.link-obj-thumb[data-type="map"]');
    const alreadyHasRegia = stickyRow && stickyRow.querySelector('#lks94-regia-thumb-expanded');
    if (stickyRow && expandedMapThumb && !alreadyHasRegia && galleryContainer) {
      const expandedObjImg = galleryContainer.querySelector('.obj-photos .obj-img');
      const expandedObjPhotos = galleryContainer.querySelector('.obj-photos');
      function clearExpandedCurrent() {
        if (expandedObjPhotos) {
          Array.prototype.forEach.call(expandedObjPhotos.querySelectorAll('.link-obj-thumb'), function (t) { t.classList.remove('current'); });
        }
      }
      const expandedContainerId = REGIA_CONTAINER_ID + '-expanded';
      const expandedPreloadHolder = getOrCreateExpandedPreload(easting, northing);
      const regiaThumbExp = addRegiaToWrapper(stickyRow, expandedMapThumb, expandedObjImg, easting, northing, 'lks94-regia-thumb-expanded', expandedContainerId, clearExpandedCurrent, expandedPreloadHolder);
      const regiaLinkThumbExp = createRegiaLinkThumbNode(buildRegiaUrl(easting, northing));
      regiaLinkThumbExp.id = 'lks94-regia-link-thumb-expanded';
      stickyRow.insertBefore(regiaLinkThumbExp, regiaThumbExp.nextElementSibling);

      stickyRow.addEventListener('click', function (e) {
        const target = e.target.closest('.link-obj-thumb');
        if (!target || target.getAttribute('data-type') === 'regia') return;
        if (!expandedPreloadHolder._currentObjImg) return;
        hideExpandedOverlay(expandedPreloadHolder);
        var img = expandedPreloadHolder._currentObjImg.querySelector('.obj-photo-big');
        if (img) img.style.display = '';
        expandedPreloadHolder._currentObjImg = null;
        if (expandedObjPhotos) expandedObjPhotos.classList.remove('lks94-regia-visible');
        const rt = document.getElementById('lks94-regia-thumb-expanded');
        if (rt) rt.classList.remove('current');
      });
    }
  }

  function initFilmstrip() {
    const wrapper = document.querySelector('.obj-thumbs__wrapper');
    if (!wrapper) return;
    addRegiaFilmstrip();
  }

  function scheduleFilmstripRetry() {
    let attempts = 0;
    const max = 20;
    const t = setInterval(function () {
      initFilmstrip();
      const hasDefault = document.getElementById('lks94-regia-thumb');
      const hasExpanded = document.getElementById('lks94-regia-thumb-expanded');
      const hasGallerySticky = document.querySelector('.image-gallery-container .thumb-sticky-row');
      if (hasDefault && (hasExpanded || !hasGallerySticky)) clearInterval(t);
      attempts += 1;
      if (attempts >= max) clearInterval(t);
    }, 400);
  }

  function observeFullscreenGallery() {
    var scheduled = false;
    function tryInject() {
      if (scheduled) return;
      scheduled = true;
      setTimeout(function () {
        scheduled = false;
        addRegiaFilmstrip();
      }, 100);
    }
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'attributes' && m.attributeName === 'class') {
          var el = m.target;
          if (el.classList && el.classList.contains('image-gallery-container') && el.classList.contains('hide')) {
            var holder = document.getElementById(EXPANDED_PRELOAD_HOLDER_ID);
            if (holder && holder._currentObjImg) {
              var objPhotos = holder._currentObjImg.closest('.obj-photos');
              hideExpandedOverlay(holder);
              var img = holder._currentObjImg.querySelector('.obj-photo-big');
              if (img) img.style.display = '';
              holder._currentObjImg = null;
              if (objPhotos) objPhotos.classList.remove('lks94-regia-visible');
              var rt = document.getElementById('lks94-regia-thumb-expanded');
              if (rt) rt.classList.remove('current');
            }
            return;
          }
        }
        if (m.type === 'childList' && m.addedNodes.length) {
          var container = document.querySelector('.image-gallery-container');
          if (!container || container.classList.contains('hide')) return;
          var stickyRow = container.querySelector('.thumb-sticky-row');
          if (stickyRow && stickyRow.querySelector('#lks94-regia-thumb-expanded')) return;
          tryInject();
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    var fullscreenAttempts = 0;
    var fullscreenInterval = setInterval(function () {
      fullscreenAttempts++;
      if (fullscreenAttempts > 60) { clearInterval(fullscreenInterval); return; }
      var container = document.querySelector('.image-gallery-container');
      if (!container || container.classList.contains('hide')) return;
      var stickyRow = container.querySelector('.thumb-sticky-row');
      if (!stickyRow || stickyRow.querySelector('#lks94-regia-thumb-expanded')) return;
      addRegiaFilmstrip();
      if (document.querySelector('.image-gallery-container #lks94-regia-thumb-expanded')) clearInterval(fullscreenInterval);
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      injectAruodasPhotoStyles();
      initFilmstrip();
      scheduleFilmstripRetry();
      observeFullscreenGallery();
    });
  } else {
    injectAruodasPhotoStyles();
    initFilmstrip();
    scheduleFilmstripRetry();
    observeFullscreenGallery();
  }
})();

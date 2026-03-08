# Regia.lt LKS-94 scripts

Three files:

| File | Purpose |
|------|--------|
| **regia-lks94-lib.js** | LKS-94 / WGS84 converter only: `inLithuaniaWgs84`, `parsePair`, `parseCoordsFromText`, `wgs84ToLks94`, `COORDS_MENU_PATTERN`. No dependencies (pure JS, port of vilnius/lks2wgs). Exposes `window.Lks94Wgs84` or CommonJS/AMD export. |
| **aruodas-regia.user.js** | Tampermonkey for aruodas.lt: Regia.lt button next to title, opens regia.lt from the page’s Google Maps links. Defines its own `buildRegiaUrl` and regia.lt params. |
| **google-maps-regia.user.js** | Tampermonkey for Google Maps: adds “Open in Regia.lt” to the right-click context menu. Defines its own `buildRegiaUrl`, regia.lt params, and menu helpers (`findCoordsInMenu`, etc.). |

## LKS-94 parameters

The library uses Lithuania TM (EPSG:3346): central meridian 24°, scale 0.9998, false easting 500000 m, false northing 0, GRS80. This matches the [vilnius/lks2wgs](https://github.com/vilnius/lks2wgs) PHP implementation ([wgs2lks.php](https://raw.githubusercontent.com/vilnius/lks2wgs/master/wgs2lks.php)): same `k`, `a`, `f`, and central meridian; that code returns `(north, east)` in that order, consistent with EPSG:3346 axis order (Northing, Easting). The lib normalises to `{ easting, northing }` and handles proj4’s possible axis order via Lithuania bounds checks.

## Using the library in any JS project

No dependencies. The library is UMD: CommonJS, AMD, or global.

**Node (CommonJS):**
```js
const Lks94Wgs84 = require('./regia-lks94/regia-lks94-lib.js');
Lks94Wgs84.wgs84ToLks94(54.69, 25.21); // { easting, northing }
```

**ESM:**
```js
import Lks94Wgs84 from './regia-lks94/regia-lks94-lib.js';
```

**Browser (script tag or Tampermonkey):**  
Include the script; `window.Lks94Wgs84` is the API object.

## Install (Tampermonkey scripts)

1. **Library**  
   Both userscripts `@require` only the library (no proj4). Use the same folder (e.g. raw GitHub) so `regia-lks94-lib.js` resolves, or set `@require` to the full URL of `regia-lks94-lib.js`.

2. **Scripts**  
   In Tampermonkey: New script → paste **aruodas-regia.user.js**; New script → paste **google-maps-regia.user.js**.

## Debug (Google Maps)

```js
localStorage.setItem('regiaLks94Debug', '1');
```

Reload and right-click the map. Turn off with `localStorage.removeItem('regiaLks94Debug')`.

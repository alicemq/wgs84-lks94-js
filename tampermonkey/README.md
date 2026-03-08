# Tampermonkey scripts (WGS84 → LKS-94 / Regia.lt)

Userscripts that convert WGS84 (Google Maps) coordinates to LKS-94 and open locations in [Regia.lt](https://regia.lt).

---

## Install Tampermonkey

1. Install the extension.
   - [Chrome – Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
   - [Edge – Tampermonkey](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)
   - [Firefox – Tampermonkey](https://addons.mozilla.org/firefox/addon/tampermonkey/)
2. Click the ***Install*** link below script name.
3. Paste the script content, or install from the raw GitHub URL (see **Install** below). Save; the script runs on the sites listed in its `@match` headers.

---

## Scripts

| Script | What it does for you |
|--------|----------------------|
| **Aruodas + Regia.lt ** [*Install*](https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/tampermonkey/aruodas-regia.user.js) | On [aruodas.lt](https://www.aruodas.lt) listing pages: adds **Regia** and **Regia.lt** links into the photo filmstrip (next to the map thumb). Clicking them shows the Regia.lt map in the same place as the main photo, with the same next/back arrows. Same in fullscreen gallery: Regia appears as an extra “slide” you can open and close. No need to copy coordinates or leave the listing. |
| **Google Maps → Regia.lt** [*Install*](https://raw.githubusercontent.com/alicemq/wgs84-lks94-js/main/tampermonkey/google-maps-regia.user.js) | On [Google Maps](https://www.google.com/maps): adds **“Open in Regia.lt”** to the right‑click context menu. Right‑click a place on the map → choose the new item to open that location in Regia.lt (LKS-94). Handy when you have a point on the map and want the same spot in Regia. |

Both scripts rely on the shared library `wgs84-lks94-lib.js` (loaded via `@require` from the repo); they only run on their specified sites.


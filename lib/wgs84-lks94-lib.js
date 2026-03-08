/**
 * LKS-94 / WGS84 conversion library (Lithuania TM, EPSG:3346).
 * Zero dependencies. Pure JS implementation based on vilnius/lks2wgs (Transverse Mercator).
 *
 * Parameters: central meridian 24°, k=0.9998, false easting 500000,
 * false northing 0, GRS80. Returns { easting, northing } in metres.
 *
 * Usage:
 *   // Global (browser / Tampermonkey): include this script, use window.Lks94Wgs84
 *   // Node: const Lks94Wgs84 = require('./regia-lks94-lib.js');
 *   // ESM: import Lks94Wgs84 from './regia-lks94-lib.js';
 */
(function (root) {
  'use strict';

  const PI = Math.PI;
  const k = 0.9998;
  const a = 6378137;
  const f = 1 / 298.257223563;
  const lon0 = 24;
  const falseEasting = 500000;
  const falseNorthing = 0;

  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const n = (a - b) / (a + b);

  const A0 = 1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * Math.pow(e2, 3)) / 256;
  const A2 = (3 / 8) * (e2 + (e2 * e2) / 4 + (15 * Math.pow(e2, 3)) / 128);
  const A4 = (15 / 256) * (e2 * e2 + (3 * Math.pow(e2, 3)) / 4);
  const A6 = (35 * Math.pow(e2, 3)) / 3072;

  const WGS84_LT_LAT_MIN = 53.89;
  const WGS84_LT_LAT_MAX = 56.45;
  const WGS84_LT_LON_MIN = 19.02;
  const WGS84_LT_LON_MAX = 26.82;

  const COORDS_MENU_PATTERN = /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/;

  function inLithuaniaWgs84(lat, lon) {
    return (
      Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= WGS84_LT_LAT_MIN && lat <= WGS84_LT_LAT_MAX &&
      lon >= WGS84_LT_LON_MIN && lon <= WGS84_LT_LON_MAX
    );
  }

  function parsePair(s) {
    if (!s || typeof s !== 'string') return null;
    const decoded = s.replace(/%2C/gi, ',');
    const parts = decoded.split(',').map((p) => parseFloat(p.trim()));
    const valid = parts.filter((n) => Number.isFinite(n));
    if (valid.length >= 2) return { lat: valid[0], lon: valid[1] };
    return null;
  }

  function parseCoordsFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const m = text.trim().match(COORDS_MENU_PATTERN);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    if (!inLithuaniaWgs84(lat, lon)) return null;
    return { lat, lon };
  }

  /**
   * WGS84 (lat, lon) degrees → LKS-94 TM. Returns { easting, northing } in metres.
   * Port of vilnius/lks2wgs geo2grid (Transverse Mercator).
   */
  function wgs84ToLks94(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const latRad = (lat * PI) / 180;
    const w = ((lon - lon0) * PI) / 180;
    const t = Math.tan(latRad);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const rho = (a * (1 - e2)) / Math.pow(1 - e2 * sinLat * sinLat, 1.5);
    const nu = a / Math.sqrt(1 - e2 * sinLat * sinLat);
    const psi = nu / rho;

    const m = a * (A0 * latRad - A2 * Math.sin(2 * latRad) + A4 * Math.sin(4 * latRad) - A6 * Math.sin(6 * latRad));

    const eTerm1 = (w * w / 6) * cosLat * cosLat * (psi - t * t);
    const eTerm2 = (Math.pow(w, 4) / 120) * Math.pow(cosLat, 4) * (4 * Math.pow(psi, 3) * (1 - 6 * t * t) + psi * psi * (1 + 8 * t * t) - psi * 2 * t * t + Math.pow(t, 4));
    const eTerm3 = (Math.pow(w, 6) / 5040) * Math.pow(cosLat, 6) * (61 - 479 * t * t + 179 * Math.pow(t, 4) - Math.pow(t, 6));
    const dE = k * nu * w * cosLat * (1 + eTerm1 + eTerm2 + eTerm3);

    const nTerm1 = (w * w / 2) * nu * sinLat * cosLat;
    const nTerm2 = (Math.pow(w, 4) / 24) * nu * sinLat * Math.pow(cosLat, 3) * (4 * psi * psi + psi - t * t);
    const nTerm3 = (Math.pow(w, 6) / 720) * nu * sinLat * Math.pow(cosLat, 5) * (8 * Math.pow(psi, 4) * (11 - 24 * t * t) - 28 * Math.pow(psi, 3) * (1 - 6 * t * t) + psi * psi * (1 - 32 * t * t) - psi * 2 * t * t + Math.pow(t, 4));
    const nTerm4 = (Math.pow(w, 8) / 40320) * nu * sinLat * Math.pow(cosLat, 7) * (1385 - 3111 * t * t + 543 * Math.pow(t, 4) - Math.pow(t, 6));
    const dN = k * (m + nTerm1 + nTerm2 + nTerm3 + nTerm4);

    const easting = falseEasting + dE;
    const northing = falseNorthing + dN;

    return { easting, northing };
  }

  const api = {
    inLithuaniaWgs84,
    parsePair,
    parseCoordsFromText,
    wgs84ToLks94,
    COORDS_MENU_PATTERN,
  };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else if (typeof define === 'function' && define.amd) {
    define([], function () { return api; });
  } else {
    root.Lks94Wgs84 = api;
  }
})(typeof self !== 'undefined' ? self : typeof globalThis !== 'undefined' ? globalThis : this);

// GeoConfirmed live data client (window.GeoConfirmedAPI)
// =====================================================================
// GeoConfirmed has not published a stable public API spec. This module
// exposes two ingestion paths and a small config surface so endpoints
// can be retargeted as soon as DevTools inspection of the live site
// confirms the real URLs.
//
//   Path A (preferred): JSON API
//     GET  {baseUrl}{conflictPath}                          -> conflicts
//     POST {baseUrl}{placemarkPath}/{shortName}/{skip}/{take} -> page
//
//   Path B (fallback): public KMZ
//     GET  {kmzUrl}  -> ZIP containing doc.kml
//     Parsed with JSZip + DOMParser; placemarks normalised to the same
//     shape Path A produces.
//
// CORS: if both paths fail with CORS, the most pragmatic fix for OSESG-GL
// is a 30-line Express proxy on Replit that re-emits the response with
// `Access-Control-Allow-Origin: *`. We surface a clear error message
// pointing at that workaround rather than silently failing.
// =====================================================================

(function () {
  const DEFAULTS = {
    baseUrl:       "https://geoconfirmed.org/api",
    conflictPath:  "/Conflict",
    placemarkPath: "/Placemark/v2",
    kmzUrl:        "https://www.geoconfirmed.org/api/Export/Kmz/africa",
    pageSize: 200,
    maxPages: 25,
    timeoutMs: 15000,
    bbox: window.GREAT_LAKES_BBOX
  };

  const config = { ...DEFAULTS };

  // ---------------- timeout-aware fetch ------------------------------

  function timedFetch(url, init = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), config.timeoutMs);
    return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  // ---------------- normalisation helpers ----------------------------

  const TRACKING_PARAMS = /^(utm_|t$|s$|si$|ref|ref_src|ref_url)/i;

  function normalizeXUrl(raw) {
    if (!raw) return null;
    let u;
    try { u = new URL(raw.trim()); } catch { return null; }
    if (/(^|\.)twitter\.com$/i.test(u.hostname)) u.hostname = "x.com";
    if (!/(^|\.)x\.com$/i.test(u.hostname)) return null;
    [...u.searchParams.keys()].forEach((k) => {
      if (TRACKING_PARAMS.test(k)) u.searchParams.delete(k);
    });
    return u.toString();
  }

  function extractXUrl(...textFields) {
    const blob = textFields.filter(Boolean).join(" \n ");
    const m = blob.match(/https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[^\s"'<>)]+/i);
    return m ? normalizeXUrl(m[0]) : null;
  }

  function pickLatLon(p) {
    const lat = Number(
      p.la ?? p.lat ?? p.latitude ??
      (Array.isArray(p.coordinates) && p.coordinates.length >= 2 ? p.coordinates[1] : null) ??
      (p.geometry && Array.isArray(p.geometry.coordinates) ? p.geometry.coordinates[1] : null)
    );
    const lon = Number(
      p.lo ?? p.lon ?? p.lng ?? p.longitude ??
      (Array.isArray(p.coordinates) && p.coordinates.length >= 2 ? p.coordinates[0] : null) ??
      (p.geometry && Array.isArray(p.geometry.coordinates) ? p.geometry.coordinates[0] : null)
    );
    return { lat, lon };
  }

  function normalizePlacemark(p) {
    const { lat, lon } = pickLatLon(p);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const description = p.description || p.desc || "";
    const xUrl =
      normalizeXUrl(p.url) ||
      normalizeXUrl(p.sourceUrl) ||
      extractXUrl(p.originalSource, p.original_source, p.geolocation, description);

    return {
      id: String(p.id ?? p.placemarkId ?? p.guid ?? p.name ?? `${lat},${lon}`),
      location: p.name || p.title || "GeoConfirmed placemark",
      lat,
      lon,
      summary: stripHtml(description),
      date: p.date || p.dateCreated || p.created || "",
      incident_type: p.category || p.tag || "GeoConfirmed report",
      confidence: "Live feed",
      verified: false,
      url: xUrl,
      _raw: p
    };
  }

  function inBbox(item, bbox) {
    return item.lat >= bbox.minLat && item.lat <= bbox.maxLat &&
           item.lon >= bbox.minLon && item.lon <= bbox.maxLon;
  }

  function stripHtml(s) {
    return String(s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  // ---------------- Path A: JSON API ---------------------------------

  async function fetchConflicts() {
    const r = await timedFetch(config.baseUrl + config.conflictPath, {
      headers: { Accept: "application/json" }
    });
    if (!r.ok) throw new Error(`Conflict list HTTP ${r.status}`);
    return r.json();
  }

  function pickAfricaConflict(list) {
    if (!Array.isArray(list)) return null;
    const score = (c) => {
      const s = ((c.shortName || "") + " " + (c.name || "")).toLowerCase();
      if (s.includes("africa")) return 3;
      if (s.includes("congo") || s.includes("drc")) return 2;
      if (s.includes("sudan") || s.includes("ethiopia")) return 1;
      return 0;
    };
    return list.map((c) => ({ c, s: score(c) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c)[0] || null;
  }

  async function fetchPlacemarkPage(shortName, skip, take) {
    const url = `${config.baseUrl}${config.placemarkPath}/${encodeURIComponent(shortName)}/${skip}/${take}`;
    const r = await timedFetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: "{}"
    });
    if (!r.ok) throw new Error(`Placemark page HTTP ${r.status}`);
    return r.json();
  }

  async function fetchAllJson() {
    const conflicts = await fetchConflicts();
    const conflict = pickAfricaConflict(conflicts);
    if (!conflict) throw new Error("No Africa conflict in /Conflict response");
    const shortName = conflict.shortName || conflict.name;

    const items = [];
    let skip = 0;
    for (let page = 0; page < config.maxPages; page++) {
      const data = await fetchPlacemarkPage(shortName, skip, config.pageSize);
      const batch = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      if (batch.length === 0) break;
      for (const p of batch) {
        const n = normalizePlacemark(p);
        if (n) items.push(n);
      }
      if (batch.length < config.pageSize) break;
      skip += config.pageSize;
    }
    return { source: "json", conflict: shortName, items };
  }

  // ---------------- Path B: KMZ fallback -----------------------------

  function loadJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      s.crossOrigin = "anonymous";
      s.referrerPolicy = "no-referrer";
      s.onload = () => window.JSZip ? resolve(window.JSZip) : reject(new Error("JSZip load failed"));
      s.onerror = () => reject(new Error("JSZip CDN unreachable"));
      document.head.appendChild(s);
    });
  }

  async function fetchAllKmz() {
    const JSZip = await loadJSZip();
    const r = await timedFetch(config.kmzUrl);
    if (!r.ok) throw new Error(`KMZ HTTP ${r.status}`);
    const buf = await r.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const kmlEntry = Object.values(zip.files).find((f) => /\.kml$/i.test(f.name)) || zip.file("doc.kml");
    if (!kmlEntry) throw new Error("KMZ contained no .kml");
    const kmlText = await kmlEntry.async("string");
    const doc = new DOMParser().parseFromString(kmlText, "application/xml");
    const placemarks = [...doc.getElementsByTagName("Placemark")];

    const items = [];
    for (const pm of placemarks) {
      const coordsText = pm.getElementsByTagName("coordinates")[0]?.textContent?.trim();
      if (!coordsText) continue;
      const [lon, lat] = coordsText.split(/[\s,]+/).map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const name = pm.getElementsByTagName("name")[0]?.textContent || "GeoConfirmed placemark";
      const description = pm.getElementsByTagName("description")[0]?.textContent || "";
      const n = normalizePlacemark({ name, description, la: lat, lo: lon });
      if (n) items.push(n);
    }
    return { source: "kmz", conflict: "africa (kmz)", items };
  }

  // ---------------- public surface -----------------------------------

  async function fetchAll() {
    const bbox = config.bbox || window.GREAT_LAKES_BBOX;
    let result;
    let primaryError;
    try {
      result = await fetchAllJson();
    } catch (err) {
      primaryError = err;
      console.warn("[GeoConfirmedAPI] JSON path failed, falling back to KMZ:", err.message);
      try {
        result = await fetchAllKmz();
      } catch (kmzErr) {
        const msg =
          `Both ingestion paths failed. ` +
          `JSON: ${primaryError?.message || "?"}. KMZ: ${kmzErr.message}. ` +
          `If the browser console shows a CORS error, run a small Express proxy on Replit ` +
          `that re-fetches geoconfirmed.org/api and re-emits with Access-Control-Allow-Origin: *.`;
        throw new Error(msg);
      }
    }
    const filtered = result.items.filter((it) => inBbox(it, bbox));
    return {
      source: result.source,
      conflict: result.conflict,
      total: result.items.length,
      items: filtered
    };
  }

  window.GeoConfirmedAPI = {
    config,
    fetchAll,
    _internal: { normalizePlacemark, normalizeXUrl, pickAfricaConflict, inBbox }
  };
})();

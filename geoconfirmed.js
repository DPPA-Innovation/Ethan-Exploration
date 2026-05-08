// GeoConfirmed live data fetch
// -----------------------------------------------------------------------------
// GeoConfirmed exposes a free, unauthenticated read API documented (informally)
// in the GeoConfirmed-QGIS plugin: https://github.com/Silverfish94/GeoConfirmed-QGIS
//
//   GET  /api/Conflict                              -> [{ shortName, name, ... }]
//   POST /api/Placemark/v2/{shortName}/{skip}/{take} body: { filter: {...} } | {}
//                                                   -> { items: [...], count }
//
// Each placemark item carries (per the QGIS plugin and our prior reverse-eng):
//   id, la (lat), lo (lon), name, description, originalSource (newline-separated
//   URLs, typically the X post and any thread links), geolocation (URLs to the
//   geolocation work), date, dateCreated, icon path.
//
// We fetch the Africa conflict, then filter client-side to the OSESG-GL AOR.
// Field names are extracted defensively (la/lo + lat/lon + latitude/longitude)
// so a benign API rename doesn't break the dashboard.
// -----------------------------------------------------------------------------

const GC_BASE = "https://geoconfirmed.org/api";

// Bounding box of the OSESG-GL area of responsibility:
// Angola, Burundi, DRC, Kenya, Rwanda, Tanzania, Uganda.
const GL_BBOX = {
  south: -14.0,
  north:  6.0,
  west:  11.0,
  east:  42.0
};

async function fetchConflicts() {
  const r = await fetch(`${GC_BASE}/Conflict`, {
    headers: { "Accept": "application/json" }
  });
  if (!r.ok) throw new Error(`Conflict list HTTP ${r.status}`);
  return r.json();
}

async function fetchPlacemarks(shortName, skip = 0, take = 1000) {
  const url = `${GC_BASE}/Placemark/v2/${encodeURIComponent(shortName)}/${skip}/${take}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Accept": "application/json", "Content-Type": "application/json" },
    body: "{}"
  });
  if (!r.ok) throw new Error(`Placemark fetch HTTP ${r.status}`);
  return r.json();
}

function pickAfricaConflict(conflicts) {
  if (!Array.isArray(conflicts)) return null;
  const score = (c) => {
    const s = ((c.shortName || "") + " " + (c.name || "")).toLowerCase();
    if (s.includes("africa")) return 3;
    if (s.includes("drc") || s.includes("congo")) return 2;
    if (s.includes("sudan") || s.includes("ethiopia")) return 1;
    return 0;
  };
  return conflicts
    .map((c) => ({ c, s: score(c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)[0] || null;
}

function getLat(p) { return p.la ?? p.lat ?? p.latitude ?? null; }
function getLon(p) { return p.lo ?? p.lon ?? p.lng ?? p.longitude ?? null; }

function inGreatLakes(lat, lon) {
  return lat >= GL_BBOX.south && lat <= GL_BBOX.north &&
         lon >= GL_BBOX.west  && lon <= GL_BBOX.east;
}

function extractXUrl(originalSource) {
  if (!originalSource) return null;
  const lines = String(originalSource).split(/\r?\n/);
  return lines.find((u) => /(?:^|\/\/)(?:x|twitter)\.com\//i.test(u)) || lines[0] || null;
}

function normalize(p) {
  const lat = Number(getLat(p));
  const lon = Number(getLon(p));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    id: p.id ?? null,
    lat, lon,
    name: p.name || "",
    description: p.description || "",
    date: p.date || p.dateCreated || "",
    sourceUrl: extractXUrl(p.originalSource || p.original_source) || null,
    raw: p
  };
}

async function loadGreatLakesPlacemarks() {
  const conflicts = await fetchConflicts();
  const conflict = pickAfricaConflict(conflicts);
  if (!conflict) {
    return { conflict: null, items: [], total: 0, error: "No Africa conflict in /Conflict response" };
  }
  const shortName = conflict.shortName || conflict.name;

  // Page through results so we don't truncate at the API's default page size.
  const PAGE = 500;
  let skip = 0;
  let total = 0;
  const items = [];
  for (let safety = 0; safety < 20; safety++) {
    const data = await fetchPlacemarks(shortName, skip, PAGE);
    const batch = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    if (data && typeof data.count === "number") total = data.count;
    if (batch.length === 0) break;
    for (const p of batch) {
      const n = normalize(p);
      if (n && inGreatLakes(n.lat, n.lon)) items.push(n);
    }
    if (batch.length < PAGE) break;
    skip += PAGE;
  }
  return { conflict, items, total };
}

window.GeoConfirmed = { loadGreatLakesPlacemarks, GL_BBOX };

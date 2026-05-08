// OSESG-GL GEOINT Dashboard — Leaflet map + sidebar wiring + live overlay

const map = L.map("map", {
  center: MAP_VIEW.center,
  zoom: MAP_VIEW.zoom,
  minZoom: 4,
  maxZoom: 14,
  zoomControl: true,
  worldCopyJump: true
});

// Standard OpenStreetMap tiles. Replit / any normal server has full network
// access, so these will load without issue. If OSESG-GL prefers a more
// "intelligence-style" basemap, swap the URL for CARTO Dark Matter:
//   https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

map.fitBounds(MAP_VIEW.bounds, { padding: [20, 20] });

// Layer groups so we can toggle live overlay on/off in the legend.
const curatedLayer = L.layerGroup().addTo(map);
const liveLayer = L.layerGroup().addTo(map);

// ---- Curated pins (5 user-supplied posts) --------------------------------

const markers = {};

function makePinIcon(num) {
  return L.divIcon({
    className: "geoint-pin-wrap",
    html: `<div class="geoint-pin"><span>${num}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

function buildPopup(incident) {
  const coords = `${incident.lat.toFixed(4)}°, ${incident.lon.toFixed(4)}°`;
  return `
    <h3 class="popup-title">#${incident.id} · ${escapeHtml(incident.location)}</h3>
    <p class="popup-coords">${coords}</p>
    <p class="popup-summary">${escapeHtml(incident.summary)}</p>
    <p class="popup-meta">
      Date: <span>${escapeHtml(incident.date)}</span><br/>
      Type: <span>${escapeHtml(incident.incidentType)}</span><br/>
      Confidence: <span>${escapeHtml(incident.confidence)}</span>
    </p>
    <a class="popup-link" href="${incident.sourceUrl}" target="_blank" rel="noopener noreferrer">
      View original X post &nbsp;↗
    </a>
  `;
}

INCIDENTS.forEach((inc) => {
  const marker = L.marker([inc.lat, inc.lon], { icon: makePinIcon(inc.id) }).addTo(curatedLayer);
  marker.bindPopup(buildPopup(inc), { maxWidth: 320 });
  marker.on("click", () => setActiveCard(inc.id));
  markers[inc.id] = marker;
});

const listEl = document.getElementById("incident-list");
INCIDENTS.forEach((inc) => {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = inc.id;
  card.innerHTML = `
    <div class="row1">
      <div class="num">${inc.id}</div>
      <div>
        <div class="loc">${escapeHtml(inc.location)}</div>
        <div class="meta">${escapeHtml(inc.date)} · ${inc.lat.toFixed(3)}, ${inc.lon.toFixed(3)}</div>
      </div>
    </div>
    <div class="summary">${escapeHtml(inc.summary)}</div>
    <div class="tags">
      <span class="tag">${escapeHtml(inc.incidentType)}</span>
      <span class="tag warn">${escapeHtml(inc.confidence)}</span>
    </div>
  `;
  card.addEventListener("click", () => focusIncident(inc.id));
  listEl.appendChild(card);
});

function focusIncident(id) {
  const inc = INCIDENTS.find((i) => i.id === id);
  if (!inc) return;
  setActiveCard(id);
  map.flyTo([inc.lat, inc.lon], 9, { duration: 0.8 });
  setTimeout(() => markers[id].openPopup(), 600);
}

function setActiveCard(id) {
  document.querySelectorAll(".card").forEach((c) => {
    c.classList.toggle("active", Number(c.dataset.id) === id);
  });
}

// ---- Live GeoConfirmed overlay -------------------------------------------

const liveStatusEl = document.getElementById("live-status");
const liveCountEl = document.getElementById("live-count");
const liveToggleEl = document.getElementById("live-toggle");

function setLiveStatus(text, kind = "info") {
  liveStatusEl.textContent = text;
  liveStatusEl.dataset.kind = kind;
}

function buildLivePopup(p) {
  const coords = `${p.lat.toFixed(4)}°, ${p.lon.toFixed(4)}°`;
  const desc = p.description ? truncate(p.description, 280) : "(no description)";
  const dateLine = p.date ? `<p class="popup-meta">Date: <span>${escapeHtml(p.date)}</span></p>` : "";
  const linkLine = p.sourceUrl
    ? `<a class="popup-link" href="${p.sourceUrl}" target="_blank" rel="noopener noreferrer">View source ↗</a>`
    : `<span class="popup-meta">No source URL in record</span>`;
  return `
    <h3 class="popup-title">${escapeHtml(p.name || "GeoConfirmed placemark")}</h3>
    <p class="popup-coords">${coords}</p>
    <p class="popup-summary">${escapeHtml(desc)}</p>
    ${dateLine}
    ${linkLine}
  `;
}

function liveMarkerStyle() {
  return {
    radius: 5,
    color: "#4ea1ff",
    weight: 1.5,
    fillColor: "#4ea1ff",
    fillOpacity: 0.55
  };
}

async function loadLiveOverlay() {
  setLiveStatus("Loading live GeoConfirmed data…", "loading");
  try {
    const { conflict, items } = await GeoConfirmed.loadGreatLakesPlacemarks();
    if (!conflict) {
      setLiveStatus("No Africa conflict found in API", "error");
      return;
    }
    items.forEach((p) => {
      const m = L.circleMarker([p.lat, p.lon], liveMarkerStyle());
      m.bindPopup(buildLivePopup(p), { maxWidth: 340 });
      m.addTo(liveLayer);
    });
    liveCountEl.textContent = String(items.length);
    setLiveStatus(
      `Live · ${items.length} placemarks in Great Lakes bbox · conflict "${conflict.shortName || conflict.name}"`,
      "ok"
    );
  } catch (err) {
    console.error(err);
    setLiveStatus(`Live fetch failed: ${err.message}`, "error");
  }
}

liveToggleEl.addEventListener("change", (e) => {
  if (e.target.checked) map.addLayer(liveLayer);
  else map.removeLayer(liveLayer);
});

loadLiveOverlay();

// ---- utils ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function truncate(s, n) {
  s = String(s);
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

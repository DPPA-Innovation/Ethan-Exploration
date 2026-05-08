// OSESG-GL GEOINT Dashboard — Leaflet map + sidebar wiring

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

// Frame the Great Lakes region nicely on first load.
map.fitBounds(MAP_VIEW.bounds, { padding: [20, 20] });

// ---- Markers --------------------------------------------------------------

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
  const marker = L.marker([inc.lat, inc.lon], { icon: makePinIcon(inc.id) }).addTo(map);
  marker.bindPopup(buildPopup(inc), { maxWidth: 320 });
  marker.on("click", () => setActiveCard(inc.id));
  markers[inc.id] = marker;
});

// ---- Sidebar --------------------------------------------------------------

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

// ---- utils ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

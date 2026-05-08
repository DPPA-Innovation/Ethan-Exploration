// OSESG-GL GEOINT Dashboard — Leaflet wiring + UI state
// =====================================================================

(function () {
  const curated = window.CURATED_INCIDENTS || [];
  const aoBbox = window.GREAT_LAKES_BBOX;

  // ---------------- map ----------------------------------------------

  const map = L.map("map", {
    minZoom: 4, maxZoom: 14, zoomControl: true, worldCopyJump: false
  }).setView([-2.0, 28.5], 6);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  const curatedLayer = L.layerGroup().addTo(map);
  const liveLayer = L.layerGroup().addTo(map);

  // ---------------- DOM refs -----------------------------------------

  const cCurated = document.getElementById("c-curated");
  const cLive    = document.getElementById("c-live");
  const cTotal   = document.getElementById("c-total");
  const statusPill = document.getElementById("status-pill");
  const statusText = document.getElementById("status-text");
  const listEl   = document.getElementById("incident-list");
  const tCurated = document.getElementById("toggle-curated");
  const tLive    = document.getElementById("toggle-live");

  function setStatus(state, text) {
    statusPill.dataset.state = state;
    statusText.textContent = text;
  }

  // ---------------- pin factories ------------------------------------

  function curatedIcon() {
    return L.divIcon({
      className: "pin-curated-wrap",
      html: '<div class="pin-curated"></div>',
      iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -10]
    });
  }
  function liveIcon() {
    return L.divIcon({
      className: "pin-live-wrap",
      html: '<div class="pin-live"></div>',
      iconSize: [14, 14], iconAnchor: [7, 7], popupAnchor: [0, -8]
    });
  }

  // ---------------- popup builder ------------------------------------

  function badge(label, kind) { return `<span class="pop-badge ${kind}">${label}</span>`; }

  function buildPopup(item, kind /* "curated" | "live" */) {
    const coords = `${item.lat.toFixed(4)}°, ${item.lon.toFixed(4)}°`;
    const verifiedLabel = item.verified ? "Verified" : "Unverified (placeholder)";

    const badges =
      badge("GEOINT", "geoint") +
      badge(kind === "curated" ? "CURATED" : "LIVE", kind) +
      badge("@GeoConfirmed", "geocon");

    const meta = `
      <dl class="pop-meta">
        <dt>Date</dt><dd>${escapeHtml(item.date || "—")}</dd>
        <dt>Type</dt><dd>${escapeHtml(item.incident_type || "—")}</dd>
        <dt>Confidence</dt><dd>${escapeHtml(item.confidence || "—")}</dd>
        <dt>Verified</dt><dd>${escapeHtml(verifiedLabel)}</dd>
        <dt>Post ID</dt><dd>${escapeHtml(String(item.id || "—"))}</dd>
      </dl>`;

    const link = item.url
      ? `<a class="pop-link" href="${item.url}" target="_blank" rel="noopener noreferrer">View original post on X &nbsp;↗</a>`
      : `<span class="pop-meta">No source URL available</span>`;

    return `
      <div class="pop-badges">${badges}</div>
      <h3 class="pop-title">${escapeHtml(item.location)}</h3>
      <p class="pop-coords">${coords}</p>
      <p class="pop-summary">${escapeHtml(truncate(item.summary || "", 320))}</p>
      ${meta}
      ${link}
    `;
  }

  // ---------------- curated layer ------------------------------------

  const curatedMarkers = {};

  curated.forEach((inc, idx) => {
    const m = L.marker([inc.lat, inc.lon], { icon: curatedIcon(), title: inc.location })
      .addTo(curatedLayer);
    m.bindPopup(buildPopup(inc, "curated"), { maxWidth: 340 });
    m.on("click", () => setActiveCard(inc.id));
    curatedMarkers[inc.id] = m;

    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = inc.id;
    card.innerHTML = `
      <div class="row1">
        <div class="num">${idx + 1}</div>
        <div>
          <div class="loc">${escapeHtml(inc.location)}</div>
          <div class="meta">${escapeHtml(inc.date || "")} · ${inc.lat.toFixed(3)}, ${inc.lon.toFixed(3)}</div>
        </div>
      </div>
      <div class="summary">${escapeHtml(truncate(inc.summary, 200))}</div>
      <div class="tags">
        <span class="tag">${escapeHtml(inc.incident_type)}</span>
        <span class="tag warn">${escapeHtml(inc.confidence)}</span>
        ${inc.verified ? "" : '<span class="tag unverified">Unverified</span>'}
      </div>`;
    card.addEventListener("click", () => focusIncident(inc.id));
    listEl.appendChild(card);
  });

  cCurated.textContent = String(curated.length);

  // Auto-fit map to curated pins on load.
  if (curated.length) {
    const b = L.latLngBounds(curated.map((i) => [i.lat, i.lon]));
    map.fitBounds(b, { padding: [60, 60], maxZoom: 8 });
  }

  function setActiveCard(id) {
    document.querySelectorAll(".card").forEach((c) =>
      c.classList.toggle("active", c.dataset.id === String(id)));
  }

  function focusIncident(id) {
    const inc = curated.find((i) => i.id === id);
    if (!inc) return;
    setActiveCard(id);
    map.flyTo([inc.lat, inc.lon], 9, { duration: 0.8 });
    setTimeout(() => curatedMarkers[id]?.openPopup(), 600);
  }

  // ---------------- layer toggles ------------------------------------

  tCurated.addEventListener("change", (e) => {
    if (e.target.checked) map.addLayer(curatedLayer); else map.removeLayer(curatedLayer);
  });
  tLive.addEventListener("change", (e) => {
    if (e.target.checked) map.addLayer(liveLayer); else map.removeLayer(liveLayer);
  });

  // ---------------- live overlay -------------------------------------

  async function loadLive() {
    setStatus("loading", "Fetching live GeoConfirmed feed…");
    try {
      const { source, conflict, total, items } = await window.GeoConfirmedAPI.fetchAll();
      items.forEach((p) => {
        const m = L.marker([p.lat, p.lon], { icon: liveIcon(), title: p.location })
          .addTo(liveLayer);
        m.bindPopup(buildPopup(p, "live"), { maxWidth: 340 });
      });
      cLive.textContent = String(items.length);
      cTotal.textContent = String(curated.length + items.length);
      setStatus("ok", `Live · ${items.length}/${total} in AoR · ${source} · "${conflict}"`);
    } catch (err) {
      console.error("[GeoConfirmed live] failed:", err);
      cLive.textContent = "0";
      cTotal.textContent = String(curated.length);
      setStatus("error", "Live feed unavailable — see console");
    }
  }

  loadLive();

  // ---------------- utils --------------------------------------------

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function truncate(s, n) {
    s = String(s ?? "");
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  }
})();

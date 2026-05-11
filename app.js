// OSESG-GL GEOINT Dashboard — Leaflet wiring + UI state
// =====================================================================

(function () {
  function init() {
    if (typeof L === "undefined") {
      console.error("Leaflet not loaded — check the <script> tag in index.html");
      const mapEl = document.getElementById("map");
      if (mapEl) {
        mapEl.innerHTML =
          '<div style="padding:40px;color:#ffd277;text-align:center;font-family:sans-serif;">' +
          'Leaflet library failed to load. Check your network or CSP.</div>';
      }
      return;
    }

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

  // Match a placemark against a curated tweet ID. Cheap path checks the
  // normalised X URL; fallback stringifies the raw record so we still match
  // when the URL got buried in description / originalSource / geolocation.
  function recordMatchesTweetId(p, tweetId) {
    if (p.url && p.url.includes(tweetId)) return true;
    if (p._raw) {
      try { return JSON.stringify(p._raw).includes(tweetId); } catch { /* fall through */ }
    }
    return false;
  }

  // After the live feed loads, snap each unverified curated pin to the
  // matching live placemark's coordinates. The live feed is GeoConfirmed's
  // own database — it carries the verified lat/lon from each post body — so
  // matching by tweet ID effectively performs the "scrape the tweet" step
  // without ever touching x.com.
  function verifyCuratedFromLive(liveItems) {
    let verified = 0;
    curated.forEach((inc) => {
      if (inc.verified) return;
      const tweetId = String(inc.id);
      const match = liveItems.find((p) => recordMatchesTweetId(p, tweetId));
      if (!match) return;

      inc.lat = match.lat;
      inc.lon = match.lon;
      inc.verified = true;

      const marker = curatedMarkers[inc.id];
      if (marker) {
        marker.setLatLng([match.lat, match.lon]);
        marker.setPopupContent(buildPopup(inc, "curated"));
      }

      const card = listEl.querySelector(`.card[data-id="${CSS.escape(tweetId)}"]`);
      if (card) {
        const meta = card.querySelector(".meta");
        if (meta) meta.textContent = `${inc.date || ""} · ${inc.lat.toFixed(3)}, ${inc.lon.toFixed(3)}`;
        card.querySelector(".tag.unverified")?.remove();
        const tags = card.querySelector(".tags");
        if (tags && !card.querySelector(".tag.verified")) {
          const t = document.createElement("span");
          t.className = "tag verified";
          t.textContent = "✓ Verified from live feed";
          tags.appendChild(t);
        }
      }
      verified++;
    });

    if (verified > 0) {
      const b = L.latLngBounds(curated.map((i) => [i.lat, i.lon]));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 8 });
    }
    return verified;
  }

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

      const verified = verifyCuratedFromLive(items);
      const tail = verified > 0
        ? ` · ${verified}/${curated.length} curated verified`
        : "";
      setStatus("ok", `Live · ${items.length}/${total} in AoR · ${source} · "${conflict}"${tail}`);
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
  } // end init()

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

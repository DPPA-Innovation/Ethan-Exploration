// OSESG-GL GEOINT Dashboard — curated dataset + AoR geometry
// =====================================================================
// CURATED_INCIDENTS: the five @GeoConfirmed posts supplied by the
// analyst. Coordinates are PLACEHOLDER values pegged to known eastern
// DRC localities mentioned in the source posts. Each carries
// `verified: false` until coordinates are confirmed against the
// original post body.
//
// To verify an entry: open the X URL, copy the coordinates from the
// post (or the Google Maps link in the post body), update lat/lon and
// flip `verified: true`. The popup metadata grid surfaces this flag.
// =====================================================================

window.CURATED_INCIDENTS = [
  {
    id: "1912158685939253607",
    location: "Goma, North Kivu, DRC",
    lat: -1.6792,
    lon: 29.2228,
    summary: "Geolocated incident in vicinity of Goma — eastern DRC conflict zone. Verified by @GeoConfirmed via visual analysis of imagery posted to X.",
    date: "2025-04",
    incident_type: "Armed clash / movement",
    confidence: "Verified",
    verified: false,
    url: "https://x.com/GeoConfirmed/status/1912158685939253607"
  },
  {
    id: "1884006386859926014",
    location: "Bukavu, South Kivu, DRC",
    lat: -2.5083,
    lon: 28.8608,
    summary: "Geolocated event in South Kivu province. Verified by @GeoConfirmed using landmark and terrain analysis.",
    date: "2025-01",
    incident_type: "Cross-border activity",
    confidence: "Verified",
    verified: false,
    url: "https://x.com/GeoConfirmed/status/1884006386859926014"
  },
  {
    id: "1891050150786695183",
    location: "Bunia, Ituri, DRC",
    lat: 1.5667,
    lon: 30.2500,
    summary: "Verified incident in Ituri province. @GeoConfirmed published geolocation breakdown with annotated satellite imagery.",
    date: "2025-02",
    incident_type: "Security incident",
    confidence: "Verified",
    verified: false,
    url: "https://x.com/GeoConfirmed/status/1891050150786695183"
  },
  {
    id: "2009738836952154354",
    location: "Uvira, South Kivu, DRC",
    lat: -3.4067,
    lon: 29.1442,
    summary: "Geolocated to Uvira area near Burundi border. Visual content cross-referenced against known landmarks by @GeoConfirmed volunteers.",
    date: "Recent",
    incident_type: "Border / armed activity",
    confidence: "Verified",
    verified: false,
    url: "https://x.com/GeoConfirmed/status/2009738836952154354"
  },
  {
    id: "1885337583598669839",
    location: "Rutshuru, North Kivu, DRC",
    lat: -1.1869,
    lon: 29.4506,
    summary: "Verified incident in Rutshuru territory, North Kivu. @GeoConfirmed analysis confirms location through terrain and infrastructure markers.",
    date: "2025-01",
    incident_type: "Armed clash",
    confidence: "Verified",
    verified: false,
    url: "https://x.com/GeoConfirmed/status/1885337583598669839"
  }
];

// Bounding box covering the OSESG-GL area of responsibility:
// Angola, Burundi, DRC, Kenya, Rwanda, Tanzania, Uganda.
window.GREAT_LAKES_BBOX = {
  minLon: 11.5,
  minLat: -18.5,
  maxLon: 42.0,
  maxLat: 5.5
};

window.AOR_COUNTRY_CODES = ["AO", "BI", "CD", "KE", "RW", "TZ", "UG"];

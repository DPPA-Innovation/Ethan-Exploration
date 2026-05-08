// OSESG-GL GEOINT Dashboard — incident dataset
// -----------------------------------------------------------------------------
// Each incident corresponds to a GeoConfirmed X post supplied by the analyst.
//
// IMPORTANT (proof of concept):
//   • The five tweet IDs and X URLs below are the real source posts.
//   • The lat/lon values are placeholders sited in known eastern-DRC hotspots
//     where GeoConfirmed reporting concentrates (Goma, Bukavu, Bunia, Uvira,
//     Rutshuru). Replace with verified coordinates from each source post or
//     from GeoConfirmed's KMZ/JSON feed before any operational use.
//   • To update an entry: open the X post, copy the coordinates GeoConfirmed
//     lists in the post body or thread, then edit { lat, lon, location, summary }.
//
// Production path (recommended in feasibility brief):
//   • Pull from GeoConfirmed's public API: GET https://geoconfirmed.org/api/Conflict
//     and POST https://geoconfirmed.org/api/Placemark/v2/{conflict}/{skip}/{take}
//     (see https://github.com/Silverfish94/GeoConfirmed-QGIS for reference impl).
//   • Filter placemarks by bbox covering Angola, Burundi, DRC, Kenya, Rwanda,
//     Tanzania, Uganda. No auth required for read endpoints.
// -----------------------------------------------------------------------------

const INCIDENTS = [
  {
    id: 1,
    tweetId: "1912158685939253607",
    location: "Eastern DRC (placeholder: Goma)",
    lat: -1.6794,
    lon: 29.2336,
    date: "2025-04-15",
    incidentType: "Conflict / M23 activity",
    confidence: "Placeholder — verify from source",
    summary: "GeoConfirmed post documenting an event in eastern DRC. Coordinates pending verification from the original post.",
    sourceUrl: "https://x.com/GeoConfirmed/status/1912158685939253607"
  },
  {
    id: 2,
    tweetId: "1884006386859926014",
    location: "N2 road, Goma–Sake corridor (placeholder)",
    lat: -1.5731,
    lon: 29.0589,
    date: "2025-01-28",
    incidentType: "OSINT verification / disinformation flag",
    confidence: "Locality confirmed via search; exact coords pending",
    summary: "GeoConfirmed Africa post. Web indexing suggests this thread relates to footage geolocated along the N2 between Goma and Sake during the early-2025 M23 offensive. Verify from the post.",
    sourceUrl: "https://x.com/GeoConfirmed/status/1884006386859926014"
  },
  {
    id: 3,
    tweetId: "1891050150786695183",
    location: "Eastern DRC (placeholder: Bukavu)",
    lat: -2.5083,
    lon: 28.8608,
    date: "2025-02-16",
    incidentType: "Conflict / armed group activity",
    confidence: "Placeholder — verify from source",
    summary: "GeoConfirmed post documenting an event in eastern DRC. Coordinates pending verification from the original post.",
    sourceUrl: "https://x.com/GeoConfirmed/status/1891050150786695183"
  },
  {
    id: 4,
    tweetId: "2009738836952154354",
    location: "Eastern DRC (placeholder: Bunia)",
    lat: 1.5644,
    lon: 30.2483,
    date: "2025-09-15",
    incidentType: "Conflict / armed group activity",
    confidence: "Placeholder — verify from source",
    summary: "GeoConfirmed post documenting an event in eastern DRC. Coordinates pending verification from the original post.",
    sourceUrl: "https://x.com/GeoConfirmed/status/2009738836952154354"
  },
  {
    id: 5,
    tweetId: "1885337583598669839",
    location: "Eastern DRC (placeholder: Uvira)",
    lat: -3.4070,
    lon: 29.1396,
    date: "2025-01-31",
    incidentType: "Conflict / cross-border incident",
    confidence: "Placeholder — verify from source",
    summary: "GeoConfirmed post documenting an event in eastern DRC. Coordinates pending verification from the original post.",
    sourceUrl: "https://x.com/GeoConfirmed/status/1885337583598669839"
  }
];

// Map view defaults — tuned to frame the OSESG-GL area of responsibility:
// Angola, Burundi, DRC, Kenya, Rwanda, Tanzania, Uganda.
const MAP_VIEW = {
  center: [-2.0, 28.5],     // east-central DRC
  zoom: 6,
  bounds: [
    [-14.0, 11.0],          // SW corner (north Angola / south Tanzania)
    [6.0, 42.0]              // NE corner (Kenyan coast / north DRC)
  ]
};

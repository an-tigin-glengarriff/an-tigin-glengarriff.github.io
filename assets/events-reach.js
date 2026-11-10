/* Events coverage around An Tigín. Nothing is drawn on the map.
   75 km is far enough to include Kinsale (~71 km east) and Macroom (~45 km
   north-east), including the towns between them, and still contains every
   event already on the calendar (Kinsale is the farthest). Cork city centre
   is just outside, so the area does not grow into the city. The map is
   framed to this distance so Macroom stays in view even with no pin there. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EventsReach = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  var HOME = [51.7283264, -9.5554595];
  var REACH_KM = 75;

  function km(a, b) {
    var r = Math.PI / 180, dl = (b[1] - a[1]) * r, dp = (b[0] - a[0]) * r;
    var x = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 12742 * Math.asin(Math.sqrt(x));
  }

  /* A place with coordinates is inside the coverage distance. No coordinates
     is not "outside" — those stay in the unmapped list, as before. */
  function inReach(e) {
    return e != null && e.lat != null && e.lng != null && km(HOME, [e.lat, e.lng]) <= REACH_KM;
  }

  function outside(e) {
    return e != null && e.lat != null && e.lng != null && !inReach(e);
  }

  /* Lat/lng box the map should show. It matches the coverage distance, so
     Macroom and Kinsale stay in frame without a drawn circle. */
  function bounds() {
    var dLat = REACH_KM / 110.574;
    var dLng = REACH_KM / (111.320 * Math.cos(HOME[0] * Math.PI / 180));
    return { south: HOME[0] - dLat, west: HOME[1] - dLng, north: HOME[0] + dLat, east: HOME[1] + dLng };
  }

  return { HOME: HOME, REACH_KM: REACH_KM, km: km, inReach: inReach, outside: outside, bounds: bounds };
});

/* Events coverage: one circle around An Tigín.
   75 km is far enough to include Kinsale (~71 km east) and Macroom (~45 km
   north-east), including the towns between them, and still contains every
   event already on the calendar (Kinsale is the farthest). Cork city centre
   is just outside, so the circle does not grow into the city. */
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

  /* A place with coordinates is inside the circle. No coordinates is not
     "outside" — those stay in the unmapped list, as before. */
  function inReach(e) {
    return e != null && e.lat != null && e.lng != null && km(HOME, [e.lat, e.lng]) <= REACH_KM;
  }

  function outside(e) {
    return e != null && e.lat != null && e.lng != null && !inReach(e);
  }

  return { HOME: HOME, REACH_KM: REACH_KM, km: km, inReach: inReach, outside: outside };
});

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var EatOverlap = require('../assets/eat-overlap.js');

var OPTS = EatOverlap.defaults();

function mercator(lat, lng, zoom) {
  var scale = 256 * Math.pow(2, zoom);
  var x = (lng + 180) / 360 * scale;
  var s = Math.sin(lat * Math.PI / 180);
  var y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x: x, y: y };
}

function projectPins(pins, zoom) {
  return pins.map(function (p, i) {
    var xy = mercator(p.lat, p.lng, zoom);
    return { x: xy.x, y: xy.y, id: i, pin: p };
  });
}

function radiusOf(count) {
  return count < 2 ? OPTS.singleRadius : OPTS.clusterRadius(count);
}

function assertPartition(groups, points) {
  var seen = {};
  var total = 0;
  groups.forEach(function (g) {
    assert.ok(g.points.length >= 1);
    g.points.forEach(function (p) {
      assert.strictEqual(seen[p.id], undefined, 'place duplicated in groups');
      seen[p.id] = true;
      total++;
    });
  });
  assert.strictEqual(total, points.length, 'place missing from groups');
}

function assertSeparated(groups) {
  for (var i = 0; i < groups.length; i++) {
    for (var j = i + 1; j < groups.length; j++) {
      var dx = groups[i].x - groups[j].x;
      var dy = groups[i].y - groups[j].y;
      var reach = radiusOf(groups[i].points.length) + radiusOf(groups[j].points.length);
      assert.ok(dx * dx + dy * dy >= reach * reach - 1e-6, 'displayed markers still overlap');
    }
  }
}

function groupOf(groups, name) {
  var found = null;
  groups.forEach(function (g) {
    g.points.forEach(function (p) {
      if (p.pin.n === name) found = g;
    });
  });
  assert.ok(found, 'missing ' + name);
  return found;
}

var html = fs.readFileSync(path.join(__dirname, '../eat.html'), 'utf8');
var start = html.indexOf('var pins=');
var end = html.indexOf('];', start);
assert.ok(start > 0 && end > start, 'pins array not found');
var pins = JSON.parse(html.slice(start + 'var pins='.length, end + 1));
assert.ok(pins.length >= 30, 'expected the eat place list');

function fitZoom(width, height, padding) {
  for (var z = 18; z >= 1; z--) {
    var pts = pins.map(function (p) { return mercator(p.lat, p.lng, z); });
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    if (maxX - minX <= width - padding * 2 && maxY - minY <= height - padding * 2) return z;
  }
  return 1;
}

var overview = fitZoom(1100, 640, 30);
var overviewGroups = EatOverlap.groupByOverlap(projectPins(pins, overview), OPTS);
assertPartition(overviewGroups, projectPins(pins, overview));
assertSeparated(overviewGroups);

var ballyNames = pins.filter(function (p) { return p.t === 'Ballydehob'; }).map(function (p) { return p.n; });
assert.deepStrictEqual(ballyNames.slice().sort(), [
  "Antonio's Ristorante Pizzeria",
  'Artichoke',
  'Bally Bia',
  "Levis' Corner House",
  'Restaurant Chestnut'
]);
var ballyGroup = groupOf(overviewGroups, 'Bally Bia');
var ballyInGroup = ballyGroup.points.map(function (p) { return p.pin.n; }).sort();
assert.deepStrictEqual(ballyInGroup, ballyNames.slice().sort(), 'Ballydehob should be one overlapping count at overview zoom ' + overview);
assert.strictEqual(ballyGroup.points.length, 5);

var closeZoom = 18;
var closeGroups = EatOverlap.groupByOverlap(projectPins(pins, closeZoom), OPTS);
assertPartition(closeGroups, projectPins(pins, closeZoom));
assertSeparated(closeGroups);
ballyNames.forEach(function (name) {
  assert.strictEqual(groupOf(closeGroups, name).points.length, 1, name + ' should be its own pin at zoom 18');
});

var algiers = groupOf(overviewGroups, 'The Algiers Inn');
assert.strictEqual(algiers.points.length, 1, 'a place on its own stays a single marker');

/* Panning shifts every point by the same pixels, so membership stays put. */
var shifted = projectPins(pins, overview).map(function (p) { return { x: p.x + 840, y: p.y - 360, id: p.id, pin: p.pin }; });
var panned = EatOverlap.groupByOverlap(shifted, OPTS);
assertPartition(panned, shifted);
assert.deepStrictEqual(
  groupOf(panned, 'Bally Bia').points.map(function (p) { return p.pin.n; }).sort(),
  ballyNames.slice().sort()
);

/* Filtering the place list drops those places and does not invent any. */
var filteredPins = pins.filter(function (p) { return p.n !== 'Artichoke' && p.n !== "Levis' Corner House"; });
var filtered = EatOverlap.groupByOverlap(projectPins(filteredPins, overview), OPTS);
assertPartition(filtered, projectPins(filteredPins, overview));
var filteredBally = groupOf(filtered, 'Bally Bia');
assert.strictEqual(filteredBally.points.length, 3);
assert.ok(!filtered.some(function (g) {
  return g.points.some(function (p) { return p.pin.n === 'Artichoke' || p.pin.n === "Levis' Corner House"; });
}));

/* Identical coordinates cannot be split by zooming, and both places count. */
var same = [
  { x: 10, y: 10, id: 0, pin: { n: 'One', t: 'Town', d: 'A', lat: 51.5, lng: -9.4, u: 'https://example.com/one', l: 'Website' } },
  { x: 10, y: 10, id: 1, pin: { n: 'Two', t: 'Town', d: 'B', lat: 51.5, lng: -9.4, u: 'https://example.com/two', l: 'Google Maps' } }
];
var sameGroups = EatOverlap.groupByOverlap(same, OPTS);
assert.strictEqual(sameGroups.length, 1);
assert.strictEqual(sameGroups[0].points.length, 2);
assert.strictEqual(EatOverlap.separates(same.map(function (p) { return p.pin; }), function () { return { x: 10, y: 10 }; }, OPTS), false);
assert.strictEqual(EatOverlap.separates(
  ballyNames.map(function (name) { return pins.filter(function (p) { return p.n === name; })[0]; }),
  function (p) { return mercator(p.lat, p.lng, 18); },
  OPTS
), true);

/* Touching circles do not count as an overlap; a real intersection does. */
var touch = EatOverlap.groupByOverlap([{ x: 0, y: 0, id: 0 }, { x: 18, y: 0, id: 1 }], OPTS);
assert.strictEqual(touch.length, 2);
var hit = EatOverlap.groupByOverlap([{ x: 0, y: 0, id: 0 }, { x: 17.9, y: 0, id: 1 }], OPTS);
assert.strictEqual(hit.length, 1);
assert.strictEqual(hit[0].points.length, 2);

/* Random clouds keep every point exactly once, and the dots we draw do not overlap. */
function lcg(seed) {
  return function () {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
var rnd = lcg(5);
var cloud = [];
for (var i = 0; i < 40; i++) cloud.push({ x: rnd() * 220, y: rnd() * 160, id: i });
var cloudGroups = EatOverlap.groupByOverlap(cloud, OPTS);
assertPartition(cloudGroups, cloud);
assertSeparated(cloudGroups);
var cloudTotal = cloudGroups.reduce(function (sum, g) { return sum + g.points.length; }, 0);
assert.strictEqual(cloudTotal, 40);

var nasty = EatOverlap.popupHtml([{
  n: 'A & B <Cafe>',
  t: 'Town "west"',
  d: "Fish & chips",
  lat: 51.1,
  lng: -9.2,
  u: 'javascript:alert(1)',
  l: 'Website'
}, {
  n: 'Bally Bia',
  t: 'Town "west"',
  d: 'Cafe',
  lat: 51.2,
  lng: -9.3,
  u: 'https://example.com/a?b=1&c=2',
  l: 'Google Maps'
}], null);
assert.ok(nasty.indexOf('A &amp; B &lt;Cafe&gt;') >= 0);
assert.ok(nasty.indexOf('<Cafe>') < 0);
assert.ok(nasty.indexOf('Town &quot;west&quot;') >= 0);
assert.ok(nasty.indexOf('javascript:') < 0);
assert.ok(nasty.indexOf('href="#"') >= 0);
assert.ok(nasty.indexOf('href="https://example.com/a?b=1&amp;c=2"') >= 0);
assert.ok(nasty.indexOf('These stay overlapping') >= 0);
assert.ok(nasty.indexOf('eat-pop__zoom') < 0);
assert.ok(nasty.indexOf('>Bally Bia<') >= 0);
assert.ok(nasty.indexOf('>A &amp; B &lt;Cafe&gt;<') >= 0);

var withZoom = EatOverlap.popupHtml([
  { n: 'Bally Bia', t: 'Ballydehob', d: 'Cafe', lat: 51.5625246, lng: -9.4621595, u: 'https://example.com/b', l: 'Google Maps' },
  { n: 'Artichoke', t: 'Ballydehob', d: 'Coffee', lat: 51.5627428, lng: -9.4617287, u: 'https://example.com/a', l: 'Google Maps' }
], { south: 51.5625, west: -9.4622, north: 51.5628, east: -9.4617 });
assert.ok(withZoom.indexOf('Ballydehob · 2 places') >= 0);
assert.ok(withZoom.indexOf('data-south="51.5625"') >= 0);
assert.ok(withZoom.indexOf('data-east="-9.4617"') >= 0);
assert.ok(withZoom.indexOf('Zoom in to separate these places') >= 0);
assert.ok(withZoom.indexOf('Directions ↗') >= 0);
assert.strictEqual(EatOverlap.ariaLabel([
  { n: 'Bally Bia', t: 'Ballydehob' },
  { n: 'Artichoke', t: 'Ballydehob' }
]), 'Ballydehob, 2 places to eat overlapping here. Show each place.');

var single = EatOverlap.placePopupHtml(pins.filter(function (p) { return p.n === 'Bally Bia'; })[0]);
assert.ok(single.indexOf('<b>Bally Bia</b>') === 0);
assert.ok(single.indexOf('Café on Main Street, eat in or take away') >= 0);
assert.ok(single.indexOf('View on Google Maps ↗') >= 0);
assert.ok(single.indexOf('destination=51.5625246%2C-9.4621595') >= 0);

var icon = EatOverlap.clusterIcon(5);
assert.strictEqual(icon.outer, 15);
assert.strictEqual(icon.box, 30);
assert.ok(icon.html.indexOf('>5<') >= 0);
assert.ok(icon.html.indexOf('fill="#094730"') >= 0);
assert.strictEqual(EatOverlap.clusterIcon(12).outer, 17);

console.log('eat-overlap tests passed (' + pins.length + ' places, overview zoom ' + overview + ', ' + overviewGroups.length + ' markers)');

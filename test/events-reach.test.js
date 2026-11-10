var assert = require('assert');
var fs = require('fs');
var path = require('path');
var EventsReach = require('../assets/events-reach.js');

var HOME = EventsReach.HOME;
var REACH = EventsReach.REACH_KM;

function km(lat, lng) { return EventsReach.km(HOME, [lat, lng]); }

/* Town centres. Kinsale and the nearer towns are the geocoded points already
   used by the site. Macroom is the OpenStreetMap town centre. */
var towns = {
  Glengarriff: [51.750197, -9.540371],
  Bantry: [51.67977, -9.45467],
  Kenmare: [51.879101, -9.583952],
  Ballydehob: [51.562667, -9.46],
  Skibbereen: [51.547823, -9.266],
  Schull: [51.527103, -9.546943],
  Dunmanway: [51.721503, -9.113],
  Clonakilty: [51.621867, -8.892039],
  Bandon: [51.746171, -8.73693],
  Macroom: [51.904971, -8.95992],
  Kinsale: [51.705737, -8.522982]
};

Object.keys(towns).forEach(function (name) {
  var d = km(towns[name][0], towns[name][1]);
  assert.ok(d <= REACH, name + ' is ' + d.toFixed(1) + ' km, outside ' + REACH);
});

assert.ok(km(51.904971, -8.95992) < km(51.705737, -8.522982), 'Macroom is nearer than Kinsale, so the radius is set by Kinsale');
assert.ok(km(51.8985, -8.4756) > REACH, 'Cork city centre stays outside the circle');

function eachLocated(file, list) {
  list.forEach(function (e) {
    if (e.lat == null) return;
    var d = km(e.lat, e.lng);
    assert.ok(EventsReach.inReach(e), file + ' drops ' + e.name + ' at ' + d.toFixed(1) + ' km (' + (e.location || e.place) + ')');
    assert.strictEqual(EventsReach.outside(e), false);
  });
}

var events = JSON.parse(fs.readFileSync(path.join(__dirname, '../events.json'), 'utf8'));
var tbc = JSON.parse(fs.readFileSync(path.join(__dirname, '../events-tbc.json'), 'utf8'));
eachLocated('events.json', (events.events || []).concat(events.regular || []));
eachLocated('events-tbc.json', tbc.events || []);
assert.strictEqual(EventsReach.outside({ name: 'no place' }), false);
assert.strictEqual(EventsReach.inReach({ lat: 51.8985, lng: -8.4756 }), false);

var html = fs.readFileSync(path.join(__dirname, '../events.html'), 'utf8');
assert.ok(html.indexOf('assets/events-reach.js') >= 0);
assert.ok(html.indexOf('ev-reach') >= 0);
assert.ok(html.indexOf('EventsReach.REACH_KM*1000') >= 0);
assert.ok(html.indexOf('EventsReach.inReach') >= 0);
assert.ok(html.indexOf('EventsReach.outside') >= 0);
assert.ok(html.indexOf('Macroom') >= 0 && html.indexOf('Kinsale') >= 0);

var py = fs.readFileSync(path.join(__dirname, '../scripts/update_events.py'), 'utf8');
assert.ok(py.indexOf('"Macroom"') >= 0, 'geocoder should recognise Macroom');

console.log('events-reach tests passed (radius ' + REACH + ' km)');

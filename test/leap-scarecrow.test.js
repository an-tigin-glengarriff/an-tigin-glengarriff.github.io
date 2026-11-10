var assert = require('assert');
var fs = require('fs');
var path = require('path');

var tbc = JSON.parse(fs.readFileSync(path.join(__dirname, '../events-tbc.json'), 'utf8'));
var events = JSON.parse(fs.readFileSync(path.join(__dirname, '../events.json'), 'utf8'));
var html = fs.readFileSync(path.join(__dirname, '../events.html'), 'utf8');

var scare = tbc.events.filter(function (e) { return e.name === 'Leap Scarecrow Festival'; });
assert.strictEqual(scare.length, 1);
scare = scare[0];
assert.strictEqual(scare.place, 'Leap');
assert.strictEqual(scare.location, 'Leap Village, County Cork');
assert.strictEqual(scare.url, 'https://www.leapscarecrowfestival.com/');
assert.deepStrictEqual(scare.months, [10, 11]);
assert.strictEqual(scare.usual, 'late October – 1 November');
assert.strictEqual(scare.last, '2026: 19 October – 1 November');
assert.strictEqual(scare.lat, 51.581063);
assert.strictEqual(scare.lng, -9.143339);
assert.strictEqual(scare.start, undefined);
assert.strictEqual(scare.end, undefined);

var horse = tbc.events.filter(function (e) { return e.name === 'Leap Horse & Pony Show'; });
assert.strictEqual(horse.length, 1);
assert.notStrictEqual(horse[0].url, scare.url);

function named(list) {
  return (list || []).filter(function (e) { return e.name === 'Leap Scarecrow Festival'; });
}
assert.strictEqual(named(events.events).length, 0);
assert.strictEqual(named(events.regular).length, 0);

var when = "e.label||('Dates TBC – usually '+e.usual+(e.last?' ('+e.last+')':''))";
assert.ok(html.indexOf(when) >= 0, 'TBC text keeps last year in parentheses and says dates are not confirmed');
assert.ok(html.indexOf('https://www.leapscarecrowfestival.com/') >= 0);
assert.ok(html.indexOf('Next dates not announced') >= 0);
assert.ok(!/Leap Scarecrow Festival[\s\S]{0,80}start"\s*:/.test(JSON.stringify(scare)));

console.log('leap scarecrow tests passed (dates TBC, 2026 dates only as last year)');

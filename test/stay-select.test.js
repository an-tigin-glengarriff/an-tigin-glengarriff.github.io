var assert = require('assert');
var fs = require('fs');
var path = require('path');
var Stay = require('../assets/stay-select.js');

var BOOKED = [
  { start: '2026-11-08', end: '2027-04-01' },
  { start: '2027-04-14', end: '2027-04-15' },
  { start: '2027-04-28', end: '2027-04-29' },
  { start: '2027-05-19', end: '2027-05-30' }
];

function stay(checkIn, extra) {
  var options = { today: '2027-04-01', booked: BOOKED, feedReady: true };
  if (extra) Object.keys(extra).forEach(function (k) { options[k] = extra[k]; });
  return Stay.selectStay(checkIn, options);
}

assert.strictEqual(Stay.NIGHTS, 4);
assert.strictEqual(Stay.GAP, 2);
assert.strictEqual(Stay.LISTING, 'https://airbnb.com/h/an-tigin');
assert.strictEqual(Stay.MIN_COPY, 'Minimum stay: 4 nights');

var open = stay('2027-04-17');
assert.strictEqual(open.ok, true);
assert.strictEqual(open.shifted, false);
assert.deepStrictEqual(open.nights, ['2027-04-17', '2027-04-18', '2027-04-19', '2027-04-20']);
assert.strictEqual(open.checkOut, '2027-04-21');
assert.strictEqual(open.nightCount, 4);
assert.strictEqual(open.url, 'https://airbnb.com/h/an-tigin?check_in=2027-04-17&check_out=2027-04-21');
assert.ok(open.nights.indexOf(open.checkOut) === -1, 'checkout morning is not a stayed night');
assert.strictEqual(Stay.summary(open), 'Check-in Saturday 17 April 2027. Check-out Wednesday 21 April 2027. 4 nights.');
assert.strictEqual(Stay.ctaLabel(open), 'Book these dates on Airbnb, check-in 2027-04-17, check-out 2027-04-21, 4 nights. Opens Airbnb, which confirms availability and price.');
assert.ok(!/\$|€|£/.test(Stay.ctaLabel(open) + Stay.summary(open)), 'no price in the handoff');

assert.strictEqual(Stay.nightBooked('2027-04-14', BOOKED), true);
assert.strictEqual(Stay.nightBooked('2027-04-15', BOOKED), false, 'checkout morning of a booking is free');

function assertShiftedBefore(result, bookedNight) {
  var checkIn = Stay.addDays(bookedNight, -6);
  var checkOut = Stay.addDays(bookedNight, -2);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.shifted, true);
  assert.strictEqual(result.blockedNight, bookedNight);
  assert.strictEqual(result.checkIn, checkIn);
  assert.strictEqual(result.checkOut, checkOut, 'checkout is two days before the next check-in');
  assert.deepStrictEqual(result.nights, [0, 1, 2, 3].map(function (n) { return Stay.addDays(checkIn, n); }));
  assert.ok(result.nights.indexOf(bookedNight) === -1, 'booked night is not stayed');
  assert.ok(result.nights.indexOf(checkOut) === -1, 'checkout morning is not a stayed night');
  assert.strictEqual(result.url, 'https://airbnb.com/h/an-tigin?check_in=' + checkIn + '&check_out=' + checkOut);
  assert.ok(Stay.summary(result).indexOf('This stay moved so two clear days remain before the next booking.') === 0);
  assert.ok(Stay.summary(result).indexOf(Stay.longDate(result.checkIn)) !== -1);
  assert.ok(Stay.summary(result).indexOf(Stay.longDate(result.checkOut)) !== -1);
}

assertShiftedBefore(stay('2027-04-13'), '2027-04-14');
assertShiftedBefore(stay('2027-04-12'), '2027-04-14');
assertShiftedBefore(stay('2027-04-11'), '2027-04-14');
assertShiftedBefore(stay('2027-04-10'), '2027-04-14');
assertShiftedBefore(stay('2027-04-09'), '2027-04-14');
assert.strictEqual(stay('2027-04-12').clicked, '2027-04-12');
assert.strictEqual(stay('2027-04-09').checkOut, '2027-04-12');
assert.notStrictEqual(stay('2027-04-09').checkOut, '2027-04-13');

var exactBefore = stay('2027-04-08');
assert.strictEqual(exactBefore.ok, true);
assert.strictEqual(exactBefore.shifted, false);
assert.deepStrictEqual(exactBefore.nights, ['2027-04-08', '2027-04-09', '2027-04-10', '2027-04-11']);
assert.strictEqual(exactBefore.checkOut, '2027-04-12');

var exactAfter = stay('2027-04-17');
assert.strictEqual(exactAfter.ok, true);
assert.strictEqual(exactAfter.shifted, false);
assert.strictEqual(exactAfter.checkIn, '2027-04-17');

var oneDayAfter = stay('2027-04-16');
assert.strictEqual(oneDayAfter.ok, false);
assert.strictEqual(oneDayAfter.reason, 'gap-after');
assert.strictEqual(oneDayAfter.url, undefined);
assert.strictEqual(Stay.reasonText(oneDayAfter), 'Two clear days are needed after the previous stay, so this check-in can\u2019t be used.');

var bookedClick = stay('2027-04-14');
assert.strictEqual(bookedClick.ok, false);
assert.strictEqual(bookedClick.reason, 'blocked');
assert.strictEqual(bookedClick.url, undefined);
assert.strictEqual(Stay.reasonText(bookedClick), 'That night is already booked.');

assertShiftedBefore(stay('2027-04-26'), '2027-04-28');

var longBlockEdge = stay('2027-03-31', { today: '2027-03-01' });
assert.strictEqual(longBlockEdge.ok, false);
assert.strictEqual(longBlockEdge.reason, 'blocked');
assert.strictEqual(longBlockEdge.url, undefined);
var dayAfterLong = stay('2027-04-01');
assert.strictEqual(dayAfterLong.ok, false);
assert.strictEqual(dayAfterLong.reason, 'gap-after');
assert.strictEqual(dayAfterLong.url, undefined);
var firstFree = stay('2027-04-03');
assert.strictEqual(firstFree.ok, true);
assert.strictEqual(firstFree.shifted, false);
assert.deepStrictEqual(firstFree.nights, ['2027-04-03', '2027-04-04', '2027-04-05', '2027-04-06']);
assert.strictEqual(firstFree.checkOut, '2027-04-07');

var past = stay('2027-04-14', { today: '2027-04-15' });
assert.strictEqual(past.ok, false);
assert.strictEqual(past.reason, 'past');
assert.strictEqual(past.url, undefined);
assert.strictEqual(Stay.reasonText(past), 'That date has already passed.');
var todayOk = stay('2027-04-17', { today: '2027-04-17' });
assert.strictEqual(todayOk.ok, true);

var monthEdge = Stay.selectStay('2027-04-30', { today: '2027-04-01', booked: [], feedReady: true });
assert.strictEqual(monthEdge.ok, true);
assert.deepStrictEqual(monthEdge.nights, ['2027-04-30', '2027-05-01', '2027-05-02', '2027-05-03']);
assert.strictEqual(monthEdge.checkOut, '2027-05-04');
assert.strictEqual(Stay.monthOffset('2027-05-03', '2027-04-01'), 1);

var precedingBlocked = Stay.selectStay('2027-04-12', {
  today: '2027-04-01',
  feedReady: true,
  booked: [
    { start: '2027-04-10', end: '2027-04-11' },
    { start: '2027-04-14', end: '2027-04-15' }
  ]
});
assert.strictEqual(precedingBlocked.ok, false);
assert.strictEqual(precedingBlocked.reason, 'shift-blocked');
assert.strictEqual(precedingBlocked.url, undefined);
assert.strictEqual(Stay.reasonText(precedingBlocked), 'The four nights that leave two clear days before that booking aren\u2019t all available, so this check-in can\u2019t be used.');

var precedingPast = Stay.selectStay('2027-04-13', {
  today: '2027-04-12',
  feedReady: true,
  booked: [{ start: '2027-04-14', end: '2027-04-15' }]
});
assert.strictEqual(precedingPast.ok, false);
assert.strictEqual(precedingPast.reason, 'shift-past');
assert.strictEqual(precedingPast.url, undefined);
assert.strictEqual(Stay.reasonText(precedingPast), 'The four nights that leave two clear days before that booking include a past date, so this check-in can\u2019t be used.');

var yearShift = Stay.selectStay('2026-12-31', {
  today: '2026-12-01',
  feedReady: true,
  booked: [{ start: '2027-01-02', end: '2027-01-03' }]
});
assertShiftedBefore(yearShift, '2027-01-02');
assert.deepStrictEqual(yearShift.nights, ['2026-12-27', '2026-12-28', '2026-12-29', '2026-12-30']);
assert.strictEqual(yearShift.checkOut, '2026-12-31');
assert.strictEqual(yearShift.url, 'https://airbnb.com/h/an-tigin?check_in=2026-12-27&check_out=2026-12-31');

var monthShift = Stay.selectStay('2027-04-30', {
  today: '2027-04-01',
  feedReady: true,
  booked: [{ start: '2027-05-02', end: '2027-05-03' }]
});
assertShiftedBefore(monthShift, '2027-05-02');
assert.deepStrictEqual(monthShift.nights, ['2027-04-26', '2027-04-27', '2027-04-28', '2027-04-29']);
assert.strictEqual(monthShift.checkOut, '2027-04-30');

var both = [
  { start: '2027-04-01', end: '2027-04-05' },
  { start: '2027-04-20', end: '2027-04-21' }
];
var bothOpts = { today: '2027-03-01', booked: both, feedReady: true };
var afterPrev = Stay.selectStay('2027-04-07', bothOpts);
assert.strictEqual(afterPrev.ok, true);
assert.strictEqual(afterPrev.shifted, false);
assert.strictEqual(afterPrev.checkIn, '2027-04-07');
var tooSoon = Stay.selectStay('2027-04-06', bothOpts);
assert.strictEqual(tooSoon.ok, false);
assert.strictEqual(tooSoon.reason, 'gap-after');
assert.strictEqual(tooSoon.url, undefined);
var beforeNext = Stay.selectStay('2027-04-14', bothOpts);
assert.strictEqual(beforeNext.ok, true);
assert.strictEqual(beforeNext.shifted, false);
assert.strictEqual(beforeNext.checkOut, '2027-04-18');
var crowdNext = Stay.selectStay('2027-04-15', bothOpts);
assertShiftedBefore(crowdNext, '2027-04-20');
assert.strictEqual(crowdNext.url, 'https://airbnb.com/h/an-tigin?check_in=2027-04-14&check_out=2027-04-18');
var blockedShift = Stay.selectStay('2027-04-15', {
  today: '2027-03-01',
  feedReady: true,
  booked: [
    { start: '2027-04-01', end: '2027-04-13' },
    { start: '2027-04-20', end: '2027-04-21' }
  ]
});
assert.strictEqual(blockedShift.ok, false);
assert.strictEqual(blockedShift.reason, 'shift-blocked');
assert.strictEqual(blockedShift.url, undefined);

var yearEdge = Stay.selectStay('2026-12-30', { today: '2026-12-01', booked: [], feedReady: true });
assert.strictEqual(yearEdge.ok, true);
assert.deepStrictEqual(yearEdge.nights, ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
assert.strictEqual(yearEdge.checkOut, '2027-01-03');
assert.strictEqual(Stay.monthOffset(yearEdge.checkOut, '2026-12-01'), 1);
assert.strictEqual(yearEdge.url, 'https://airbnb.com/h/an-tigin?check_in=2026-12-30&check_out=2027-01-03');

var leap = Stay.selectStay('2028-02-27', { today: '2028-02-01', booked: [], feedReady: true });
assert.strictEqual(leap.ok, true);
assert.deepStrictEqual(leap.nights, ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01']);
assert.strictEqual(leap.checkOut, '2028-03-02');
assert.strictEqual(Stay.parseISO('2027-02-29'), null);
assert.strictEqual(Stay.addDays('2027-02-28', 1), '2027-03-01');

var spring = '2026-03-27';
assert.deepStrictEqual([0, 1, 2, 3, 4].map(function (n) { return Stay.addDays(spring, n); }),
  ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
var autumn = '2026-10-24';
assert.deepStrictEqual([0, 1, 2, 3].map(function (n) { return Stay.addDays(autumn, n); }),
  ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);

var unloaded = Stay.selectStay('2027-04-15', { today: '2027-04-01', booked: [], feedReady: false });
assert.strictEqual(unloaded.ok, false);
assert.strictEqual(unloaded.reason, 'feed');
assert.strictEqual(unloaded.url, undefined);
assert.strictEqual(Stay.reasonText(unloaded), 'Availability is not loaded, so these dates can\u2019t be confirmed here.');
assert.strictEqual(Stay.dayLabel('2027-04-15', { feedReady: false }), 'Thursday 15 April 2027. Availability not loaded.');

assert.strictEqual(Stay.moveDate('2027-04-15', 'ArrowLeft'), '2027-04-14');
assert.strictEqual(Stay.moveDate('2027-04-15', 'ArrowRight'), '2027-04-16');
assert.strictEqual(Stay.moveDate('2027-04-15', 'ArrowUp'), '2027-04-08');
assert.strictEqual(Stay.moveDate('2027-04-15', 'ArrowDown'), '2027-04-22');
assert.strictEqual(Stay.moveDate('2027-04-30', 'ArrowRight'), '2027-05-01');
assert.strictEqual(Stay.moveDate('2026-12-31', 'ArrowDown'), '2027-01-07');
assert.strictEqual(Stay.moveDate('2027-04-15', 'Enter'), null);

assert.strictEqual(Stay.dayLabel('2027-04-15', { past: true }), 'Thursday 15 April 2027. Past.');
assert.strictEqual(Stay.dayLabel('2027-04-14', { booked: true }), 'Wednesday 14 April 2027. Booked.');
assert.strictEqual(Stay.dayLabel('2027-04-15', { role: 'checkin' }), 'Thursday 15 April 2027. Check-in, night 1 of 4.');
assert.strictEqual(Stay.dayLabel('2027-04-17', { role: 'night', nightIndex: 3 }), 'Saturday 17 April 2027. Night 3 of 4.');

var html = fs.readFileSync(path.join(__dirname, '..', 'calendar.html'), 'utf8');
assert.ok(html.indexOf('Minimum stay: 4 nights') !== -1, 'minimum-stay note is on the page');
assert.ok(html.indexOf('Two clear days between stays.') !== -1, 'gap note is on the page');
assert.ok(html.indexOf('assets/stay-select.js') !== -1);
assert.ok(html.indexOf('https://airbnb.com/h/an-tigin') !== -1);
assert.ok(html.indexOf('938334645264143712') === -1, 'room id is not hardcoded');
assert.ok(/<a\b[^>]*id="stay-book"[^>]*>/.test(html), 'booking handoff is a link');
assert.ok(/id="stay-book"[^>]*target="_blank"/.test(html));
assert.ok(/id="stay-book"[^>]*rel="noopener"/.test(html));
assert.ok(html.indexOf('aria-describedby="stay-note"') !== -1);
assert.ok(html.indexOf("btn.type = 'button'") !== -1 || html.indexOf('btn.type="button"') !== -1 || html.indexOf("type = 'button'") !== -1);
assert.ok(html.indexOf('moveDate') !== -1, 'arrow keys move the date');
assert.ok(html.indexOf('Airbnb confirms the final availability and the price') !== -1);
assert.ok(html.indexOf('<span><i class="cal-avail"></i>Available</span>') !== -1);
assert.ok(html.indexOf('<span><i class="cal-booked"></i>Booked</span>') !== -1);

console.log('stay-select tests passed');

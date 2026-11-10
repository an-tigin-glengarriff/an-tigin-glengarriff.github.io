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
assert.strictEqual(Stay.GAP, undefined);
assert.strictEqual(Stay.LISTING, 'https://airbnb.com/h/an-tigin');
assert.strictEqual(Stay.MIN_COPY, 'Minimum stay: 4 nights');

var open = stay('2027-04-15');
assert.strictEqual(open.ok, true);
assert.strictEqual(open.shifted, false);
assert.deepStrictEqual(open.nights, ['2027-04-15', '2027-04-16', '2027-04-17', '2027-04-18']);
assert.strictEqual(open.checkOut, '2027-04-19');
assert.strictEqual(open.nightCount, 4);
assert.strictEqual(open.url, 'https://airbnb.com/h/an-tigin?check_in=2027-04-15&check_out=2027-04-19');
assert.ok(open.nights.indexOf(open.checkOut) === -1, 'checkout morning is not a stayed night');
assert.strictEqual(Stay.summary(open), 'Check-in Thursday 15 April 2027. Check-out Monday 19 April 2027. 4 nights.');
assert.strictEqual(Stay.ctaLabel(open), 'Book these dates on Airbnb, check-in 2027-04-15, check-out 2027-04-19, 4 nights. Opens Airbnb, which confirms availability and price.');
assert.ok(!/\$|€|£/.test(Stay.ctaLabel(open) + Stay.summary(open)), 'no price in the handoff');
assert.ok(Stay.summary(open).indexOf('two clear days') === -1);
assert.ok(Stay.summary(open).indexOf('Two clear days') === -1);

assert.strictEqual(Stay.nightBooked('2027-04-14', BOOKED), true);
assert.strictEqual(Stay.nightBooked('2027-04-15', BOOKED), false, 'checkout morning of a booking is free');

function assertShiftedBefore(result, bookedNight) {
  var checkIn = Stay.addDays(bookedNight, -4);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.shifted, true);
  assert.strictEqual(result.blockedNight, bookedNight);
  assert.strictEqual(result.checkIn, checkIn);
  assert.strictEqual(result.checkOut, bookedNight, 'checkout is the booked date');
  assert.deepStrictEqual(result.nights, [0, 1, 2, 3].map(function (n) { return Stay.addDays(checkIn, n); }));
  assert.ok(result.nights.indexOf(bookedNight) === -1, 'booked night is not stayed');
  assert.strictEqual(result.url, 'https://airbnb.com/h/an-tigin?check_in=' + checkIn + '&check_out=' + bookedNight);
  assert.ok(Stay.summary(result).indexOf('This stay moved to the four nights before the booked date.') === 0);
  assert.ok(Stay.summary(result).indexOf('two clear days') === -1);
}

assertShiftedBefore(stay('2027-04-13'), '2027-04-14');
assertShiftedBefore(stay('2027-04-12'), '2027-04-14');
assertShiftedBefore(stay('2027-04-11'), '2027-04-14');
assert.strictEqual(stay('2027-04-12').clicked, '2027-04-12');

var nightBefore = stay('2027-04-10');
assert.strictEqual(nightBefore.ok, true);
assert.strictEqual(nightBefore.shifted, false);
assert.deepStrictEqual(nightBefore.nights, ['2027-04-10', '2027-04-11', '2027-04-12', '2027-04-13']);
assert.strictEqual(nightBefore.checkOut, '2027-04-14');
assert.strictEqual(nightBefore.url, 'https://airbnb.com/h/an-tigin?check_in=2027-04-10&check_out=2027-04-14');

var dayAfter = stay('2027-04-15');
assert.strictEqual(dayAfter.ok, true);
assert.strictEqual(dayAfter.shifted, false);
assert.strictEqual(dayAfter.checkIn, '2027-04-15');

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
var firstFree = stay('2027-04-01');
assert.strictEqual(firstFree.ok, true);
assert.strictEqual(firstFree.shifted, false);
assert.deepStrictEqual(firstFree.nights, ['2027-04-01', '2027-04-02', '2027-04-03', '2027-04-04']);
assert.strictEqual(firstFree.checkOut, '2027-04-05');

var past = stay('2027-04-14', { today: '2027-04-15' });
assert.strictEqual(past.ok, false);
assert.strictEqual(past.reason, 'past');
assert.strictEqual(past.url, undefined);
assert.strictEqual(Stay.reasonText(past), 'That date has already passed.');
var todayOk = stay('2027-04-15', { today: '2027-04-15' });
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
assert.strictEqual(Stay.reasonText(precedingBlocked), 'The four nights before that booked date aren\u2019t all available, so this check-in can\u2019t be used.');

var precedingPast = Stay.selectStay('2027-04-13', {
  today: '2027-04-12',
  feedReady: true,
  booked: [{ start: '2027-04-14', end: '2027-04-15' }]
});
assert.strictEqual(precedingPast.ok, false);
assert.strictEqual(precedingPast.reason, 'shift-past');
assert.strictEqual(precedingPast.url, undefined);
assert.strictEqual(Stay.reasonText(precedingPast), 'The four nights before that booked date include a past date, so this check-in can\u2019t be used.');

var yearShift = Stay.selectStay('2026-12-31', {
  today: '2026-12-01',
  feedReady: true,
  booked: [{ start: '2027-01-02', end: '2027-01-03' }]
});
assertShiftedBefore(yearShift, '2027-01-02');
assert.deepStrictEqual(yearShift.nights, ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
assert.strictEqual(yearShift.checkOut, '2027-01-02');
assert.strictEqual(yearShift.url, 'https://airbnb.com/h/an-tigin?check_in=2026-12-29&check_out=2027-01-02');

var monthShift = Stay.selectStay('2027-04-30', {
  today: '2027-04-01',
  feedReady: true,
  booked: [{ start: '2027-05-02', end: '2027-05-03' }]
});
assertShiftedBefore(monthShift, '2027-05-02');
assert.deepStrictEqual(monthShift.nights, ['2027-04-28', '2027-04-29', '2027-04-30', '2027-05-01']);
assert.strictEqual(monthShift.checkOut, '2027-05-02');

var adjacent = [
  { start: '2027-04-01', end: '2027-04-05' },
  { start: '2027-04-20', end: '2027-04-21' }
];
var adjacentOpts = { today: '2027-03-01', booked: adjacent, feedReady: true };
var dayAfterBusy = Stay.selectStay('2027-04-05', adjacentOpts);
assert.strictEqual(dayAfterBusy.ok, true);
assert.strictEqual(dayAfterBusy.shifted, false);
assert.strictEqual(dayAfterBusy.checkIn, '2027-04-05');
assert.deepStrictEqual(dayAfterBusy.nights, ['2027-04-05', '2027-04-06', '2027-04-07', '2027-04-08']);
var touchingNext = Stay.selectStay('2027-04-16', adjacentOpts);
assert.strictEqual(touchingNext.ok, true);
assert.strictEqual(touchingNext.shifted, false);
assert.strictEqual(touchingNext.checkOut, '2027-04-20');
assert.deepStrictEqual(touchingNext.nights, ['2027-04-16', '2027-04-17', '2027-04-18', '2027-04-19']);
var intoNext = Stay.selectStay('2027-04-18', adjacentOpts);
assertShiftedBefore(intoNext, '2027-04-20');
assert.strictEqual(intoNext.url, 'https://airbnb.com/h/an-tigin?check_in=2027-04-16&check_out=2027-04-20');

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
function opts(today, booked) {
  return { today: today, booked: booked || [], feedReady: true };
}

var base = Stay.selectStay('2027-06-10', opts('2027-06-01'));
assert.strictEqual(base.nightCount, 4);
assert.strictEqual(base.checkOut, '2027-06-14');
var later = Stay.extendStay(base, '2027-06-16', opts('2027-06-01'));
assert.strictEqual(later.ok, true);
assert.strictEqual(later.direction, 'later');
assert.strictEqual(later.checkIn, '2027-06-10');
assert.strictEqual(later.checkOut, '2027-06-17');
assert.strictEqual(later.nightCount, 7);
assert.deepStrictEqual(later.nights, ['2027-06-10', '2027-06-11', '2027-06-12', '2027-06-13', '2027-06-14', '2027-06-15', '2027-06-16']);
assert.strictEqual(later.url, 'https://airbnb.com/h/an-tigin?check_in=2027-06-10&check_out=2027-06-17');
assert.strictEqual(base.checkOut, '2027-06-14', 'extension does not change the original stay');
var earlier = Stay.extendStay(base, '2027-06-08', opts('2027-06-01'));
assert.strictEqual(earlier.ok, true);
assert.strictEqual(earlier.direction, 'earlier');
assert.strictEqual(earlier.checkIn, '2027-06-08');
assert.strictEqual(earlier.checkOut, '2027-06-14');
assert.strictEqual(earlier.nightCount, 6);
var both = Stay.extendStay(later, '2027-06-08', opts('2027-06-01'));
assert.strictEqual(both.ok, true);
assert.strictEqual(both.checkIn, '2027-06-08');
assert.strictEqual(both.checkOut, '2027-06-17');
assert.strictEqual(both.nightCount, 9);
assert.ok(both.nightCount >= 4);
assert.strictEqual(both.url, 'https://airbnb.com/h/an-tigin?check_in=2027-06-08&check_out=2027-06-17');

var blockedLater = Stay.extendStay(base, '2027-06-16', opts('2027-06-01', [{ start: '2027-06-15', end: '2027-06-16' }]));
assert.strictEqual(blockedLater.ok, false);
assert.strictEqual(blockedLater.reason, 'blocked');
assert.strictEqual(blockedLater.url, undefined);
assert.strictEqual(Stay.extendReason(blockedLater), 'A booked night is in the way, so the stay was not extended.');
assert.strictEqual(base.checkIn, '2027-06-10');
var blockedEarlier = Stay.extendStay(base, '2027-06-05', opts('2027-06-01', [{ start: '2027-06-07', end: '2027-06-08' }]));
assert.strictEqual(blockedEarlier.ok, false);
assert.strictEqual(blockedEarlier.reason, 'blocked');
assert.strictEqual(blockedEarlier.url, undefined);
var pastExtend = Stay.extendStay(base, '2027-06-08', opts('2027-06-10'));
assert.strictEqual(pastExtend.ok, false);
assert.strictEqual(pastExtend.reason, 'past');
assert.strictEqual(pastExtend.url, undefined);
var inside = Stay.extendStay(base, '2027-06-12', opts('2027-06-01'));
assert.strictEqual(inside.ok, false);
assert.strictEqual(inside.reason, 'inside');
assert.ok(Stay.extendReason(inside).indexOf('start a new stay') !== -1);

var monthLong = Stay.extendStay(
  Stay.selectStay('2027-04-28', opts('2027-04-01')),
  '2027-05-03',
  opts('2027-04-01')
);
assert.strictEqual(monthLong.ok, true);
assert.deepStrictEqual(monthLong.nights.slice(0, 4), ['2027-04-28', '2027-04-29', '2027-04-30', '2027-05-01']);
assert.strictEqual(monthLong.checkOut, '2027-05-04');
assert.strictEqual(monthLong.nightCount, 6);

var yearLong = Stay.extendStay(
  Stay.selectStay('2026-12-30', opts('2026-12-01')),
  '2027-01-04',
  opts('2026-12-01')
);
assert.strictEqual(yearLong.ok, true);
assert.strictEqual(yearLong.checkIn, '2026-12-30');
assert.strictEqual(yearLong.checkOut, '2027-01-05');
assert.ok(yearLong.nights.indexOf('2026-12-31') !== -1);
assert.ok(yearLong.nights.indexOf('2027-01-01') !== -1);
assert.strictEqual(yearLong.nightCount, 6);

var leapBase = Stay.selectStay('2028-02-27', opts('2028-02-01'));
assert.ok(leapBase.nights.indexOf('2028-02-29') !== -1);
var leapLong = Stay.extendStay(leapBase, '2028-02-25', opts('2028-02-01'));
assert.strictEqual(leapLong.ok, true);
assert.strictEqual(leapLong.checkIn, '2028-02-25');
assert.strictEqual(leapLong.checkOut, '2028-03-02');
assert.ok(leapLong.nights.indexOf('2028-02-29') !== -1);
assert.strictEqual(leapLong.nightCount, 6);

var dstBase = Stay.selectStay('2026-03-27', opts('2026-03-01'));
var dstLong = Stay.extendStay(dstBase, '2026-03-31', opts('2026-03-01'));
assert.strictEqual(dstLong.ok, true);
assert.deepStrictEqual(dstLong.nights, ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
assert.strictEqual(dstLong.checkOut, '2026-04-01');

var fresh = Stay.selectStay('2027-04-12', { today: '2027-04-01', booked: BOOKED, feedReady: true });
assert.strictEqual(fresh.shifted, true);
assert.strictEqual(fresh.checkOut, '2027-04-14');
var noFeed = Stay.extendStay(fresh, '2027-04-16', { today: '2027-04-01', booked: BOOKED, feedReady: false });
assert.strictEqual(noFeed.ok, false);
assert.strictEqual(noFeed.reason, 'feed');
assert.strictEqual(noFeed.url, undefined);

assert.ok(html.indexOf('Minimum stay: 4 nights') !== -1, 'minimum-stay note is on the page');
assert.ok(html.indexOf('Two clear days') === -1, 'no two-day gap copy');
assert.ok(html.indexOf('id="stay-gap"') === -1);
assert.ok(html.indexOf("evnt.key === 'Enter'") !== -1, 'Enter selects a date');
assert.ok(html.indexOf('extendStay') !== -1, 'a selected stay can be extended');
assert.ok(/<button type="button"[^>]*id="stay-reset"/.test(html), 'reset is a keyboard button');
assert.ok(html.indexOf('Start a new stay') !== -1);
assert.ok(html.indexOf('assets/stay-select.js') !== -1);
assert.ok(html.indexOf('https://airbnb.com/h/an-tigin') !== -1);
assert.ok(html.indexOf('938334645264143712') === -1, 'room id is not hardcoded');
var daysAt = html.indexOf('id="cal-days"');
var summaryAt = html.indexOf('id="stay-summary"');
var bookAt = html.indexOf('id="stay-book"');
var legendAt = html.indexOf('class="legend"');
var eventsAt = html.indexOf('id="cal-evlist"');
assert.ok(daysAt !== -1 && daysAt < summaryAt && summaryAt < bookAt && bookAt < legendAt, 'dated booking button sits under the month grid');
assert.ok(bookAt < eventsAt, 'dated booking button is above the events list');
assert.ok(html.indexOf('id="airbnb-book"') !== -1);
assert.ok(html.indexOf('airbnb.href = selection.url') !== -1);
assert.ok(html.indexOf('airbnb.href = StaySelect.LISTING') !== -1);
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

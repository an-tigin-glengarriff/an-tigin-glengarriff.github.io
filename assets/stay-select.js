/* Four-night stay selection for the accommodation calendar.
   A clicked available date starts as the check-in. Nights are check-in + 0..3.
   Check-out is check-in + 4 and is not a stayed night (exclusive end).
   Busy nights come only from the calendar feed. The night before a booking
   and the checkout morning after one can both be stayed. If one of the next
   three nights is booked, the stay moves to the four free nights immediately
   before that booked night, and check-out is that morning, when those nights
   are free and not past. Dates are civil YYYY-MM-DD values. Adding days uses
   the UTC calendar, so a leap day or a daylight-saving change cannot skip
   or repeat a date. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.StaySelect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var NIGHTS = 4;
  var LISTING = 'https://airbnb.com/h/an-tigin';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function parseISO(iso) {
    if (typeof iso !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  function formatISO(y, m, d) {
    return y + '-' + pad(m) + '-' + pad(d);
  }

  function addDays(iso, n) {
    var p = parseISO(iso);
    if (!p || typeof n !== 'number' || n !== n || Math.floor(n) !== n) return null;
    var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return formatISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  function todayISO(now) {
    var dt = now || new Date();
    return formatISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  }

  function monthOffset(iso, today) {
    var p = parseISO(iso), t = parseISO(today);
    if (!p || !t) return null;
    return (p.y - t.y) * 12 + (p.m - t.m);
  }

  function nightBooked(iso, booked) {
    if (!iso || !booked) return false;
    for (var i = 0; i < booked.length; i++) {
      var r = booked[i];
      if (!r || !r.start || !r.end) continue;
      if (iso >= r.start && iso < r.end) return true;
    }
    return false;
  }

  function airbnbUrl(checkIn, checkOut) {
    return LISTING + '?check_in=' + encodeURIComponent(checkIn) + '&check_out=' + encodeURIComponent(checkOut);
  }

  function selectStay(checkIn, options) {
    options = options || {};
    var nights = options.nights == null ? NIGHTS : options.nights;
    var today = options.today || null;
    var booked = options.booked || [];
    if (options.feedReady === false) return { ok: false, reason: 'feed', nightCount: nights };
    if (!parseISO(checkIn) || nights < 1) return { ok: false, reason: 'invalid', nightCount: nights };
    if (today && checkIn < today) return { ok: false, reason: 'past', clicked: checkIn, nightCount: nights };
    var span = [];
    for (var i = 0; i < nights; i++) span.push(addDays(checkIn, i));
    var checkOut = addDays(checkIn, nights);
    if (nightBooked(checkIn, booked)) {
      return { ok: false, reason: 'blocked', clicked: checkIn, checkIn: checkIn, blockedNight: checkIn, nights: span, nightCount: nights };
    }
    var firstBlocked = null;
    var firstOffset = -1;
    for (var j = 0; j < span.length; j++) {
      if (nightBooked(span[j], booked)) { firstBlocked = span[j]; firstOffset = j; break; }
    }
    if (!firstBlocked) {
      return {
        ok: true,
        reason: 'ok',
        shifted: false,
        clicked: checkIn,
        checkIn: checkIn,
        checkOut: checkOut,
        nights: span,
        nightCount: nights,
        url: airbnbUrl(checkIn, checkOut)
      };
    }
    if (nights !== NIGHTS || firstOffset < 1 || firstOffset > 3) {
      return { ok: false, reason: 'blocked', clicked: checkIn, checkIn: checkIn, blockedNight: firstBlocked, nights: span, nightCount: nights };
    }
    var slotIn = addDays(firstBlocked, -NIGHTS);
    var shiftedNights = [];
    for (var s = 0; s < NIGHTS; s++) shiftedNights.push(addDays(slotIn, s));
    for (var k = 0; k < shiftedNights.length; k++) {
      if (today && shiftedNights[k] < today) {
        return { ok: false, reason: 'shift-past', clicked: checkIn, blockedNight: firstBlocked, nightCount: nights };
      }
      if (nightBooked(shiftedNights[k], booked)) {
        return { ok: false, reason: 'shift-blocked', clicked: checkIn, blockedNight: firstBlocked, nightCount: nights };
      }
    }
    return {
      ok: true,
      reason: 'shifted',
      shifted: true,
      clicked: checkIn,
      checkIn: slotIn,
      checkOut: firstBlocked,
      nights: shiftedNights,
      nightCount: NIGHTS,
      blockedNight: firstBlocked,
      url: airbnbUrl(slotIn, firstBlocked)
    };
  }

  /* Grow an existing stay earlier or later. Every night from the new
     check-in up to, but not including, the new checkout must be free.
     A failed extension does not replace the stay. */
  function extendStay(current, date, options) {
    options = options || {};
    var nights = current && current.nights ? current.nights.slice() : [];
    if (!current || !current.ok || !current.checkIn || !current.checkOut) {
      return { ok: false, reason: 'invalid', nightCount: nights.length };
    }
    if (options.feedReady === false) return { ok: false, reason: 'feed', nightCount: current.nightCount };
    if (!parseISO(date)) return { ok: false, reason: 'invalid', nightCount: current.nightCount };
    var today = options.today || null;
    var booked = options.booked || [];
    if (today && date < today) return { ok: false, reason: 'past', nightCount: current.nightCount };
    if (date >= current.checkIn && date < current.checkOut) {
      return { ok: false, reason: 'inside', nightCount: current.nightCount };
    }
    var newIn = current.checkIn;
    var newOut = current.checkOut;
    var direction = 'later';
    if (date < current.checkIn) {
      newIn = date;
      direction = 'earlier';
    } else {
      newOut = addDays(date, 1);
    }
    if (!newIn || !newOut || newOut <= newIn) return { ok: false, reason: 'invalid', nightCount: current.nightCount };
    var span = [];
    for (var cursor = newIn; cursor < newOut; cursor = addDays(cursor, 1)) {
      if (!cursor || span.length > 370) return { ok: false, reason: 'invalid', nightCount: current.nightCount };
      if (today && cursor < today) return { ok: false, reason: 'past', nightCount: current.nightCount };
      if (nightBooked(cursor, booked)) return { ok: false, reason: 'blocked', nightCount: current.nightCount };
      span.push(cursor);
    }
    if (span.length < NIGHTS) return { ok: false, reason: 'short', nightCount: current.nightCount };
    return {
      ok: true,
      reason: 'extended',
      shifted: false,
      extended: true,
      direction: direction,
      clicked: current.clicked || current.checkIn,
      checkIn: newIn,
      checkOut: newOut,
      nights: span,
      nightCount: span.length,
      url: airbnbUrl(newIn, newOut)
    };
  }

  /* With a stay already chosen, a free date that joins it without crossing a
     booked night adds those nights. A free date that cannot be added, but can
     start its own stay, replaces the selection. A past or booked date leaves
     the current stay in place. */
  function chooseDate(current, date, options) {
    if (!current || !current.ok) {
      var created = selectStay(date, options);
      return { action: created.ok ? 'new' : 'reject', stay: created.ok ? created : null, result: created };
    }
    if (date >= current.checkIn && date < current.checkOut) {
      return { action: 'keep', stay: current, result: { ok: false, reason: 'inside', nightCount: current.nightCount } };
    }
    var ext = extendStay(current, date, options);
    if (ext.ok) return { action: 'extend', stay: ext, result: ext };
    if (ext.reason === 'past' || ext.reason === 'feed') return { action: 'keep', stay: current, result: ext };
    var next = selectStay(date, options);
    if (next.ok) return { action: 'change', stay: next, result: next };
    return { action: 'keep', stay: current, result: ext.reason === 'blocked' ? ext : next };
  }

  function extendReason(result) {
    if (!result || result.ok) return '';
    if (result.reason === 'past') return 'That date has already passed. The selected stay is unchanged.';
    if (result.reason === 'blocked') return 'A booked night is in the way, so those nights were not added. Press Clear selected dates to choose a different stay.';
    if (result.reason === 'inside') return 'Those nights are already in this stay. Choose a free date before or after them to add nights, or press Clear selected dates.';
    if (result.reason === 'feed') return 'Availability is not loaded, so the stay was not extended.';
    if (result.reason === 'short') return 'A stay has to be at least 4 nights. The selected stay is unchanged.';
    return 'That date can\u2019t be added. The selected stay is unchanged.';
  }

  function weekdayIndex(iso) {
    var p = parseISO(iso);
    if (!p) return null;
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  }

  function longDate(iso) {
    var p = parseISO(iso);
    if (!p) return '';
    return WEEKDAYS[weekdayIndex(iso)] + ' ' + p.d + ' ' + MONTHS[p.m - 1] + ' ' + p.y;
  }

  function summary(stay) {
    if (!stay || !stay.ok) return '';
    var line = 'Check-in ' + longDate(stay.checkIn) + '. Check-out at 11am on ' + longDate(stay.checkOut) + '. ' + stay.nightCount + ' nights.';
    if (stay.shifted) return 'This stay moved to the four nights before the booked date. ' + line;
    return line;
  }

  function reasonText(stay) {
    if (!stay || stay.ok) return '';
    var n = stay.nightCount || NIGHTS;
    if (stay.reason === 'past') return 'That date has already passed.';
    if (stay.reason === 'blocked' && stay.blockedNight && stay.blockedNight === stay.checkIn) return 'That night is already booked.';
    if (stay.reason === 'blocked') return 'A booked night falls in those ' + n + ' nights, so this check-in can\u2019t be used.';
    if (stay.reason === 'shift-past') return 'The four nights before that booked date include a past date, so this check-in can\u2019t be used.';
    if (stay.reason === 'shift-blocked') return 'The four nights before that booked date aren\u2019t all available, so this check-in can\u2019t be used.';
    if (stay.reason === 'feed') return 'Availability is not loaded, so these dates can\u2019t be confirmed here.';
    return 'That date can\u2019t be selected.';
  }

  function dayLabel(iso, ctx) {
    ctx = ctx || {};
    var name = longDate(iso);
    if (!name) return '';
    var text = name + '.';
    if (ctx.feedReady === false) return text + ' Availability not loaded.';
    if (ctx.past) return text + ' Past.';
    if (ctx.booked) return text + ' Booked.';
    var total = ctx.nightCount || 4;
    if (ctx.role === 'checkin') return text + ' Check-in, night 1 of ' + total + '.';
    if (ctx.role === 'night') return text + ' Night ' + ctx.nightIndex + ' of ' + total + '.';
    return text + ' Available. Selects 4 nights from this check-in.';
  }

  function ctaLabel(stay) {
    if (!stay || !stay.ok) return '';
    return 'Book these dates on Airbnb, check-in ' + stay.checkIn + ', check-out at 11am on ' + stay.checkOut + ', ' + stay.nightCount + ' nights. Opens Airbnb, which confirms availability and price.';
  }

  function moveDate(iso, key) {
    if (key === 'ArrowLeft') return addDays(iso, -1);
    if (key === 'ArrowRight') return addDays(iso, 1);
    if (key === 'ArrowUp') return addDays(iso, -7);
    if (key === 'ArrowDown') return addDays(iso, 7);
    return null;
  }

  return {
    NIGHTS: NIGHTS,
    LISTING: LISTING,
    MIN_COPY: 'Minimum stay: 4 nights',
    parseISO: parseISO,
    addDays: addDays,
    todayISO: todayISO,
    monthOffset: monthOffset,
    nightBooked: nightBooked,
    airbnbUrl: airbnbUrl,
    selectStay: selectStay,
    extendStay: extendStay,
    extendReason: extendReason,
    chooseDate: chooseDate,
    longDate: longDate,
    summary: summary,
    reasonText: reasonText,
    dayLabel: dayLabel,
    ctaLabel: ctaLabel,
    moveDate: moveDate
  };
});

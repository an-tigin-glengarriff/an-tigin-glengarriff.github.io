/* Four-night stay selection for the accommodation calendar.
   A clicked available date starts as the check-in. Nights are check-in + 0..3.
   Check-out is check-in + 4 and is not a stayed night (exclusive end).
   Busy ranges are occupied nights from the Airbnb calendar. Their end is the
   checkout morning. The feed does not insert a turnover gap, so this page
   keeps two clear days outside each busy range: check-out at least two days
   before the next check-in, and check-in at least two days after the previous
   checkout. A stay that would crowd the next booking moves to the four nights
   that finish two days before it, when those nights are free and not past.
   Dates are civil YYYY-MM-DD values. Adding days uses the UTC calendar,
   so a leap day or a daylight-saving change cannot skip or repeat a date. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof root !== 'undefined') root.StaySelect = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var NIGHTS = 4;
  var GAP = 2;
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

  function ranges(booked) {
    var list = [];
    for (var i = 0; i < (booked || []).length; i++) {
      var r = booked[i];
      if (!r || !parseISO(r.start) || !parseISO(r.end) || !(r.start < r.end)) continue;
      list.push(r);
    }
    return list;
  }

  /* A stay is clear of a busy range when it checks out at least two days
     before that check-in, or checks in at least two days after that checkout. */
  function crowded(checkIn, checkOut, booked) {
    var list = ranges(booked);
    var found = [];
    for (var i = 0; i < list.length; i++) {
      var beforeSafe = checkOut <= addDays(list[i].start, -GAP);
      var afterSafe = checkIn >= addDays(list[i].end, GAP);
      if (!beforeSafe && !afterSafe) found.push(list[i]);
    }
    return found;
  }

  function judge(checkIn, nights, booked, today) {
    if (today && checkIn < today) return { ok: false, reason: 'past' };
    var span = [];
    for (var i = 0; i < nights; i++) span.push(addDays(checkIn, i));
    var checkOut = addDays(checkIn, nights);
    if (nightBooked(checkIn, booked)) {
      return { ok: false, reason: 'blocked', blockedNight: checkIn, nights: span, checkOut: checkOut };
    }
    var bad = crowded(checkIn, checkOut, booked);
    if (!bad.length) return { ok: true, nights: span, checkOut: checkOut };
    var before = null;
    for (var j = 0; j < bad.length; j++) {
      if (checkIn < bad[j].start && (!before || bad[j].start < before.start)) before = bad[j];
    }
    if (before) return { ok: false, reason: 'before', booking: before, nights: span, checkOut: checkOut };
    return { ok: false, reason: 'gap-after', nights: span, checkOut: checkOut };
  }

  function selectStay(checkIn, options) {
    options = options || {};
    var nights = options.nights == null ? NIGHTS : options.nights;
    var today = options.today || null;
    var booked = options.booked || [];
    if (options.feedReady === false) return { ok: false, reason: 'feed', nightCount: nights };
    if (!parseISO(checkIn) || nights < 1) return { ok: false, reason: 'invalid', nightCount: nights };
    var judged = judge(checkIn, nights, booked, today);
    if (judged.ok) {
      return {
        ok: true,
        reason: 'ok',
        shifted: false,
        clicked: checkIn,
        checkIn: checkIn,
        checkOut: judged.checkOut,
        nights: judged.nights,
        nightCount: nights,
        url: airbnbUrl(checkIn, judged.checkOut)
      };
    }
    if (judged.reason !== 'before' || nights !== NIGHTS) {
      return {
        ok: false,
        reason: judged.reason,
        clicked: checkIn,
        checkIn: checkIn,
        checkOut: judged.checkOut,
        nights: judged.nights,
        nightCount: nights,
        blockedNight: judged.blockedNight || (judged.booking && judged.booking.start)
      };
    }
    var arrival = judged.booking.start;
    var slotIn = addDays(arrival, -(NIGHTS + GAP));
    var slot = judge(slotIn, NIGHTS, booked, today);
    if (!slot.ok) {
      var pastSlot = today && slotIn < today;
      return {
        ok: false,
        reason: pastSlot || slot.reason === 'past' ? 'shift-past' : 'shift-blocked',
        clicked: checkIn,
        blockedNight: arrival,
        nightCount: nights
      };
    }
    return {
      ok: true,
      reason: 'shifted',
      shifted: true,
      clicked: checkIn,
      checkIn: slotIn,
      checkOut: slot.checkOut,
      nights: slot.nights,
      nightCount: NIGHTS,
      blockedNight: arrival,
      url: airbnbUrl(slotIn, slot.checkOut)
    };
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
    var line = 'Check-in ' + longDate(stay.checkIn) + '. Check-out ' + longDate(stay.checkOut) + '. ' + stay.nightCount + ' nights.';
    if (stay.shifted) return 'This stay moved so two clear days remain before the next booking. ' + line;
    return line;
  }

  function reasonText(stay) {
    if (!stay || stay.ok) return '';
    var n = stay.nightCount || NIGHTS;
    if (stay.reason === 'past') return 'That date has already passed.';
    if (stay.reason === 'blocked' && stay.blockedNight && stay.blockedNight === stay.checkIn) return 'That night is already booked.';
    if (stay.reason === 'blocked') return 'A booked night falls in those ' + n + ' nights, so this check-in can\u2019t be used.';
    if (stay.reason === 'gap-after') return 'Two clear days are needed after the previous stay, so this check-in can\u2019t be used.';
    if (stay.reason === 'shift-past') return 'The four nights that leave two clear days before that booking include a past date, so this check-in can\u2019t be used.';
    if (stay.reason === 'shift-blocked') return 'The four nights that leave two clear days before that booking aren\u2019t all available, so this check-in can\u2019t be used.';
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
    if (ctx.role === 'checkin') return text + ' Check-in, night 1 of 4.';
    if (ctx.role === 'night') return text + ' Night ' + ctx.nightIndex + ' of 4.';
    return text + ' Available. Selects 4 nights from this check-in.';
  }

  function ctaLabel(stay) {
    if (!stay || !stay.ok) return '';
    return 'Book these dates on Airbnb, check-in ' + stay.checkIn + ', check-out ' + stay.checkOut + ', ' + stay.nightCount + ' nights. Opens Airbnb, which confirms availability and price.';
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
    GAP: GAP,
    LISTING: LISTING,
    MIN_COPY: 'Minimum stay: 4 nights',
    parseISO: parseISO,
    addDays: addDays,
    todayISO: todayISO,
    monthOffset: monthOffset,
    nightBooked: nightBooked,
    airbnbUrl: airbnbUrl,
    selectStay: selectStay,
    longDate: longDate,
    summary: summary,
    reasonText: reasonText,
    dayLabel: dayLabel,
    ctaLabel: ctaLabel,
    moveDate: moveDate
  };
});

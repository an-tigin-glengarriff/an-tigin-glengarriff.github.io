#!/usr/bin/env python3
"""Fetch the PUBLIC 'West Cork Events' Google Calendar iCal and write events.json
(all-day events, yearly RRULEs expanded ~18 months ahead). On failure, leaves the old events.
Also writes a "holidays" list: Republic of Ireland public (bank) holidays computed from the
statutory rules for the same window (actual dates; no substitute days)."""
import json, os, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone
from dateutil.rrule import rrulestr
from dateutil.easter import easter

import urllib.parse
# The calendar ID is configured in ONE place: the WEST_CORK_CALENDAR_ID env var
# in .github/workflows/update-availability.yml. It is copied into events.json so
# for reference (the website does not use it).
CAL_ID = os.environ.get("WEST_CORK_CALENDAR_ID", "").strip()
ICS_URL = ("https://calendar.google.com/calendar/ical/"
           + urllib.parse.quote(CAL_ID, safe="") + "/public/basic.ics")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "events.json")

def d8(v):
    v = v.strip()[:8]; return date(int(v[:4]), int(v[4:6]), int(v[6:8]))

def unesc(v):
    return v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")

# ---------- Geocoding (event location -> lat/lng) ----------
# Results are cached in data/geocode-cache.json (committed) so the hourly run only
# queries OpenStreetMap Nominatim for locations it has never seen (max 1 req/s).
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "geocode-cache.json")
NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = "an-tigin-events/1.0 (https://an-tigin.ie; an.tigin.glengarriff@gmail.com)"
# Rough box around West Cork / South Kerry; results outside it are rejected.
BOX = (51.25, 52.30, -10.60, -8.20)  # lat min/max, lng min/max
# Town names used as a fallback when the full location can't be found.
TOWNS = ["Glengarriff", "Bantry", "Ballylickey", "Kenmare", "Kinsale", "Schull", "Skibbereen",
         "Castletownbere", "Eyeries", "Allihies", "Adrigole", "Bere Island", "Durrus", "Ahakista",
         "Ballydehob", "Baltimore", "Clonakilty", "Drimoleague", "Dunmanway", "Rosscarbery",
         "Union Hall", "Castletownshend", "Goleen", "Crookhaven", "Cape Clear", "Sherkin",
         "Whiddy Island", "Rerrin", "Kilcrohane", "Lauragh", "Ardgroom", "Sneem", "Timoleague", "Courtmacsherry"]
# Locations that span many places are listed as "location not mapped" instead of a misleading pin.
MULTI = re.compile(r"\b(across|nationwide|various|venues)\b", re.I)
_last_q = [0.0]

def _nominatim(q):
    import time
    wait = 1.1 - (time.time() - _last_q[0])
    if wait > 0: time.sleep(wait)
    _last_q[0] = time.time()
    url = NOMINATIM + "?" + urllib.parse.urlencode({"q": q, "format": "jsonv2", "limit": 1, "countrycodes": "ie",
        "viewbox": f"{BOX[2]},{BOX[1]},{BOX[3]},{BOX[0]}", "bounded": 1})
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en"})
        with urllib.request.urlopen(req, timeout=20) as r: res = json.load(r)
    except Exception as e:
        print(f"  geocode error for {q!r}: {type(e).__name__}"); return None, False
    if not res: return None, True
    lat, lng = float(res[0]["lat"]), float(res[0]["lon"])
    if not (BOX[0] <= lat <= BOX[1] and BOX[2] <= lng <= BOX[3]): return None, True
    return (round(lat, 6), round(lng, 6)), True

def _km(a, b):
    import math
    dy = (a[0] - b[0]) * 111.2; dx = (a[1] - b[1]) * 111.2 * math.cos(math.radians(a[0]))
    return (dx * dx + dy * dy) ** 0.5

def _town_in(loc):
    hits = [(loc.lower().find(t.lower()), t) for t in TOWNS if t.lower() in loc.lower()]
    return min(hits)[1] if hits else None

def geocode(loc, cache):
    """Return {"lat","lng","precision","matched"} or None. Uses/updates cache."""
    loc = (loc or "").strip()
    if not loc: return None
    if loc in cache: return cache[loc]
    out, ok = None, True
    if not MULTI.search(loc):
        town = _town_in(loc)
        tpos = None
        if town:
            key = "town:" + town
            if key not in cache:
                c, ok1 = _nominatim(town + ", Ireland")
                if not ok1: return None
                cache[key] = {"lat": c[0], "lng": c[1], "precision": "town", "matched": town} if c else None
            tpos = cache[key]
        q = re.sub(r"\s*\([^)]*\)", "", loc)
        # "Town" / "Town, Region": use the town's own point (the village centre).
        if tpos and q.split(",")[0].strip().lower() == town.lower():
            cache[loc] = dict(tpos); return cache[loc]
        c, ok = _nominatim(q)
        if not ok: return None  # network error: don't cache, retry next run
        # Accept the precise hit only if it is near the named town (guards against same-name places).
        if c and (not tpos or _km(c, (tpos["lat"], tpos["lng"])) <= 15):
            out = {"lat": c[0], "lng": c[1], "precision": "place", "matched": q}
        elif tpos:
            out = dict(tpos)
        else:
            for part in [x.strip() for x in q.split(",")][::-1]:
                if not part or part.lower().startswith("co."): continue
                c, ok = _nominatim(part + ", Ireland")
                if not ok: return None
                if c: out = {"lat": c[0], "lng": c[1], "precision": "town", "matched": part}; break
    cache[loc] = out
    return out

def add_coords(events):
    try:
        with open(CACHE) as f: cache = json.load(f)
    except Exception: cache = {}
    before = json.dumps(cache, sort_keys=True)
    for e in events:
        g = geocode(e.get("location", ""), cache)
        for k in ("lat", "lng", "geo_precision"): e.pop(k, None)
        if g: e["lat"], e["lng"], e["geo_precision"] = g["lat"], g["lng"], g["precision"]
    if json.dumps(cache, sort_keys=True) != before:
        os.makedirs(os.path.dirname(CACHE), exist_ok=True)
        with open(CACHE, "w") as f: json.dump(cache, f, indent=2, ensure_ascii=False, sort_keys=True); f.write("\n")
        print("Updated geocode cache.")
    return events

def _first_monday(y, m):
    d = date(y, m, 1); return d + timedelta(days=(0 - d.weekday()) % 7)

def _last_monday(y, m):
    d = date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1)
    return d - timedelta(days=d.weekday())

def ie_holidays(y):
    """Republic of Ireland public holidays for year y (Organisation of Working Time Act 1997, as amended)."""
    feb1 = date(y, 2, 1)
    brigid = feb1 if feb1.weekday() == 4 else _first_monday(y, 2)
    h = [(date(y, 1, 1), "New Year's Day"), (brigid, "St Brigid's Day"),
         (date(y, 3, 17), "St Patrick's Day"), (easter(y) + timedelta(days=1), "Easter Monday"),
         (_first_monday(y, 5), "May Bank Holiday"), (_first_monday(y, 6), "June Bank Holiday"),
         (_first_monday(y, 8), "August Bank Holiday"), (_last_monday(y, 10), "October Bank Holiday"),
         (date(y, 12, 25), "Christmas Day"), (date(y, 12, 26), "St Stephen's Day")]
    if y < 2023: h = [x for x in h if x[1] != "St Brigid's Day"]
    return h

def holidays_window(today, horizon):
    out = []
    for y in range(today.year, horizon.year + 1):
        for d, n in ie_holidays(y):
            if today <= d <= horizon: out.append({"date": d.isoformat(), "name": n})
    return sorted(out, key=lambda x: x["date"])

def load_old():
    try:
        with open(OUT) as f: return json.load(f)
    except Exception: return {}

def write(old, events, cal_id, ics_url, holidays):
    if (old.get("events") == events and old.get("calendar_id") == cal_id
            and old.get("holidays") == holidays):
        print(f"No change ({len(events)} events, {len(holidays)} holidays)."); return
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "calendar_id": cal_id, "ics_url": ics_url,
            "note": "all-day events; end dates are exclusive. lat/lng geocoded from location (OpenStreetMap Nominatim, cached in data/geocode-cache.json; geo_precision place|town; missing = not mapped). holidays = Republic of Ireland public holidays (actual dates, no substitute days)",
            "events": events, "holidays": holidays}
    with open(OUT, "w") as f: json.dump(data, f, indent=2, ensure_ascii=False); f.write("\n")
    print(f"Wrote {len(events)} events, {len(holidays)} holidays.")

def keep_old_events(reason):
    """Event fetch failed: keep the old events but still refresh holidays."""
    old = load_old(); today = date.today()
    print(f"{reason}; keeping existing events.")
    write(old, add_coords([dict(e) for e in old.get("events", [])]), old.get("calendar_id", CAL_ID), old.get("ics_url", ICS_URL),
          holidays_window(today, today + timedelta(days=548)))
    return 0

def main():
    if not CAL_ID:
        return keep_old_events("WEST_CORK_CALENDAR_ID not set")
    try:
        req = urllib.request.Request(ICS_URL, headers={"User-Agent": "an-tigin-events/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8", "replace")
    except Exception as e:
        return keep_old_events(f"Fetch failed ({type(e).__name__})")
    if "BEGIN:VCALENDAR" not in text:
        return keep_old_events("Not an iCal")
    text = re.sub(r"\r?\n[ \t]", "", text)
    vevents, cur = [], None
    for line in text.splitlines():
        if line == "BEGIN:VEVENT": cur = {"exdate": []}
        elif line == "END:VEVENT":
            if cur and "s" in cur: vevents.append(cur)
            cur = None
        elif cur is not None:
            k, _, v = line.partition(":"); k = k.split(";")[0]
            try:
                if k == "DTSTART": cur["s"] = d8(v)
                elif k == "DTEND": cur["e"] = d8(v)
                elif k == "RRULE": cur["rrule"] = v
                elif k == "EXDATE": cur["exdate"] += [d8(x) for x in v.split(",")]
                elif k == "RECURRENCE-ID": cur["rid"] = d8(v)
                elif k in ("SUMMARY", "LOCATION", "DESCRIPTION", "UID", "STATUS"): cur[k.lower()] = unesc(v)
            except ValueError: pass
    today = date.today()
    horizon = today + timedelta(days=548)
    overrides = {}
    for ev in vevents:
        if "rid" in ev: overrides.setdefault(ev.get("uid"), {})[ev["rid"]] = ev
    out = []
    def add(ev, s):
        dur = (ev.get("e", ev["s"] + timedelta(days=1)) - ev["s"])
        e = s + dur
        if e <= today or s > horizon or ev.get("status") == "CANCELLED": return
        desc = ev.get("description", "")
        urls = re.findall(r"https?://\S+", desc)
        text_ = re.sub(r"https?://\S+", "", desc).strip()
        out.append({"name": ev.get("summary", "Event"), "start": s.isoformat(), "end": e.isoformat(),
                    "location": ev.get("location", ""), "description": text_, "url": urls[-1] if urls else ""})
    for ev in vevents:
        if "rid" in ev: continue
        if "rrule" in ev:
            start_dt = datetime.combine(ev["s"], datetime.min.time())
            rule = rrulestr(ev["rrule"], dtstart=start_dt)
            ov = overrides.get(ev.get("uid"), {})
            for occ in rule.between(start_dt, datetime.combine(horizon, datetime.min.time()), inc=True):
                s = occ.date()
                if s in ev["exdate"]: continue
                if s in ov: add(ov[s], ov[s]["s"])
                else: add(ev, s)
        else:
            add(ev, ev["s"])
    out.sort(key=lambda x: (x["start"], x["name"]))
    write(load_old(), add_coords(out), CAL_ID, ICS_URL, holidays_window(today, horizon))
    return 0

if __name__ == "__main__":
    sys.exit(main())

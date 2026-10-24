#!/usr/bin/env python3
"""Fetch the PUBLIC 'West Cork Events' Google Calendar iCal and write events.json
(all-day events, yearly RRULEs expanded ~18 months ahead). On failure, leaves the old file."""
import json, os, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone
from dateutil.rrule import rrulestr

import urllib.parse
# The calendar ID is configured in ONE place: the WEST_CORK_CALENDAR_ID env var
# in .github/workflows/update-availability.yml. It is copied into events.json so
# the website builds its subscribe links from it.
CAL_ID = os.environ.get("WEST_CORK_CALENDAR_ID", "").strip()
ICS_URL = ("https://calendar.google.com/calendar/ical/"
           + urllib.parse.quote(CAL_ID, safe="") + "/public/basic.ics")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "events.json")

def d8(v):
    v = v.strip()[:8]; return date(int(v[:4]), int(v[4:6]), int(v[6:8]))

def unesc(v):
    return v.replace("\\n", "\n").replace("\\N", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")

def main():
    if not CAL_ID:
        print("WEST_CORK_CALENDAR_ID not set; leaving existing file."); return 0
    try:
        req = urllib.request.Request(ICS_URL, headers={"User-Agent": "an-tigin-events/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"Fetch failed ({type(e).__name__}); leaving existing file."); return 0
    if "BEGIN:VCALENDAR" not in text:
        print("Not an iCal; leaving existing file."); return 0
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
    try:
        with open(OUT) as f: old = json.load(f)
        if old.get("events") == out and old.get("calendar_id") == CAL_ID:
            print(f"No change ({len(out)} events)."); return 0
    except Exception: pass
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "calendar_id": CAL_ID,
            "ics_url": ICS_URL,
            "note": "all-day events; end dates are exclusive", "events": out}
    with open(OUT, "w") as f: json.dump(data, f, indent=2, ensure_ascii=False); f.write("\n")
    print(f"Wrote {len(out)} events.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

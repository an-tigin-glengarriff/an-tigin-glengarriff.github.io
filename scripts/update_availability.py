#!/usr/bin/env python3
"""Fetch the Airbnb iCal (URL from env AIRBNB_ICAL_URL) and write availability.json
with booked date ranges only. Never prints the URL. On failure, leaves the old file."""
import json, os, re, sys, urllib.request
from datetime import date, datetime, timedelta, timezone

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "availability.json")

def parse_date(v):
    v = v.strip()[:8]
    return date(int(v[:4]), int(v[4:6]), int(v[6:8]))

def main():
    url = os.environ.get("AIRBNB_ICAL_URL", "")
    if not url:
        print("AIRBNB_ICAL_URL not set; leaving existing file."); return 0
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "an-tigin-availability/1.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            text = r.read().decode("utf-8", "replace")
    except Exception as e:
        print(f"Fetch failed ({type(e).__name__}); leaving existing file."); return 0
    if "BEGIN:VCALENDAR" not in text:
        print("Response is not an iCal; leaving existing file."); return 0
    text = re.sub(r"\r?\n[ \t]", "", text)  # unfold
    ranges, cur = [], None
    for line in text.splitlines():
        if line == "BEGIN:VEVENT": cur = {}
        elif line == "END:VEVENT":
            if cur and "s" in cur:
                s = cur["s"]; e = cur.get("e", s + timedelta(days=1))
                if e > s: ranges.append([s, e])
            cur = None
        elif cur is not None:
            k, _, v = line.partition(":")
            k = k.split(";")[0]
            try:
                if k == "DTSTART": cur["s"] = parse_date(v)
                elif k == "DTEND": cur["e"] = parse_date(v)
            except ValueError: pass
    ranges.sort()
    merged = []
    for s, e in ranges:
        if merged and s <= merged[-1][1]: merged[-1][1] = max(merged[-1][1], e)
        else: merged.append([s, e])
    cutoff = date.today() - timedelta(days=31)
    booked = [{"start": s.isoformat(), "end": e.isoformat()} for s, e in merged if e >= cutoff]
    try:
        with open(OUT) as f: old = json.load(f)
        if old.get("booked") == booked:
            print(f"No change ({len(booked)} ranges)."); return 0
    except Exception: pass
    data = {"updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "note": "end dates are exclusive (checkout day is available)", "booked": booked}
    with open(OUT, "w") as f: json.dump(data, f, indent=2); f.write("\n")
    print(f"Wrote {len(booked)} booked ranges.")
    return 0

if __name__ == "__main__":
    sys.exit(main())

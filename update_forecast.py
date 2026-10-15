"""Download the Forex Factory weekly calendar (server side, so no browser CORS problem)
and save it to data/forecast.json. Keeps the old file if the download fails."""
import json, sys, time, urllib.request, datetime

URLS = [
    "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
    "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
]

def get(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.load(r)
            if isinstance(data, list):
                return data
        except Exception as e:
            print("retry", url, e)
            time.sleep(5 * (attempt + 1))
    return []

events = []
for u in URLS:
    events += get(u)

if not events:
    print("No data downloaded, keeping existing file")
    sys.exit(0)

with open("data/forecast.json", "w") as f:
    json.dump({"updated": datetime.datetime.utcnow().isoformat() + "Z", "events": events}, f)
print("Saved", len(events), "events")

# Macro Trader

Installable web app (PWA) for trading US economic news on EURUSD, XAUUSD, GBPUSD and USDJPY.

- Countdown to the next **CPI**, **NFP** and **Fed rate decision** (shown in your local time)
- Live TradingView chart and Buy/Sell gauge
- BUY / SELL / WAIT signal from actual vs forecast
- Auto forecast (free Forex Factory feed, no key) and a live TradingView calendar that shows the Actual
- Alert 15 minutes before a release (while the app is open)

## Files
index.html, styles.css, app.js, manifest.webmanifest, sw.js, icons/

## Run locally
Open `index.html`, or run `python3 -m http.server` and visit http://localhost:8000

## Publish on GitHub Pages
Push to GitHub, then Settings -> Pages -> Deploy from branch `main`, root folder.
Your link: https://YOUR-USERNAME.github.io/REPO-NAME/

## Install on your phone
Open the Pages link in Chrome (Android): menu -> Install app.
Safari (iPhone): Share -> Add to Home Screen.

## Update dates
Edit the `EVENTS` list at the top of `app.js`.
Sources: bls.gov/schedule/news_release/cpi.htm, bls.gov/ces/publications/news-release-schedule.htm,
federalreserve.gov/monetarypolicy/fomccalendars.htm

## Disclaimer
Not financial advice. Trading is risky.

## Build the Android APK
Push to GitHub. The workflow in `.github/workflows/build-apk.yml` builds the APK.
Open the repo -> Actions -> latest run -> Artifacts -> `macro-trader-apk`. Unzip and install `app-debug.apk`.

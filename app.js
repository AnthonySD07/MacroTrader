// ================= CONFIG =================
// Dates/times are New York time. Sources: bls.gov (CPI, NFP) and federalreserve.gov (FOMC).
// Update these lists when new schedules are published.
const EVENTS = {
  CPI: {
    name: "US CPI (inflation)", time: [8, 30], unit: "%", threshold: 0.1,
    dates: [["2026-11-10", "Covers October 2026"], ["2026-12-10", "Covers November 2026"]],
    match: e => /(CPI|Inflation Rate).*YoY/i.test(e.event) && !/core/i.test(e.event)
  },
  NFP: {
    name: "US Non-Farm Payrolls", time: [8, 30], unit: "K jobs", threshold: 25,
    dates: [["2026-11-06", "Covers October 2026"], ["2026-12-04", "Covers November 2026"]],
    match: e => /non.?farm payrolls/i.test(e.event) && !/private|adp|revision/i.test(e.event)
  },
  FOMC: {
    name: "Fed Interest Rate Decision", time: [14, 0], unit: "%", threshold: 0.1,
    dates: [["2026-10-28", "October FOMC meeting"], ["2026-12-09", "December FOMC meeting"]],
    match: e => /fed interest rate decision/i.test(e.event)
  }
};
const POLL_MS = 15000;

// ================= TIME HELPERS =================
// New York wall-clock time -> real Date (handles daylight saving)
function etToDate(dateStr, hour, min) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hour, min));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p = Object.fromEntries(fmt.formatToParts(guess).map(x => [x.type, x.value]));
  const asNY = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);
  return new Date(guess.getTime() + (guess.getTime() - asNY));
}
const releaseTime = (key, d) => etToDate(d[0], ...EVENTS[key].time);

function nextRelease(key) {
  for (const d of EVENTS[key].dates) {
    const t = releaseTime(key, d);
    if (t.getTime() > Date.now()) return { t, ref: d[1] };
  }
  return null;
}
// Stays on a release for 3 hours after it happens so the result remains visible
function activeRelease(key) {
  for (const d of EVENTS[key].dates) {
    const t = releaseTime(key, d);
    if (Date.now() - t.getTime() < 3 * 3600 * 1000) return { t, ref: d[1] };
  }
  return null;
}

// ================= STATE / ELEMENTS =================
const $ = id => document.getElementById(id);
let current = "CPI";
let timer = null;

// ================= COUNTDOWN =================
function tick() {
  const r = nextRelease(current);
  const ev = EVENTS[current];
  $("evTitle").textContent = ev.name;
  if (!r) { $("countdown").textContent = "No dates left"; $("when").textContent = "Add new dates in app.js"; $("ref").textContent = ""; }
  else {
    let s = Math.floor((r.t - Date.now()) / 1000);
    const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600;
    const m = Math.floor(s / 60); s %= 60;
    $("countdown").textContent = `${d}d ${h}h ${m}m ${s}s`;
    $("when").textContent = r.t.toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) + " (your local time)";
    $("ref").textContent = `${r.ref} · ${String(ev.time[0]).padStart(2, "0")}:${String(ev.time[1]).padStart(2, "0")} New York time`;
  }
  // Banner: soonest event overall
  let best = null;
  for (const k of Object.keys(EVENTS)) { const n = nextRelease(k); if (n && (!best || n.t < best.t)) best = { k, t: n.t }; }
  if (best) {
    const hrs = Math.floor((best.t - Date.now()) / 3600000);
    $("nextUp").textContent = `Next up: ${best.k === "FOMC" ? "Fed Rate" : best.k} in ${hrs >= 48 ? Math.floor(hrs / 24) + " days" : hrs + " hours"}`;
  }
  checkAlerts();
}
setInterval(tick, 1000);


 // ================= NOTIFICATIONS =================

const isNativeApp = () =>
  !!window.Capacitor?.isNativePlatform?.();

function makeNotificationId(key, timestamp) {
  const input = `${key}-${timestamp}`;
  let hash = 0;

  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return (hash % 2000000000) + 1;
}

async function scheduleNativeAlerts() {
  const plugin = window.LocalNotifications;
  if (!plugin) throw new Error("Notification plugin not loaded.");

  let permission = await plugin.checkPermissions();

  if (permission.display !== "granted") {
    permission = await plugin.requestPermissions();
  }

  if (permission.display !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  // Cancel previously scheduled alerts before rebuilding the schedule.
  const pending = await plugin.getPending();

  if (pending.notifications.length) {
    await plugin.cancel({
      notifications: pending.notifications
    });
  }

  const now = Date.now();
  const notifications = [];

  for (const key of Object.keys(EVENTS)) {
    for (const date of EVENTS[key].dates) {
      const release = releaseTime(key, date);
      const alertAt = new Date(release.getTime() - 15 * 60000);

      if (alertAt.getTime() <= now) continue;

      notifications.push({
        id: makeNotificationId(key, release.getTime()),
        title: `${EVENTS[key].name} in 15 minutes`,
        body: `${date[1]}. Open Macro Trader to prepare.`,
        schedule: { at: alertAt },
        extra: {
          event: key,
          releaseTime: release.toISOString()
        }
      });
    }
  }

  if (notifications.length) {
    await plugin.schedule({ notifications });
  }

  return notifications.length;
}

async function enableAlerts() {
  const button = $("notify");
  button.disabled = true;
  button.textContent = "Enabling alerts...";

  try {
    if (isNativeApp()) {
      const count = await scheduleNativeAlerts();

      localStorage.setItem("alerts", "1");
      button.textContent = count
        ? `🔔 Alerts on (${count} scheduled)`
        : "🔔 Enabled — no future dates";

      return;
    }

    if (!("Notification" in window) ||
        !("serviceWorker" in navigator)) {
      button.textContent = "Notifications unsupported";
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      button.textContent = "Allow notifications in browser settings";
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    localStorage.setItem("alerts", "1");
    button.textContent = "🔔 Web alerts enabled";

    checkAlerts();

  } catch (error) {
    console.error("Notification setup failed:", error);
    button.textContent = "Alert setup failed — tap to retry";
  } finally {
    button.disabled = false;
  }
}

async function checkAlerts() {
  if (localStorage.getItem("alerts") !== "1") return;
  if (isNativeApp()) return;

  if (!("Notification" in window) ||
      Notification.permission !== "granted") return;

  for (const key of Object.keys(EVENTS)) {
    const release = nextRelease(key);
    if (!release) continue;

    const mins = (release.t.getTime() - Date.now()) / 60000;
    const id = `notified-${key}-${release.t.getTime()}`;

    if (mins <= 15 && mins > 0 &&
        !sessionStorage.getItem(id)) {

      // Prevent repeated notifications during the countdown.
      sessionStorage.setItem(id, "1");

      try {
        const registration = await navigator.serviceWorker.ready;

        await registration.showNotification(
          `${EVENTS[key].name} in ${Math.ceil(mins)} minutes`,
          {
            body: "Open Macro Trader and prepare for the release.",
            icon: "icons/icon-192.png",
            badge: "icons/icon-192.png",
            tag: id,
            data: { url: "./index.html" }
          }
        );
      } catch (error) {
        console.error("Could not show web notification:", error);
      }
    }
  }
}

$("notify").addEventListener("click", enableAlerts);

if (localStorage.getItem("alerts") === "1") {
  $("notify").textContent = "🔔 Alerts enabled";

  if (isNativeApp()) {
    scheduleNativeAlerts().catch(error => {
      console.error("Could not reschedule alerts:", error);
      $("notify").textContent = "Tap to enable alerts";
    });
  }
}


// ================= TRADINGVIEW =================
function widget(id, script, config) {
  const el = $(id); el.innerHTML = "";
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/external-embedding/" + script;
  s.async = true; s.innerHTML = JSON.stringify(config);
  el.appendChild(s);
}
function loadCharts() {
  const [symbol] = $("market").value.split("|");
  widget("chart", "embed-widget-advanced-chart.js", { autosize: true, symbol, interval: "5", timezone: "Etc/UTC",
    theme: "dark", style: "1", locale: "en", allow_symbol_change: false });
  widget("cal", "embed-widget-events.js", { colorTheme: "dark", isTransparent: true, width: "100%", height: "100%",
    locale: "en", importanceFilter: "0,1", countryFilter: "us" });
  widget("ta", "embed-widget-technical-analysis.js", { interval: "5m", width: "100%", height: "100%", symbol,
    showIntervalTabs: true, colorTheme: "dark", locale: "en", isTransparent: true });
}
$("market").addEventListener("change", () => { loadCharts(); $("signal").style.display = "none"; $("why").textContent = ""; });

// ================= SIGNAL =================
function runSignal() {
  const f = parseFloat($("forecast").value), a = parseFloat($("actual").value);
  if (isNaN(f) || isNaN(a)) return;
  const ev = EVENTS[current];
  const [symbol, rule] = $("market").value.split("|");
  const diff = +(a - f).toFixed(2);
  let sig = "WAIT", text;
  if (Math.abs(diff) < ev.threshold) {
    text = `Actual ${a}${ev.unit} is in line with forecast ${f}${ev.unit}. No edge, stay out.`;
  } else {
    const strong = diff > 0;
    sig = (strong === (rule === "BUY_ON_HOT")) ? "BUY" : "SELL";
    const word = current === "FOMC" ? (strong ? "MORE HAWKISH" : "MORE DOVISH") : (strong ? "STRONGER/HOTTER" : "WEAKER/COOLER");
    text = `Result was ${word} than expected (difference ${diff} ${ev.unit}), so the USD is expected to ${strong ? "strengthen" : "weaken"}. ` +
           `Confirm with the gauge below, wait for a 5-minute candle close, and put your stop beyond the spike high/low.`;
  }
  const box = $("signal");
  box.className = sig; box.textContent = `${sig} ${symbol.split(":")[1]}`; box.style.display = "block";
  $("why").textContent = text;
}
$("forecast").addEventListener("input", runSignal);
$("actual").addEventListener("input", runSignal);

// ================= AUTO FORECAST (free Forex Factory weekly feed, no key) =================
// The feed has forecast + previous but not the released actual, so you type the actual
// (read it from the live calendar in the app) and the signal appears instantly.
const FF_URLS = ["https://nfs.faireconomy.media/ff_calendar_thisweek.json", "https://nfs.faireconomy.media/ff_calendar_nextweek.json"];
const FF_MATCH = { CPI: /^CPI y\/y$/i, NFP: /non-farm employment change/i, FOMC: /federal funds rate/i };

function parseNum(str) {
  if (str == null || str === "") return NaN;
  const m = /(-?[\d.]+)\s*([KMB%]?)/i.exec(String(str));
  if (!m) return NaN;
  let v = parseFloat(m[1]); const u = m[2].toUpperCase();
  if (u === "M") v *= 1000; if (u === "B") v *= 1e6; // K is already thousands
  return v;
}

async function getFF() {
  try { // cache 30 min: the feed is rate limited
    const c = JSON.parse(localStorage.getItem("ffCache") || "null");
    if (c && Date.now() - c.t < 30 * 60000) return c.data;
  } catch (e) {}
  try { // 1) same-site file refreshed every 30 min by the GitHub workflow (no browser blocking)
    const r = await fetch("data/forecast.json?" + Date.now());
    if (r.ok) {
      const j = await r.json();
      if (j.events && j.events.length) {
        try { localStorage.setItem("ffCache", JSON.stringify({ t: Date.now(), data: j.events })); } catch (e) {}
        return j.events;
      }
    }
  } catch (e) {}
  // 2) direct from the feed (works in the Android app, may be blocked in a browser)
  const res = await Promise.allSettled(FF_URLS.map(u => fetch(u).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })));
  const data = res.filter(r => r.status === "fulfilled").flatMap(r => r.value);
  if (!data.length) throw new Error(res[0].reason ? res[0].reason.message : "no data");
  try { localStorage.setItem("ffCache", JSON.stringify({ t: Date.now(), data })); } catch (e) {}
  return data;
}

async function loadForecast() {
  const rel = activeRelease(current);
  if (!rel) { $("status").textContent = "No dates configured."; return; }
  try {
    const data = await getFF();
    const ev = data.find(e => e.country === "USD" && FF_MATCH[current].test(e.title) && Math.abs(new Date(e.date) - rel.t) < 30 * 3600000);
    if (!ev) { $("status").textContent = "Forecast is published in the week of the release. Check back then, or type it in."; return; }
    const f = parseNum(ev.forecast);
    if (!isNaN(f) && $("forecast").value === "") $("forecast").value = f;
    $("status").textContent = `Forecast ${ev.forecast || "n/a"} (previous ${ev.previous || "n/a"}). Type the Actual when released, taken from the calendar below.`;
    runSignal();
  } catch (err) {
    $("status").textContent = `Could not load forecast (${err.message}). Type the numbers in manually.`;
  }
}

// ================= TABS =================
document.querySelectorAll("#tabs button").forEach(b => b.addEventListener("click", () => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.remove("active"));
  b.classList.add("active"); current = b.dataset.ev;
  document.querySelectorAll(".unit").forEach(u => u.textContent = "(" + EVENTS[current].unit + ")");
  $("forecast").value = ""; $("actual").value = ""; $("signal").style.display = "none"; $("why").textContent = "";
  $("status").textContent = "Loading forecast...";
  tick(); loadForecast();
}));

// ================= INIT =================
document.querySelectorAll(".unit").forEach(u => u.textContent = "(" + EVENTS[current].unit + ")");
loadCharts(); tick(); loadForecast(); setInterval(loadForecast, 30 * 60000);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

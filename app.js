const $ = (id) => document.getElementById(id);
const units = { temp: "celsius", wind: "kmh", precip: "mm" };
let place = { name: "Berlin", country: "Germany", latitude: 52.52, longitude: 13.41 };
let data = null;
let selectedDay = 0;

const ICONS = (code) => {
  if (code === 0) return "☀️";
  if (code <= 2) return "⛅";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 57) return "🌦️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌧️";
  if (code <= 86) return "🌨️";
  return "⛈️";
};

/* ---------- fetching ---------- */
async function geocode(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`);
  const j = await r.json();
  return j.results ? j.results[0] : null;
}

async function load() {
  const p = new URLSearchParams({
    latitude: place.latitude,
    longitude: place.longitude,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code",
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    temperature_unit: units.temp,
    wind_speed_unit: units.wind,
    precipitation_unit: units.precip,
    timezone: "auto",
  });
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
    if (!r.ok) throw new Error();
    data = await r.json();
    render();
  } catch {
    showStatus("We couldn’t connect to the server (API error). Please try again in a few moments.");
  }
}

function showStatus(msg) {
  $("status").textContent = msg;
  $("status").hidden = !msg;
  $("content").hidden = !!msg;
}

/* ---------- rendering ---------- */
const deg = (n) => `${Math.round(n)}°`;
const dayName = (iso, long) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: long ? "long" : "short" });

function render() {
  showStatus("");
  const c = data.current;
  $("place").textContent = `${place.name}${place.country ? ", " + place.country : ""}`;
  $("date").textContent = new Date(c.time).toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });
  $("nowIcon").textContent = ICONS(c.weather_code);
  $("nowTemp").textContent = deg(c.temperature_2m);
  $("feels").textContent = deg(c.apparent_temperature);
  $("hum").textContent = `${c.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(c.wind_speed_10m)} ${units.wind === "kmh" ? "km/h" : "mph"}`;
  $("prec").textContent = `${c.precipitation} ${units.precip === "mm" ? "mm" : "in"}`;

  const d = data.daily;
  $("days").innerHTML = d.time.map((t, i) => `
    <div class="day"><span>${dayName(t)}</span>
      <span class="icon">${ICONS(d.weather_code[i])}</span>
      <div class="hl"><span>${deg(d.temperature_2m_max[i])}</span><span>${deg(d.temperature_2m_min[i])}</span></div>
    </div>`).join("");

  $("dayMenu").innerHTML = d.time.map((t, i) =>
    `<button data-day="${i}" class="${i === selectedDay ? "on" : ""}">${dayName(t, true)}</button>`).join("");
  renderHours();
  syncUnitMenu();
}

function renderHours() {
  const h = data.hourly;
  const day = data.daily.time[selectedDay];
  $("dayBtn").textContent = `${dayName(day, true)} ▾`;
  const rows = [];
  h.time.forEach((t, i) => {
    if (!t.startsWith(day)) return;
    const hr = new Date(t).getHours();
    const label = `${hr % 12 || 12} ${hr < 12 ? "AM" : "PM"}`;
    rows.push(`<li><span class="icon">${ICONS(h.weather_code[i])}</span>
      <span class="t">${label}</span><span class="v">${deg(h.temperature_2m[i])}</span></li>`);
  });
  $("hours").innerHTML = rows.join("");
  [...$("dayMenu").children].forEach((b, i) => b.classList.toggle("on", i === selectedDay));
}

/* ---------- units ---------- */
function syncUnitMenu() {
  document.querySelectorAll("#unitsMenu [data-key]").forEach((b) =>
    b.classList.toggle("on", units[b.dataset.key] === b.dataset.val));
  const imperial = units.temp === "fahrenheit" && units.wind === "mph" && units.precip === "inch";
  $("switchBtn").textContent = imperial ? "Switch to Metric" : "Switch to Imperial";
}

$("switchBtn").addEventListener("click", () => {
  const imperial = units.temp === "fahrenheit" && units.wind === "mph" && units.precip === "inch";
  Object.assign(units, imperial
    ? { temp: "celsius", wind: "kmh", precip: "mm" }
    : { temp: "fahrenheit", wind: "mph", precip: "inch" });
  load();
});

$("unitsMenu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-key]");
  if (!b) return;
  units[b.dataset.key] = b.dataset.val;
  load();
});

/* ---------- dropdowns ---------- */
function dropdown(btn, menu) {
  const toggle = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open);
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); toggle(menu.hidden); });
  document.addEventListener("click", (e) => { if (!menu.contains(e.target)) toggle(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
  return toggle;
}
dropdown($("unitsBtn"), $("unitsMenu"));
const closeDay = dropdown($("dayBtn"), $("dayMenu"));

$("dayMenu").addEventListener("click", (e) => {
  const b = e.target.closest("[data-day]");
  if (!b) return;
  selectedDay = +b.dataset.day;
  renderHours();
  closeDay(false);
});

/* ---------- search ---------- */
$("searchForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const q = $("q").value.trim();
  if (!q) return;
  try {
    const r = await geocode(q);
    if (!r) return showStatus("No search result found!");
    place = r;
    selectedDay = 0;
    load();
  } catch {
    showStatus("We couldn’t connect to the server (API error). Please try again in a few moments.");
  }
});

load();

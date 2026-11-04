/*
  SKYCAST WEATHER DASHBOARD
  1. Create a free API key at https://openweathermap.org/api
  2. Paste it between the quotes below.
  3. Save this file and reload index.html.
*/
const API_KEY = "7bf3f09e01f4eabee9483d21e48df0ed";
const CURRENT_API = "https://api.openweathermap.org/data/2.5/weather";
const FORECAST_API = "https://api.openweathermap.org/data/2.5/forecast";
const GEOCODING_API = "https://api.openweathermap.org/geo/1.0/direct";

const $ = (id) => document.getElementById(id);
let weatherData = null;
let forecastData = null;
let currentCity = "";
let unit = "metric";
let favorites = readStorage("skycast_favorites");
let recent = readStorage("skycast_recent");

function readStorage(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable. */ }
}

function setStatus(message, isError = false) {
  $("status").textContent = message;
  $("status").classList.toggle("error", isError);
}

function setBusy(isBusy) {
  $("searchBtn").disabled = isBusy;
  $("locationBtn").disabled = isBusy;
  $("searchBtn").innerHTML = isBusy ? '<span class="spinner"></span> Loading…' : 'Search <span>→</span>';
}

function toDisplayTemp(value) {
  const converted = unit === "metric" ? value : (value * 9 / 5) + 32;
  return `${Math.round(converted)}°${unit === "metric" ? "C" : "F"}`;
}

function toDisplayWind(value) {
  return unit === "metric" ? `${Number(value).toFixed(1)} m/s` : `${(value * 2.23694).toFixed(1)} mph`;
}

function weatherIcon(code) {
  return `https://openweathermap.org/img/wn/${code}@2x.png`;
}

function localTime(timestamp, timezoneOffset) {
  return new Date((timestamp + timezoneOffset) * 1000).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "UTC"
  });
}

function localDate(timestamp, timezoneOffset, options = {}) {
  return new Date((timestamp + timezoneOffset) * 1000).toLocaleDateString("en-IN", {
    ...options, timeZone: "UTC"
  });
}

function windCompass(degrees) {
  if (degrees == null) return "Direction unavailable";
  return `${["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8]} · ${degrees}°`;
}

async function getJSON(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) throw new Error("City not found. Check the spelling and try again.");
    if (response.status === 401) throw new Error("API key is invalid or not active yet. Check your key and try again.");
    if (response.status === 429) throw new Error("Weather API limit reached. Please try again later.");
    throw new Error(data.message || `Weather service error (${response.status}).`);
  }
  return data;
}

async function loadWeather(query) {
  if (!API_KEY || API_KEY === "YOUR_OPENWEATHERMAP_API_KEY") {
    setStatus("Add your OpenWeatherMap API key in script.js first. See the setup instructions at the top of that file.", true);
    return;
  }
  if (typeof query === "string" && !query.trim()) {
    setStatus("Please enter a city name.", true);
    $("cityInput").focus();
    return;
  }

  setBusy(true);
  setStatus(typeof query === "string" ? "Finding city or area…" : "Getting the latest weather…");
  try {
    let coordinates;
    if (typeof query === "string") {
      // Geocoding supports local areas as well as city names.
      const places = await getJSON(`${GEOCODING_API}?q=${encodeURIComponent(query.trim())}&limit=5&appid=${API_KEY}`);
      if (!Array.isArray(places) || places.length === 0) {
        throw new Error("Area or city not found. Try adding the city/state name, e.g. Najafgarh, Delhi.");
      }
      // Prefer the closest matching result; OpenWeather returns the best match first.
      coordinates = `lat=${encodeURIComponent(places[0].lat)}&lon=${encodeURIComponent(places[0].lon)}`;
    } else {
      coordinates = `lat=${encodeURIComponent(query.lat)}&lon=${encodeURIComponent(query.lon)}`;
    }

    setStatus("Getting the latest weather…");
    const [current, forecast] = await Promise.all([
      getJSON(`${CURRENT_API}?${coordinates}&units=metric&appid=${API_KEY}`),
      getJSON(`${FORECAST_API}?${coordinates}&units=metric&appid=${API_KEY}`)
    ]);

    weatherData = current;
    forecastData = forecast;
    currentCity = current.name;
    recent = [currentCity, ...recent.filter(name => name.toLowerCase() !== currentCity.toLowerCase())].slice(0, 6);
    saveStorage("skycast_recent", recent);
    $("cityInput").value = currentCity;
    renderDashboard();
    setStatus(`Weather updated for ${current.name}.`);
  } catch (error) {
    setStatus(error.message || "Unable to load weather. Check your internet connection.", true);
  } finally {
    setBusy(false);
  }
}

function renderDashboard() {
  if (!weatherData || !forecastData) return;
  const data = weatherData;
  const offset = data.timezone || 0;
  const condition = data.weather?.[0]?.main || "clear";
  document.body.dataset.weather = /thunder|rain|drizzle/i.test(condition) ? "rain"
    : /cloud|mist|fog|haze|smoke|dust/i.test(condition) ? "clouds"
    : /snow/i.test(condition) ? "snow" : "clear";

  $("cityName").textContent = `${data.name}, ${data.sys.country || ""}`;
  $("localDate").textContent = localDate(data.dt, offset, { weekday: "long", day: "numeric", month: "long" });
  $("temperature").textContent = Math.round(unit === "metric" ? data.main.temp : data.main.temp * 9 / 5 + 32);
  $("degree").textContent = unit === "metric" ? "°C" : "°F";
  $("condition").textContent = data.weather[0].description;
  $("feelsLike").textContent = `Feels like ${toDisplayTemp(data.main.feels_like)}`;
  $("weatherIcon").src = weatherIcon(data.weather[0].icon);
  $("weatherIcon").alt = data.weather[0].description;
  $("highTemp").textContent = toDisplayTemp(data.main.temp_max);
  $("lowTemp").textContent = toDisplayTemp(data.main.temp_min);
  $("localTime").textContent = localTime(Math.floor(Date.now() / 1000), offset);
  $("humidity").textContent = `${data.main.humidity}%`;
  $("wind").textContent = toDisplayWind(data.wind.speed);
  $("windDirection").textContent = windCompass(data.wind.deg);
  $("pressure").textContent = `${data.main.pressure} hPa`;
  $("visibility").textContent = `${((data.visibility ?? 0) / 1000).toFixed(1)} km`;
  $("sunrise").textContent = localTime(data.sys.sunrise, offset);
  $("sunset").textContent = localTime(data.sys.sunset, offset);
  $("unitToggle").innerHTML = unit === "metric" ? '°C <small>/ °F</small>' : '°F <small>/ °C</small>';

  const isFavorite = favorites.some(name => name.toLowerCase() === currentCity.toLowerCase());
  $("favoriteBtn").textContent = isFavorite ? "★" : "☆";
  $("favoriteBtn").classList.toggle("active", isFavorite);
  $("favoriteBtn").setAttribute("aria-label", isFavorite ? "Remove city from favourites" : "Add city to favourites");

  renderHourly();
  renderDaily();
  renderCityLists();
  $("weatherContent").classList.remove("hidden");
}

function renderHourly() {
  const container = $("hourlyForecast");
  container.replaceChildren();
  forecastData.list.slice(0, 8).forEach(item => {
    const card = document.createElement("div");
    card.className = "hour-item";
    const time = document.createElement("div");
    time.textContent = localTime(item.dt, forecastData.city.timezone);
    const icon = document.createElement("img");
    icon.src = weatherIcon(item.weather[0].icon);
    icon.alt = item.weather[0].description;
    const temperature = document.createElement("strong");
    temperature.textContent = toDisplayTemp(item.main.temp);
    const rain = document.createElement("small");
    rain.textContent = `💧 ${Math.round((item.pop || 0) * 100)}% rain`;
    card.append(time, icon, temperature, rain);
    container.append(card);
  });
}

function renderDaily() {
  const groups = new Map();
  forecastData.list.forEach(item => {
    const key = localDate(item.dt, forecastData.city.timezone, { year: "numeric", month: "2-digit", day: "2-digit" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const container = $("dailyForecast");
  container.replaceChildren();
  [...groups.values()].slice(0, 5).forEach((items, index) => {
    const midday = items.reduce((best, item) =>
      Math.abs(new Date(item.dt * 1000).getUTCHours() - 12) < Math.abs(new Date(best.dt * 1000).getUTCHours() - 12) ? item : best
    , items[0]);
    const high = Math.max(...items.map(item => item.main.temp_max));
    const low = Math.min(...items.map(item => item.main.temp_min));
    const row = document.createElement("div");
    row.className = "day-row";

    const day = document.createElement("b");
    day.textContent = index === 0 ? "Today" : localDate(items[0].dt, forecastData.city.timezone, { weekday: "long" });
    const iconWrap = document.createElement("span");
    const icon = document.createElement("img");
    icon.className = "day-icon";
    icon.src = weatherIcon(midday.weather[0].icon);
    icon.alt = midday.weather[0].description;
    iconWrap.append(icon);
    const condition = document.createElement("span");
    condition.className = "day-condition";
    condition.textContent = midday.weather[0].description;
    const temperatures = document.createElement("span");
    temperatures.className = "day-temps";
    const max = document.createElement("b");
    max.textContent = toDisplayTemp(high);
    const min = document.createElement("span");
    min.textContent = toDisplayTemp(low);
    temperatures.append(max, min);
    row.append(day, iconWrap, condition, temperatures);
    container.append(row);
  });
}

function renderChips(containerId, items, emptyMessage) {
  const container = $(containerId);
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("span");
    empty.className = "empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return;
  }
  items.forEach(name => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "city-chip";
    button.textContent = name;
    button.addEventListener("click", () => loadWeather(name));
    container.append(button);
  });
}

function renderCityLists() {
  renderChips("recentCities", recent, "Your recent cities will appear here.");
  renderChips("favoriteCities", favorites, "Save a city with ☆ to add it here.");
}

$("searchBtn").addEventListener("click", () => loadWeather($("cityInput").value));
$("cityInput").addEventListener("keydown", event => {
  if (event.key === "Enter") loadWeather($("cityInput").value);
});
$("clearSearch").addEventListener("click", () => {
  $("cityInput").value = "";
  $("cityInput").focus();
});

$("locationBtn").addEventListener("click", () => {
  if (!navigator.geolocation) {
    setStatus("Location is not supported by this browser. Search for a city instead.", true);
    return;
  }
  setBusy(true);
  setStatus("Finding your location… Please allow location access.");
  navigator.geolocation.getCurrentPosition(
    position => loadWeather({ lat: position.coords.latitude, lon: position.coords.longitude }),
    error => {
      setBusy(false);
      setStatus(error.code === 1 ? "Location permission denied. You can search for a city instead." : "Could not detect your location. Search for a city instead.", true);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 300000 }
  );
});

$("unitToggle").addEventListener("click", () => {
  unit = unit === "metric" ? "imperial" : "metric";
  if (weatherData) renderDashboard();
});

$("favoriteBtn").addEventListener("click", () => {
  if (!currentCity) return;
  const exists = favorites.some(name => name.toLowerCase() === currentCity.toLowerCase());
  favorites = exists
    ? favorites.filter(name => name.toLowerCase() !== currentCity.toLowerCase())
    : [currentCity, ...favorites].slice(0, 8);
  saveStorage("skycast_favorites", favorites);
  renderDashboard();
});

$("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});
renderCityLists();

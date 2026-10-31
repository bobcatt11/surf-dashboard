// Web addresses for the free Open-Meteo APIs (no key needed).
// Both point at Old Man's (Tourmaline) and use San Diego time.
// "current=" asks for conditions right now.
// "hourly=" plus "forecast_days=5" asks for every hour of the next 5 days.
const waveUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=32.80&longitude=-117.27"
  + "&current=wave_height,wave_period,wave_direction"
  + "&hourly=wave_height,wave_period,wave_direction"
  + "&forecast_days=5&timezone=America/Los_Angeles&length_unit=imperial";
const windUrl = "https://api.open-meteo.com/v1/forecast?latitude=32.80&longitude=-117.27"
  + "&current=wind_speed_10m,wind_direction_10m"
  + "&hourly=wind_speed_10m,wind_direction_10m"
  + "&forecast_days=5&timezone=America/Los_Angeles&wind_speed_unit=mph";

// Surf spots we might want to rank, listed north to south.
// - latitude / longitude: roughly where the waves break (approximate, worth double-checking)
// - facingDegrees: the compass direction the beach looks out toward the ocean
//   (270 = due west). Later we'll use this to tell offshore wind from onshore wind,
//   and whether a swell is pointed at the spot or missing it.
// Trestles is in Orange County, about 45 miles from Old Man's, so it's handy
// for testing the radius setting later.
const surfSpots = [
  { name: "Trestles (Lowers)", area: "San Clemente", latitude: 33.382, longitude: -117.589, facingDegrees: 225 },
  { name: "Oceanside Pier", area: "Oceanside", latitude: 33.193, longitude: -117.386, facingDegrees: 245 },
  { name: "Tamarack", area: "Carlsbad", latitude: 33.148, longitude: -117.348, facingDegrees: 250 },
  { name: "Ponto", area: "South Carlsbad", latitude: 33.087, longitude: -117.312, facingDegrees: 255 },
  { name: "Beacon's", area: "Leucadia", latitude: 33.065, longitude: -117.304, facingDegrees: 255 },
  { name: "Swami's", area: "Encinitas", latitude: 33.034, longitude: -117.295, facingDegrees: 255 },
  { name: "Cardiff Reef", area: "Cardiff", latitude: 33.014, longitude: -117.283, facingDegrees: 250 },
  { name: "15th Street", area: "Del Mar", latitude: 32.958, longitude: -117.269, facingDegrees: 265 },
  { name: "Black's Beach", area: "La Jolla", latitude: 32.879, longitude: -117.253, facingDegrees: 270 },
  { name: "La Jolla Shores", area: "La Jolla", latitude: 32.858, longitude: -117.257, facingDegrees: 290 },
  { name: "Windansea", area: "La Jolla", latitude: 32.830, longitude: -117.281, facingDegrees: 265 },
  { name: "Old Man's (Tourmaline)", area: "Pacific Beach", latitude: 32.805, longitude: -117.264, facingDegrees: 250 },
  { name: "Crystal Pier", area: "Pacific Beach", latitude: 32.797, longitude: -117.258, facingDegrees: 245 },
  { name: "Ocean Beach Pier", area: "Ocean Beach", latitude: 32.749, longitude: -117.256, facingDegrees: 260 },
  { name: "Sunset Cliffs", area: "Point Loma", latitude: 32.722, longitude: -117.256, facingDegrees: 265 },
  { name: "Imperial Beach Pier", area: "Imperial Beach", latitude: 32.579, longitude: -117.135, facingDegrees: 255 },
];

// Fetch a web address and turn the reply into data.
// If the server replies with an error (like "500 Server Error"), stop here
// so the page can show a friendly message instead.
function fetchData(url) {
  return fetch(url).then(response => {
    if (!response.ok) {
      throw new Error("Server replied with status " + response.status);
    }
    return response.json();
  });
}

// Turn a direction in degrees into a compass point, like 292 → "WNW".
// The compass is split into 16 slices of 22.5° each (360 ÷ 16).
// Dividing by 22.5 and rounding tells us which slice we're in.
// "% 16" wraps slice 16 (anything near 360°) back round to "N".
function toCompassPoint(degrees) {
  const compassPoints = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  const slice = Math.round(degrees / 22.5) % 16;
  return compassPoints[slice];
}

// Show the conditions right now at the top of the page,
// rounded so they're easy to read at a glance
function showCurrentConditions(waveData, windData) {
  const waves = waveData.current;
  const wind = windData.current;
  document.getElementById("waves").textContent =
    "Waves: " + waves.wave_height.toFixed(1) + " ft at " + Math.round(waves.wave_period) + " seconds, from "
    + toCompassPoint(waves.wave_direction) + " (" + waves.wave_direction + "°)";
  document.getElementById("wind").textContent =
    "Wind: " + Math.round(wind.wind_speed_10m) + " mph from "
    + toCompassPoint(wind.wind_direction_10m) + " (" + wind.wind_direction_10m + "°)";
}

// The 4 surfing time blocks in each day.
// Each block covers 3 hours, starting at startHour (24-hour clock, so 15 = 3 PM).
const timeBlocks = [
  { label: "6–9 AM", startHour: 6 },
  { label: "9 AM–12 PM", startHour: 9 },
  { label: "12–3 PM", startHour: 12 },
  { label: "3–6 PM", startHour: 15 },
];

// Add up a list of numbers and divide by how many there are
function average(numbers) {
  let total = 0;
  for (const number of numbers) {
    total = total + number;
  }
  return total / numbers.length;
}

// Turn "2026-10-31" into a friendly label like "Saturday, Oct 31".
// Adding "T12:00" (noon) stops the date from slipping back a day
// in some time zones.
function formatDayLabel(dateText) {
  const date = new Date(dateText + "T12:00");
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// Find the positions in the hourly lists that belong to one time block.
// Each hourly time looks like "2026-10-31T06:00": the date is the first
// 10 characters, and the hour is characters 11–12.
function findHoursInBlock(hourlyTimes, dateText, startHour) {
  const positions = [];
  for (let position = 0; position < hourlyTimes.length; position++) {
    const time = hourlyTimes[position];
    const date = time.slice(0, 10);
    const hour = Number(time.slice(11, 13));
    if (date === dateText && hour >= startHour && hour < startHour + 3) {
      positions.push(position);
    }
  }
  return positions;
}

// Sum up the conditions for one time block:
// - wave height as a range (smallest to biggest), like surf apps show
// - average wave period and average wind speed
// - wave and wind direction from the middle hour of the block
//   (averaging compass directions is tricky, so we keep it simple)
function summarizeBlock(waveHourly, windHourly, positions) {
  const waveHeights = positions.map(position => waveHourly.wave_height[position]);
  const wavePeriods = positions.map(position => waveHourly.wave_period[position]);
  const windSpeeds = positions.map(position => windHourly.wind_speed_10m[position]);
  const middlePosition = positions[1];

  return {
    smallestWave: Math.min(...waveHeights),
    biggestWave: Math.max(...waveHeights),
    averagePeriod: average(wavePeriods),
    waveDirection: waveHourly.wave_direction[middlePosition],
    averageWindSpeed: average(windSpeeds),
    windDirection: windHourly.wind_direction_10m[middlePosition],
  };
}

// Make a small piece of the page: a tag (like "p") with a CSS class and some text
function makeElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

// Rate a time block by its biggest wave:
// 3 ft or more = good (green), 1 to 3 ft = fair (yellow), under 1 ft = poor (red).
// The "className" matches a style in style.css that sets the colour.
function rateBlock(summary) {
  if (summary.biggestWave >= 3) {
    return { label: "Good", className: "rating-good" };
  }
  if (summary.biggestWave >= 1) {
    return { label: "Fair", className: "rating-fair" };
  }
  return { label: "Poor", className: "rating-poor" };
}

// Build the box for one time block: the time, a big wave height,
// then the wave period/direction and the wind underneath.
// toFixed(1) rounds to 1 decimal place, Math.round rounds to a whole number.
function makeBlockBox(label, summary) {
  let waveText = summary.smallestWave.toFixed(1) + "–" + summary.biggestWave.toFixed(1) + " ft";
  if (summary.smallestWave.toFixed(1) === summary.biggestWave.toFixed(1)) {
    waveText = summary.smallestWave.toFixed(1) + " ft";
  }
  const swellText = Math.round(summary.averagePeriod) + " s from " + toCompassPoint(summary.waveDirection);
  const windText = "Wind " + Math.round(summary.averageWindSpeed) + " mph from " + toCompassPoint(summary.windDirection);

  // The rating adds a colour class to the box, plus a word ("Good") so it
  // still makes sense for anyone who can't easily tell the colours apart
  const rating = rateBlock(summary);
  const blockBox = makeElement("div", "time-block " + rating.className, "");
  blockBox.appendChild(makeElement("p", "block-time", label));
  blockBox.appendChild(makeElement("p", "block-rating", rating.label));
  blockBox.appendChild(makeElement("p", "block-waves", waveText));
  blockBox.appendChild(makeElement("p", "block-detail", swellText));
  blockBox.appendChild(makeElement("p", "block-detail", windText));
  return blockBox;
}

// Build the 5-day forecast: a card for each day,
// holding a row of its 4 time blocks.
// Both APIs return the same list of hours, so position 0 in the wave
// data is the same hour as position 0 in the wind data.
function showForecast(waveData, windData) {
  const waveHourly = waveData.hourly;
  const windHourly = windData.hourly;

  // Make a list of the dates in the forecast, each one only once
  const dates = [];
  for (const time of waveHourly.time) {
    const date = time.slice(0, 10);
    if (!dates.includes(date)) {
      dates.push(date);
    }
  }

  const forecastArea = document.getElementById("forecast");
  forecastArea.textContent = "";

  for (const date of dates) {
    const dayCard = makeElement("section", "day-card", "");
    dayCard.appendChild(makeElement("h3", "day-name", formatDayLabel(date)));

    const blockRow = makeElement("div", "time-blocks", "");
    for (const block of timeBlocks) {
      const positions = findHoursInBlock(waveHourly.time, date, block.startHour);
      const summary = summarizeBlock(waveHourly, windHourly, positions);
      blockRow.appendChild(makeBlockBox(block.label, summary));
    }
    dayCard.appendChild(blockRow);
    forecastArea.appendChild(dayCard);
  }
}

// Shown if anything goes wrong (no internet, API down, etc.)
function showLoadError(error) {
  console.error(error);
  document.getElementById("waves").textContent =
    "Sorry, we couldn't load the surf forecast right now. Please try refreshing the page in a minute.";
  document.getElementById("wind").textContent = "";
  document.getElementById("forecast").textContent = "";
}

// Show the list of surf spots: one line each with the name, the area,
// and which way the beach faces (like "faces WSW").
function showSurfSpots() {
  const spotList = document.getElementById("spot-list");
  for (const spot of surfSpots) {
    const spotItem = makeElement("li", "spot-item", "");
    spotItem.appendChild(makeElement("span", "spot-item-name", spot.name));
    spotItem.appendChild(makeElement("span", "spot-item-detail",
      spot.area + " · faces " + toCompassPoint(spot.facingDegrees)));
    spotList.appendChild(spotItem);
  }
}

// The spot list doesn't need any data from the internet,
// so show it straight away, even if the forecast fails to load
showSurfSpots();

// Fetch the waves and the wind at the same time, then wait until BOTH have arrived.
// The forecast needs both, so it's simpler to handle them together.
Promise.all([fetchData(waveUrl), fetchData(windUrl)])
  .then(([waveData, windData]) => {
    showCurrentConditions(waveData, windData);
    showForecast(waveData, windData);
  })
  .catch(showLoadError);

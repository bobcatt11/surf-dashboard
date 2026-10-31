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

// Show the conditions right now at the top of the page
function showCurrentConditions(waveData, windData) {
  const waves = waveData.current;
  const wind = windData.current;
  document.getElementById("waves").textContent =
    "Waves: " + waves.wave_height + " ft at " + waves.wave_period + " seconds, from " + waves.wave_direction + "°";
  document.getElementById("wind").textContent =
    "Wind: " + wind.wind_speed_10m + " mph from " + wind.wind_direction_10m + "°";
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

// Turn a block summary into one line of text.
// toFixed(1) rounds to 1 decimal place, Math.round rounds to a whole number.
function describeBlock(summary) {
  let waveText = summary.smallestWave.toFixed(1) + "–" + summary.biggestWave.toFixed(1) + " ft";
  if (summary.smallestWave.toFixed(1) === summary.biggestWave.toFixed(1)) {
    waveText = summary.smallestWave.toFixed(1) + " ft";
  }
  return "Waves " + waveText
    + " at " + Math.round(summary.averagePeriod) + " s"
    + " from " + summary.waveDirection + "°"
    + " · Wind " + Math.round(summary.averageWindSpeed) + " mph"
    + " from " + summary.windDirection + "°";
}

// Build the 5-day forecast: a heading for each day,
// followed by a list of its 4 time blocks.
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
    const dayHeading = document.createElement("h3");
    dayHeading.textContent = formatDayLabel(date);
    forecastArea.appendChild(dayHeading);

    const blockList = document.createElement("ul");
    for (const block of timeBlocks) {
      const positions = findHoursInBlock(waveHourly.time, date, block.startHour);
      const summary = summarizeBlock(waveHourly, windHourly, positions);

      const blockItem = document.createElement("li");
      blockItem.textContent = block.label + ": " + describeBlock(summary);
      blockList.appendChild(blockItem);
    }
    forecastArea.appendChild(blockList);
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

// Fetch the waves and the wind at the same time, then wait until BOTH have arrived.
// The forecast needs both, so it's simpler to handle them together.
Promise.all([fetchData(waveUrl), fetchData(windUrl)])
  .then(([waveData, windData]) => {
    showCurrentConditions(waveData, windData);
    showForecast(waveData, windData);
  })
  .catch(showLoadError);

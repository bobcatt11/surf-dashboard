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

// Turn a time block's numbers into short bits of text, like
// "2.8–3.1 ft", "12 s from WSW" and "Wind 5 mph from E".
// Both the 5-day forecast and the surf spot list use this.
// toFixed(1) rounds to 1 decimal place, Math.round rounds to a whole number.
function describeConditions(summary) {
  let waveText = summary.smallestWave.toFixed(1) + "–" + summary.biggestWave.toFixed(1) + " ft";
  if (summary.smallestWave.toFixed(1) === summary.biggestWave.toFixed(1)) {
    waveText = summary.smallestWave.toFixed(1) + " ft";
  }
  const swellText = Math.round(summary.averagePeriod) + " s from " + toCompassPoint(summary.waveDirection);
  const windText = "Wind " + Math.round(summary.averageWindSpeed) + " mph from " + toCompassPoint(summary.windDirection);
  return { waveText, swellText, windText };
}

// Build the box for one time block: the time, a big wave height,
// then the wave period/direction and the wind underneath.
function makeBlockBox(label, summary) {
  const { waveText, swellText, windText } = describeConditions(summary);

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
  const dates = listDates(waveHourly.time);

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

// ---------- Finding spots near you ----------

// Where we measure distances from. It starts at Old Man's so the list
// works straight away; typing in a zip code replaces it.
// This only lives in your browser while the page is open — it's never saved.
let homeLocation = { name: "Old Man's", latitude: 32.805, longitude: -117.264 };

// How far apart two places are, in miles, "as the crow flies".
// This is the standard "haversine" formula for distances on a globe.
// You don't need to follow the maths: it turns the latitude/longitude
// differences into an angle, then multiplies by the Earth's radius.
function distanceInMiles(latitude1, longitude1, latitude2, longitude2) {
  const earthRadiusMiles = 3959;
  const toRadians = degrees => degrees * Math.PI / 180;
  const latitudeChange = toRadians(latitude2 - latitude1);
  const longitudeChange = toRadians(longitude2 - longitude1);
  const a = Math.sin(latitudeChange / 2) ** 2
    + Math.cos(toRadians(latitude1)) * Math.cos(toRadians(latitude2))
    * Math.sin(longitudeChange / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------- Scoring each spot ----------

// How far apart two compass directions are, from 0° (same way)
// to 180° (opposite ways). For example 350° and 10° are 20° apart,
// not 340°, because you can go the short way round past north.
function angleBetween(direction1, direction2) {
  const difference = Math.abs(direction1 - direction2) % 360;
  return difference > 180 ? 360 - difference : difference;
}

// Describe the wind compared with which way the beach faces.
// Wind directions say where the wind comes FROM. So:
// - wind from the same way the beach faces = from the sea = "onshore" (bad: choppy)
// - wind from the opposite way = from the land = "offshore" (good: clean waves)
// - anything in between = "cross-shore"
function describeWind(windSpeed, windDirection, facingDegrees) {
  if (windSpeed <= 5) {
    return "light";
  }
  const angle = angleBetween(windDirection, facingDegrees);
  if (angle >= 120) {
    return "offshore";
  }
  if (angle >= 60) {
    return "cross-shore";
  }
  return "onshore";
}

// Give a spot a score out of 10 for one time block.
// Points come from four things (change the numbers here to tune it):
// - wave size: up to 3 points
// - wave period: up to 2 points (longer period = cleaner, stronger waves)
// - wind: up to 4 points (light or offshore is best, strong onshore is worst).
//   Wind gets the most points because strong onshore wind ruins
//   even big waves.
// - swell direction: 1 point if the swell is heading roughly at the beach
// Waves under 1 ft are too small to surf, so those spots score 3 at most.
// It also returns a short reason, like "light wind".
function scoreSpot(summary, facingDegrees) {
  // Wave size, using the biggest wave in the block
  let wavePoints = 0;
  if (summary.biggestWave >= 3) wavePoints = 3;
  else if (summary.biggestWave >= 2) wavePoints = 2;
  else if (summary.biggestWave >= 1) wavePoints = 1;

  // Wave period
  let periodPoints = 0;
  if (summary.averagePeriod >= 12) periodPoints = 2;
  else if (summary.averagePeriod >= 8) periodPoints = 1;

  // Wind
  const windSpeed = summary.averageWindSpeed;
  const windType = describeWind(windSpeed, summary.windDirection, facingDegrees);
  // ("a ? b : c" means "if a, then b, otherwise c")
  let windPoints = 0;
  if (windType === "light") windPoints = 4;
  else if (windType === "offshore") windPoints = windSpeed <= 15 ? 4 : 3;
  else if (windType === "cross-shore") windPoints = windSpeed <= 10 ? 2 : 1;
  else if (windType === "onshore") windPoints = windSpeed <= 10 ? 1 : 0;

  // Swell direction: is the swell coming from roughly where the beach faces?
  const swellPoints = angleBetween(summary.waveDirection, facingDegrees) <= 60 ? 1 : 0;

  // Words for the reason: "light wind", or e.g. "strong onshore wind" over 15 mph
  let windReason = windType + " wind";
  if (windType !== "light" && windSpeed > 15) {
    windReason = "strong " + windReason;
  }
  const swellReason = swellPoints === 1 ? "" : " · swell angled away";

  // Too small to surf: cap the score at 3 and say why
  let points = wavePoints + periodPoints + windPoints + swellPoints;
  let reason = windReason + swellReason;
  if (summary.biggestWave < 1) {
    points = Math.min(points, 3);
    reason = "too small · " + reason;
  }

  return { points, reason };
}

// Turn a score into the same Good / Fair / Poor colours as the 5-day forecast
function rateScore(points) {
  if (points >= 7) {
    return { label: "Good", className: "rating-good" };
  }
  if (points >= 4) {
    return { label: "Fair", className: "rating-fair" };
  }
  return { label: "Poor", className: "rating-poor" };
}

// Show the spots within the chosen radius as cards, best first.
// A spot's rank comes from its best time block that isn't over yet.
// (While the forecasts are still loading, they're sorted nearest first.)
function showSurfSpots() {
  const radiusMiles = Number(document.getElementById("radius").value);
  const spotList = document.getElementById("spot-list");
  spotList.textContent = "";

  // Work out each spot's distance, its time blocks for the day and its
  // best block, and keep the spots inside the radius.
  // Before the forecasts arrive, dayBlocks and bestBlock are null.
  const nearbySpots = surfSpots
    .map(spot => {
      const dayBlocks = spot.waveHourly && forecastDay
        ? buildDayBlocks(spot, forecastDay.date, forecastDay.pastBeforeHour)
        : null;
      return {
        ...spot,
        distance: distanceInMiles(homeLocation.latitude, homeLocation.longitude, spot.latitude, spot.longitude),
        dayBlocks: dayBlocks,
        bestBlock: dayBlocks ? findBestBlock(dayBlocks) : null,
      };
    })
    .filter(spot => spot.distance <= radiusMiles);

  // Sort: highest best-block score first. Spots with no score go to the bottom.
  // If two spots have the same score, the nearer one comes first.
  // (A sort compares two spots; a negative answer puts spotA first.)
  nearbySpots.sort((spotA, spotB) => {
    const pointsA = spotA.bestBlock ? spotA.bestBlock.score.points : -1;
    const pointsB = spotB.bestBlock ? spotB.bestBlock.score.points : -1;
    if (pointsA !== pointsB) {
      return pointsB - pointsA;
    }
    return spotA.distance - spotB.distance;
  });

  let statusText = nearbySpots.length + " spots within " + radiusMiles + " miles of " + homeLocation.name;
  if (spotForecastStatus === "ready") {
    statusText = statusText + ", best first";
  }
  document.getElementById("location-status").textContent = statusText;

  if (nearbySpots.length === 0) {
    spotList.appendChild(makeElement("li", "spot-item",
      "No spots in range. Try a bigger radius."));
    return;
  }

  let rank = 1;
  for (const spot of nearbySpots) {
    const spotItem = makeElement("li", "spot-item", "");

    // Name, with a rank number if the spot has a score
    let nameText = spot.name;
    if (spot.bestBlock) {
      nameText = "#" + rank + " " + spot.name;
      rank = rank + 1;
    }
    spotItem.appendChild(makeElement("span", "spot-item-name", nameText));
    spotItem.appendChild(makeElement("span", "spot-item-detail",
      Math.round(spot.distance) + " mi · " + spot.area + " · faces " + toCompassPoint(spot.facingDegrees)));

    // One line summing up the day: the best block, or why there isn't one
    let bestText = "Loading forecast...";
    if (spot.bestBlock) {
      const rating = rateScore(spot.bestBlock.score.points);
      bestText = "Best: " + rating.label + " " + spot.bestBlock.score.points + "/10 at " + spot.bestBlock.label;
    } else if (spotForecastStatus === "failed" || spot.dayBlocks) {
      bestText = "Forecast unavailable";
    }
    spotItem.appendChild(makeElement("span", "spot-score", bestText));

    // The row of 4 time blocks for the day
    if (spot.dayBlocks) {
      const blockRow = makeElement("div", "time-blocks", "");
      for (const block of spot.dayBlocks) {
        blockRow.appendChild(makeSpotBlockBox(block));
      }
      spotItem.appendChild(blockRow);
      spotItem.appendChild(makeFiveDayForecast(spot));
    }

    spotList.appendChild(spotItem);
  }
}

// ---------- Forecasts for every surf spot ----------

// Where the spot forecasts are up to: "loading", "ready" or "failed".
// The spot list uses this to decide what to show in each spot's card.
let spotForecastStatus = "loading";

// Which day the spot cards show. It's filled in when the forecasts arrive,
// and looks like { date: "2026-11-01", label: "Today, Sunday, Nov 1", pastBeforeHour: 10 }.
// pastBeforeHour: any time block that finishes by this hour is already over.
let forecastDay = null;

// Make a list of the dates in a forecast, each one only once,
// like ["2026-11-01", "2026-11-02", ...]
function listDates(hourlyTimes) {
  const dates = [];
  for (const time of hourlyTimes) {
    const date = time.slice(0, 10);
    if (!dates.includes(date)) {
      dates.push(date);
    }
  }
  return dates;
}

// Pick which day to show, using the current San Diego time
// (text like "2026-11-01T10:45"):
// - before 6 PM: today. Blocks that have already finished count as "past".
// - 6 PM or later: all of today's blocks are over, so show tomorrow.
function chooseForecastDay(hourlyTimes, currentTime) {
  const today = currentTime.slice(0, 10);
  const currentHour = Number(currentTime.slice(11, 13));
  if (currentHour < 18) {
    return { date: today, label: "Today, " + formatDayLabel(today), pastBeforeHour: currentHour };
  }
  const dates = listDates(hourlyTimes);
  const tomorrow = dates[dates.indexOf(today) + 1];
  return { date: tomorrow, label: "Tomorrow, " + formatDayLabel(tomorrow), pastBeforeHour: 0 };
}

// Work out one spot's 4 time blocks for one day. For each block we keep:
// - summary: the waves and wind (or null if the ocean model has no wave
//   data there, which can happen right at the shoreline)
// - score: its score out of 10 (or null if there's no summary)
// - isPast: true if the block has already finished
// A block finishes 3 hours after it starts, so the 6–9 AM block
// is past once it's 9 AM or later.
function buildDayBlocks(spot, date, pastBeforeHour) {
  return timeBlocks.map(block => {
    const positions = findHoursInBlock(spot.waveHourly.time, date, block.startHour);
    const hasWaveData = positions.length === 3
      && positions.every(position => spot.waveHourly.wave_height[position] !== null);
    const summary = hasWaveData ? summarizeBlock(spot.waveHourly, spot.windHourly, positions) : null;
    return {
      label: block.label,
      summary: summary,
      score: summary ? scoreSpot(summary, spot.facingDegrees) : null,
      isPast: block.startHour + 3 <= pastBeforeHour,
    };
  });
}

// Find the block with the highest score, skipping past blocks and
// blocks with no data. If two blocks tie, the earlier one wins.
// Returns null if there's nothing left to surf.
function findBestBlock(dayBlocks) {
  let bestBlock = null;
  for (const block of dayBlocks) {
    if (block.isPast || !block.score) {
      continue;
    }
    if (!bestBlock || block.score.points > bestBlock.score.points) {
      bestBlock = block;
    }
  }
  return bestBlock;
}

// Build the box for one of a spot's time blocks.
// Past blocks and blocks with no data get a plain grey box;
// the rest are coloured by their score, like the 5-day forecast.
function makeSpotBlockBox(block) {
  if (block.isPast) {
    const pastBox = makeElement("div", "time-block block-past", "");
    pastBox.appendChild(makeElement("p", "block-time", block.label));
    pastBox.appendChild(makeElement("p", "block-rating", "Past"));
    return pastBox;
  }
  if (!block.summary) {
    const noDataBox = makeElement("div", "time-block block-no-data", "");
    noDataBox.appendChild(makeElement("p", "block-time", block.label));
    noDataBox.appendChild(makeElement("p", "block-rating", "No data"));
    return noDataBox;
  }

  const { waveText, swellText, windText } = describeConditions(block.summary);
  const rating = rateScore(block.score.points);
  const blockBox = makeElement("div", "time-block " + rating.className, "");
  blockBox.appendChild(makeElement("p", "block-time", block.label));
  blockBox.appendChild(makeElement("p", "block-rating", rating.label + " " + block.score.points + "/10"));
  blockBox.appendChild(makeElement("p", "block-waves", waveText));
  blockBox.appendChild(makeElement("p", "block-detail", swellText));
  blockBox.appendChild(makeElement("p", "block-detail", windText));
  blockBox.appendChild(makeElement("p", "block-reason", block.score.reason));
  return blockBox;
}

// Build a spot's forecast for the next 5 days, tucked inside an open/close box.
// <details> is a built-in HTML box: only its <summary> line shows at first,
// and tapping that line opens or closes the rest. No extra code needed.
// Inside is one row of 4 time blocks per day. It starts the day AFTER the
// one shown on the card, so it doesn't repeat what's already on the card.
function makeFiveDayForecast(spot) {
  const details = makeElement("details", "five-day", "");
  details.appendChild(makeElement("summary", "five-day-toggle", "Show next 5 days"));

  // Keep the 5 days after the card's day. (We fetch 7 days so there are
  // still 5 left after 6 PM, when the card itself shows tomorrow.)
  const dates = listDates(spot.waveHourly.time)
    .filter(date => date > forecastDay.date)
    .slice(0, 5);
  for (const date of dates) {
    // These are all future days, so no blocks are past (0)
    const dayBlocks = buildDayBlocks(spot, date, 0);

    details.appendChild(makeElement("h4", "five-day-name", formatDayLabel(date)));
    const blockRow = makeElement("div", "time-blocks", "");
    for (const block of dayBlocks) {
      blockRow.appendChild(makeSpotBlockBox(block));
    }
    details.appendChild(blockRow);
  }
  return details;
}

// Ask Open-Meteo for the waves and wind at every spot at once.
// Open-Meteo lets one request cover many places: we list all the latitudes
// separated by commas, then all the longitudes in the same order, and it
// replies with a list of forecasts in that same order.
// Doing this once when the page opens means changing the radius or zip
// code doesn't need to fetch anything new.
function loadSpotForecasts() {
  const latitudes = surfSpots.map(spot => spot.latitude).join(",");
  const longitudes = surfSpots.map(spot => spot.longitude).join(",");
  const spotWaveUrl = "https://marine-api.open-meteo.com/v1/marine?latitude=" + latitudes
    + "&longitude=" + longitudes
    + "&current=wave_height"
    + "&hourly=wave_height,wave_period,wave_direction"
    + "&forecast_days=7&timezone=America/Los_Angeles&length_unit=imperial";
  const spotWindUrl = "https://api.open-meteo.com/v1/forecast?latitude=" + latitudes
    + "&longitude=" + longitudes
    + "&hourly=wind_speed_10m,wind_direction_10m"
    + "&forecast_days=7&timezone=America/Los_Angeles&wind_speed_unit=mph";

  Promise.all([fetchData(spotWaveUrl), fetchData(spotWindUrl)])
    .then(([waveList, windList]) => {
      // Keep each spot's hourly forecast, in the same order as surfSpots
      surfSpots.forEach((spot, position) => {
        spot.waveHourly = waveList[position].hourly;
        spot.windHourly = windList[position].hourly;
      });

      // Pick today or tomorrow, using the current San Diego time
      // that the wave forecast sends back
      forecastDay = chooseForecastDay(waveList[0].hourly.time, waveList[0].current.time);
      document.getElementById("spot-forecast-time").textContent = forecastDay.label;
      spotForecastStatus = "ready";
      showSurfSpots();
    })
    .catch(error => {
      console.error(error);
      spotForecastStatus = "failed";
      document.getElementById("spot-forecast-time").textContent =
        "Sorry, we couldn't load the spot forecasts right now. Try refreshing in a minute.";
      showSurfSpots();
    });
}

// Look up a US zip code and measure distances from there.
// Zippopotam.us is a free website (no key needed) that turns a zip code
// into a place name plus latitude/longitude. Its reply looks like:
//   { "places": [ { "place name": "San Diego", "state abbreviation": "CA",
//                   "latitude": "32.7977", "longitude": "-117.2357" } ] }
// The names have spaces in them, so we use place["place name"] instead of place.placeName.
function findZipCode(event) {
  // Stop the form from reloading the page (its normal behaviour)
  event.preventDefault();

  const status = document.getElementById("location-status");
  const zipCode = document.getElementById("zip-code").value.trim();

  // A US zip code is exactly 5 digits: /^\d{5}$/ checks for that
  if (!/^\d{5}$/.test(zipCode)) {
    status.textContent = "Please enter a 5-digit zip code, like 92109.";
    return;
  }

  status.textContent = "Looking up " + zipCode + "...";
  fetchData("https://api.zippopotam.us/us/" + zipCode)
    .then(zipData => {
      const place = zipData.places[0];
      homeLocation = {
        name: zipCode + " (" + place["place name"] + ", " + place["state abbreviation"] + ")",
        latitude: Number(place.latitude),
        longitude: Number(place.longitude),
      };
      showSurfSpots();
    })
    .catch(error => {
      // An unknown zip code comes back as an error, as does no internet
      console.error(error);
      status.textContent = "Sorry, we couldn't find zip code " + zipCode
        + ". Check it and try again. Still measuring from " + homeLocation.name + ".";
    });
}

// Hook up the controls: submitting the zip code form (button or Enter key)
// looks up the zip code, and changing the radius box redraws the list
document.getElementById("zip-form").addEventListener("submit", findZipCode);
document.getElementById("radius").addEventListener("input", showSurfSpots);

// Show the spot list straight away (saying "Loading forecast..."),
// then fetch the spot forecasts and fill them in when they arrive
showSurfSpots();
loadSpotForecasts();

// Fetch the waves and the wind at the same time, then wait until BOTH have arrived.
// The forecast needs both, so it's simpler to handle them together.
Promise.all([fetchData(waveUrl), fetchData(windUrl)])
  .then(([waveData, windData]) => {
    showCurrentConditions(waveData, windData);
    showForecast(waveData, windData);
  })
  .catch(showLoadError);

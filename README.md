# Surf Dashboard

Where should I surf today? This page ranks San Diego surf spots near you, best first, using the day's forecast.

**Live site:** https://bobcatt11.github.io/surf-dashboard/

## What it shows

- Surf spots within a radius you choose (30 miles to start) of a zip code you type in
- For each spot, today's four 3-hour time blocks (6–9 AM, 9 AM–12 PM, 12–3 PM, 3–6 PM), each with:
  - wave height (ft), wave period (seconds) and swell direction
  - wind speed (mph) and direction
  - a score out of 10, coloured Good / Fair / Poor
- Spots ranked by their best time block that hasn't finished yet. After 6 PM, the page shows tomorrow instead.
- Tap "Show next 5 days" on any spot to see its forecast for the next 5 days

## How the score works

Each time block gets up to 10 points:

| Part | Points | Best when |
| --- | --- | --- |
| Wave size | up to 3 | 3 ft or bigger |
| Wave period | up to 2 | 12 seconds or longer |
| Wind | up to 4 | light (5 mph or less), or offshore (blowing from the land out to sea) |
| Swell direction | 1 | the swell is heading roughly at the beach |

Waves under 1 ft are too small to surf, so they score 3 at most. 7–10 is Good, 4–6 Fair, 0–3 Poor.

Wind and swell are compared with the direction each beach faces, which is stored with the spot in `script.js`.

## How it works

The page is plain HTML, CSS and JavaScript. When it loads, it uses `fetch()` to get the forecast for every spot at once from two free [Open-Meteo](https://open-meteo.com/) APIs. When you type a zip code, it looks up where that is with [Zippopotam.us](https://www.zippopotam.us/).

| Data | Service |
| --- | --- |
| Waves | [Open-Meteo Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api) |
| Wind | [Open-Meteo Weather Forecast API](https://open-meteo.com/en/docs) |
| Zip code → location | [Zippopotam.us](https://www.zippopotam.us/) |

No API keys or sign-ups are needed.

The list of surf spots (names, locations and which way each beach faces) is written by hand at the top of `script.js`. The numbers are approximate. To add a spot, copy a line and change it.

## Run it on your computer

1. Clone the repo:
   ```
   git clone https://github.com/bobcatt11/surf-dashboard.git
   ```
2. Open the folder and double-click `index.html` to view it in your browser. (`index.html`, `style.css` and `script.js` need to stay together in the same folder.)

## Built with

- HTML, CSS and JavaScript
- [Open-Meteo](https://open-meteo.com/) for forecast data
- [Zippopotam.us](https://www.zippopotam.us/) for zip code lookups
- GitHub Pages for hosting

## Ideas for later

- [x] Show wave and wind direction as compass points (e.g. "W" instead of "270°")
- [x] Add CSS styling so it looks like a real dashboard
- [x] Show the forecast in 3-hour time blocks
- [x] Rate conditions as good, fair or poor
- [x] Add more spots and rank them
- [ ] Add tides
- [ ] Fine-tune the scoring after comparing it with real sessions

## About

A beginner project by Bob Catt, built while learning to code.

Forecast data is provided by Open-Meteo under the CC BY 4.0 licence.

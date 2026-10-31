# Surf Dashboard

A simple surf forecast page for **Old Man's (Tourmaline Surfing Park)** in Pacific Beach, San Diego.

**Live site:** https://bobcatt11.github.io/surf-dashboard/

## What it shows

- Current wave height (ft), wave period (seconds) and wave direction
- Current wind speed (mph) and wind direction

## How it works

The page is plain HTML and JavaScript. When it loads, it uses `fetch()` to request the latest conditions from two free [Open-Meteo](https://open-meteo.com/) APIs, then writes the numbers onto the page.

| Data | API |
| --- | --- |
| Waves | [Marine Weather API](https://open-meteo.com/en/docs/marine-weather-api) |
| Wind | [Weather Forecast API](https://open-meteo.com/en/docs) |

No API key or sign-up is needed.

**Location:** latitude 32.80, longitude -117.27 (just offshore of Tourmaline).

## Run it on your computer

1. Clone the repo:
   ```
   git clone https://github.com/bobcatt11/surf-dashboard.git
   ```
2. Open the folder and double-click `index.html` to view it in your browser.

## Built with

- HTML
- JavaScript
- [Open-Meteo](https://open-meteo.com/) for forecast data
- GitHub Pages for hosting

## Ideas for later

- [ ] Show wave and wind direction as compass points (e.g. "W" instead of "270°")
- [ ] Add CSS styling so it looks like a real dashboard
- [ ] Show the forecast for the next 12 hours
- [ ] Rate conditions as good, fair or poor
- [ ] Add more spots (Ocean Beach, PB Point) with a dropdown to switch between them
- [ ] Add a tide chart

## About

A beginner project by Bob Catt, built while learning to code.

Forecast data is provided by Open-Meteo under the CC BY 4.0 licence.

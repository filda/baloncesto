# Baloncesto

A simple extrapolation predictor for basketball game results. From repeatedly entered scoreboard snapshots (period, remaining time, score) it estimates the final score and draws a chart. Games are stored in localStorage. See [docs/project-plan.md](docs/project-plan.md) for details.

The app is installable (PWA) and works offline.

## Commands

```sh
npm install      # install dependencies
npm run dev      # development server
npm run check    # format, lint, typecheck, tests and build
```

## Privacy

When you start a new game, the app asks the browser for your location and sends the coordinates to [OpenStreetMap Nominatim](https://nominatim.org/) to look up a place name (one request per form opening, results cached in localStorage). Location is optional: if it is denied or unavailable, the place can be typed in manually.

# Baloncesto

A simple extrapolating predictor of a basketball game's final score.

## Language

- English is the primary language: everything in the repository (code, comments, tests, docs, commit messages, UI texts) is in English.
- Conversation with the developer may be in Czech.

## Target device

- Primary device: Samsung Galaxy A35 (6.6", 1080 × 2340 px, ~390 ppi).
- CSS viewport 412 × 892 px at device pixel ratio 2.625; in Chrome the usable height is smaller (address bar, navigation bar), design for roughly 412 × 780.
- Portrait orientation first; the layout must also work on desktop.

## Functionality

During a game the user repeatedly reads the scoreboard and enters snapshots: period, time remaining in the period, and the home and away scores. From the elapsed time and the scoring pace the app estimates how many points each team will have at the end of the game. The chart shows two curves: the actual progression from the entered snapshots and the prediction until the end of the game.
Games are stored in localStorage.

### Game rules

- FIBA format: 4 periods × 10 min.
- Overtime: period 5, 6, … = 5 min overtime each. In overtime the prediction runs to the end of the current overtime.
- Time is entered as `m:ss` remaining in the period (as shown on the scoreboard); tenths of a second are not used.

### Prediction model

- Linear: team pace = points / elapsed time (whole game); prediction = current points + pace × remaining time.
- When elapsed time is 0, no prediction is shown (known data only).
- Output: curves + predicted final score (e.g. "82 : 76") at the end of the chart.
- The calculation is a pure function in its own module, fully covered by unit tests.

### Data (localStorage)

- Game: id, team names, date and time, geolocation (coordinates + place name), list of snapshots `{period, remaining, home, away}`.
- Versioned storage key (`baloncesto:v1`) for future migrations.
- History: list of previous games, open (continue / view chart), delete.

## Tech stack

- Vanilla TypeScript + Vite (dev server and build), no framework.
- Chart: hand-written SVG, no library.
- Vitest (unit tests), Oxlint (lint), Oxfmt (formatting), Stryker (mutation tests).
- PWA: manifest + service worker (vite-plugin-pwa), works offline.
- GitHub workflows:
  - push to `main`: format check, lint, typecheck, tests, build → on success deploy to GitHub Pages (`base: /baloncesto/`).
  - Stryker: separate, manually triggered workflow (`workflow_dispatch`).
- Version in the footer: short commit hash (`GITHUB_SHA`) and build date injected via Vite `define`.
- Local run: `npm run dev`.

## UI

Visual direction: **paper scoresheet**. Off-white paper, a grid like an official game scoresheet, ink colours and handwritten accents. Above all it must not look like every other agent-generated SPA.

- Layout top to bottom: header + game info line, entry form, chart, projected final score (with editable team names), log.
- The current score is not shown separately — it is on the scoreboard.
- Entry form at the top: 4 inputs (period, time, home score, away score) + a full-width button to record the snapshot.
  - Focusing an input selects its text, so typing overwrites it.
  - Time is typed as digits only, the colon is inserted automatically: the first digit is minutes, 4 digits mean two-digit minutes (`530` → `5:30`, `1000` → `10:00`).
- Input validation: period 1–9, time within the period length (10:00, overtime 5:00), scores 0–300 and not lower than in the previous snapshot, time not going back; a snapshot identical to the previous one is rejected.
- The chart takes most of the screen, each team has its own curve in a fixed colour (blue and red ink).
- Known data in a saturated colour, prediction lighter (dashed).
- Projected final score below the chart.
- Log of snapshots, newest first; each row has a × button to delete it (no separate undo button).
- Optimised for a portrait phone screen (see Target device).
- The footer shows the app version: commit hash and deployment date.
- Teams can be named.
- New game button: prefills date, time and geolocation.
  - Geolocation via the Geolocation API, place name via reverse geocoding (Nominatim, respect its usage policy, cache the result).
  - If permission is denied or the network is unavailable, the field stays empty and can be filled in manually.
- Game history (list, open, delete).

## Milestones

1. Scaffold (Vite + TS, Vitest, Oxlint, Oxfmt) + CI + GitHub Pages deploy with version in the footer.
2. Domain model: time parsing, period/time → elapsed time, linear prediction + tests.
3. Input and snapshot UI + validation.
4. SVG chart (known data + prediction, predicted score).
5. localStorage: saving, history, open, delete.
6. New game: team names, date/time, geolocation + reverse geocoding.
7. PWA (offline).
8. Stryker workflow.

## Agents

The main model agrees on the plan with the developer and then delegates tasks to cheaper sub-models. If something is unclear, the agent asks. We take the fastest possible path.

- Commit directly to `main` after each finished step with green checks.
- A task is done when format check, lint, typecheck, tests and build pass.
- Checks run after every change except mutation tests, which run on the developer's request.

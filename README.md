# Baloncesto

A possession-based predictor for basketball game results. From repeatedly entered scoreboard snapshots (period, remaining time, score) it estimates the final score and draws a chart. Games are stored in localStorage. See [docs/project-plan.md](docs/project-plan.md) for details.

The app is installable (PWA) and works offline.

## Commands

```sh
npm install      # install dependencies
npm run dev      # development server
npm run check    # format, lint, typecheck, tests and build
npm run test:mutation  # Stryker mutation tests (slow; in CI via the manual "Mutation Testing" workflow)
```

## Privacy

When you start a new game, the app asks the browser for your location and sends the coordinates to [OpenStreetMap Nominatim](https://nominatim.org/) to look up a place name (one request per form opening, results cached in localStorage). Location is optional: if it is denied or unavailable, the place can be typed in manually.

## Data and rules

### Storage schema

All game data lives in `localStorage` under the key `baloncesto:v1` as one JSON document (`AppState`, see `src/app/storage.ts`):

| Type           | Field        | Meaning                                                                               |
| -------------- | ------------ | ------------------------------------------------------------------------------------- |
| `AppState`     | `version`    | Schema version, always `1`.                                                           |
|                | `currentId`  | `id` of the game being edited, or `null`.                                             |
|                | `games`      | All stored games.                                                                     |
| `Game`         | `id`         | Non-empty unique string.                                                              |
|                | `createdAt`  | ISO 8601 timestamp of creation (must be parseable by `Date.parse`).                   |
|                | `homeName`   | Home team name (string).                                                              |
|                | `awayName`   | Away team name (string).                                                              |
|                | `location`   | Optional `GameLocation`.                                                              |
|                | `snapshots`  | Scoreboard entries in chronological order.                                            |
| `Snapshot`     | `period`     | Integer 1–9: 1–4 are regulation periods, 5–9 are overtimes.                           |
|                | `remaining`  | Integer seconds left in the period, `0`–`600` (regulation) or `0`–`300` (overtime).   |
|                | `home`       | Home score, integer 0–300.                                                            |
|                | `away`       | Away score, integer 0–300.                                                            |
| `GameLocation` | `lat`, `lon` | Finite numbers; always present together or both absent.                               |
|                | `place`      | Optional place name. At least one of `place` or the `lat`/`lon` pair must be present. |

A second key, `baloncesto:geocache`, holds the reverse-geocoding cache: a JSON object mapping `"lat,lon"` (coordinates rounded to 3 decimals) to a place name string. Non-string values are ignored when it is read.

### Prediction range

The projection is possession based, per team and independent of the other team (`src/domain/predict.ts`). Constants: `POSSESSIONS_PER_40 = 72`, `POSSESSION_RATE = 72 / 2400` per second, `PRIOR_PPP = 1.0` points per possession, `PRIOR_WEIGHT_SECONDS = 600`, `HOT_PPP = 1.5`.

- `ppp = (points + PRIOR_PPP × POSSESSION_RATE × PRIOR_WEIGHT_SECONDS) / (POSSESSION_RATE × (elapsed + PRIOR_WEIGHT_SECONDS))`: the observed rate shrunk towards the prior, which weighs as much as one played period.
- `remainingPossessions = POSSESSION_RATE × (end − elapsed)`, where `end` is the end of the current period's game (2400 s, plus 300 s per overtime).
- `predicted = points + remainingPossessions × ppp`. An entry at 0:00 elapsed predicts the prior (72 for 0 points); "— : —" is shown only while there are no entries.
- Range (min–max): `low = points` (no further scoring), `high = points + remainingPossessions × max(HOT_PPP, ppp)` (a hot streak). The range collapses to the current score at the final buzzer, is drawn as a light band from the current score up to the high bound around the dashed line, and is printed as min–max under the projected final.

### Migration policy

The stored `version` is the schema version. `migrate()` in `src/app/storage.ts` currently accepts only version `1` and returns it unchanged; any other or missing version (including newer ones) yields `null`, which loads as the empty state and does not overwrite anything until the next save. To change the schema, bump the version (and the storage key), add a step v(n) → v(n+1) in `migrate()` and chain the steps. Old keys are never mutated in place.

### What loading drops

`loadState` never throws. Unreadable input (no storage, missing key, invalid JSON, unknown version, `games` not an array) gives the empty state. Otherwise each stored game is validated and invalid games are dropped individually (a warning with the count is logged to the console), so one corrupt game cannot take down the others. A game is dropped when:

- `id` is not a non-empty string, `createdAt` is not a parseable date string, or `homeName` / `awayName` are not strings;
- `location` is present but malformed (see the schema above);
- any snapshot is out of range (non-integer values, period outside 1–9, `remaining` outside the period length, a score outside 0–300);
- snapshots are not chronological (elapsed game time or either score decreases between neighbours).

`currentId` is reset to `null` if it does not refer to a surviving game.

### Input validation

New snapshots (`src/domain/validate.ts`) are checked before they are stored:

- **Period**: a single canonical digit `1`–`9` (no leading zeros or signs). Periods 1–4 are regulation, 5–9 overtime.
- **Time**: `m:ss` with one or two minute digits and seconds `00`–`59`, at most the period length: `10:00` in regulation, `5:00` in overtime.
- **Scores**: whole numbers `0`–`300`.
- **Against the previous entry**: elapsed game time must not decrease, neither score may go down, and an entry identical to the previous one (same period, time and both scores) is rejected as a duplicate.

While typing in the time field only digits are kept (at most four) and the colon is inserted automatically. On confirm an unfinished time is completed: a single seconds digit gets a trailing zero (`4:4` → `4:40`, so typing `44` gives `4:40`) and a lone digit becomes whole minutes (`4` → `4:00`). Anything else is left as typed and reported by validation.

### Nominatim policy

Place names come from the OpenStreetMap Nominatim reverse-geocoding service (`https://nominatim.openstreetmap.org/reverse`, `format=jsonv2`, `zoom=17`):

- at most one request per lookup (one per opening of the new-game form), and no retries; a failure simply leaves the place to be typed in manually;
- each request is aborted after 8 seconds (`FETCH_TIMEOUT_MS`);
- results are cached in `baloncesto:geocache`, keyed by the coordinates rounded to 3 decimals (about 100 m); a cache hit means no request at all;
- the cache keeps the 50 most recently stored entries, the oldest are dropped first.

The position itself is requested from the browser without high accuracy, with a 10 s timeout and a 10 minute position cache.

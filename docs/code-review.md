# Code Review — Baloncesto

- Date: 2026-10-20
- Commit: `01b00a3`
- Scope: full repository (`src/`, `tests/`, build config, CI workflows, docs)
- Verification: `npm run check` passes (276 tests, lint, typecheck, build) — findings below are on top of a green baseline.

## Verdict

The codebase is in good shape for its size: clean domain/app/chart layering, pure functions,
disciplined input validation, real storage hardening, mutation testing, and an intentional visual
design. The main weaknesses are (1) a mismatch between storage validation and domain invariants
that lets corrupt data crash the app at startup, (2) silent data loss paths (ignored
`saveState` result, no multi-tab handling), and (3) zero test coverage on the UI layer, which is
also the largest and least structured file.

## P0 — Correctness bugs (fix before anything else)

- [x] **Corrupt snapshot crashes the app on load** — `src/app/storage.ts:31-39`
      `isSnapshot` only checks that `period`, `remaining`, `home`, `away` are integers. It accepts
      `period ≤ 0`, negative `remaining`, `remaining > periodLength(period)`, or negative scores.
      Such a snapshot passes `loadState`, then `render → currentPrediction → predict →
  elapsedSeconds → periodLength` throws `RangeError` (`src/domain/clock.ts:5-9`) during the
      initial render in `src/main.ts`. The app is dead on every reload until the user clears
      localStorage manually — and there is no UI to do that.
      Fix: validate domain invariants in `loadState` (`1 ≤ period`, `0 ≤ remaining ≤
  periodLength(period)`, `home ≥ 0`, `away ≥ 0`), or make `predict`/`elapsedSeconds` return
      `null` instead of throwing for out-of-domain input. Add regression tests for both storage
      filtering and render-time behavior.
- [ ] **Silent data loss when persistence fails** — `src/main.ts:62-65`
      `persist()` ignores the boolean returned by `saveState`. Quota exceeded / private mode /
      disabled storage means the user records scores for a whole game and nothing is ever saved, with
      no warning. Fix: surface a persistent, dismissible warning (reuse the update-banner pattern in
      `src/app/update-banner.ts`) when a save fails, and re-check on the next save.
- [ ] **Multi-tab writes clobber state** — `src/app/storage.ts`, `src/main.ts`
      Each tab keeps the full state in memory and writes it wholesale; two tabs overwrite each other
      (last write wins, including deleting games created in the other tab). Minimum fix: listen to
      the `storage` event, detect a foreign write, and re-`loadState` (or at least warn). Better
      long-term: one storage key per game instead of one blob for the whole state.

## P1 — Robustness and architecture

- [x] **`formatVersion` can throw at startup** — `src/footer.ts:2-3`
      `new Date(invalid).toISOString()` throws `RangeError`. If `__APP_BUILD_DATE__` is ever invalid,
      the first statement of `src/main.ts:51` kills the whole app. Guard with
      `Number.isNaN(date.getTime())` and render the raw string. Add a test for invalid input.
- [x] **Geolocation status can hang forever** — `src/app/geo.ts:154`
      `browserGetPosition` has a 10 s timeout, but `fetchJson` has none; a hanging Nominatim request
      leaves the form stuck on "Locating…". Fix: `AbortSignal.timeout(...)` (or an
      `AbortController` wired into `LocateDeps` so it stays testable).
- [x] **Invalid games are dropped silently** — `src/app/storage.ts:78`
      `games.filter(isGame)` throws away data with no `console.warn`, no quarantine key, no counter.
      A version bump bug or partial corruption becomes invisible data loss. Fix: log how many games
      were dropped and why (at least in dev), or store rejected items under a quarantine key.
- [ ] **`main.ts` mixes routing, state, persistence and geolocation** — `src/main.ts`
      Module-level mutable `state`/`game`/`formSession`/`coords`, plus hash routing and side effects
      in one file, with zero tests. Extract a small store (state + `persist`/`switchTo`/reducer) and
      a router module; both become unit-testable and `main.ts` shrinks to wiring.
- [ ] **`view.ts` is a 470-line monolith with a fragile mount hack** — `src/app/view.ts:294-297`
      `mountView` does `root.replaceChildren(...)` and then re-appends a footer it removed — this
      only works because `main.ts` happens to append the footer before mounting. Fix: let `main.ts`
      pass a dedicated container (or a `<slot>`-style child) for the view, and split the view into
      `sheet` / `history` / `new-game` sub-mounts.
- [x] **Chart geometry duplicates clock constants** — `src/chart/geometry.ts:7-9`
      `2400`, `600`, `300` hardcode what `src/domain/clock.ts` already owns (`REGULATION_PERIODS`,
      `REGULATION_LENGTH`, `OVERTIME_LENGTH`). Export the constants from `clock.ts` and derive
      `PERIOD_BOUNDS`/`REGULATION_END` so a rules change cannot desynchronize domain and chart.
- [x] **`listHistory` sorts raw strings** — `src/app/storage.ts:125-129`
      `isGame` accepts any non-empty string as `createdAt`; an invalid timestamp sorts
      unpredictably (and `formatDateTime` then renders it verbatim). Validate the ISO shape (or
      `!Number.isNaN(Date.parse(...))`) in `isGame`.
- [ ] **Tighten tsconfig** — `tsconfig.json`
      Add `noUncheckedIndexedAccess` (would have flagged several `array[n]` patterns),
      `noFallthroughCasesInSwitch`, `noImplicitOverride`. Fix what surfaces.
- [x] **Storage version field has no migration story** — `src/app/storage.ts:13-21`
      `version: 1` exists, but nothing documents how v2 would migrate. Add a one-paragraph policy
      (and a `migrate(raw)` seam) to the plan or a code comment before the schema grows.

## P2 — UI/UX and polish

- [ ] **Asymmetric empty prediction display** — `src/app/view.ts:332-333`
      No prediction renders home as `"—"` but away as `""` (only the colon is hidden). Unify: both
      `"—"`, or hide the whole score span. Add a DOM test so it cannot drift silently.
- [ ] **Native `confirm()` for destructive actions** — `src/main.ts:173`
      Breaks the crafted visual language and is untestable; deleting a game is irreversible with no
      undo. Either build a small in-app confirm sheet (matches the update-banner pattern) or support
      undo (keep the game in memory and offer "Undo" for a few seconds).
- [ ] **Focus/select hack is brittle** — `src/app/view.ts:178-195`
      Three redundant `select()` calls plus swallowing the first `mouseup` — documented, but
      fragile across browsers. Extract into a named helper and cover it with happy-dom tests; or
      switch to selecting on `pointerdown`.
- [ ] **Unknown hashes silently render the sheet** — `src/main.ts:113-124`
      Any garbage hash shows the sheet without normalizing the URL, so Back/Forward behaves
      surprisingly. Consider `history.replaceState` normalization, and deep links like
      `#/game/<id>` so a specific game can be reopened from an URL.
- [ ] **Dead code** — `src/app/view.ts:382`: `item.dataset.gameId` is written but never read.
      Remove it or use it (e.g. for tests/automation selectors).
- [x] **Duplicated default team names** — `src/chart/render.ts:34` hardcodes
      `"Home"/"Away"`; reuse `DEFAULT_HOME_NAME`/`DEFAULT_AWAY_NAME` from `src/app/match.ts`.
- [x] **`parsePeriod` accepts leading zeros** — `src/domain/validate.ts:27-31`: `"01"` is a
      valid period. Decide and enforce one canonical form (`^[1-9]$`), consistent with the clock.
- [ ] **Invalid new-game datetime silently becomes "now"** — `src/main.ts:101`
      `parseDateTimeLocal(...) ?? new Date()` hides user input errors; the field is
      `datetime-local` so it should rarely happen, but consider validating and flagging instead.

## P3 — Tests, tooling, CI, docs

- [ ] **The UI layer has zero coverage** — `src/app/view.ts`, `src/main.ts`,
      `src/app/update-banner.ts`, `src/chart/render.ts` (render path) are untested; vitest runs in
      `node` environment so DOM tests are impossible today. Add the `happy-dom` environment (or
      `jsdom`) and tests for: render/log/errors wiring, submit flow, screen switching, the clock
      input formatting loop. Optionally a minimal Playwright smoke test (record entry → prediction
      visible → reload persists) since this is a data-entry PWA.
- [ ] **`.gitignore` is stock Vite boilerplate** — `.gitignore`
      ~130 lines of Nuxt/Gatsby/FuseBox/Docusaurus noise. Reduce to what the project needs
      (`node_modules/`, `dist/`, `reports/`, `.stryker-tmp/`, `.idea/`, logs, `.env*`).
- [x] **Missing `engines` / Node pinning** — `package.json`
      CI uses Node 24 but nothing declares it; add `"engines": { "node": ">=24" }` and/or a
      `.nvmrc`. Also decide the role of `"version": "0.0.0"` (never bumped) — bump per release or
      keep and rely on the footer commit hash only.
- [x] **Lint scope omits config files** — `package.json:11`
      `oxlint src tests` skips `vite.config.ts`, `vitest.config.ts`, `stryker.config.mjs`,
      `pwa-assets.config.ts`. Include them.
- [ ] **Mutation testing only manual** — `.github/workflows/mutation-testing.yml`
      Fine per plan, but add a weekly `schedule` trigger (or run on PRs touching `src/domain`) so
      the mutation score cannot silently drift.
- [x] **Manifest hardening** — `vite.config.ts:24-46`
      Add manifest `id` (stable identity across scope changes); consider `display_override`. A meta
      CSP (`default-src 'self'; connect-src 'self' https://nominatim.openstreetmap.org`) is possible
      in `index.html` and costs little.
- [ ] **Document the storage schema and validation rules** — `README.md` / `docs/project-plan.md`
      The localStorage schema, its versioning policy, and the accepted input ranges (period 1–9,
      scores 0–300, m:ss) live only in code. Write them down; also document the Nominatim
      rate/cache policy already implemented in `src/app/geo.ts`.
- [x] **No dependency update automation** — add Dependabot/Renovate config (there is already one
      manual `overrides` entry for `qs` from an audit fix — exactly the kind of drift automation
      prevents).

## What is already good (keep it)

- Clean layering: `domain/` pure and framework-free, `app/` effects, `chart/` isolated;
  dependency injection (`LocateDeps`, `KeyValueStorage`) makes everything testable.
- `loadState` shape validation and the "never throws" contract are the right instinct — they
  just need to align with domain invariants (P0-1).
- `textContent` everywhere, no `innerHTML` — no XSS surface.
- A11y basics done: `aria-label`s, `role="alert"/"status"`, `aria-invalid`/`aria-describedby`
  wiring, 44 px touch targets.
- Mutation testing with a break threshold, deterministic history-sort tests, `related: true`
  for Stryker — unusually disciplined for a project this size.

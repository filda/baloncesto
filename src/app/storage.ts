import type { Game, GameLocation } from "./match";
import { elapsedSeconds, periodLength } from "../domain/clock";
import type { Snapshot } from "../domain/predict";

export const STORAGE_KEY = "baloncesto:v1";

/** The subset of the Web Storage API the app uses. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AppState {
  version: 1;
  currentId: string | null;
  games: Game[];
}

export function emptyState(): AppState {
  return { version: 1, currentId: null, games: [] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

const MAX_PERIOD = 9;
const MAX_SCORE = 300;

function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    isInt(value.period) &&
    value.period >= 1 &&
    value.period <= MAX_PERIOD &&
    isInt(value.remaining) &&
    value.remaining >= 0 &&
    value.remaining <= periodLength(value.period) &&
    isInt(value.home) &&
    value.home >= 0 &&
    value.home <= MAX_SCORE &&
    isInt(value.away) &&
    value.away >= 0 &&
    value.away <= MAX_SCORE
  );
}

/** Elapsed game time and both scores never decrease from one snapshot to the next. */
function isChronological(snapshots: Snapshot[]): boolean {
  return snapshots.every((s, i) => {
    const prev = snapshots[i - 1];
    return (
      prev === undefined ||
      (elapsedSeconds(s.period, s.remaining) >= elapsedSeconds(prev.period, prev.remaining) &&
        s.home >= prev.home &&
        s.away >= prev.away)
    );
  });
}

function isLocation(value: unknown): value is GameLocation {
  if (!isRecord(value)) return false;
  const placeOk = value.place === undefined || typeof value.place === "string";
  const hasLat = value.lat !== undefined;
  const hasLon = value.lon !== undefined;
  if (hasLat !== hasLon || !placeOk) return false;
  if (!hasLat) return value.place !== undefined;
  return (
    typeof value.lat === "number" &&
    Number.isFinite(value.lat) &&
    typeof value.lon === "number" &&
    Number.isFinite(value.lon)
  );
}

function isGame(value: unknown): value is Game {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id !== "" &&
    typeof value.createdAt === "string" &&
    !Number.isNaN(Date.parse(value.createdAt)) &&
    typeof value.homeName === "string" &&
    typeof value.awayName === "string" &&
    (value.location === undefined || isLocation(value.location)) &&
    Array.isArray(value.snapshots) &&
    value.snapshots.every(isSnapshot) &&
    isChronological(value.snapshots as Snapshot[])
  );
}

/**
 * Migration policy: the stored `version` is the schema version. To change the schema, bump the
 * version (and the storage key), add a step v(n) -> v(n+1) here and chain the steps; never mutate
 * old keys in place. Unknown (e.g. newer) versions yield `null`, which loads as the empty state.
 */
export function migrate(raw: unknown): unknown {
  if (isRecord(raw) && raw.version === 1) return raw;
  return null;
}

export interface LoadReport {
  state: AppState;
  /** Number of stored games rejected by validation. */
  dropped: number;
}

/** Never throws: anything unreadable yields the empty state. Warns when games were dropped. */
export function loadStateWithReport(storage: KeyValueStorage | null): LoadReport {
  const empty = { state: emptyState(), dropped: 0 };
  if (!storage) return empty;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return empty;
    const data = migrate(JSON.parse(raw));
    if (!isRecord(data) || !Array.isArray(data.games)) return empty;
    const games = data.games.filter(isGame);
    const dropped = data.games.length - games.length;
    if (dropped > 0) console.warn(`Dropped ${dropped} invalid stored game(s)`);
    const currentId =
      typeof data.currentId === "string" && games.some((g) => g.id === data.currentId)
        ? data.currentId
        : null;
    return { state: { version: 1, currentId, games }, dropped };
  } catch {
    return empty;
  }
}

export function loadState(storage: KeyValueStorage | null): AppState {
  return loadStateWithReport(storage).state;
}

/** Returns false when nothing could be written (no storage, quota, SecurityError). */
export function saveState(storage: KeyValueStorage | null, state: AppState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function upsertGame(state: AppState, game: Game): AppState {
  const exists = state.games.some((g) => g.id === game.id);
  const games = exists
    ? state.games.map((g) => (g.id === game.id ? game : g))
    : [...state.games, game];
  return { ...state, games };
}

export function deleteGame(state: AppState, id: string): AppState {
  return {
    ...state,
    currentId: state.currentId === id ? null : state.currentId,
    games: state.games.filter((g) => g.id !== id),
  };
}

export function setCurrent(state: AppState, id: string | null): AppState {
  return { ...state, currentId: id };
}

export function findGame(state: AppState, id: string | null): Game | null {
  return id === null ? null : (state.games.find((g) => g.id === id) ?? null);
}

/** Games with at least one snapshot, newest first. */
export function listHistory(state: AppState): Game[] {
  return state.games
    .filter((g) => g.snapshots.length > 0)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

export function safeLocalStorage(): KeyValueStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

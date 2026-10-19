import type { Game, GameLocation } from "./match";
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

function isSnapshot(value: unknown): value is Snapshot {
  return (
    isRecord(value) &&
    isInt(value.period) &&
    isInt(value.remaining) &&
    isInt(value.home) &&
    isInt(value.away)
  );
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
    typeof value.homeName === "string" &&
    typeof value.awayName === "string" &&
    (value.location === undefined || isLocation(value.location)) &&
    Array.isArray(value.snapshots) &&
    value.snapshots.every(isSnapshot)
  );
}

/** Never throws: anything unreadable yields the empty state. */
export function loadState(storage: KeyValueStorage | null): AppState {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return emptyState();
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data) || data.version !== 1 || !Array.isArray(data.games)) return emptyState();
    const games = data.games.filter(isGame);
    const currentId =
      typeof data.currentId === "string" && games.some((g) => g.id === data.currentId)
        ? data.currentId
        : null;
    return { version: 1, currentId, games };
  } catch {
    return emptyState();
  }
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

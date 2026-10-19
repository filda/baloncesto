import { formatClock } from "../domain/clock";
import { predict } from "../domain/predict";
import type { Prediction, Snapshot } from "../domain/predict";
import type { SnapshotInput } from "../domain/validate";

/** Coordinates (lat and lon always together) and/or a place name; at least one of them is present. */
export interface GameLocation {
  lat?: number;
  lon?: number;
  place?: string;
}

export interface Game {
  id: string;
  /** ISO 8601 timestamp of when the game was created. */
  createdAt: string;
  homeName: string;
  awayName: string;
  location?: GameLocation;
  snapshots: Snapshot[];
}

/** Anything that carries snapshots; the helpers below accept a full Game too. */
export interface HasSnapshots {
  snapshots: Snapshot[];
}

export const DEFAULT_HOME_NAME = "Home";
export const DEFAULT_AWAY_NAME = "Away";

export function newGame(id: string, now: Date): Game {
  return {
    id,
    createdAt: now.toISOString(),
    homeName: DEFAULT_HOME_NAME,
    awayName: DEFAULT_AWAY_NAME,
    snapshots: [],
  };
}

export const MAX_TEAM_NAME_LENGTH = 24;

/** Trims and truncates a team name; blank input yields the fallback. */
export function normalizeTeamName(input: string, fallback: string): string {
  const name = input.trim().slice(0, MAX_TEAM_NAME_LENGTH).trim();
  return name === "" ? fallback : name;
}

export interface NewGameInput {
  id: string;
  createdAt: Date;
  homeName: string;
  awayName: string;
  lat?: number;
  lon?: number;
  place?: string;
}

/** Builds an empty game from the new-game form values; the location is omitted when unknown. */
export function createGame(input: NewGameInput): Game {
  const place = input.place?.trim() || undefined;
  const hasCoords = input.lat !== undefined && input.lon !== undefined;
  const game = newGame(input.id, input.createdAt);
  game.homeName = normalizeTeamName(input.homeName, DEFAULT_HOME_NAME);
  game.awayName = normalizeTeamName(input.awayName, DEFAULT_AWAY_NAME);
  if (hasCoords) {
    game.location = place
      ? { lat: input.lat, lon: input.lon, place }
      : { lat: input.lat, lon: input.lon };
  } else if (place) {
    game.location = { place };
  }
  return game;
}

/** "2026-10-19 20:05 · Place" (the place is omitted when absent). */
export function gameInfoLine(game: Game, formatDate: (iso: string) => string): string {
  const place = game.location?.place;
  return place ? `${formatDate(game.createdAt)} · ${place}` : formatDate(game.createdAt);
}

export function addSnapshot<T extends HasSnapshots>(game: T, snapshot: Snapshot): T {
  return { ...game, snapshots: [...game.snapshots, snapshot] };
}

export function removeLastSnapshot<T extends HasSnapshots>(game: T): T {
  return { ...game, snapshots: game.snapshots.slice(0, -1) };
}

export function lastSnapshot(game: HasSnapshots): Snapshot | null {
  return game.snapshots.at(-1) ?? null;
}

export function currentPrediction(game: HasSnapshots): Prediction | null {
  const last = lastSnapshot(game);
  return last ? predict(last) : null;
}

export function nextInputDefaults(game: HasSnapshots): SnapshotInput {
  const last = lastSnapshot(game);
  if (!last) return { period: "1", clock: "10:00", home: "0", away: "0" };
  return {
    period: String(last.period),
    clock: formatClock(last.remaining),
    home: String(last.home),
    away: String(last.away),
  };
}

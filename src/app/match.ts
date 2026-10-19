import { formatClock } from "../domain/clock";
import { predict } from "../domain/predict";
import type { Prediction, Snapshot } from "../domain/predict";
import type { SnapshotInput } from "../domain/validate";

export interface GameLocation {
  lat: number;
  lon: number;
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

import { formatClock } from "../domain/clock";
import { predict } from "../domain/predict";
import type { Prediction, Snapshot } from "../domain/predict";
import type { SnapshotInput } from "../domain/validate";
import { parseDateTimeLocal } from "./format";
import type { Coords, LocationStatus } from "./geo";

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

export type Side = "home" | "away";

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

export const INVALID_DATE_MESSAGE = "Enter a valid date and time.";

/** Raw values of the new-game form. */
export interface NewGameFormValues {
  homeName: string;
  awayName: string;
  /** `datetime-local` value, local time. */
  dateTime: string;
  place: string;
}

export type NewGameDraft =
  | { ok: true; input: Omit<NewGameInput, "id"> }
  | { ok: false; errors: { dateTime: string } };

/** Validates the new-game form: an unparsable date is an error, never silently "now". */
export function draftNewGame(form: NewGameFormValues, coords: Coords | null): NewGameDraft {
  const createdAt = parseDateTimeLocal(form.dateTime);
  if (!createdAt) return { ok: false, errors: { dateTime: INVALID_DATE_MESSAGE } };
  return {
    ok: true,
    input: {
      createdAt,
      homeName: form.homeName,
      awayName: form.awayName,
      lat: coords?.lat,
      lon: coords?.lon,
      place: form.place,
    },
  };
}

/** "2026-10-19 20:05 · Place" (the place is omitted when absent). */
export function gameInfoLine(game: Game, formatDate: (iso: string) => string): string {
  const place = game.location?.place;
  return place ? `${formatDate(game.createdAt)} · ${place}` : formatDate(game.createdAt);
}

/** The app opens the new-game form on start when there is nothing to continue with. */
export function shouldOpenNewFormOnStart(game: Game | undefined): boolean {
  return game === undefined || game.snapshots.length === 0;
}

/** "49.195, 16.607": coordinates as place text when no place name could be resolved. */
export function coordsText(coords: Coords): string {
  return `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`;
}

/** Applies a locate result to a game; without a place name the coordinates text is the place. */
export function withLocation(game: Game, coords: Coords, place: string | undefined): Game {
  return {
    ...game,
    location: { lat: coords.lat, lon: coords.lon, place: place?.trim() || coordsText(coords) },
  };
}

/** Label of the "+ ADD PLACE" button (CSS uppercases it) for the running lookup, if any. */
export function addPlaceLabel(status: LocationStatus | null): string {
  if (status === "locating") return "Locating…";
  if (status === "unavailable") return "Location unavailable · retry";
  return "+ Add place";
}

export function addSnapshot<T extends HasSnapshots>(game: T, snapshot: Snapshot): T {
  return { ...game, snapshots: [...game.snapshots, snapshot] };
}

/** Removes the snapshot at `index`; an out-of-range or non-integer index returns the game unchanged. */
export function removeSnapshotAt<T extends HasSnapshots>(game: T, index: number): T {
  if (!Number.isInteger(index) || index < 0 || index >= game.snapshots.length) return game;
  return { ...game, snapshots: game.snapshots.filter((_, i) => i !== index) };
}

export function lastSnapshot(game: HasSnapshots): Snapshot | null {
  return game.snapshots.at(-1) ?? null;
}

/** Never throws: an out-of-domain snapshot (e.g. from corrupt data) yields no prediction. */
export function currentPrediction(game: HasSnapshots): Prediction | null {
  const last = lastSnapshot(game);
  if (!last) return null;
  try {
    return predict(last);
  } catch {
    return null;
  }
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

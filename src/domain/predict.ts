import { elapsedSeconds, gameEndSeconds } from "./clock";

export interface Snapshot {
  period: number;
  /** Seconds remaining in the period. */
  remaining: number;
  home: number;
  away: number;
}

export interface Prediction {
  elapsed: number;
  end: number;
  /** Predicted final points, unrounded. */
  home: number;
  away: number;
}

export function predict(snapshot: Snapshot): Prediction | null {
  const elapsed = elapsedSeconds(snapshot.period, snapshot.remaining);
  if (elapsed === 0) return null;
  const end = gameEndSeconds(snapshot.period);
  const left = end - elapsed;
  return {
    elapsed,
    end,
    home: snapshot.home + (snapshot.home / elapsed) * left,
    away: snapshot.away + (snapshot.away / elapsed) * left,
  };
}

export function roundScore(points: number): number {
  return Math.round(points);
}

/** z-score of a two-sided ~95 % interval. */
export const Z = 1.96;
/** Remaining points arrive as scoring events worth ~2 points, so their variance is 2 × expected. */
export const POINTS_PER_EVENT = 2;

export interface Range {
  /** Unrounded lower bound of the final score (never below the current score). */
  low: number;
  /** Unrounded upper bound of the final score. */
  high: number;
}

export interface PredictionRange {
  home: Range;
  away: Range;
}

/** Half-width of the interval for `expected` remaining points: Z × √(POINTS_PER_EVENT × expected). */
export function halfWidth(expected: number): number {
  return Z * Math.sqrt(POINTS_PER_EVENT * expected);
}

/** Interval of the final score for a team with `points` now and a linear `predicted` final. */
export function finalRange(points: number, predicted: number): Range {
  const half = halfWidth(predicted - points);
  return { low: Math.max(points, predicted - half), high: predicted + half };
}

export function predictRange(snapshot: Snapshot): PredictionRange | null {
  const prediction = predict(snapshot);
  if (!prediction) return null;
  return {
    home: finalRange(snapshot.home, prediction.home),
    away: finalRange(snapshot.away, prediction.away),
  };
}

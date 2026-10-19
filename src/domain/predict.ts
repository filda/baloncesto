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

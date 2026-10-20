import { elapsedSeconds, gameEndSeconds } from "./clock";

/** Possessions per team in 40 minutes (FIBA average). */
export const POSSESSIONS_PER_40 = 72;
/** Possessions per team per second of game time. */
export const POSSESSION_RATE = POSSESSIONS_PER_40 / 2400;
/** League prior for points per possession. */
export const PRIOR_PPP = 1.0;
/** Game seconds the prior weighs, i.e. one regulation period of evidence. */
export const PRIOR_WEIGHT_SECONDS = 600;
/** Points per possession of a realistic hot streak; the range's upper bound uses at least this. */
export const HOT_PPP = 1.5;

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

/** Points per possession: the observed rate shrunk towards the prior by PRIOR_WEIGHT_SECONDS. */
function pointsPerPossession(points: number, elapsed: number): number {
  return (
    (points + PRIOR_PPP * POSSESSION_RATE * PRIOR_WEIGHT_SECONDS) /
    (POSSESSION_RATE * (elapsed + PRIOR_WEIGHT_SECONDS))
  );
}

export function predict(snapshot: Snapshot): Prediction {
  const elapsed = elapsedSeconds(snapshot.period, snapshot.remaining);
  const end = gameEndSeconds(snapshot.period);
  const possessions = POSSESSION_RATE * (end - elapsed);
  return {
    elapsed,
    end,
    home: snapshot.home + possessions * pointsPerPossession(snapshot.home, elapsed),
    away: snapshot.away + possessions * pointsPerPossession(snapshot.away, elapsed),
  };
}

export function roundScore(points: number): number {
  return Math.round(points);
}

export interface Range {
  /** Unrounded lower bound of the final score: the current score. */
  low: number;
  /** Unrounded upper bound of the final score. */
  high: number;
}

export interface PredictionRange {
  home: Range;
  away: Range;
}

/** Range of the final score: no further points up to a hot streak of at least HOT_PPP. */
function finalRange(points: number, elapsed: number, possessions: number): Range {
  const ppp = Math.max(HOT_PPP, pointsPerPossession(points, elapsed));
  return { low: points, high: points + possessions * ppp };
}

export function predictRange(snapshot: Snapshot): PredictionRange {
  const elapsed = elapsedSeconds(snapshot.period, snapshot.remaining);
  const possessions = POSSESSION_RATE * (gameEndSeconds(snapshot.period) - elapsed);
  return {
    home: finalRange(snapshot.home, elapsed, possessions),
    away: finalRange(snapshot.away, elapsed, possessions),
  };
}

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

/** Variance of one possession's points (0–3 points, about 1 on average). */
export const POSSESSION_VARIANCE = 1.2;

export interface WinProbability {
  /** Probability that the home team wins, 0–1. */
  home: number;
  away: number;
  /** True when no time is left, so the probabilities are 0, 1 or a 0.5 tie. */
  decided: boolean;
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 for erf, absolute error below 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * Win probability from the possession model: each team's remaining points are a sum of
 * independent possessions, so the final margin is roughly normal around the predicted margin
 * with variance 2 × remaining possessions × POSSESSION_VARIANCE. A tie (overtime) counts half.
 */
export function winProbability(snapshot: Snapshot): WinProbability {
  const prediction = predict(snapshot);
  const possessions = POSSESSION_RATE * (prediction.end - prediction.elapsed);
  const margin = prediction.home - prediction.away;
  const sd = Math.sqrt(2 * possessions * POSSESSION_VARIANCE);
  if (sd === 0) {
    const home = margin > 0 ? 1 : margin < 0 ? 0 : 0.5;
    return { home, away: 1 - home, decided: true };
  }
  const home = normalCdf(margin / sd);
  return { home, away: 1 - home, decided: false };
}

/** Whole percents that add up to 100; 0 and 100 only once the game is decided. */
export function winPercents(win: WinProbability): { home: number; away: number } {
  const rounded = Math.round(win.home * 100);
  const home = win.decided ? rounded : Math.min(99, Math.max(1, rounded));
  return { home, away: 100 - home };
}

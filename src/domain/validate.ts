import { elapsedSeconds, formatClock, parseClock, periodLength } from "./clock";
import type { Snapshot } from "./predict";

export interface SnapshotInput {
  period: string;
  clock: string;
  home: string;
  away: string;
}

export type Field = keyof SnapshotInput;

export interface FieldError {
  field: Field;
  message: string;
}

export type ValidationResult =
  | { ok: true; snapshot: Snapshot }
  | { ok: false; errors: FieldError[] };

const MAX_PERIOD = 9;
const MAX_SCORE = 300;
const REGULATION_PERIODS = 4;

function parsePeriod(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const period = Number(value);
  return period >= 1 && period <= MAX_PERIOD ? period : null;
}

function parseScore(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const score = Number(value);
  return score <= MAX_SCORE ? score : null;
}

export function validateSnapshot(input: SnapshotInput, previous?: Snapshot): ValidationResult {
  const errors: FieldError[] = [];

  const period = parsePeriod(input.period.trim());
  if (period === null) {
    errors.push({ field: "period", message: `Perioda musí být celé číslo 1–${MAX_PERIOD}.` });
  }

  let remaining = parseClock(input.clock);
  if (remaining === null) {
    errors.push({ field: "clock", message: "Čas zadej jako m:ss." });
  } else if (period !== null) {
    const max = periodLength(period);
    if (remaining > max) {
      const where = period <= REGULATION_PERIODS ? "V periodě" : "V prodloužení";
      errors.push({ field: "clock", message: `${where} je max ${formatClock(max)}.` });
      remaining = null;
    }
  }

  const home = parseScore(input.home.trim());
  if (home === null) {
    errors.push({ field: "home", message: `Skóre musí být celé číslo 0–${MAX_SCORE}.` });
  }
  const away = parseScore(input.away.trim());
  if (away === null) {
    errors.push({ field: "away", message: `Skóre musí být celé číslo 0–${MAX_SCORE}.` });
  }

  if (
    errors.length > 0 ||
    period === null ||
    remaining === null ||
    home === null ||
    away === null
  ) {
    return { ok: false, errors };
  }

  const snapshot: Snapshot = { period, remaining, home, away };

  if (previous) {
    if (
      elapsedSeconds(snapshot.period, snapshot.remaining) <
      elapsedSeconds(previous.period, previous.remaining)
    ) {
      errors.push({ field: "clock", message: "Čas nemůže jít zpět oproti předchozímu zápisu." });
    }
    if (snapshot.home < previous.home) {
      errors.push({ field: "home", message: "Skóre nemůže klesnout." });
    }
    if (snapshot.away < previous.away) {
      errors.push({ field: "away", message: "Skóre nemůže klesnout." });
    }
    if (errors.length > 0) return { ok: false, errors };
  }

  return { ok: true, snapshot };
}

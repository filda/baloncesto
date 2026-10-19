import { elapsedSeconds, formatClock, parseClock, periodLength } from "./clock";
import type { Snapshot } from "./predict";

export interface SnapshotInput {
  period: string;
  clock: string;
  home: string;
  away: string;
}

export type Field = keyof SnapshotInput;

/** `"form"` marks an error that belongs to the whole entry, not to a single field. */
export interface FieldError {
  field: Field | "form";
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
    errors.push({ field: "period", message: `Period must be a whole number 1–${MAX_PERIOD}.` });
  }

  let remaining = parseClock(input.clock);
  if (remaining === null) {
    errors.push({ field: "clock", message: "Enter time as m:ss." });
  } else if (period !== null) {
    const max = periodLength(period);
    if (remaining > max) {
      const where = period <= REGULATION_PERIODS ? "A period" : "Overtime";
      errors.push({ field: "clock", message: `${where} lasts at most ${formatClock(max)}.` });
      remaining = null;
    }
  }

  const home = parseScore(input.home.trim());
  if (home === null) {
    errors.push({ field: "home", message: `Score must be a whole number 0–${MAX_SCORE}.` });
  }
  const away = parseScore(input.away.trim());
  if (away === null) {
    errors.push({ field: "away", message: `Score must be a whole number 0–${MAX_SCORE}.` });
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
      errors.push({ field: "clock", message: "Time cannot go back from the previous entry." });
    }
    if (snapshot.home < previous.home) {
      errors.push({ field: "home", message: "Score cannot go down." });
    }
    if (snapshot.away < previous.away) {
      errors.push({ field: "away", message: "Score cannot go down." });
    }
    if (errors.length > 0) return { ok: false, errors };
    if (
      snapshot.period === previous.period &&
      snapshot.remaining === previous.remaining &&
      snapshot.home === previous.home &&
      snapshot.away === previous.away
    ) {
      return { ok: false, errors: [{ field: "form", message: "Same as the previous entry." }] };
    }
  }

  return { ok: true, snapshot };
}

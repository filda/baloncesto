const REGULATION_PERIODS = 4;
const REGULATION_LENGTH = 600;
const OVERTIME_LENGTH = 300;

function assertPeriod(period: number): void {
  if (!Number.isInteger(period) || period < 1) {
    throw new RangeError(`Invalid period: ${period}`);
  }
}

export function parseClock(input: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(input.trim());
  if (!match) return null;
  const seconds = Number(match[2]);
  if (seconds >= 60) return null;
  return Number(match[1]) * 60 + seconds;
}

export function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function periodLength(period: number): number {
  assertPeriod(period);
  return period <= REGULATION_PERIODS ? REGULATION_LENGTH : OVERTIME_LENGTH;
}

export function elapsedSeconds(period: number, remaining: number): number {
  const length = periodLength(period);
  if (!Number.isInteger(remaining) || remaining < 0 || remaining > length) {
    throw new RangeError(`Invalid remaining time: ${remaining}`);
  }
  const regulationPlayed = Math.min(period - 1, REGULATION_PERIODS) * REGULATION_LENGTH;
  const overtimePlayed = Math.max(period - 1 - REGULATION_PERIODS, 0) * OVERTIME_LENGTH;
  return regulationPlayed + overtimePlayed + (length - remaining);
}

export function gameEndSeconds(period: number): number {
  assertPeriod(period);
  const overtimes = Math.max(period - REGULATION_PERIODS, 0);
  return REGULATION_PERIODS * REGULATION_LENGTH + overtimes * OVERTIME_LENGTH;
}

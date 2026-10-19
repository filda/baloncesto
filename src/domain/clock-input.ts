/**
 * Formats raw typing in the time field: only digits are kept (max 4) and the colon is inserted
 * automatically. The first digit is always minutes, except with 4 digits where the first two are
 * minutes (the only realistic case is 10:00). Every complete result ("5:30", "10:00", "00:07")
 * is accepted by `parseClock`.
 */
export function formatClockInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 1) return digits;
  const minutesLength = digits.length === 4 ? 2 : 1;
  return `${digits.slice(0, minutesLength)}:${digits.slice(minutesLength)}`;
}

/**
 * Completes an unfinished time on confirm: one seconds digit gets a trailing zero ("4:4" →
 * "4:40") and a lone digit becomes whole minutes ("4" → "4:00"). Everything else is returned
 * unchanged, so validation can report it.
 */
export function completeClockInput(value: string): string {
  if (/^\d{1,2}:\d$/.test(value)) return `${value}0`;
  if (/^\d$/.test(value)) return `${value}:00`;
  return value;
}

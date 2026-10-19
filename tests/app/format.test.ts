import { describe, expect, it } from "vitest";
import { formatDateTime, parseDateTimeLocal, toDateTimeLocalValue } from "../../src/app/format";

describe("formatDateTime", () => {
  it("formats local date and time with zero padding", () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 3).toISOString())).toBe("2026-01-05 07:03");
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe("2026-12-31 23:59");
  });

  it("returns unparsable input unchanged", () => {
    expect(formatDateTime("nope")).toBe("nope");
  });
});

describe("datetime-local helpers", () => {
  it("formats local time with minutes precision", () => {
    expect(toDateTimeLocalValue(new Date(2026, 9, 19, 20, 5, 42))).toBe("2026-10-19T20:05");
  });

  it("parses a local value and round-trips", () => {
    const d = parseDateTimeLocal("2026-10-19T20:05");
    expect(d).toEqual(new Date(2026, 9, 19, 20, 5));
    expect(toDateTimeLocalValue(d as Date)).toBe("2026-10-19T20:05");
  });

  it("rejects empty and invalid values", () => {
    expect(parseDateTimeLocal("")).toBeNull();
    expect(parseDateTimeLocal("2026-10-19")).toBeNull();
    expect(parseDateTimeLocal("2026-02-30T10:00")).toBeNull();
    expect(parseDateTimeLocal("2026-10-19T25:00")).toBeNull();
  });
});

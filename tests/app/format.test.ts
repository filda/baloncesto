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

describe("parseDateTimeLocal strictness", () => {
  it("rejects impossible calendar dates and times", () => {
    for (const value of [
      "2026-02-31T10:00",
      "2026-13-01T10:00",
      "2026-00-10T10:00",
      "2026-10-00T10:00",
      "2026-10-32T10:00",
      "2026-10-19T24:00",
      "2026-10-19T25:00",
      "2026-10-19T10:60",
      "2026-10-19T23:60",
    ]) {
      expect(parseDateTimeLocal(value), value).toBeNull();
    }
  });

  it("accepts boundary values and leap days", () => {
    expect(parseDateTimeLocal("2028-02-29T00:00")).toEqual(new Date(2028, 1, 29, 0, 0));
    expect(parseDateTimeLocal("2026-12-31T23:59")).toEqual(new Date(2026, 11, 31, 23, 59));
    expect(parseDateTimeLocal("2027-02-29T10:00")).toBeNull();
  });

  it("does not let two-digit-range years roll into the 1900s", () => {
    expect(parseDateTimeLocal("0050-01-01T10:00")).toBeNull();
  });

  it("rejects text before or after the value", () => {
    expect(parseDateTimeLocal("x2026-10-19T10:00")).toBeNull();
    expect(parseDateTimeLocal("2026-10-19T10:00x")).toBeNull();
    expect(parseDateTimeLocal(" 2026-10-19T10:00")).toBeNull();
    expect(parseDateTimeLocal("2026-10-19T10:00:00")).toBeNull();
  });
});

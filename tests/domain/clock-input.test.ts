import { describe, expect, it } from "vitest";
import { parseClock } from "../../src/domain/clock";
import { formatClockInput } from "../../src/domain/clock-input";

describe("formatClockInput", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["0", "0"],
    ["53", "5:3"],
    ["530", "5:30"],
    ["1000", "10:00"],
    ["1234", "12:34"],
    ["12345", "12:34"],
    ["0007", "00:07"],
    ["007", "0:07"],
    ["1:23", "1:23"],
    ["10:00", "10:00"],
    ["5:30", "5:30"],
    ["abc", ""],
    ["a1b2c3", "1:23"],
    [" 5 : 3 0 ", "5:30"],
    ["5.30", "5:30"],
    [":", ""],
  ])("formats %j as %j", (raw, expected) => {
    expect(formatClockInput(raw)).toBe(expected);
  });

  it("is idempotent", () => {
    for (const raw of ["", "5", "53", "530", "1000", "12345", "0007", "a1b2"]) {
      const once = formatClockInput(raw);
      expect(formatClockInput(once)).toBe(once);
    }
  });

  it("produces values that parseClock accepts when complete", () => {
    expect(parseClock(formatClockInput("530"))).toBe(330);
    expect(parseClock(formatClockInput("1000"))).toBe(600);
    expect(parseClock(formatClockInput("007"))).toBe(7);
    expect(parseClock(formatClockInput("0007"))).toBe(7);
    expect(parseClock(formatClockInput("1:23"))).toBe(83);
  });

  it("does not treat incomplete values as valid", () => {
    expect(parseClock(formatClockInput("5"))).toBeNull();
    expect(parseClock(formatClockInput("53"))).toBeNull();
  });
});

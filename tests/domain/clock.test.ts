import { describe, expect, it } from "vitest";
import {
  elapsedSeconds,
  formatClock,
  gameEndSeconds,
  parseClock,
  periodLength,
} from "../../src/domain/clock";

describe("parseClock", () => {
  it.each([
    ["0:00", 0],
    ["0:01", 1],
    ["1:05", 65],
    ["9:59", 599],
    ["10:00", 600],
    ["05:00", 300],
    ["5:00", 300],
    ["59:59", 3599],
    [" 5:00 ", 300],
    ["\t10:00\n", 600],
  ])("parses %j as %i", (input, expected) => {
    expect(parseClock(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "abc",
    "5:0",
    "5:000",
    "123:00",
    "9:60",
    "0:99",
    "5",
    "500",
    ":30",
    "5:",
    "5.00",
    "-1:00",
    "1:-5",
    "5:00.3",
    "1 :00",
    "5:00:00",
    "a5:00",
    "5:00a",
  ])("rejects %j", (input) => {
    expect(parseClock(input)).toBeNull();
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00"],
    [5, "0:05"],
    [59, "0:59"],
    [60, "1:00"],
    [65, "1:05"],
    [300, "5:00"],
    [599, "9:59"],
    [600, "10:00"],
  ])("formats %i as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });

  it("round-trips with parseClock", () => {
    for (let s = 0; s <= 600; s++) {
      expect(parseClock(formatClock(s))).toBe(s);
    }
  });
});

describe("periodLength", () => {
  it.each([
    [1, 600],
    [2, 600],
    [3, 600],
    [4, 600],
    [5, 300],
    [6, 300],
    [10, 300],
  ])("period %i is %i s", (period, expected) => {
    expect(periodLength(period)).toBe(expected);
  });

  it.each([0, -1, 1.5, NaN, Infinity])("throws RangeError for %s", (period) => {
    expect(() => periodLength(period)).toThrow(RangeError);
  });
});

describe("elapsedSeconds", () => {
  it.each([
    [1, 600, 0],
    [1, 0, 600],
    [1, 599, 1],
    [2, 600, 600],
    [2, 300, 900],
    [3, 0, 1800],
    [4, 600, 1800],
    [4, 1, 2399],
    [4, 0, 2400],
    [5, 300, 2400],
    [5, 0, 2700],
    [5, 120, 2580],
    [6, 300, 2700],
    [6, 0, 3000],
    [7, 300, 3000],
  ])("period %i with %i s remaining is %i elapsed", (period, remaining, expected) => {
    expect(elapsedSeconds(period, remaining)).toBe(expected);
  });

  it("throws RangeError for invalid remaining", () => {
    expect(() => elapsedSeconds(1, -1)).toThrow(RangeError);
    expect(() => elapsedSeconds(1, 601)).toThrow(RangeError);
    expect(() => elapsedSeconds(5, 301)).toThrow(RangeError);
    expect(() => elapsedSeconds(4, 300.5)).toThrow(RangeError);
    expect(() => elapsedSeconds(4, NaN)).toThrow(RangeError);
  });

  it("throws RangeError for invalid period", () => {
    expect(() => elapsedSeconds(0, 0)).toThrow(RangeError);
    expect(() => elapsedSeconds(1.5, 0)).toThrow(RangeError);
  });
});

describe("gameEndSeconds", () => {
  it.each([
    [1, 2400],
    [2, 2400],
    [3, 2400],
    [4, 2400],
    [5, 2700],
    [6, 3000],
    [7, 3300],
  ])("period %i ends at %i", (period, expected) => {
    expect(gameEndSeconds(period)).toBe(expected);
  });

  it.each([0, -3, 2.5])("throws RangeError for %s", (period) => {
    expect(() => gameEndSeconds(period)).toThrow(RangeError);
  });
});

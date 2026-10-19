import { describe, expect, it } from "vitest";
import { predict, roundScore } from "../../src/domain/predict";

describe("predict", () => {
  it("projects linearly in regulation", () => {
    expect(predict({ period: 2, remaining: 300, home: 30, away: 24 })).toEqual({
      elapsed: 900,
      end: 2400,
      home: 80,
      away: 64,
    });
  });

  it("returns null when nothing has been played", () => {
    expect(predict({ period: 1, remaining: 600, home: 0, away: 0 })).toBeNull();
    expect(predict({ period: 1, remaining: 600, home: 5, away: 3 })).toBeNull();
  });

  it("predicts zero for a team with zero points", () => {
    expect(predict({ period: 1, remaining: 300, home: 0, away: 10 })).toEqual({
      elapsed: 300,
      end: 2400,
      home: 0,
      away: 80,
    });
  });

  it("equals the current score at the end of period 4", () => {
    expect(predict({ period: 4, remaining: 0, home: 82, away: 76 })).toEqual({
      elapsed: 2400,
      end: 2400,
      home: 82,
      away: 76,
    });
  });

  it("projects to the end of the first overtime", () => {
    // elapsed 2400 + 100 = 2500, end 2700, left 200
    expect(predict({ period: 5, remaining: 200, home: 100, away: 50 })).toEqual({
      elapsed: 2500,
      end: 2700,
      home: 100 + (100 / 2500) * 200,
      away: 50 + (50 / 2500) * 200,
    });
  });

  it("projects to the end of the current (second) overtime", () => {
    // elapsed 2700 + 150 = 2850, end 3000, left 150
    expect(predict({ period: 6, remaining: 150, home: 114, away: 57 })).toEqual({
      elapsed: 2850,
      end: 3000,
      home: 114 + (114 / 2850) * 150,
      away: 57 + (57 / 2850) * 150,
    });
  });

  it("at the start of overtime keeps the regulation pace", () => {
    const result = predict({ period: 5, remaining: 300, home: 80, away: 60 });
    expect(result).toEqual({ elapsed: 2400, end: 2700, home: 90, away: 67.5 });
  });

  it("returns unrounded floats", () => {
    const result = predict({ period: 1, remaining: 500, home: 7, away: 3 });
    expect(result?.elapsed).toBe(100);
    expect(result?.home).toBeCloseTo(168, 10);
    expect(result?.away).toBeCloseTo(72, 10);
    const odd = predict({ period: 1, remaining: 400, home: 7, away: 3 });
    expect(odd?.home).toBeCloseTo(7 + (7 / 200) * 2200, 10);
    expect(Number.isInteger(odd?.home)).toBe(false);
  });

  it("propagates RangeError for invalid snapshots", () => {
    expect(() => predict({ period: 0, remaining: 0, home: 0, away: 0 })).toThrow(RangeError);
    expect(() => predict({ period: 1, remaining: 601, home: 0, away: 0 })).toThrow(RangeError);
  });
});

describe("roundScore", () => {
  it.each([
    [0, 0],
    [79.4, 79],
    [79.5, 80],
    [79.6, 80],
    [82, 82],
  ])("rounds %f to %i", (input, expected) => {
    expect(roundScore(input)).toBe(expected);
  });
});

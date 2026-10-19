import { describe, expect, it } from "vitest";
import {
  POINTS_PER_EVENT,
  Z,
  finalRange,
  halfWidth,
  predict,
  predictRange,
  roundScore,
} from "../../src/domain/predict";

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

describe("constants", () => {
  it("uses a 95 % interval and two-point scoring events", () => {
    expect(Z).toBe(1.96);
    expect(POINTS_PER_EVENT).toBe(2);
  });
});

describe("halfWidth", () => {
  it("is Z × √(2 × expected)", () => {
    expect(halfWidth(0)).toBe(0);
    expect(halfWidth(50)).toBeCloseTo(19.6, 10);
    expect(halfWidth(8)).toBeCloseTo(7.84, 10);
  });
});

describe("predictRange", () => {
  it("returns null when nothing has been played", () => {
    expect(predictRange({ period: 1, remaining: 600, home: 5, away: 3 })).toBeNull();
  });

  it("matches the formula for the worked example (period 3, 7:12, 48 : 45)", () => {
    const range = predictRange({ period: 3, remaining: 432, home: 48, away: 45 });
    // elapsed 1368, end 2400, left 1032
    const eHome = (48 / 1368) * 1032;
    const eAway = (45 / 1368) * 1032;
    const halfHome = 1.96 * Math.sqrt(2 * eHome);
    const halfAway = 1.96 * Math.sqrt(2 * eAway);
    expect(range?.home.low).toBeCloseTo(48 + eHome - halfHome, 10);
    expect(range?.home.high).toBeCloseTo(48 + eHome + halfHome, 10);
    expect(range?.away.low).toBeCloseTo(45 + eAway - halfAway, 10);
    expect(range?.away.high).toBeCloseTo(45 + eAway + halfAway, 10);
    expect(roundScore(48 + eHome)).toBe(84);
    expect(roundScore(45 + eAway)).toBe(79);
    expect([range?.home.low, range?.home.high].map((v) => roundScore(v ?? 0))).toEqual([68, 101]);
    expect([range?.away.low, range?.away.high].map((v) => roundScore(v ?? 0))).toEqual([63, 95]);
  });

  it("gives an exact band for a simple case", () => {
    // elapsed 600, end 2400, 20 points -> E = 60, half = 1.96 × √120
    const range = predictRange({ period: 1, remaining: 0, home: 20, away: 10 });
    expect(range?.home.low).toBeCloseTo(80 - 1.96 * Math.sqrt(120), 10);
    expect(range?.home.high).toBeCloseTo(80 + 1.96 * Math.sqrt(120), 10);
    expect(range?.away.low).toBeCloseTo(40 - 1.96 * Math.sqrt(60), 10);
    expect(range?.away.high).toBeCloseTo(40 + 1.96 * Math.sqrt(60), 10);
  });

  it("collapses to the current score at the final buzzer", () => {
    expect(predictRange({ period: 4, remaining: 0, home: 82, away: 76 })).toEqual({
      home: { low: 82, high: 82 },
      away: { low: 76, high: 76 },
    });
  });

  it("is a single point for a team with zero points", () => {
    const range = predictRange({ period: 1, remaining: 300, home: 0, away: 10 });
    expect(range?.home).toEqual({ low: 0, high: 0 });
    expect(range?.away.high).toBeGreaterThan(80);
  });

  it("never goes below the current score", () => {
    // 2 points after 599 s: predicted ≈ 8, half ≈ 6.4 → raw low ≈ 1.6 < 2
    const range = predictRange({ period: 1, remaining: 1, home: 2, away: 2 });
    expect(range?.home.low).toBe(2);
    expect(finalRange(10, 12).low).toBe(10);
    expect(finalRange(10, 12).high).toBeCloseTo(12 + 1.96 * 2, 10);
  });

  it("does not clamp a band that stays above the current score", () => {
    const { low } = finalRange(10, 100);
    expect(low).toBeCloseTo(100 - 1.96 * Math.sqrt(180), 10);
    expect(low).toBeGreaterThan(10);
  });
});

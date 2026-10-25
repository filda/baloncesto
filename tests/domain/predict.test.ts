import { describe, expect, it } from "vitest";
import {
  HOT_PPP,
  POSSESSION_VARIANCE,
  POSSESSIONS_PER_40,
  POSSESSION_RATE,
  PRIOR_PPP,
  PRIOR_WEIGHT_SECONDS,
  predict,
  predictRange,
  normalCdf,
  roundScore,
  winPercentText,
  winProbability,
} from "../../src/domain/predict";

describe("constants", () => {
  it("pins the possession model", () => {
    expect(POSSESSIONS_PER_40).toBe(72);
    expect(POSSESSION_RATE).toBe(72 / 2400);
    expect(POSSESSION_RATE).toBeCloseTo(0.03, 12);
    expect(PRIOR_PPP).toBe(1.0);
    expect(PRIOR_WEIGHT_SECONDS).toBe(600);
    expect(HOT_PPP).toBe(1.5);
  });
});

describe("predict", () => {
  it("case a: stays near the prior after one minute (period 1, 9:00, 3 : 0)", () => {
    // elapsed 60, end 2400; rate 0.03; prior points = 1.0 × 0.03 × 600 = 18
    // home ppp = (3 + 18) / (0.03 × 660) = 21 / 19.8 ≈ 1.0606; remaining possessions = 0.03 × 2340 = 70.2
    // home = 3 + 70.2 × 21 / 19.8 ≈ 77.4545; away ppp = 18 / 19.8 ≈ 0.9091 → 63.8182
    const result = predict({ period: 1, remaining: 540, home: 3, away: 0 });
    expect(result.elapsed).toBe(60);
    expect(result.end).toBe(2400);
    expect(result.home).toBeCloseTo(77.4545454545, 8);
    expect(result.away).toBeCloseTo(63.8181818182, 8);
    expect(roundScore(result.home)).toBe(77);
    expect(roundScore(result.away)).toBe(64);
  });

  it("case b: worked example (period 3, 7:12, 48 : 45)", () => {
    // elapsed 1368, end 2400; remaining possessions = 0.03 × 1032 = 30.96
    // denominator 0.03 × 1968 = 59.04; home ppp = 66 / 59.04 ≈ 1.1179 → 48 + 30.96 × 1.1179 ≈ 82.6098
    // away ppp = 63 / 59.04 ≈ 1.0671 → 45 + 30.96 × 1.0671 ≈ 78.0366
    const result = predict({ period: 3, remaining: 432, home: 48, away: 45 });
    expect(result.elapsed).toBe(1368);
    expect(result.home).toBeCloseTo(48 + (30.96 * 66) / 59.04, 10);
    expect(result.away).toBeCloseTo(45 + (30.96 * 63) / 59.04, 10);
    expect(result.home).toBeCloseTo(82.6098, 4);
    expect(result.away).toBeCloseTo(78.0366, 4);
  });

  it("case f: a snapshot at 0:00 elapsed is the prior", () => {
    // ppp = 18 / (0.03 × 600) = 1; possessions = 72 → 72 for either score of 0
    const result = predict({ period: 1, remaining: 600, home: 0, away: 0 });
    expect(result).toEqual({ elapsed: 0, end: 2400, home: 72, away: 72 });
  });

  it("case c: equals the current score at the final buzzer", () => {
    expect(predict({ period: 4, remaining: 0, home: 82, away: 76 })).toEqual({
      elapsed: 2400,
      end: 2400,
      home: 82,
      away: 76,
    });
  });

  it("case e: projects to the end of the first overtime", () => {
    // elapsed 2500, end 2700; remaining possessions = 0.03 × 200 = 6
    // denominator 0.03 × 3100 = 93; home ppp = (100 + 18) / 93; away ppp = (50 + 18) / 93
    const result = predict({ period: 5, remaining: 200, home: 100, away: 50 });
    expect(result.elapsed).toBe(2500);
    expect(result.end).toBe(2700);
    expect(result.home).toBeCloseTo(100 + (6 * 118) / 93, 10);
    expect(result.away).toBeCloseTo(50 + (6 * 68) / 93, 10);
  });

  it("projects to the end of the current (second) overtime", () => {
    // elapsed 2850, end 3000; possessions = 4.5; denominator 0.03 × 3450 = 103.5
    const result = predict({ period: 6, remaining: 150, home: 114, away: 57 });
    expect(result.elapsed).toBe(2850);
    expect(result.end).toBe(3000);
    expect(result.home).toBeCloseTo(114 + (4.5 * 132) / 103.5, 10);
    expect(result.away).toBeCloseTo(57 + (4.5 * 75) / 103.5, 10);
  });

  it("gives a hot team more than a cold one and never less than the current score", () => {
    const result = predict({ period: 2, remaining: 300, home: 50, away: 0 });
    expect(result.home).toBeGreaterThan(result.away);
    expect(result.away).toBeGreaterThan(0);
    expect(result.home).toBeGreaterThanOrEqual(50);
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

describe("predictRange", () => {
  it("case a: low is the current score, high uses 1.5 points per possession", () => {
    // possessions 70.2; both ppp < 1.5 → high = points + 70.2 × 1.5
    const range = predictRange({ period: 1, remaining: 540, home: 3, away: 0 });
    expect(range.home.low).toBe(3);
    expect(range.home.high).toBeCloseTo(108.3, 10);
    expect(range.away.low).toBe(0);
    expect(range.away.high).toBeCloseTo(105.3, 10);
    expect([range.home.high, range.away.high].map(roundScore)).toEqual([108, 105]);
  });

  it("case b: worked example (period 3, 7:12, 48 : 45)", () => {
    // possessions 30.96, ppp 1.1179 / 1.0671 < 1.5 → high = 48 + 46.44, 45 + 46.44
    const range = predictRange({ period: 3, remaining: 432, home: 48, away: 45 });
    expect(range.home.low).toBe(48);
    expect(range.home.high).toBeCloseTo(94.44, 10);
    expect(range.away.low).toBe(45);
    expect(range.away.high).toBeCloseTo(91.44, 10);
  });

  it("case c: collapses to the current score at the final buzzer", () => {
    expect(predictRange({ period: 4, remaining: 0, home: 82, away: 76 })).toEqual({
      home: { low: 82, high: 82 },
      away: { low: 76, high: 76 },
    });
  });

  it("case d: a hot team's high uses its own points per possession", () => {
    // period 1, 0:00 left: elapsed 600, possessions 0.03 × 1800 = 54; denominator 0.03 × 1200 = 36
    // 60 points: ppp = 78 / 36 ≈ 2.1667 > 1.5; predicted = high = 60 + 54 × 78 / 36 = 177
    const snapshot = { period: 1, remaining: 0, home: 60, away: 10 };
    const range = predictRange(snapshot);
    const prediction = predict(snapshot);
    expect(prediction.home).toBeCloseTo(177, 10);
    expect(range.home.high).toBeCloseTo(177, 10);
    expect(range.home.high).toBeCloseTo(prediction.home, 10);
    // 10 points: ppp = 28 / 36 < 1.5 → high = 10 + 54 × 1.5 = 91
    expect(range.away.high).toBeCloseTo(91, 10);
    expect(range.away.high).toBeGreaterThan(prediction.away);
  });

  it("case e: overtime period 5", () => {
    // elapsed 2500, possessions 6; home ppp 118 / 93 ≈ 1.269 → high = 100 + 6 × 1.5 = 109
    const range = predictRange({ period: 5, remaining: 200, home: 100, away: 50 });
    expect(range.home).toEqual({ low: 100, high: 109 });
    expect(range.away).toEqual({ low: 50, high: 59 });
  });

  it("case f: a snapshot at 0:00 elapsed", () => {
    // possessions 72 → high = 0 + 72 × 1.5 = 108
    const range = predictRange({ period: 1, remaining: 600, home: 0, away: 0 });
    expect(range.home).toEqual({ low: 0, high: 108 });
    expect(range.away).toEqual({ low: 0, high: 108 });
  });

  it("keeps the prediction inside the range", () => {
    for (const snapshot of [
      { period: 1, remaining: 300, home: 0, away: 25 },
      { period: 2, remaining: 100, home: 40, away: 70 },
      { period: 6, remaining: 10, home: 120, away: 119 },
    ]) {
      const prediction = predict(snapshot);
      const range = predictRange(snapshot);
      expect(prediction.home).toBeGreaterThanOrEqual(range.home.low);
      expect(prediction.home).toBeLessThanOrEqual(range.home.high + 1e-9);
      expect(prediction.away).toBeGreaterThanOrEqual(range.away.low);
      expect(prediction.away).toBeLessThanOrEqual(range.away.high + 1e-9);
    }
  });
});

describe("normalCdf", () => {
  it("matches known values of the standard normal CDF", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1)).toBeCloseTo(0.841345, 6);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975002, 6);
    expect(normalCdf(-3)).toBeCloseTo(0.00135, 5);
    expect(normalCdf(10)).toBeCloseTo(1, 12);
  });
});

describe("winProbability", () => {
  it("pins the possession variance", () => {
    expect(POSSESSION_VARIANCE).toBe(1.2);
  });

  it("is a coin flip at a tied tip-off, with a margin sd of about 13 points", () => {
    const win = winProbability({ period: 1, remaining: 600, home: 0, away: 0 });
    expect(win.home).toBeCloseTo(0.5, 7);
    expect(win.away).toBeCloseTo(0.5, 7);
    expect(win.decided).toBe(false);
    // sd = sqrt(2 × 72 × 1.2) ≈ 13.15: a 13-point predicted margin is about one sd.
    expect(Math.sqrt(2 * 72 * POSSESSION_VARIANCE)).toBeCloseTo(13.145, 3);
  });

  it("case b: worked example (period 3, 7:12, 48 : 45)", () => {
    // predicted 82.6098 : 78.0366 → margin 4.5732; possessions 30.96 → sd sqrt(74.304) ≈ 8.6200
    // z ≈ 0.5305 → Φ ≈ 0.7021
    const win = winProbability({ period: 3, remaining: 432, home: 48, away: 45 });
    expect(win.home).toBeCloseTo(0.7021, 4);
    expect(win.home + win.away).toBeCloseTo(1, 12);
    expect(win.decided).toBe(false);
  });

  it("is near certain for a 15-point lead three minutes before the end", () => {
    const win = winProbability({ period: 4, remaining: 180, home: 80, away: 65 });
    expect(win.home).toBeGreaterThan(0.999);
    expect(win.away).toBeLessThan(0.001);
  });

  it("favours the trailing team symmetrically", () => {
    const home = winProbability({ period: 2, remaining: 300, home: 30, away: 40 });
    const away = winProbability({ period: 2, remaining: 300, home: 40, away: 30 });
    expect(home.home).toBeCloseTo(away.away, 12);
    expect(home.home).toBeLessThan(0.5);
  });

  it("is decided at the final buzzer, a tie counting half", () => {
    expect(winProbability({ period: 4, remaining: 0, home: 82, away: 76 })).toEqual({
      home: 1,
      away: 0,
      decided: true,
    });
    expect(winProbability({ period: 5, remaining: 0, home: 90, away: 91 })).toEqual({
      home: 0,
      away: 1,
      decided: true,
    });
    expect(winProbability({ period: 4, remaining: 0, home: 80, away: 80 })).toEqual({
      home: 0.5,
      away: 0.5,
      decided: true,
    });
  });
});

describe("winPercentText", () => {
  const text = (home: number, decided = false) => winPercentText({ home, away: 1 - home, decided });

  it("rounds to whole percents that add up to 100", () => {
    expect(text(0.741)).toEqual({ home: "74%", away: "26%" });
    expect(text(0.505)).toEqual({ home: "51%", away: "49%" });
    expect(text(0.99)).toEqual({ home: "99%", away: "1%" });
    expect(text(0.01)).toEqual({ home: "1%", away: "99%" });
  });

  it("shows <1% and >99% instead of rounding an open game to 0 or 100", () => {
    expect(text(0.996)).toEqual({ home: ">99%", away: "<1%" });
    expect(text(0.004)).toEqual({ home: "<1%", away: ">99%" });
    expect(text(1 - 1e-12)).toEqual({ home: ">99%", away: "<1%" });
  });

  it("shows 0 and 100 once the game is decided", () => {
    expect(text(1, true)).toEqual({ home: "100%", away: "0%" });
    expect(text(0, true)).toEqual({ home: "0%", away: "100%" });
    expect(text(0.5, true)).toEqual({ home: "50%", away: "50%" });
  });
});

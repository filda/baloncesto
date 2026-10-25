import { describe, expect, it } from "vitest";
import { PADDING, computeChart } from "../../src/chart/geometry";
import type { Point } from "../../src/chart/geometry";
import type { Snapshot } from "../../src/domain/predict";

// 338 x 222 gives a 270 x 190 plot area: 0.1125 px/s horizontally.
const W = 338;
const H = 222;
const LEFT = PADDING.left;
const BOTTOM = H - PADDING.bottom;

function expectPoint(actual: Point | undefined, x: number, y: number): void {
  expect(actual).toBeDefined();
  expect(actual?.x).toBeCloseTo(x, 6);
  expect(actual?.y).toBeCloseTo(y, 6);
}

const a: Snapshot = { period: 1, remaining: 300, home: 10, away: 8 };
const b: Snapshot = { period: 2, remaining: 300, home: 30, away: 24 };
const end = (home: number, away: number): Snapshot => ({ period: 4, remaining: 0, home, away });

describe("computeChart", () => {
  it("exposes the plot area from the padding", () => {
    const model = computeChart([], W, H);
    expect(model.width).toBe(W);
    expect(model.height).toBe(H);
    expect(model.plot).toEqual({
      left: PADDING.left,
      top: PADDING.top,
      right: W - PADDING.right,
      bottom: H - PADDING.bottom,
    });
  });

  it("handles an empty match", () => {
    const model = computeChart([], W, H);
    expect(model.end).toBe(2400);
    expect(model.yMax).toBe(20);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 10, 20]);
    expect(model.yTicks[0]?.y).toBeCloseTo(BOTTOM, 6);
    expect(model.yTicks[1]?.y).toBeCloseTo(BOTTOM - 95, 6);
    expect(model.yTicks[2]?.y).toBeCloseTo(PADDING.top, 6);
    expect(model.boundaries.map((x) => x.seconds)).toEqual([600, 1200, 1800]);
    expect(model.boundaries.map((x) => x.x)).toEqual([97.5, 165, 232.5]);
    expect(model.periodLabels.map((p) => p.label)).toEqual(["1", "2", "3", "4"]);
    expect(model.periodLabels.map((p) => p.x)).toEqual([63.75, 131.25, 198.75, 266.25]);
    for (const team of [model.home, model.away]) {
      expectPoint(team.known[0], LEFT, BOTTOM);
      expect(team.known).toHaveLength(1);
      expect(team.prediction).toBeNull();
      expect(team.finalLabel).toBeNull();
    }
  });

  it("handles a single snapshot", () => {
    const model = computeChart([a], W, H);
    expect(model.end).toBe(2400);
    // 10 : 8 at 300 s: possessions 0.03 × 2100 = 63, denominator 0.03 × 900 = 27
    // home ppp 28 / 27 -> 10 + 63 × 28 / 27 = 75.33; away 26 / 27 -> 68.67
    // the band's high (10 + 63 × 1.5 = 104.5) lifts yMax from 90 to 120
    expect(model.yMax).toBe(120);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(model.home.known).toHaveLength(2);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 120);
    expectPoint(model.away.known[1], 30 + 33.75, BOTTOM - (8 * 190) / 120);
    expectPoint(model.home.prediction?.from, 30 + 33.75, BOTTOM - (10 * 190) / 120);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (10 + (63 * 28) / 27) * (190 / 120));
    expectPoint(model.away.prediction?.to, 300, BOTTOM - (8 + (63 * 26) / 27) * (190 / 120));
    expect(model.home.finalLabel).toBe(75);
    expect(model.away.finalLabel).toBe(69);
    expect(model.home.range).toEqual({ low: 10, high: 105 });
    expect(model.away.range).toEqual({ low: 8, high: 103 });
  });

  it("handles several snapshots in order", () => {
    // b: 30 : 24 at 900 s: possessions 45, denominator 45 -> home 30 + 48 = 78, away 24 + 42 = 66
    // home high 30 + 45 × 1.5 = 97.5 -> yMax 110
    const model = computeChart([a, b], W, H);
    expect(model.yMax).toBe(110);
    expect(model.home.known).toHaveLength(3);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 110);
    expectPoint(model.home.known[2], 131.25, BOTTOM - (30 * 190) / 110);
    expectPoint(model.away.known[2], 131.25, BOTTOM - (24 * 190) / 110);
    expectPoint(model.home.prediction?.from, 131.25, BOTTOM - (30 * 190) / 110);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (78 * 190) / 110);
    expect(model.home.finalLabel).toBe(78);
    expect(model.away.finalLabel).toBe(66);
  });

  it("predicts the prior for a snapshot at elapsed 0 without duplicating the origin", () => {
    // 0 : 0 at 0:00 -> 72 each, high 72 × 1.5 = 108 -> yMax 120
    const model = computeChart([{ period: 1, remaining: 600, home: 0, away: 0 }], W, H);
    expect(model.yMax).toBe(120);
    expect(model.home.known).toHaveLength(1);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expectPoint(model.home.prediction?.from, LEFT, BOTTOM);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (72 * 190) / 120);
    expect(model.home.finalLabel).toBe(72);
    expect(model.away.finalLabel).toBe(72);
    expect(model.home.range).toEqual({ low: 0, high: 108 });
  });

  it("puts dots only on entries where the team's score changed", () => {
    const entries: Snapshot[] = [
      { period: 1, remaining: 600, home: 0, away: 0 },
      { period: 1, remaining: 400, home: 2, away: 0 },
      { period: 1, remaining: 300, home: 2, away: 3 },
      { period: 1, remaining: 200, home: 2, away: 3 },
      { period: 1, remaining: 100, home: 4, away: 3 },
    ];
    const model = computeChart(entries, W, H);
    expect(model.home.known).toHaveLength(5);
    expect(model.home.dots).toEqual([model.home.known[1], model.home.known[4]]);
    expect(model.away.dots).toEqual([model.away.known[2]]);
  });

  it("counts the first entry's dot from zero", () => {
    const model = computeChart([{ period: 1, remaining: 500, home: 0, away: 2 }], W, H);
    expect(model.home.dots).toEqual([]);
    expect(model.away.dots).toEqual([model.away.known[1]]);
    expect(computeChart([], W, H).home.dots).toEqual([]);
  });

  it("starts the known line at the origin when only later snapshots exist", () => {
    const model = computeChart([{ period: 1, remaining: 600, home: 0, away: 0 }, a], W, H);
    expect(model.home.known).toHaveLength(2);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 120);
  });

  it("extends the end to 2700 in overtime", () => {
    const model = computeChart([{ period: 5, remaining: 300, home: 90, away: 88 }], W, H);
    expect(model.end).toBe(2700);
    // elapsed 2400, possessions 0.03 × 300 = 9, denominator 0.03 × 3000 = 90
    // home ppp 108 / 90 = 1.2 -> 90 + 10.8 = 100.8; away 106 / 90 -> 88 + 10.6 = 98.6
    // high 90 + 9 × 1.5 = 103.5 -> yMax 120
    expect(model.yMax).toBe(120);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(model.boundaries.map((x) => x.seconds)).toEqual([600, 1200, 1800, 2400]);
    expect(model.boundaries[3]?.x).toBeCloseTo(30 + (270 * 2400) / 2700, 6);
    expect(model.periodLabels.map((p) => p.label)).toEqual(["1", "2", "3", "4", "P1"]);
    expect(model.periodLabels[4]?.x).toBeCloseTo(30 + (270 * 2550) / 2700, 6);
    expect(model.home.finalLabel).toBe(101);
    expect(model.away.finalLabel).toBe(99);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (100.8 * 190) / 120);
  });

  it("adds a label per further overtime", () => {
    const model = computeChart([{ period: 6, remaining: 0, home: 100, away: 100 }], W, H);
    expect(model.end).toBe(3000);
    expect(model.boundaries.map((x) => x.seconds)).toEqual([600, 1200, 1800, 2400, 2700]);
    expect(model.periodLabels.map((p) => p.label)).toEqual(["1", "2", "3", "4", "P1", "P2"]);
  });

  it("rounds yMax up to a multiple of 10 with 10% headroom", () => {
    expect(computeChart([end(5, 5)], W, H).yMax).toBe(20);
    expect(computeChart([end(54, 0)], W, H).yMax).toBe(60);
    expect(computeChart([end(55, 0)], W, H).yMax).toBe(70);
    expect(computeChart([end(100, 50)], W, H).yMax).toBe(110);
    expect(computeChart([end(101, 50)], W, H).yMax).toBe(120);
  });

  it("includes predicted finals and the range band in yMax", () => {
    // the prediction alone (75.3) would give 90; the band's high (104.5) gives 120
    expect(computeChart([a], W, H).yMax).toBe(120);
    expect(computeChart([end(54, 0)], W, H).yMax).toBe(60);
    // 40 points after 1200 s: prediction 40 + 36 × 58 / 54 = 78.7 -> 90, band high 40 + 54 = 94 -> 110
    expect(computeChart([{ period: 2, remaining: 0, home: 40, away: 0 }], W, H).yMax).toBe(110);
  });

  it("scales yMax to a hot team's high, which equals its prediction", () => {
    // 60 points after 600 s: 60 + 54 × 78 / 36 = 177 -> 200
    const hot = computeChart([{ period: 1, remaining: 0, home: 60, away: 0 }], W, H);
    expect(hot.yMax).toBe(200);
  });

  describe("range band", () => {
    // snapshot b: 30 : 24 at 900 s, end 2400; yMax 110, 190 / 110 px per point
    const model = computeChart([b], W, H);
    const px = (seconds: number): number => 30 + (270 * seconds) / 2400;
    const py = (points: number): number => BOTTOM - (points * 190) / 110;

    it("is a four-point polygon: start, high at the end, low at the end, start", () => {
      // home high 30 + 45 × 1.5 = 97.5, low 30
      const band = model.home.band;
      expect(band).toHaveLength(4);
      expectPoint(band?.[0], px(900), py(30));
      expectPoint(band?.[1], px(2400), py(97.5));
      expectPoint(band?.[2], px(2400), py(30));
      expectPoint(band?.[3], px(900), py(30));
      expect(model.home.range).toEqual({ low: 30, high: 98 });
    });

    it("has a flat lower edge at the current score and a linear upper edge", () => {
      // away high 24 + 45 × 1.5 = 91.5
      const band = model.away.band ?? [];
      expectPoint(band[0], px(900), py(24));
      expectPoint(band[1], px(2400), py(91.5));
      expectPoint(band[2], px(2400), py(24));
      expectPoint(band[3], px(900), py(24));
      expect(model.away.range).toEqual({ low: 24, high: 92 });
    });

    it("is absent without snapshots", () => {
      const none = computeChart([], W, H);
      expect(none.home.band).toBeNull();
      expect(none.home.range).toBeNull();
      expect(none.away.band).toBeNull();
    });

    it("spans the whole game for a snapshot at elapsed 0", () => {
      const start = computeChart([{ period: 1, remaining: 600, home: 0, away: 0 }], W, H);
      const band = start.home.band ?? [];
      // yMax 120: high 108
      expectPoint(band[0], LEFT, BOTTOM);
      expectPoint(band[1], 300, BOTTOM - (108 * 190) / 120);
      expectPoint(band[2], 300, BOTTOM);
    });

    it("collapses at the final buzzer", () => {
      const done = computeChart([end(82, 76)], W, H);
      expect(done.home.range).toEqual({ low: 82, high: 82 });
      for (const p of done.home.band ?? []) expect(p.y).toBeCloseTo(BOTTOM - (82 * 190) / 100, 6);
    });

    it("keeps the upper edge at the prediction's ppp for a hot team", () => {
      // 60 points at 600 s: ppp 78 / 36 > 1.5, so high = prediction = 177 (yMax 200)
      const hot = computeChart([{ period: 1, remaining: 0, home: 60, away: 0 }], W, H);
      expect(hot.home.range).toEqual({ low: 60, high: 177 });
      expect(hot.home.finalLabel).toBe(177);
      expectPoint(hot.home.band?.[1], 300, BOTTOM - (177 * 190) / 200);
      expectPoint(hot.home.prediction?.to, 300, BOTTOM - (177 * 190) / 200);
    });

    it("has a band from zero for a team without points", () => {
      // 0 : 10 at 300 s: home 0 + 63 × 18 / 27 = 42, high 63 × 1.5 = 94.5
      const zero = computeChart([{ period: 1, remaining: 300, home: 0, away: 10 }], W, H);
      expect(zero.home.range).toEqual({ low: 0, high: 95 });
      expect(zero.home.finalLabel).toBe(42);
      expectPoint(zero.home.band?.[0], 30 + (270 * 300) / 2400, BOTTOM);
      expectPoint(zero.home.band?.[2], 300, BOTTOM);
    });
  });

  it("uses a tick step of 10 up to 60 and 20 above", () => {
    expect(computeChart([end(54, 0)], W, H).yTicks.map((t) => t.value)).toEqual([
      0, 10, 20, 30, 40, 50, 60,
    ]);
    expect(computeChart([end(55, 0)], W, H).yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60]);
  });
});

describe("computeChart scale", () => {
  it("scales the y axis to the highest score of any snapshot, not just the last", () => {
    const high: Snapshot = { period: 1, remaining: 300, home: 200, away: 5 };
    const low: Snapshot = { period: 2, remaining: 300, home: 10, away: 8 };
    const withHigh = computeChart([high, low], W, H);
    const lowOnly = computeChart([low], W, H);
    expect(withHigh.yTicks.at(-1)?.value).toBeGreaterThanOrEqual(200);
    expect(lowOnly.yTicks.at(-1)?.value).toBeLessThan(200);
  });
});

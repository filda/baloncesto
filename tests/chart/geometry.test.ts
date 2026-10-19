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
    // the band's upper edge (80 + 1.96 × √140 = 103.2) lifts yMax from 90 to 120
    expect(model.yMax).toBe(120);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(model.home.known).toHaveLength(2);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 120);
    expectPoint(model.away.known[1], 30 + 33.75, BOTTOM - (8 * 190) / 120);
    expectPoint(model.home.prediction?.from, 30 + 33.75, BOTTOM - (10 * 190) / 120);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (80 * 190) / 120);
    expectPoint(model.away.prediction?.to, 300, BOTTOM - (64 * 190) / 120);
    expect(model.home.finalLabel).toBe(80);
    expect(model.away.finalLabel).toBe(64);
  });

  it("handles several snapshots in order", () => {
    const model = computeChart([a, b], W, H);
    expect(model.yMax).toBe(110);
    expect(model.home.known).toHaveLength(3);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 110);
    expectPoint(model.home.known[2], 131.25, BOTTOM - (30 * 190) / 110);
    expectPoint(model.away.known[2], 131.25, BOTTOM - (24 * 190) / 110);
    expectPoint(model.home.prediction?.from, 131.25, BOTTOM - (30 * 190) / 110);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (80 * 190) / 110);
    expect(model.home.finalLabel).toBe(80);
    expect(model.away.finalLabel).toBe(64);
  });

  it("does not duplicate the origin for a snapshot at elapsed 0", () => {
    const model = computeChart([{ period: 1, remaining: 600, home: 0, away: 0 }], W, H);
    expect(model.home.known).toHaveLength(1);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expect(model.home.prediction).toBeNull();
    expect(model.away.finalLabel).toBeNull();
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
    expect(model.yMax).toBe(130);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(model.boundaries.map((x) => x.seconds)).toEqual([600, 1200, 1800, 2400]);
    expect(model.boundaries[3]?.x).toBeCloseTo(30 + (270 * 2400) / 2700, 6);
    expect(model.periodLabels.map((p) => p.label)).toEqual(["1", "2", "3", "4", "P1"]);
    expect(model.periodLabels[4]?.x).toBeCloseTo(30 + (270 * 2550) / 2700, 6);
    expect(model.home.finalLabel).toBe(101);
    expect(model.away.finalLabel).toBe(99);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (101.25 * 190) / 130);
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
    // the prediction alone (80) would give 90; the band's high (103.2) gives 120
    expect(computeChart([a], W, H).yMax).toBe(120);
    expect(computeChart([end(54, 0)], W, H).yMax).toBe(60);
    // 40 points after 1200 s: prediction 80, band high 80 + 1.96 × √80 = 97.5 -> 110, not 90
    expect(computeChart([{ period: 2, remaining: 0, home: 40, away: 0 }], W, H).yMax).toBe(110);
  });

  describe("range band", () => {
    // snapshot b: 30 : 24 at 900 s, end 2400; yMax 110, 190 / 110 px per point
    const model = computeChart([b], W, H);
    const px = (seconds: number): number => 30 + (270 * seconds) / 2400;
    const py = (points: number): number => BOTTOM - (points * 190) / 110;

    it("has a zero-width start at the last entry and 13 samples per edge", () => {
      const band = model.home.band;
      expect(band).toHaveLength(26);
      expectPoint(band?.[0], px(900), py(30));
      expectPoint(band?.[25], px(900), py(30));
    });

    it("widens with the square root of the time ahead, centred on the prediction", () => {
      const band = model.home.band ?? [];
      const pace = 30 / 900;
      for (const i of [1, 6, 12]) {
        const ahead = (1500 * i) / 12;
        const centre = 30 + pace * ahead;
        const half = 1.96 * Math.sqrt(2 * pace * ahead);
        expectPoint(band[i], px(900 + ahead), py(centre + half));
        expectPoint(band[25 - i], px(900 + ahead), py(Math.max(30, centre - half)));
      }
      // the end of the band spans the final range 80 ± 1.96 × √100
      expect(model.home.range).toEqual({ low: 60, high: 100 });
      expectPoint(band[12], px(2400), py(80 + 1.96 * Math.sqrt(100)));
      expectPoint(band[13], px(2400), py(80 - 1.96 * Math.sqrt(100)));
    });

    it("clamps the lower edge to the current score", () => {
      // 10 points after 300 s: at the very start the centre barely moves while the half-width
      // grows quickly, so the lower edge would drop below 10
      const clamped = computeChart([a], W, H).home.band ?? [];
      const yMaxA = 120;
      const lowest = clamped.slice(13);
      for (const p of lowest) expect(p.y).toBeLessThanOrEqual(BOTTOM - (10 * 190) / yMaxA + 1e-9);
      // first step: ahead = 175 s, raw lower edge 15.83 - 6.70 = 9.1 -> 10
      expectPoint(clamped[24], 30 + (270 * 475) / 2400, BOTTOM - (10 * 190) / yMaxA);
      // the upper edge is not clamped
      const half = 1.96 * Math.sqrt(2 * (10 / 300) * 175);
      expectPoint(
        clamped[1],
        30 + (270 * 475) / 2400,
        BOTTOM - ((10 + (10 / 300) * 175 + half) * 190) / yMaxA,
      );
    });

    it("is absent without a prediction", () => {
      const none = computeChart([{ period: 1, remaining: 600, home: 0, away: 0 }], W, H);
      expect(none.home.band).toBeNull();
      expect(none.home.range).toBeNull();
      expect(computeChart([], W, H).away.band).toBeNull();
    });

    it("collapses at the final buzzer", () => {
      const done = computeChart([end(82, 76)], W, H);
      expect(done.home.range).toEqual({ low: 82, high: 82 });
      for (const p of done.home.band ?? []) expect(p.y).toBeCloseTo(BOTTOM - (82 * 190) / 100, 6);
    });

    it("has a flat band for a team without points", () => {
      const zero = computeChart([{ period: 1, remaining: 300, home: 0, away: 10 }], W, H);
      expect(zero.home.range).toEqual({ low: 0, high: 0 });
      for (const p of zero.home.band ?? []) expect(p.y).toBeCloseTo(BOTTOM, 6);
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

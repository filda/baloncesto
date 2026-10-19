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
    expect(model.yMax).toBe(90);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80]);
    expect(model.home.known).toHaveLength(2);
    expectPoint(model.home.known[0], LEFT, BOTTOM);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 90);
    expectPoint(model.away.known[1], 30 + 33.75, BOTTOM - (8 * 190) / 90);
    expectPoint(model.home.prediction?.from, 30 + 33.75, BOTTOM - (10 * 190) / 90);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (80 * 190) / 90);
    expectPoint(model.away.prediction?.to, 300, BOTTOM - (64 * 190) / 90);
    expect(model.home.finalLabel).toBe(80);
    expect(model.away.finalLabel).toBe(64);
  });

  it("handles several snapshots in order", () => {
    const model = computeChart([a, b], W, H);
    expect(model.yMax).toBe(90);
    expect(model.home.known).toHaveLength(3);
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 90);
    expectPoint(model.home.known[2], 131.25, BOTTOM - (30 * 190) / 90);
    expectPoint(model.away.known[2], 131.25, BOTTOM - (24 * 190) / 90);
    expectPoint(model.home.prediction?.from, 131.25, BOTTOM - (30 * 190) / 90);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (80 * 190) / 90);
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
    expectPoint(model.home.known[1], 30 + 33.75, BOTTOM - (10 * 190) / 90);
  });

  it("extends the end to 2700 in overtime", () => {
    const model = computeChart([{ period: 5, remaining: 300, home: 90, away: 88 }], W, H);
    expect(model.end).toBe(2700);
    expect(model.yMax).toBe(120);
    expect(model.yTicks.map((t) => t.value)).toEqual([0, 20, 40, 60, 80, 100, 120]);
    expect(model.boundaries.map((x) => x.seconds)).toEqual([600, 1200, 1800, 2400]);
    expect(model.boundaries[3]?.x).toBeCloseTo(30 + (270 * 2400) / 2700, 6);
    expect(model.periodLabels.map((p) => p.label)).toEqual(["1", "2", "3", "4", "P1"]);
    expect(model.periodLabels[4]?.x).toBeCloseTo(30 + (270 * 2550) / 2700, 6);
    expect(model.home.finalLabel).toBe(101);
    expect(model.away.finalLabel).toBe(99);
    expectPoint(model.home.prediction?.to, 300, BOTTOM - (101.25 * 190) / 120);
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

  it("includes predicted finals in yMax", () => {
    expect(computeChart([a], W, H).yMax).toBe(90);
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

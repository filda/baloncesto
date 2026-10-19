import { describe, expect, it } from "vitest";
import {
  addSnapshot,
  currentPrediction,
  emptyMatch,
  lastSnapshot,
  nextInputDefaults,
  removeLastSnapshot,
} from "../../src/app/match";

const a = { period: 1, remaining: 300, home: 10, away: 8 };
const b = { period: 2, remaining: 300, home: 30, away: 24 };

describe("match", () => {
  it("starts empty", () => {
    expect(emptyMatch()).toEqual({ snapshots: [] });
    expect(lastSnapshot(emptyMatch())).toBeNull();
    expect(currentPrediction(emptyMatch())).toBeNull();
  });

  it("adds snapshots immutably", () => {
    const empty = emptyMatch();
    const one = addSnapshot(empty, a);
    const two = addSnapshot(one, b);
    expect(empty.snapshots).toEqual([]);
    expect(one.snapshots).toEqual([a]);
    expect(two.snapshots).toEqual([a, b]);
    expect(lastSnapshot(two)).toBe(b);
  });

  it("removes the last snapshot immutably", () => {
    const two = addSnapshot(addSnapshot(emptyMatch(), a), b);
    const one = removeLastSnapshot(two);
    expect(one.snapshots).toEqual([a]);
    expect(two.snapshots).toEqual([a, b]);
    expect(removeLastSnapshot(emptyMatch())).toEqual({ snapshots: [] });
  });

  it("predicts from the last snapshot", () => {
    const m = addSnapshot(addSnapshot(emptyMatch(), a), b);
    expect(currentPrediction(m)).toEqual({ elapsed: 900, end: 2400, home: 80, away: 64 });
  });

  it("has no prediction when nothing has been played", () => {
    const m = addSnapshot(emptyMatch(), { period: 1, remaining: 600, home: 0, away: 0 });
    expect(currentPrediction(m)).toBeNull();
  });

  it("gives defaults for an empty match", () => {
    expect(nextInputDefaults(emptyMatch())).toEqual({
      period: "1",
      clock: "10:00",
      home: "0",
      away: "0",
    });
  });

  it("prefills from the last snapshot", () => {
    const m = addSnapshot(addSnapshot(emptyMatch(), a), { ...b, remaining: 65 });
    expect(nextInputDefaults(m)).toEqual({ period: "2", clock: "1:05", home: "30", away: "24" });
  });
});

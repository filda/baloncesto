import { describe, expect, it } from "vitest";
import {
  addSnapshot,
  currentPrediction,
  lastSnapshot,
  newGame,
  nextInputDefaults,
  removeLastSnapshot,
} from "../../src/app/match";

const a = { period: 1, remaining: 300, home: 10, away: 8 };
const b = { period: 2, remaining: 300, home: 30, away: 24 };
const now = new Date("2026-03-04T18:30:00.000Z");
const empty = () => newGame("g1", now);

describe("newGame", () => {
  it("creates an empty game with default names", () => {
    expect(newGame("g1", now)).toEqual({
      id: "g1",
      createdAt: "2026-03-04T18:30:00.000Z",
      homeName: "Home",
      awayName: "Away",
      snapshots: [],
    });
  });
});

describe("game helpers", () => {
  it("starts without a last snapshot or prediction", () => {
    expect(lastSnapshot(empty())).toBeNull();
    expect(currentPrediction(empty())).toBeNull();
  });

  it("adds snapshots immutably and keeps other fields", () => {
    const g0 = empty();
    const one = addSnapshot(g0, a);
    const two = addSnapshot(one, b);
    expect(g0.snapshots).toEqual([]);
    expect(one.snapshots).toEqual([a]);
    expect(two.snapshots).toEqual([a, b]);
    expect(two.id).toBe("g1");
    expect(two.homeName).toBe("Home");
    expect(lastSnapshot(two)).toBe(b);
  });

  it("removes the last snapshot immutably", () => {
    const two = addSnapshot(addSnapshot(empty(), a), b);
    const one = removeLastSnapshot(two);
    expect(one.snapshots).toEqual([a]);
    expect(one.id).toBe("g1");
    expect(two.snapshots).toEqual([a, b]);
    expect(removeLastSnapshot(empty()).snapshots).toEqual([]);
  });

  it("predicts from the last snapshot", () => {
    const g = addSnapshot(addSnapshot(empty(), a), b);
    expect(currentPrediction(g)).toEqual({ elapsed: 900, end: 2400, home: 80, away: 64 });
  });

  it("has no prediction when nothing has been played", () => {
    const g = addSnapshot(empty(), { period: 1, remaining: 600, home: 0, away: 0 });
    expect(currentPrediction(g)).toBeNull();
  });

  it("gives defaults for an empty game", () => {
    expect(nextInputDefaults(empty())).toEqual({
      period: "1",
      clock: "10:00",
      home: "0",
      away: "0",
    });
  });

  it("prefills from the last snapshot", () => {
    const g = addSnapshot(addSnapshot(empty(), a), { ...b, remaining: 65 });
    expect(nextInputDefaults(g)).toEqual({ period: "2", clock: "1:05", home: "30", away: "24" });
  });
});

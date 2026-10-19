import { describe, expect, it } from "vitest";
import { validateSnapshot } from "../../src/domain/validate";
import type { SnapshotInput } from "../../src/domain/validate";

const valid: SnapshotInput = { period: "2", clock: "5:30", home: "30", away: "24" };
const PERIOD_MSG = "Period must be a whole number 1–9.";
const CLOCK_MSG = "Enter time as m:ss.";
const SCORE_MSG = "Score must be a whole number 0–300.";
const BACK_MSG = "Time cannot go back from the previous entry.";
const DROP_MSG = "Score cannot go down.";

function input(patch: Partial<SnapshotInput>): SnapshotInput {
  return { ...valid, ...patch };
}

describe("validateSnapshot", () => {
  it("accepts valid input", () => {
    expect(validateSnapshot(valid)).toEqual({
      ok: true,
      snapshot: { period: 2, remaining: 330, home: 30, away: 24 },
    });
  });

  it("trims whitespace", () => {
    expect(validateSnapshot({ period: " 3 ", clock: " 1:05 ", home: "\t7", away: "8\n" })).toEqual({
      ok: true,
      snapshot: { period: 3, remaining: 65, home: 7, away: 8 },
    });
  });

  describe("period", () => {
    it.each([
      ["1", 1],
      ["9", 9],
    ])("accepts %j", (period, n) => {
      expect(validateSnapshot(input({ period, clock: "1:00" }))).toEqual({
        ok: true,
        snapshot: { period: n, remaining: 60, home: 30, away: 24 },
      });
    });

    it.each(["0", "10", "", "abc", "1.5", "-1", "+1", "1e1"])("rejects %j", (period) => {
      expect(validateSnapshot(input({ period }))).toEqual({
        ok: false,
        errors: [{ field: "period", message: PERIOD_MSG }],
      });
    });
  });

  describe("clock", () => {
    it("accepts 10:00 in regulation and 0:00", () => {
      expect(validateSnapshot(input({ period: "1", clock: "10:00" }))).toMatchObject({
        ok: true,
        snapshot: { remaining: 600 },
      });
      expect(validateSnapshot(input({ clock: "0:00" }))).toMatchObject({
        ok: true,
        snapshot: { remaining: 0 },
      });
    });

    it("rejects 10:01 in regulation", () => {
      expect(validateSnapshot(input({ period: "4", clock: "10:01" }))).toEqual({
        ok: false,
        errors: [{ field: "clock", message: "A period lasts at most 10:00." }],
      });
    });

    it("accepts 5:00 in overtime and rejects 5:01", () => {
      expect(validateSnapshot(input({ period: "5", clock: "5:00" }))).toMatchObject({
        ok: true,
        snapshot: { period: 5, remaining: 300 },
      });
      expect(validateSnapshot(input({ period: "5", clock: "5:01" }))).toEqual({
        ok: false,
        errors: [{ field: "clock", message: "Overtime lasts at most 5:00." }],
      });
      expect(validateSnapshot(input({ period: "9", clock: "5:01" }))).toEqual({
        ok: false,
        errors: [{ field: "clock", message: "Overtime lasts at most 5:00." }],
      });
    });

    it.each(["", "abc", "5", "5:0", "5:60", "-1:00"])("rejects unparsable %j", (clock) => {
      expect(validateSnapshot(input({ clock }))).toEqual({
        ok: false,
        errors: [{ field: "clock", message: CLOCK_MSG }],
      });
    });

    it("does not check the max when the period is invalid", () => {
      expect(validateSnapshot(input({ period: "x", clock: "10:01" }))).toEqual({
        ok: false,
        errors: [{ field: "period", message: PERIOD_MSG }],
      });
    });
  });

  describe("scores", () => {
    it.each(["0", "1", "300"])("accepts %j", (score) => {
      expect(validateSnapshot(input({ home: score, away: score }))).toMatchObject({
        ok: true,
        snapshot: { home: Number(score), away: Number(score) },
      });
    });

    it.each(["301", "-1", "", "x", "1.5", "1000"])("rejects %j on both fields", (score) => {
      expect(validateSnapshot(input({ home: score, away: score }))).toEqual({
        ok: false,
        errors: [
          { field: "home", message: SCORE_MSG },
          { field: "away", message: SCORE_MSG },
        ],
      });
    });

    it("rejects only the away field when only it is bad", () => {
      expect(validateSnapshot(input({ away: "301" }))).toEqual({
        ok: false,
        errors: [{ field: "away", message: SCORE_MSG }],
      });
    });
  });

  it("collects all errors at once, in field order", () => {
    expect(validateSnapshot({ period: "0", clock: "x", home: "-1", away: "301" })).toEqual({
      ok: false,
      errors: [
        { field: "period", message: PERIOD_MSG },
        { field: "clock", message: CLOCK_MSG },
        { field: "home", message: SCORE_MSG },
        { field: "away", message: SCORE_MSG },
      ],
    });
  });

  describe("against previous snapshot", () => {
    const previous = { period: 2, remaining: 330, home: 30, away: 24 };

    it("accepts equal elapsed time and equal scores", () => {
      expect(validateSnapshot(valid, previous)).toEqual({ ok: true, snapshot: previous });
    });

    it("accepts later time and higher scores", () => {
      expect(
        validateSnapshot(input({ clock: "5:29", home: "31", away: "25" }), previous),
      ).toMatchObject({ ok: true });
      expect(validateSnapshot(input({ period: "3", clock: "10:00" }), previous)).toMatchObject({
        ok: true,
      });
    });

    it("rejects time one second back", () => {
      expect(validateSnapshot(input({ clock: "5:31" }), previous)).toEqual({
        ok: false,
        errors: [{ field: "clock", message: BACK_MSG }],
      });
    });

    it("rejects an earlier period", () => {
      expect(validateSnapshot(input({ period: "1", clock: "0:00" }), previous)).toEqual({
        ok: false,
        errors: [{ field: "clock", message: BACK_MSG }],
      });
    });

    it("rejects each lower score on its own field", () => {
      expect(validateSnapshot(input({ home: "29" }), previous)).toEqual({
        ok: false,
        errors: [{ field: "home", message: DROP_MSG }],
      });
      expect(validateSnapshot(input({ away: "23" }), previous)).toEqual({
        ok: false,
        errors: [{ field: "away", message: DROP_MSG }],
      });
    });

    it("reports time and both scores together", () => {
      expect(validateSnapshot(input({ clock: "6:00", home: "0", away: "0" }), previous)).toEqual({
        ok: false,
        errors: [
          { field: "clock", message: BACK_MSG },
          { field: "home", message: DROP_MSG },
          { field: "away", message: DROP_MSG },
        ],
      });
    });

    it("skips comparison when a field is individually invalid", () => {
      expect(validateSnapshot(input({ clock: "x", home: "0" }), previous)).toEqual({
        ok: false,
        errors: [{ field: "clock", message: CLOCK_MSG }],
      });
    });
  });
});

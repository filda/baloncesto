import { describe, expect, it } from "vitest";
import {
  addSnapshot,
  consolidateSnapshots,
  createGame,
  draftNewGame,
  INVALID_DATE_MESSAGE,
  currentPrediction,
  gameInfoLine,
  normalizeTeamName,
  lastSnapshot,
  newGame,
  nextInputDefaults,
  removeSnapshotAt,
  repeatedScoreCount,
  shouldOpenNewFormOnStart,
  coordsText,
  withLocation,
  addPlaceLabel,
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
    for (const bad of [
      { period: 0, remaining: 100, home: 1, away: 1 },
      { period: 1, remaining: -1, home: 1, away: 1 },
      { period: 1, remaining: 601, home: 1, away: 1 },
    ]) {
      expect(currentPrediction({ snapshots: [bad] })).toBeNull();
    }
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

  it("removes the snapshot at an index immutably", () => {
    const c = { period: 3, remaining: 100, home: 50, away: 40 };
    const three = addSnapshot(addSnapshot(addSnapshot(empty(), a), b), c);
    expect(removeSnapshotAt(three, 0).snapshots).toEqual([b, c]);
    expect(removeSnapshotAt(three, 1).snapshots).toEqual([a, c]);
    expect(removeSnapshotAt(three, 2).snapshots).toEqual([a, b]);
    expect(removeSnapshotAt(three, 1).id).toBe("g1");
    expect(three.snapshots).toEqual([a, b, c]);
  });

  it("leaves the game unchanged for an out-of-range index", () => {
    const two = addSnapshot(addSnapshot(empty(), a), b);
    expect(removeSnapshotAt(two, 2)).toBe(two);
    expect(removeSnapshotAt(two, -1)).toBe(two);
    expect(removeSnapshotAt(two, 0.5)).toBe(two);
    expect(removeSnapshotAt(empty(), 0).snapshots).toEqual([]);
  });

  it("predicts from the last snapshot", () => {
    const g = addSnapshot(addSnapshot(empty(), a), b);
    // b at 900 s: possessions 45, denominator 45 -> home 30 + 48 = 78, away 24 + 42 = 66
    const prediction = currentPrediction(g);
    expect(prediction?.elapsed).toBe(900);
    expect(prediction?.end).toBe(2400);
    expect(prediction?.home).toBeCloseTo(78, 10);
    expect(prediction?.away).toBeCloseTo(66, 10);
  });

  it("predicts the prior when nothing has been played yet", () => {
    const g = addSnapshot(empty(), { period: 1, remaining: 600, home: 0, away: 0 });
    expect(currentPrediction(g)).toEqual({ elapsed: 0, end: 2400, home: 72, away: 72 });
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

describe("consolidateSnapshots", () => {
  const at = (remaining: number, home: number, away: number) => ({
    period: 1,
    remaining,
    home,
    away,
  });

  it("keeps the last entry of each run of equal scores", () => {
    const game = {
      ...empty(),
      snapshots: [at(480, 10, 8), at(430, 10, 8), at(390, 10, 8), at(300, 12, 8), at(200, 12, 8)],
    };
    const result = consolidateSnapshots(game);
    expect(result.snapshots).toEqual([at(390, 10, 8), at(200, 12, 8)]);
    expect(result.id).toBe("g1");
    expect(game.snapshots).toHaveLength(5);
    expect(repeatedScoreCount(game)).toBe(3);
  });

  it("treats a change of either score as a different entry", () => {
    const snapshots = [at(500, 10, 8), at(400, 12, 8), at(300, 12, 10), at(200, 14, 10)];
    const game = { ...empty(), snapshots };
    expect(consolidateSnapshots(game)).toBe(game);
    expect(repeatedScoreCount(game)).toBe(0);
  });

  it("only merges neighbours", () => {
    const game = { snapshots: [at(500, 10, 8), at(400, 12, 8), at(300, 12, 8), at(200, 14, 8)] };
    expect(consolidateSnapshots(game).snapshots).toEqual([
      at(500, 10, 8),
      at(300, 12, 8),
      at(200, 14, 8),
    ]);
  });

  it("returns an empty or single-entry game unchanged", () => {
    const none = empty();
    const one = { ...empty(), snapshots: [a] };
    expect(consolidateSnapshots(none)).toBe(none);
    expect(consolidateSnapshots(one)).toBe(one);
    expect(repeatedScoreCount(none)).toBe(0);
  });
});

describe("normalizeTeamName", () => {
  it("trims and falls back for blank input", () => {
    expect(normalizeTeamName("  Lakers ", "Home")).toBe("Lakers");
    expect(normalizeTeamName("", "Home")).toBe("Home");
    expect(normalizeTeamName("   ", "Away")).toBe("Away");
  });

  it("truncates to 24 characters", () => {
    expect(normalizeTeamName("A".repeat(30), "Home")).toBe("A".repeat(24));
    expect(normalizeTeamName(`${"B".repeat(23)} ${"C".repeat(5)}`, "Home")).toBe("B".repeat(23));
  });
});

describe("createGame", () => {
  const input = { id: "g2", createdAt: now, homeName: " Lakers ", awayName: "" };

  it("normalizes names and omits an unknown location", () => {
    const g = createGame(input);
    expect(g).toEqual({
      id: "g2",
      createdAt: "2026-03-04T18:30:00.000Z",
      homeName: "Lakers",
      awayName: "Away",
      snapshots: [],
    });
    expect("location" in g).toBe(false);
  });

  it("keeps coordinates with and without a place", () => {
    expect(createGame({ ...input, lat: 1, lon: 2, place: " Hall " }).location).toEqual({
      lat: 1,
      lon: 2,
      place: "Hall",
    });
    expect(createGame({ ...input, lat: 1, lon: 2, place: " " }).location).toEqual({
      lat: 1,
      lon: 2,
    });
  });

  it("allows a place without coordinates and ignores a lone coordinate", () => {
    expect(createGame({ ...input, place: "Hall" }).location).toEqual({ place: "Hall" });
    expect(createGame({ ...input, lat: 1, place: "Hall" }).location).toEqual({ place: "Hall" });
    expect(createGame({ ...input, lat: 1 }).location).toBeUndefined();
  });
});

describe("gameInfoLine", () => {
  const fmt = (iso: string) => `fmt(${iso})`;

  it("joins date and place, omitting a missing place", () => {
    const withPlace = { ...empty(), location: { place: "Hall" } };
    expect(gameInfoLine(withPlace, fmt)).toBe("fmt(2026-03-04T18:30:00.000Z) · Hall");
    expect(gameInfoLine(empty(), fmt)).toBe("fmt(2026-03-04T18:30:00.000Z)");
    expect(gameInfoLine({ ...empty(), location: { lat: 1, lon: 2 } }, fmt)).toBe(
      "fmt(2026-03-04T18:30:00.000Z)",
    );
  });
});

describe("shouldOpenNewFormOnStart", () => {
  it("opens the form without a game or without snapshots only", () => {
    expect(shouldOpenNewFormOnStart(undefined)).toBe(true);
    expect(shouldOpenNewFormOnStart(empty())).toBe(true);
    expect(shouldOpenNewFormOnStart({ ...empty(), snapshots: [a] })).toBe(false);
  });
});

describe("coordsText", () => {
  it("rounds to three decimals", () => {
    expect(coordsText({ lat: 49.19512, lon: 16.60749 })).toBe("49.195, 16.607");
    expect(coordsText({ lat: 49, lon: -1.5 })).toBe("49.000, -1.500");
  });
});

describe("withLocation", () => {
  const coords = { lat: 49.195, lon: 16.607 };

  it("stores coordinates and the place", () => {
    expect(withLocation(empty(), coords, " Hall ").location).toEqual({
      lat: 49.195,
      lon: 16.607,
      place: "Hall",
    });
  });

  it("falls back to the coordinates text and keeps the rest of the game", () => {
    const game = { ...empty(), snapshots: [a] };
    const result = withLocation(game, coords, undefined);
    expect(result.location?.place).toBe("49.195, 16.607");
    expect(withLocation(game, coords, "  ").location?.place).toBe("49.195, 16.607");
    expect(result.snapshots).toEqual([a]);
    expect(result.id).toBe("g1");
    expect(game.location).toBeUndefined();
  });
});

describe("addPlaceLabel", () => {
  it("describes the lookup state", () => {
    expect(addPlaceLabel(null)).toBe("+ Add place");
    expect(addPlaceLabel("locating")).toBe("Locating…");
    expect(addPlaceLabel("unavailable")).toBe("Location unavailable · retry");
    expect(addPlaceLabel("located")).toBe("+ Add place");
    expect(addPlaceLabel("place-unavailable")).toBe("+ Add place");
  });
});

describe("draftNewGame", () => {
  const form = {
    homeName: "Lakers",
    awayName: "Celtics",
    dateTime: "2026-05-06T07:08",
    place: "Brno",
  };

  it("builds the input from valid form values and coordinates", () => {
    const draft = draftNewGame(form, { lat: 49.2, lon: 16.6 });
    expect(draft).toEqual({
      ok: true,
      input: {
        createdAt: new Date(2026, 4, 6, 7, 8),
        homeName: "Lakers",
        awayName: "Celtics",
        lat: 49.2,
        lon: 16.6,
        place: "Brno",
      },
    });
  });

  it("omits coordinates when unknown", () => {
    const draft = draftNewGame(form, null);
    expect(draft.ok && draft.input.lat).toBeUndefined();
    expect(draft.ok && draft.input.lon).toBeUndefined();
  });

  it.each(["", "garbage", "2026-02-30T10:00", "2026-05-06T25:00", "2026-05-06"])(
    "rejects the date %j instead of using now",
    (dateTime) => {
      expect(draftNewGame({ ...form, dateTime }, null)).toEqual({
        ok: false,
        errors: { dateTime: "Enter a valid date and time." },
      });
    },
  );

  it("exposes the message", () => {
    expect(INVALID_DATE_MESSAGE).toBe("Enter a valid date and time.");
  });
});

describe("mutation regressions", () => {
  it("trims before truncating a team name", () => {
    expect(normalizeTeamName(`${" ".repeat(30)}Lakers`, "Home")).toBe("Lakers");
  });

  it("needs both coordinates to store a location with coordinates", () => {
    const game = createGame({ id: "g", createdAt: now, homeName: "", awayName: "", lon: 16.6 });
    expect(game.location).toBeUndefined();
    const lonOnly = createGame({
      id: "g",
      createdAt: now,
      homeName: "",
      awayName: "",
      lon: 16.6,
      place: "Gym",
    });
    expect(lonOnly.location).toEqual({ place: "Gym" });
  });

  it("returns the last of several snapshots", () => {
    const c = { period: 3, remaining: 200, home: 40, away: 33 };
    expect(lastSnapshot({ snapshots: [a, b, c] })).toBe(c);
  });
});

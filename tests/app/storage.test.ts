import { describe, expect, it } from "vitest";
import { newGame } from "../../src/app/match";
import type { Game } from "../../src/app/match";
import {
  STORAGE_KEY,
  deleteGame,
  emptyState,
  findGame,
  listHistory,
  loadState,
  saveState,
  setCurrent,
  upsertGame,
} from "../../src/app/storage";
import type { AppState, KeyValueStorage } from "../../src/app/storage";

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const snap = { period: 1, remaining: 300, home: 10, away: 8 };

function game(id: string, createdAt: string, snapshots = [snap]): Game {
  return { ...newGame(id, new Date(createdAt)), snapshots };
}

function stored(value: unknown): FakeStorage {
  const s = new FakeStorage();
  s.setItem(STORAGE_KEY, JSON.stringify(value));
  return s;
}

describe("loadState / saveState", () => {
  it("returns the empty state when nothing is stored or there is no storage", () => {
    expect(loadState(new FakeStorage())).toEqual({ version: 1, currentId: null, games: [] });
    expect(loadState(null)).toEqual(emptyState());
  });

  it("round-trips a state including optional fields", () => {
    const g: Game = {
      ...game("a", "2026-01-01T10:00:00.000Z"),
      homeName: "Lions",
      location: { lat: 50.1, lon: 14.4, place: "Prague" },
    };
    const state: AppState = { version: 1, currentId: "a", games: [g] };
    const storage = new FakeStorage();
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage)).toEqual(state);
  });

  it("accepts place-only and coordinates-only locations", () => {
    const placeOnly = { ...game("p", "2026-01-01T10:00:00.000Z"), location: { place: "Brno" } };
    const coordsOnly = { ...game("c", "2026-01-02T10:00:00.000Z"), location: { lat: 1, lon: 2 } };
    const state = { version: 1, currentId: null, games: [placeOnly, coordsOnly] };
    expect(loadState(stored(state)).games).toEqual([placeOnly, coordsOnly]);
  });

  it("uses the versioned key", () => {
    const storage = new FakeStorage();
    saveState(storage, emptyState());
    expect([...storage.data.keys()]).toEqual(["baloncesto:v1"]);
  });

  it("returns the empty state for corrupt JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(loadState(storage)).toEqual(emptyState());
  });

  it("returns the empty state for a wrong version or shape", () => {
    expect(loadState(stored({ version: 2, currentId: null, games: [] }))).toEqual(emptyState());
    expect(loadState(stored({ currentId: null, games: [] }))).toEqual(emptyState());
    expect(loadState(stored({ version: 1, currentId: null, games: "x" }))).toEqual(emptyState());
    expect(loadState(stored([]))).toEqual(emptyState());
    expect(loadState(stored(null))).toEqual(emptyState());
  });

  it("returns the empty state when reading throws", () => {
    const storage: KeyValueStorage = {
      getItem() {
        throw new Error("denied");
      },
      setItem() {},
      removeItem() {},
    };
    expect(loadState(storage)).toEqual(emptyState());
  });

  it("drops invalid games and keeps valid ones", () => {
    const good = game("good", "2026-01-01T10:00:00.000Z");
    const state = {
      version: 1,
      currentId: "good",
      games: [
        good,
        { ...good, id: 5 },
        { ...good, id: "" },
        { ...good, id: "x1", createdAt: undefined },
        { ...good, id: "x2", homeName: 1 },
        { ...good, id: "x3", snapshots: [{ ...snap, home: 1.5 }] },
        { ...good, id: "x4", snapshots: [{ period: 1, remaining: 300, home: 1 }] },
        { ...good, id: "x5", snapshots: "none" },
        { ...good, id: "x6", location: { lat: "1", lon: 2 } },
        { ...good, id: "x7", location: { lat: 1 } },
        { ...good, id: "x8", location: { lon: 1, place: "Brno" } },
        { ...good, id: "x9", location: {} },
        { ...good, id: "x10", location: { place: 5 } },
        "garbage",
        null,
      ],
    };
    expect(loadState(stored(state)).games).toEqual([good]);
  });

  it("resets currentId when it points to no valid game", () => {
    const good = game("good", "2026-01-01T10:00:00.000Z");
    const gone = { version: 1, currentId: "gone", games: [good] };
    expect(loadState(stored(gone)).currentId).toBeNull();
    const num = { version: 1, currentId: 7, games: [good] };
    expect(loadState(stored(num)).currentId).toBeNull();
  });

  it("returns false when saving fails", () => {
    const storage: KeyValueStorage = {
      getItem: () => null,
      setItem() {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem() {},
    };
    expect(saveState(storage, emptyState())).toBe(false);
    expect(saveState(null, emptyState())).toBe(false);
  });
});

describe("state helpers", () => {
  const g1 = game("1", "2026-01-01T10:00:00.000Z");
  const g2 = game("2", "2026-02-01T10:00:00.000Z");

  it("upsert appends a new game and replaces an existing one in place", () => {
    const s1 = upsertGame(emptyState(), g1);
    const s2 = upsertGame(s1, g2);
    expect(s2.games).toEqual([g1, g2]);
    const changed = { ...g1, homeName: "Lions" };
    const s3 = upsertGame(s2, changed);
    expect(s3.games).toEqual([changed, g2]);
    expect(s2.games).toEqual([g1, g2]);
  });

  it("delete removes the game and clears currentId only if it was current", () => {
    const state: AppState = { version: 1, currentId: "1", games: [g1, g2] };
    expect(deleteGame(state, "1")).toEqual({ version: 1, currentId: null, games: [g2] });
    expect(deleteGame(state, "2")).toEqual({ version: 1, currentId: "1", games: [g1] });
    expect(deleteGame(state, "zzz")).toEqual(state);
  });

  it("setCurrent and findGame", () => {
    const state: AppState = { version: 1, currentId: null, games: [g1] };
    expect(setCurrent(state, "1").currentId).toBe("1");
    expect(setCurrent(state, null).currentId).toBeNull();
    expect(findGame(state, "1")).toBe(g1);
    expect(findGame(state, "2")).toBeNull();
    expect(findGame(state, null)).toBeNull();
  });

  it("history lists only games with snapshots, newest first, without mutating", () => {
    const empty = game("e", "2026-03-01T10:00:00.000Z", []);
    const state: AppState = { version: 1, currentId: null, games: [g1, empty, g2] };
    expect(listHistory(state).map((g) => g.id)).toEqual(["2", "1"]);
    expect(state.games.map((g) => g.id)).toEqual(["1", "e", "2"]);
    expect(listHistory(emptyState())).toEqual([]);
  });
});

describe("loadState validation details", () => {
  const g1 = game("a", "2026-01-01T10:00:00.000Z");
  const g2 = game("b", "2026-01-02T10:00:00.000Z");
  const load = (games: unknown[], extra: object = {}) =>
    loadState(stored({ version: 1, currentId: null, games, ...extra })).games;

  it("rejects a wrong version even when the games are valid", () => {
    expect(loadState(stored({ version: 2, currentId: "a", games: [g1] }))).toEqual(emptyState());
    expect(loadState(stored({ version: "1", currentId: null, games: [g1] }))).toEqual(emptyState());
  });

  it("drops games with a snapshot that is invalid, even when others are valid", () => {
    const bad = { ...g1, snapshots: [snap, { ...snap, home: "x" }] };
    const badFirst = { ...g1, id: "c", snapshots: [{ ...snap, period: 1.5 }, snap] };
    expect(load([bad, badFirst, g2])).toEqual([g2]);
  });

  it("drops games with invalid names, ids or timestamps", () => {
    expect(
      load([
        { ...g1, awayName: 5 },
        { ...g1, homeName: 5 },
        { ...g1, createdAt: 5 },
      ]),
    ).toEqual([]);
    expect(
      load([
        { ...g1, id: "" },
        { ...g1, id: 5 },
        { ...g1, snapshots: "x" },
      ]),
    ).toEqual([]);
    expect(load([null, "x", 5, [g1]])).toEqual([]);
  });

  it("drops games with a malformed location", () => {
    const withLocation = (location: unknown) => ({ ...g1, location });
    expect(
      load([
        withLocation(null),
        withLocation("Brno"),
        withLocation([]),
        withLocation({}),
        withLocation({ place: 5 }),
        withLocation({ lat: 1 }),
        withLocation({ lon: 1 }),
        withLocation({ lat: "1", lon: 2 }),
        withLocation({ lat: 1, lon: "2" }),
        withLocation({ lat: 1, lon: null }),
        withLocation({ lat: 1, lon: 2, place: 7 }),
      ]),
    ).toEqual([]);
  });

  it("drops games whose coordinates parse to infinity", () => {
    for (const location of ['{"lat":1e999,"lon":2}', '{"lat":1,"lon":-1e999}']) {
      const storage = new FakeStorage();
      const raw = JSON.stringify({
        version: 1,
        currentId: null,
        games: [game("a", "2026-01-01T10:00:00.000Z")],
      });
      storage.setItem(STORAGE_KEY, raw.replace(/}]}$/, `,"location":${location}}]}`));
      expect(loadState(storage).games).toEqual([]);
    }
  });

  it("keeps games with a valid location, with or without a place", () => {
    const a = { ...g1, location: { lat: 0, lon: 0 } };
    const b = { ...g2, location: { lat: -1.5, lon: 2.5, place: "Brno" } };
    expect(load([a, b])).toEqual([a, b]);
  });

  it("keeps currentId only when it points to a valid game, wherever it is", () => {
    const state = (currentId: unknown) =>
      loadState(stored({ version: 1, currentId, games: [g1, g2] })).currentId;
    expect(state("a")).toBe("a");
    expect(state("b")).toBe("b");
    expect(state("zzz")).toBeNull();
    expect(state(5)).toBeNull();
    expect(state(null)).toBeNull();
  });
});

describe("listHistory ordering", () => {
  const ids = (games: Game[]) => games.map((g) => g.id);
  const dates = ["2026-01-01", "2026-01-02", "2026-01-03"];

  it("sorts newest first for every input permutation", () => {
    const perms = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const perm of perms) {
      const games = perm.map((i) => game(`g${i}`, `${dates[i]}T10:00:00.000Z`));
      expect(ids(listHistory({ version: 1, currentId: null, games }))).toEqual(["g2", "g1", "g0"]);
    }
  });

  it("keeps insertion order for equal timestamps", () => {
    const games = Array.from({ length: 40 }, (_, i) => game(`e${i}`, "2026-01-01T10:00:00.000Z"));
    const sorted = listHistory({ version: 1, currentId: null, games });
    expect(ids(sorted)).toEqual(games.map((g) => g.id));
  });

  it("orders mixed equal and distinct timestamps", () => {
    const games = [
      game("old1", "2026-01-01T10:00:00.000Z"),
      game("new1", "2026-01-03T10:00:00.000Z"),
      game("old2", "2026-01-01T10:00:00.000Z"),
      game("new2", "2026-01-03T10:00:00.000Z"),
    ];
    expect(ids(listHistory({ version: 1, currentId: null, games }))).toEqual([
      "new1",
      "new2",
      "old1",
      "old2",
    ]);
  });
});

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

import { describe, expect, it } from "vitest";
import { newGame } from "../../src/app/match";
import type { Game } from "../../src/app/match";
import { STORAGE_KEY, emptyState, loadState, saveState, upsertGame } from "../../src/app/storage";
import type { KeyValueStorage } from "../../src/app/storage";
import { createStore } from "../../src/app/store";

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("quota");
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const NOW = new Date("2026-03-04T05:06:07.000Z");
const snap = (home: number, away: number, remaining = 500) => ({
  period: 1,
  remaining,
  home,
  away,
});

function makeStore(storage = new FakeStorage()) {
  let n = 0;
  const store = createStore({ storage, now: () => NOW, newId: () => `id-${++n}` });
  return { store, storage };
}

function seed(storage: FakeStorage, games: Game[], currentId: string | null): void {
  let state = emptyState();
  for (const g of games) state = upsertGame(state, g);
  saveState(storage, { ...state, currentId });
}

const played = (id: string): Game => ({ ...newGame(id, NOW), snapshots: [snap(2, 3)] });

describe("createStore", () => {
  it("starts with a fresh empty game built from the injected clock and id", () => {
    const { store } = makeStore();
    expect(store.game).toEqual(newGame("id-1", NOW));
    expect(store.restored).toBeUndefined();
    expect(store.state).toEqual(emptyState());
  });

  it("resumes the stored current game", () => {
    const storage = new FakeStorage();
    seed(storage, [played("a"), played("b")], "b");
    const { store } = makeStore(storage);
    expect(store.game.id).toBe("b");
    expect(store.restored).toBe(store.game);
  });

  it("falls back to a fresh game when the stored current id is gone", () => {
    const storage = new FakeStorage();
    seed(storage, [played("a")], null);
    const { store } = makeStore(storage);
    expect(store.game.id).toBe("id-1");
    expect(store.restored).toBeUndefined();
  });

  it("works without storage", () => {
    let n = 0;
    const store = createStore({ storage: null, now: () => NOW, newId: () => `id-${++n}` });
    store.addSnapshot(snap(1, 1));
    expect(store.game.snapshots).toHaveLength(1);
    expect(store.persist()).toBe(false);
  });
});

describe("persist", () => {
  it("writes the current game even before the first snapshot", () => {
    const { store, storage } = makeStore();
    expect(store.persist()).toBe(true);
    const stored = loadState(storage);
    expect(stored.currentId).toBe("id-1");
    expect(stored.games).toHaveLength(1);
  });

  it("reports a failed write", () => {
    const { store, storage } = makeStore();
    storage.failWrites = true;
    expect(store.persist()).toBe(false);
  });
});

describe("snapshots", () => {
  it("adds and removes entries and persists after each change", () => {
    const { store, storage } = makeStore();
    store.addSnapshot(snap(2, 3, 500));
    store.addSnapshot(snap(4, 5, 400));
    expect(loadState(storage).games[0]?.snapshots).toHaveLength(2);
    store.removeSnapshot(0);
    expect(store.game.snapshots).toEqual([snap(4, 5, 400)]);
    expect(loadState(storage).games[0]?.snapshots).toEqual([snap(4, 5, 400)]);
  });

  it("ignores an out-of-range removal", () => {
    const { store } = makeStore();
    store.addSnapshot(snap(2, 3));
    store.removeSnapshot(5);
    expect(store.game.snapshots).toHaveLength(1);
  });
});

describe("setTeamName", () => {
  it("normalizes names per side and falls back to the defaults", () => {
    const { store, storage } = makeStore();
    store.setTeamName("home", "  Lakers  ");
    store.setTeamName("away", "   ");
    expect(store.game.homeName).toBe("Lakers");
    expect(store.game.awayName).toBe("Away");
    store.setTeamName("home", "");
    expect(store.game.homeName).toBe("Home");
    store.setTeamName("away", "Celtics");
    expect(store.game.awayName).toBe("Celtics");
    expect(loadState(storage).games[0]?.awayName).toBe("Celtics");
  });
});

describe("setLocation", () => {
  it("stores coordinates with the place or the coordinates text", () => {
    const { store, storage } = makeStore();
    store.setLocation({ lat: 49.2, lon: 16.6 }, "Brno");
    expect(store.game.location).toEqual({ lat: 49.2, lon: 16.6, place: "Brno" });
    store.setLocation({ lat: 49.195, lon: 16.607 }, undefined);
    expect(store.game.location?.place).toBe("49.195, 16.607");
    expect(loadState(storage).games[0]?.location?.place).toBe("49.195, 16.607");
  });
});

describe("startGame / switchTo", () => {
  it("drops an empty previous game and makes the new one current", () => {
    const { store, storage } = makeStore();
    store.persist();
    store.startGame({ createdAt: NOW, homeName: "A", awayName: "B", place: "Gym" });
    expect(store.game.id).toBe("id-2");
    expect(store.game.homeName).toBe("A");
    expect(store.game.location).toEqual({ place: "Gym" });
    const stored = loadState(storage);
    expect(stored.games.map((g) => g.id)).toEqual(["id-2"]);
    expect(stored.currentId).toBe("id-2");
  });

  it("keeps a previous game that has entries", () => {
    const { store, storage } = makeStore();
    store.addSnapshot(snap(1, 0));
    store.startGame({ createdAt: NOW, homeName: "", awayName: "" });
    expect(loadState(storage).games.map((g) => g.id)).toEqual(["id-1", "id-2"]);
  });

  it("does not drop the game when switching to itself", () => {
    const { store } = makeStore();
    store.persist();
    store.switchTo(store.game);
    expect(store.state.games).toHaveLength(1);
  });
});

describe("open", () => {
  it("opens a stored game and makes it current", () => {
    const storage = new FakeStorage();
    seed(storage, [played("a"), played("b")], "a");
    const { store } = makeStore(storage);
    expect(store.open("b")).toBe(true);
    expect(store.game.id).toBe("b");
    expect(loadState(storage).currentId).toBe("b");
  });

  it("returns false and changes nothing for an unknown id", () => {
    const { store } = makeStore();
    expect(store.open("zzz")).toBe(false);
    expect(store.game.id).toBe("id-1");
  });
});

describe("remove", () => {
  it("deletes another game and keeps the current one", () => {
    const storage = new FakeStorage();
    seed(storage, [played("a"), played("b")], "a");
    const { store } = makeStore(storage);
    expect(store.remove("b")).toBe(false);
    expect(store.game.id).toBe("a");
    expect(loadState(storage).games.map((g) => g.id)).toEqual(["a"]);
  });

  it("replaces the current game with a fresh one when it is deleted", () => {
    const storage = new FakeStorage();
    seed(storage, [played("a")], "a");
    const { store } = makeStore(storage);
    expect(store.remove("a")).toBe(true);
    expect(store.game.id).toBe("id-1");
    expect(store.game.snapshots).toEqual([]);
    const stored = loadState(storage);
    expect(stored.currentId).toBe("id-1");
    expect(stored.games.map((g) => g.id)).toEqual(["id-1"]);
  });
});

describe("history", () => {
  it("lists only games with entries, newest first", () => {
    const storage = new FakeStorage();
    const older = { ...played("old"), createdAt: "2026-01-01T00:00:00.000Z" };
    const newer = { ...played("new"), createdAt: "2026-02-01T00:00:00.000Z" };
    seed(storage, [older, newGame("empty", NOW), newer], "empty");
    const { store } = makeStore(storage);
    expect(store.history().map((g) => g.id)).toEqual(["new", "old"]);
  });

  it("is built on the persisted shape", () => {
    const { store, storage } = makeStore();
    store.addSnapshot(snap(1, 1));
    expect(JSON.parse(storage.data.get(STORAGE_KEY) ?? "{}").games).toHaveLength(1);
    expect(store.history()).toHaveLength(1);
  });
});

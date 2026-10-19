// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newGame } from "../../src/app/match";
import { STORAGE_KEY } from "../../src/app/storage";
import { createStore } from "../../src/app/store";
import { applyForeignWrite, watchStorage } from "../../src/app/sync";
import { mountView } from "../../src/app/view";
import { $, spies, type } from "./helpers";

const snap = (home: number, away: number) => ({ period: 1, remaining: 500, home, away });

function tab(ids: string[]) {
  let n = 0;
  return createStore({
    storage: localStorage,
    now: () => new Date("2026-03-04T05:06:07.000Z"),
    newId: () => ids[n++] ?? `extra-${n}`,
  });
}

function fireStorage(init: StorageEventInit = {}): void {
  window.dispatchEvent(
    new StorageEvent("storage", { key: STORAGE_KEY, storageArea: localStorage, ...init }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("watchStorage", () => {
  it("calls back for a foreign write of the app key", () => {
    const onWrite = vi.fn();
    const stop = watchStorage(window, localStorage, onWrite);
    fireStorage();
    expect(onWrite).toHaveBeenCalledTimes(1);
    stop();
  });

  it("treats a cleared storage as a change", () => {
    const onWrite = vi.fn();
    const stop = watchStorage(window, localStorage, onWrite);
    fireStorage({ key: null });
    expect(onWrite).toHaveBeenCalledTimes(1);
    stop();
  });

  it("ignores other keys and other storage areas", () => {
    const onWrite = vi.fn();
    const stop = watchStorage(window, localStorage, onWrite);
    fireStorage({ key: "something-else" });
    fireStorage({ storageArea: sessionStorage });
    expect(onWrite).not.toHaveBeenCalled();
    stop();
  });

  it("accepts an event without a storage area", () => {
    const onWrite = vi.fn();
    const stop = watchStorage(window, localStorage, onWrite);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(onWrite).toHaveBeenCalledTimes(1);
    stop();
  });

  it("stops listening after the returned function is called", () => {
    const onWrite = vi.fn();
    watchStorage(window, localStorage, onWrite)();
    fireStorage();
    expect(onWrite).not.toHaveBeenCalled();
  });

  it("does nothing without storage", () => {
    const onWrite = vi.fn();
    watchStorage(window, null, onWrite)();
    fireStorage();
    expect(onWrite).not.toHaveBeenCalled();
  });
});

describe("applyForeignWrite", () => {
  const ui = () => ({ resetPlaceLookup: vi.fn(), showGame: vi.fn(), refreshHistory: vi.fn() });

  it("keeps the current game and shows the other tab's edits to it", () => {
    const a = tab(["g1"]);
    a.addSnapshot(snap(2, 1));
    const b = tab([]);
    expect(b.game.id).toBe("g1");
    b.addSnapshot(snap(5, 4));
    const hooks = ui();
    applyForeignWrite(a, hooks);
    expect(a.game.id).toBe("g1");
    expect(a.game.snapshots).toHaveLength(2);
    expect(hooks.showGame).toHaveBeenCalledTimes(1);
    expect(hooks.resetPlaceLookup).not.toHaveBeenCalled();
    expect(hooks.refreshHistory).toHaveBeenCalledTimes(1);
  });

  it("does not redraw the sheet when the current game is unchanged", () => {
    const a = tab(["g1"]);
    a.addSnapshot(snap(2, 1));
    const hooks = ui();
    applyForeignWrite(a, hooks);
    expect(hooks.showGame).not.toHaveBeenCalled();
    expect(hooks.refreshHistory).toHaveBeenCalledTimes(1);
  });

  it("starts a fresh empty game when the current one was deleted elsewhere", () => {
    const a = tab(["g1", "fresh"]);
    a.addSnapshot(snap(2, 1));
    const b = tab([]);
    b.remove("g1");
    const hooks = ui();
    applyForeignWrite(a, hooks);
    expect(a.game.id).not.toBe("g1");
    expect(a.game.snapshots).toEqual([]);
    expect(hooks.resetPlaceLookup).toHaveBeenCalledTimes(1);
    expect(hooks.showGame).toHaveBeenCalledTimes(1);
  });

  it("sees games created in the other tab in the history", () => {
    const a = tab(["g1"]);
    a.addSnapshot(snap(2, 1));
    const b = tab([]);
    b.startGame({ createdAt: new Date(), homeName: "", awayName: "" });
    b.addSnapshot(snap(3, 3));
    applyForeignWrite(a, ui());
    expect(a.history()).toHaveLength(2);
  });

  it("recovers from corrupt foreign data with a fresh game", () => {
    const a = tab(["g1", "fresh"]);
    a.addSnapshot(snap(2, 1));
    localStorage.setItem(STORAGE_KEY, "{not json");
    applyForeignWrite(a, ui());
    expect(a.game.snapshots).toEqual([]);
    expect(a.history()).toEqual([]);
  });

  it("end to end: a storage event refreshes the view and leaves an open new-game form alone", () => {
    const a = tab(["g1"]);
    a.addSnapshot(snap(2, 1));
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    const view = mountView(root, spies());
    view.render(a.game, []);
    view.showScreen("new");
    view.openNewForm("2026-05-06T07:08");
    type($(root, "#n-home") as HTMLInputElement, "Lakers");

    const b = tab([]);
    b.addSnapshot(snap(9, 8));
    watchStorage(window, localStorage, () =>
      applyForeignWrite(a, {
        resetPlaceLookup() {},
        showGame: () => view.render(a.game, []),
        refreshHistory: () => view.renderHistory(a.history()),
      }),
    );
    fireStorage();

    expect(root.querySelectorAll(".log tbody tr")).toHaveLength(2);
    expect(($(root, "#n-home") as HTMLInputElement).value).toBe("Lakers");
    expect($(root, "#newgame").hidden).toBe(false);
  });
});

describe("store.reload", () => {
  it("reports whether the current game changed", () => {
    const a = tab(["g1"]);
    a.persist();
    expect(a.reload()).toBe(false);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        currentId: "g1",
        games: [{ ...newGame("g1", new Date("2026-03-04T05:06:07.000Z")), homeName: "Other" }],
      }),
    );
    expect(a.reload()).toBe(true);
    expect(a.game.homeName).toBe("Other");
  });

  it("does not write anything", () => {
    const a = tab(["g1"]);
    a.reload();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

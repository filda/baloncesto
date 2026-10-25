import type { Snapshot } from "../domain/predict";
import type { Coords } from "./geo";
import {
  DEFAULT_AWAY_NAME,
  DEFAULT_HOME_NAME,
  addSnapshot,
  consolidateSnapshots,
  createGame,
  newGame,
  normalizeTeamName,
  removeSnapshotAt,
  withLocation,
} from "./match";
import type { Game, NewGameInput, Side } from "./match";
import {
  deleteGame,
  findGame,
  listHistory,
  loadState,
  saveState,
  setCurrent,
  upsertGame,
} from "./storage";
import type { AppState, KeyValueStorage } from "./storage";

export interface StoreDeps {
  storage: KeyValueStorage | null;
  now: () => Date;
  newId: () => string;
  /** Called with the outcome of every write (false: nothing could be stored). */
  onSave?: (saved: boolean) => void;
}

export interface Store {
  readonly state: AppState;
  /** The game being edited; always defined (a fresh empty game when nothing is stored). */
  readonly game: Game;
  /** The stored current game at creation time, if there was one (used to decide the start screen). */
  readonly restored: Game | undefined;
  /** Writes the state; returns false when nothing could be stored. */
  persist(): boolean;
  /** Makes `next` the current game; an empty previous game is dropped. */
  switchTo(next: Game): void;
  /** Starts a new game from the form values (id from the store). */
  startGame(input: Omit<NewGameInput, "id">): void;
  /** Opens a stored game; false when it does not exist. */
  open(id: string): boolean;
  /** Deletes a stored game; returns true when it was the current one (replaced by a fresh game). */
  remove(id: string): boolean;
  addSnapshot(snapshot: Snapshot): void;
  removeSnapshot(index: number): void;
  /** Drops repeated-score entries (see consolidateSnapshots); writes only when something changed. */
  consolidate(): void;
  setTeamName(side: Side, value: string): void;
  setLocation(coords: Coords, place: string | undefined): void;
  /**
   * Re-reads the stored state after a write by another tab. The current game is kept (in its
   * stored version) if it still exists, otherwise replaced by a fresh empty game. Nothing is
   * written. Returns true when the current game differs from before.
   */
  reload(): boolean;
  /** Games with at least one snapshot, newest first. */
  history(): Game[];
}

export function createStore(deps: StoreDeps): Store {
  const fresh = () => newGame(deps.newId(), deps.now());
  let state = loadState(deps.storage);
  const restored = findGame(state, state.currentId) ?? undefined;
  let game: Game = restored ?? fresh();

  // Persistence rule: the current game is always written (names and place survive a reload even
  // before the first snapshot); the history only lists games with snapshots. An empty game that
  // is replaced by another one (new game, opened game) is simply dropped.
  function persist(): boolean {
    state = setCurrent(upsertGame(state, game), game.id);
    const saved = saveState(deps.storage, state);
    deps.onSave?.(saved);
    return saved;
  }

  function update(next: Game): void {
    game = next;
    persist();
  }

  function switchTo(next: Game): void {
    if (game.snapshots.length === 0 && game.id !== next.id) state = deleteGame(state, game.id);
    update(next);
  }

  return {
    get state() {
      return state;
    },
    get game() {
      return game;
    },
    restored,
    persist,
    switchTo,
    startGame(input) {
      switchTo(createGame({ ...input, id: deps.newId() }));
    },
    open(id) {
      const opened = findGame(state, id);
      if (!opened) return false;
      switchTo(opened);
      return true;
    },
    remove(id) {
      state = deleteGame(state, id);
      const wasCurrent = game.id === id;
      if (wasCurrent) game = fresh();
      persist();
      return wasCurrent;
    },
    addSnapshot(snapshot) {
      update(addSnapshot(game, snapshot));
    },
    removeSnapshot(index) {
      update(removeSnapshotAt(game, index));
    },
    consolidate() {
      const next = consolidateSnapshots(game);
      if (next !== game) update(next);
    },
    setTeamName(side, value) {
      update(
        side === "home"
          ? { ...game, homeName: normalizeTeamName(value, DEFAULT_HOME_NAME) }
          : { ...game, awayName: normalizeTeamName(value, DEFAULT_AWAY_NAME) },
      );
    },
    setLocation(coords, place) {
      update(withLocation(game, coords, place));
    },
    reload() {
      const before = game;
      state = loadState(deps.storage);
      game = findGame(state, before.id) ?? fresh();
      return JSON.stringify(game) !== JSON.stringify(before);
    },
    history() {
      return listHistory(state);
    },
  };
}

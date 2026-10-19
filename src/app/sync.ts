import { STORAGE_KEY } from "./storage";
import type { KeyValueStorage } from "./storage";
import type { Store } from "./store";

/**
 * Calls `onForeignWrite` when another tab changes the app's stored state (the `storage` event
 * never fires in the tab that wrote). A cleared storage (`key === null`) counts as a change.
 * Returns a function that stops listening.
 */
export function watchStorage(
  target: Pick<Window, "addEventListener" | "removeEventListener">,
  storage: KeyValueStorage | null,
  onForeignWrite: () => void,
): () => void {
  if (!storage) return () => {};
  const listener = (event: StorageEvent): void => {
    if (event.storageArea !== null && event.storageArea !== storage) return;
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    onForeignWrite();
  };
  target.addEventListener("storage", listener);
  return () => target.removeEventListener("storage", listener);
}

export interface ForeignWriteUi {
  /** The current game was replaced by another one (deleted elsewhere). */
  resetPlaceLookup(): void;
  /** The current game's content changed: redraw the sheet and its inputs. */
  showGame(): void;
  /** Redraws the history list when it is on screen. */
  refreshHistory(): void;
}

/** Reloads the store after a foreign write and refreshes what is on screen; the form stays open. */
export function applyForeignWrite(store: Pick<Store, "game" | "reload">, ui: ForeignWriteUi): void {
  const id = store.game.id;
  const changed = store.reload();
  if (store.game.id !== id) ui.resetPlaceLookup();
  if (changed) ui.showGame();
  ui.refreshHistory();
}

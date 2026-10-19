import { mountBanner } from "./banner";

export const STORAGE_WARNING = "NOT SAVED — STORAGE UNAVAILABLE";

export interface StorageBanner {
  /** Reports the outcome of a save: a failure shows the warning (once), a success hides it. */
  report(saved: boolean): void;
}

/**
 * A persistent warning that games are not being stored. DISMISS hides it, but the next failed
 * save shows it again, because unsaved scores are lost on reload.
 */
export function createStorageBanner(parent: HTMLElement): StorageBanner {
  let banner: HTMLElement | null = null;
  return {
    report(saved) {
      if (saved) {
        banner?.remove();
        banner = null;
      } else if (!banner?.isConnected) {
        banner = mountBanner(parent, "storage-banner", STORAGE_WARNING, [
          { label: "DISMISS", onClick: (node) => node.remove() },
        ]);
      }
    },
  };
}

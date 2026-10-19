import { mountBanner } from "./banner";

/** Shows the "new version available" strip; LATER dismisses it, RELOAD applies the update. */
export function mountUpdateBanner(parent: HTMLElement, onReload: () => void): HTMLElement {
  return mountBanner(parent, "update-banner", "NEW VERSION AVAILABLE", [
    { label: "RELOAD", onClick: onReload },
    { label: "LATER", onClick: (banner) => banner.remove() },
  ]);
}

/** Shows the "new version available" strip; LATER dismisses it, RELOAD applies the update. */
export function mountUpdateBanner(parent: HTMLElement, onReload: () => void): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "update-banner printed";
  banner.setAttribute("role", "status");

  const text = document.createElement("p");
  text.textContent = "NEW VERSION AVAILABLE";

  const reload = document.createElement("button");
  reload.type = "button";
  reload.textContent = "RELOAD";
  reload.addEventListener("click", onReload);

  const later = document.createElement("button");
  later.type = "button";
  later.textContent = "LATER";
  later.addEventListener("click", () => banner.remove());

  banner.append(text, reload, later);
  parent.append(banner);
  return banner;
}

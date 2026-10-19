export interface BannerAction {
  label: string;
  onClick(banner: HTMLElement): void;
}

/** The fixed strip at the bottom of the page that stacks all banners; created on first use. */
export function bannerHost(parent: HTMLElement): HTMLElement {
  const existing = parent.querySelector<HTMLElement>(":scope > .banner-host");
  if (existing) return existing;
  const host = document.createElement("div");
  host.className = "banner-host";
  parent.append(host);
  return host;
}

/** A printed strip with a message and buttons, appended to the banner host of `parent`. */
export function mountBanner(
  parent: HTMLElement,
  className: string,
  message: string,
  actions: BannerAction[],
): HTMLElement {
  const banner = document.createElement("div");
  banner.className = `banner ${className} printed`;
  banner.setAttribute("role", "status");

  const text = document.createElement("p");
  text.textContent = message;
  banner.append(text);

  for (const action of actions) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.addEventListener("click", () => action.onClick(banner));
    banner.append(button);
  }
  bannerHost(parent).append(banner);
  return banner;
}

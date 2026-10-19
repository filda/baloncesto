// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_WARNING, createStorageBanner } from "../../src/app/storage-banner";
import { mountUpdateBanner } from "../../src/app/update-banner";
import { click } from "./helpers";

beforeEach(() => {
  document.body.replaceChildren();
});

const banners = (selector = ".banner") => document.body.querySelectorAll(selector);
const buttons = (banner: Element) => [...banner.querySelectorAll("button")];

describe("storage banner", () => {
  it("shows nothing while saves succeed", () => {
    const banner = createStorageBanner(document.body);
    banner.report(true);
    expect(banners()).toHaveLength(0);
  });

  it("shows the warning after a failed save", () => {
    createStorageBanner(document.body).report(false);
    const [node] = banners(".storage-banner");
    expect(node?.querySelector("p")?.textContent).toBe("NOT SAVED — STORAGE UNAVAILABLE");
    expect(STORAGE_WARNING).toBe("NOT SAVED — STORAGE UNAVAILABLE");
    expect(node?.getAttribute("role")).toBe("status");
  });

  it("does not stack duplicates on repeated failures", () => {
    const banner = createStorageBanner(document.body);
    banner.report(false);
    banner.report(false);
    banner.report(false);
    expect(banners(".storage-banner")).toHaveLength(1);
  });

  it("hides the warning after a later successful save and shows it again on a new failure", () => {
    const banner = createStorageBanner(document.body);
    banner.report(false);
    banner.report(true);
    expect(banners(".storage-banner")).toHaveLength(0);
    banner.report(false);
    expect(banners(".storage-banner")).toHaveLength(1);
  });

  it("can be dismissed and reappears on the next failed save", () => {
    const banner = createStorageBanner(document.body);
    banner.report(false);
    const [node] = banners(".storage-banner");
    const [dismiss] = buttons(node as Element);
    expect(dismiss?.textContent).toBe("DISMISS");
    click(dismiss as Element);
    expect(banners(".storage-banner")).toHaveLength(0);
    banner.report(true);
    banner.report(false);
    expect(banners(".storage-banner")).toHaveLength(1);
    banner.report(false);
    expect(banners(".storage-banner")).toHaveLength(1);
  });

  it("reappears after being dismissed even without an intervening success", () => {
    const banner = createStorageBanner(document.body);
    banner.report(false);
    click(buttons(banners(".storage-banner")[0] as Element)[0] as Element);
    banner.report(false);
    expect(banners(".storage-banner")).toHaveLength(1);
  });
});

describe("update banner", () => {
  it("reloads and dismisses through its buttons", () => {
    const onReload = vi.fn();
    const node = mountUpdateBanner(document.body, onReload);
    expect(node.querySelector("p")?.textContent).toBe("NEW VERSION AVAILABLE");
    const [reload, later] = buttons(node);
    expect(reload?.textContent).toBe("RELOAD");
    expect(later?.textContent).toBe("LATER");
    click(reload as Element);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(node.isConnected).toBe(true);
    click(later as Element);
    expect(node.isConnected).toBe(false);
  });

  it("stacks with the storage banner in one host", () => {
    mountUpdateBanner(document.body, () => {});
    createStorageBanner(document.body).report(false);
    expect(document.body.querySelectorAll(".banner-host")).toHaveLength(1);
    expect(banners()).toHaveLength(2);
  });
});

// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { mountView } from "../../src/app/view";
import type { View } from "../../src/app/view";
import { $, click, gameWith, spies } from "./helpers";

let handlers: ReturnType<typeof spies>;
let view: View;
let root: HTMLElement;

beforeEach(() => {
  handlers = spies();
  root = document.createElement("div");
  document.body.replaceChildren(root);
  view = mountView(root, handlers);
});

const visible = (selector: string) => !$(root, selector).hidden;

describe("mountView", () => {
  it("fills only the container it is given and keeps other siblings alone", () => {
    const parent = document.createElement("div");
    const container = document.createElement("div");
    const footer = document.createElement("footer");
    parent.append(container, footer);
    mountView(container, handlers);
    expect(parent.lastElementChild).toBe(footer);
    expect(footer.childElementCount).toBe(0);
    expect(container.querySelector("header")).not.toBeNull();
  });

  it("starts on the sheet", () => {
    expect(visible("#estimate")).toBe(true);
    expect(visible("#history")).toBe(false);
    expect(visible("#newgame")).toBe(false);
    expect(visible("#btn-new")).toBe(true);
    expect(visible("#btn-history")).toBe(true);
    expect(visible("#btn-back")).toBe(false);
  });

  it("switches between the screens", () => {
    view.showScreen("history");
    expect(visible("#estimate")).toBe(false);
    expect(visible("#history")).toBe(true);
    expect(visible("#newgame")).toBe(false);
    expect(visible("#btn-new")).toBe(false);
    expect(visible("#btn-history")).toBe(false);
    expect(visible("#btn-back")).toBe(true);

    view.showScreen("new");
    expect(visible("#estimate")).toBe(false);
    expect(visible("#history")).toBe(false);
    expect(visible("#newgame")).toBe(true);
    expect(visible("#btn-new")).toBe(false);
    expect(visible("#btn-history")).toBe(false);
    expect(visible("#btn-back")).toBe(false);

    view.showScreen("sheet");
    expect(visible("#estimate")).toBe(true);
    expect(visible("#history")).toBe(false);
    expect(visible("#newgame")).toBe(false);
    expect(visible("#btn-new")).toBe(true);
  });

  it("wires the navigation buttons", () => {
    click($(root, "#btn-new"));
    click($(root, "#btn-history"));
    click($(root, "#btn-back"));
    expect(handlers.onNew).toHaveBeenCalledTimes(1);
    expect(handlers.onHistory).toHaveBeenCalledTimes(1);
    expect(handlers.onBack).toHaveBeenCalledTimes(1);
  });

  it("delegates rendering to the sub-views", () => {
    const game = gameWith([{ period: 1, remaining: 300, home: 10, away: 8 }], "g1", {
      homeName: "Lakers",
    });
    view.render(game, []);
    view.renderHistory([game]);
    view.setInput({ period: "2", clock: "9:00", home: "11", away: "9" });
    view.openNewForm("2026-05-06T07:08");
    view.setLocationStatus("located");
    view.setPlaceStatus("locating");
    view.suggestPlace("Brno");
    expect($<HTMLInputElement>(root, "#f-home-name").value).toBe("Lakers");
    expect(root.querySelectorAll(".history-row")).toHaveLength(1);
    expect($<HTMLInputElement>(root, "#f-period").value).toBe("2");
    expect($<HTMLInputElement>(root, "#n-datetime").value).toBe("2026-05-06T07:08");
    expect($(root, "#location-status").textContent).toBe("Located");
    expect($(root, "#btn-add-place").textContent).toBe("Locating…");
    expect($<HTMLInputElement>(root, "#n-place").value).toBe("Brno");
    view.focusHome();
    expect(document.activeElement).toBe($(root, "#f-home"));
  });
});

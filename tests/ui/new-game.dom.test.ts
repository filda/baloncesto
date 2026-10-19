// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { mountNewGame } from "../../src/app/view/new-game";
import type { NewGameView } from "../../src/app/view/new-game";
import { $, attach, click, spies, submit, type } from "./helpers";

let handlers: ReturnType<typeof spies>;
let form: NewGameView;
let root: HTMLElement;

beforeEach(() => {
  handlers = spies();
  form = mountNewGame(handlers);
  root = attach(form.node);
});

const field = (id: string) => $<HTMLInputElement>(root, `#n-${id}`);

describe("new game form", () => {
  it("starts hidden and toggles", () => {
    expect(form.node.hidden).toBe(true);
    form.setHidden(false);
    expect(form.node.hidden).toBe(false);
    form.setHidden(true);
    expect(form.node.hidden).toBe(true);
  });

  it("uses the default team names as placeholders", () => {
    expect(field("home").placeholder).toBe("Home");
    expect(field("away").placeholder).toBe("Away");
    expect(field("home").maxLength).toBe(24);
    expect(field("away").maxLength).toBe(24);
  });

  it("open resets all fields and sets the date", () => {
    field("home").value = "x";
    field("away").value = "y";
    field("place").value = "z";
    form.open("2026-05-06T07:08");
    expect(field("home").value).toBe("");
    expect(field("away").value).toBe("");
    expect(field("place").value).toBe("");
    expect(field("datetime").value).toBe("2026-05-06T07:08");
  });

  it("submits the raw values without a native submit", () => {
    form.open("2026-05-06T07:08");
    field("home").value = "Lakers";
    field("away").value = "Celtics";
    field("place").value = "Brno";
    const event = submit($(root, "form"));
    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onStart).toHaveBeenCalledWith({
      homeName: "Lakers",
      awayName: "Celtics",
      dateTime: "2026-05-06T07:08",
      place: "Brno",
    });
  });

  it("cancel calls the handler", () => {
    click($(root, "#btn-cancel"));
    expect(handlers.onCancel).toHaveBeenCalledTimes(1);
    expect(handlers.onStart).not.toHaveBeenCalled();
  });

  it("shows the location status text", () => {
    form.setLocationStatus("locating");
    expect($(root, "#location-status").textContent).toBe("Locating…");
    expect($(root, "#location-status").dataset.status).toBe("locating");
    form.setLocationStatus("located");
    expect($(root, "#location-status").textContent).toBe("Located");
  });

  it("suggests a place only until the user has typed one", () => {
    form.suggestPlace("Brno");
    expect(field("place").value).toBe("Brno");
    type(field("place"), "My gym");
    form.suggestPlace("Prague");
    expect(field("place").value).toBe("My gym");
  });

  it("allows suggestions again after the form is reopened", () => {
    type(field("place"), "My gym");
    form.open("2026-05-06T07:08");
    form.suggestPlace("Brno");
    expect(field("place").value).toBe("Brno");
  });
});

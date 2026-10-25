// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountSheet } from "../../src/app/view/sheet";
import type { SheetView } from "../../src/app/view/sheet";
import { $, attach, click, gameWith, spies, submit, type } from "./helpers";

let handlers: ReturnType<typeof spies>;
let sheet: SheetView;
let root: HTMLElement;

beforeEach(() => {
  handlers = spies();
  sheet = mountSheet(handlers);
  root = attach(...sheet.nodes);
});

const input = (id: string) => $<HTMLInputElement>(root, `#f-${id}`);
const logRows = () => [...root.querySelectorAll("tbody tr")];
const cells = (row: Element) => [...row.querySelectorAll("td")].map((td) => td.textContent);

const entries = [
  { period: 1, remaining: 400, home: 10, away: 8 },
  { period: 1, remaining: 300, home: 14, away: 12 },
  { period: 2, remaining: 500, home: 20, away: 18 },
];

describe("render", () => {
  it("shows team names, the info line and an empty log for a new game", () => {
    sheet.render(gameWith([], "g1", { homeName: "Lakers", awayName: "Celtics" }), []);
    expect($<HTMLInputElement>(root, "#f-home-name").value).toBe("Lakers");
    expect($<HTMLInputElement>(root, "#f-away-name").value).toBe("Celtics");
    expect(root.querySelector('label[for="f-home"]')?.textContent).toBe("Lakers");
    expect(root.querySelector('label[for="f-away"]')?.textContent).toBe("Celtics");
    expect($(root, ".sheet-info-text").textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    expect($(root, ".log").hidden).toBe(true);
    expect(logRows()).toHaveLength(0);
  });

  it("lists the log newest first with formatted values", () => {
    sheet.render(gameWith(entries), []);
    expect($(root, ".log").hidden).toBe(false);
    const rows = logRows();
    expect(rows).toHaveLength(3);
    expect(cells(rows[0] as Element)).toEqual(["3", "2", "8:20", "20", "18", "×"]);
    expect(cells(rows[2] as Element)).toEqual(["1", "1", "6:40", "10", "8", "×"]);
  });

  it("shows the place in the info line and hides the add-place button", () => {
    sheet.render(gameWith([], "g1", { location: { place: "Brno gym" } }), []);
    expect($(root, ".sheet-info-text").textContent).toContain("· Brno gym");
    expect($(root, "#btn-add-place").hidden).toBe(true);
  });

  it("offers adding a place when none is known and reflects the lookup status", () => {
    sheet.render(gameWith([]), []);
    const add = $<HTMLButtonElement>(root, "#btn-add-place");
    expect(add.hidden).toBe(false);
    expect(add.textContent).toBe("+ Add place");
    expect(add.disabled).toBe(false);
    sheet.setPlaceStatus("locating");
    expect(add.textContent).toBe("Locating…");
    expect(add.disabled).toBe(true);
    sheet.setPlaceStatus("unavailable");
    expect(add.textContent).toBe("Location unavailable · retry");
    expect(add.disabled).toBe(false);
    sheet.setPlaceStatus(null);
    expect(add.textContent).toBe("+ Add place");
    click(add);
    expect(handlers.onAddPlace).toHaveBeenCalledTimes(1);
  });

  it("shows a dash for both sides while there is no prediction", () => {
    sheet.render(gameWith([]), []);
    expect($(root, ".estimate .hand.home").textContent).toBe("—");
    expect($(root, ".estimate .hand.away").textContent).toBe("—");
    expect($(root, ".estimate .colon").hidden).toBe(false);
    expect($(root, ".estimate-score").textContent).toBe("— : —");
  });

  it("returns to dashes when the last entry is removed", () => {
    sheet.render(gameWith(entries), []);
    sheet.render(gameWith([]), []);
    expect($(root, ".estimate-score").textContent).toBe("— : —");
  });

  it("shows a projected final once there is an entry", () => {
    sheet.render(gameWith(entries), []);
    const text = $(root, ".estimate-score").textContent ?? "";
    expect(text).toMatch(/^\d+ : \d+$/);
  });
});

describe("errors", () => {
  const errors = [
    { field: "clock" as const, message: "Enter time as m:ss." },
    { field: "form" as const, message: "Scores cannot decrease." },
  ];

  it("shows field errors with aria wiring and the form error", () => {
    sheet.render(gameWith([]), errors);
    expect($(root, "#f-clock-error").textContent).toBe("Enter time as m:ss.");
    expect(input("clock").getAttribute("aria-invalid")).toBe("true");
    expect(input("clock").getAttribute("aria-describedby")).toBe("f-clock-error");
    expect(input("period").hasAttribute("aria-invalid")).toBe(false);
    expect(input("period").hasAttribute("aria-describedby")).toBe(false);
    expect($(root, "#form-error").textContent).toBe("Scores cannot decrease.");
  });

  it("clears everything on the next render without errors", () => {
    sheet.render(gameWith([]), errors);
    sheet.render(gameWith([]), []);
    expect($(root, "#f-clock-error").textContent).toBe("");
    expect(input("clock").hasAttribute("aria-invalid")).toBe(false);
    expect(input("clock").hasAttribute("aria-describedby")).toBe(false);
    expect($(root, "#form-error").textContent).toBe("");
  });

  it("clears the form error when the user types", () => {
    sheet.render(gameWith([]), errors);
    type(input("home"), "5");
    expect($(root, "#form-error").textContent).toBe("");
  });
});

describe("submit flow", () => {
  it("prevents the native submit and passes the raw values on", () => {
    sheet.setInput({ period: "1", clock: "10:00", home: "0", away: "0" });
    input("home").value = "12";
    input("away").value = "9";
    const event = submit($(root, "form.entry"));
    expect(event.defaultPrevented).toBe(true);
    expect(handlers.onSubmit).toHaveBeenCalledWith({
      period: "1",
      clock: "10:00",
      home: "12",
      away: "9",
    });
  });

  it("completes an unfinished clock before submitting", () => {
    sheet.setInput({ period: "1", clock: "4:4", home: "1", away: "2" });
    submit($(root, "form.entry"));
    expect(input("clock").value).toBe("4:40");
    expect(handlers.onSubmit.mock.calls[0]?.[0].clock).toBe("4:40");
  });

  it("setInput fills all four fields", () => {
    sheet.setInput({ period: "3", clock: "2:15", home: "40", away: "38" });
    expect(
      [input("period"), input("clock"), input("home"), input("away")].map((i) => i.value),
    ).toEqual(["3", "2:15", "40", "38"]);
  });

  it("focusEntry focuses and selects the home score until another input was used", () => {
    sheet.setInput({ period: "1", clock: "10:00", home: "17", away: "0" });
    sheet.focusEntry();
    expect(document.activeElement).toBe(input("home"));
    expect(input("home").selectionStart).toBe(0);
    expect(input("home").selectionEnd).toBe(2);
  });

  it("focusEntry returns to the input used last, after focus moved to the button", () => {
    input("clock").focus();
    $(root, "#btn-record").focus();
    sheet.setInput({ period: "1", clock: "9:30", home: "17", away: "0" });
    sheet.focusEntry();
    expect(document.activeElement).toBe(input("clock"));
    expect(input("clock").selectionStart).toBe(0);
    expect(input("clock").selectionEnd).toBe(4);
  });
});

describe("clock input", () => {
  it("formats digits into m:ss while typing", () => {
    const clock = input("clock");
    type(clock, "1000");
    expect(clock.value).toBe("10:00");
    type(clock, "530");
    expect(clock.value).toBe("5:30");
    type(clock, "5a");
    expect(clock.value).toBe("5");
    type(clock, "123456");
    expect(clock.value).toBe("12:34");
  });

  it("leaves an already formatted value untouched", () => {
    const clock = input("clock");
    type(clock, "5:30");
    expect(clock.value).toBe("5:30");
  });

  it("moves the caret to the end after reformatting", () => {
    const clock = input("clock");
    type(clock, "530");
    expect(clock.selectionStart).toBe(4);
    expect(clock.selectionEnd).toBe(4);
  });

  it("completes the time on blur", () => {
    const clock = input("clock");
    type(clock, "44");
    clock.value = "4:4";
    clock.dispatchEvent(new Event("blur"));
    expect(clock.value).toBe("4:40");
    clock.value = "7";
    clock.dispatchEvent(new Event("blur"));
    expect(clock.value).toBe("7:00");
  });
});

describe("log delete", () => {
  it("calls the handler with the chronological index of the clicked row", () => {
    sheet.render(gameWith(entries), []);
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("button.log-delete")];
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Delete entry 3",
      "Delete entry 2",
      "Delete entry 1",
    ]);
    click(buttons[0] as HTMLElement);
    expect(handlers.onRemoveEntry).toHaveBeenLastCalledWith(2);
    click(buttons[2] as HTMLElement);
    expect(handlers.onRemoveEntry).toHaveBeenLastCalledWith(0);
    click(buttons[1] as HTMLElement);
    expect(handlers.onRemoveEntry).toHaveBeenLastCalledWith(1);
    expect(handlers.onRemoveEntry).toHaveBeenCalledTimes(3);
  });
});

describe("log consolidate", () => {
  const repeated = [
    { period: 1, remaining: 400, home: 10, away: 8 },
    { period: 1, remaining: 350, home: 10, away: 8 },
    { period: 1, remaining: 300, home: 10, away: 8 },
    { period: 2, remaining: 500, home: 20, away: 18 },
  ];
  const box = () => $(root, ".log-consolidate");
  const confirm = () => $(root, ".log-confirm");

  it("is hidden when no score repeats", () => {
    sheet.render(gameWith(entries), []);
    expect(box().hidden).toBe(true);
  });

  it("sits below the log table and shows the number of entries to remove", () => {
    sheet.render(gameWith(repeated), []);
    expect(box().hidden).toBe(false);
    expect($(root, ".log table").nextElementSibling).toBe(box());
    expect($(root, "#btn-consolidate").textContent).toBe("Remove repeated scores (2)");
    expect(confirm().hidden).toBe(true);
  });

  it("asks before removing and calls the handler on confirm", () => {
    sheet.render(gameWith(repeated), []);
    click($(root, "#btn-consolidate"));
    expect(confirm().hidden).toBe(false);
    expect($(root, ".log-confirm-text").textContent).toBe(
      "REMOVE 2 ENTRIES WITH A REPEATED SCORE?",
    );
    expect(document.activeElement).toBe($(root, ".log-consolidate-keep"));
    expect(handlers.onConsolidate).not.toHaveBeenCalled();
    click($(root, ".log-consolidate-remove"));
    expect(handlers.onConsolidate).toHaveBeenCalledTimes(1);
  });

  it("keeps the entries when the user backs out", () => {
    sheet.render(gameWith(repeated), []);
    click($(root, "#btn-consolidate"));
    click($(root, ".log-consolidate-keep"));
    expect(confirm().hidden).toBe(true);
    expect(document.activeElement).toBe($(root, "#btn-consolidate"));
    expect(handlers.onConsolidate).not.toHaveBeenCalled();
  });

  it("uses the singular for one entry and closes the confirm on re-render", () => {
    sheet.render(gameWith(repeated.slice(1)), []);
    click($(root, "#btn-consolidate"));
    expect($(root, ".log-confirm-text").textContent).toBe("REMOVE 1 ENTRY WITH A REPEATED SCORE?");
    sheet.render(gameWith(repeated.slice(1)), []);
    expect(confirm().hidden).toBe(true);
  });
});

describe("team names", () => {
  it("reports changes per side", () => {
    const home = $<HTMLInputElement>(root, "#f-home-name");
    home.value = "Lakers";
    home.dispatchEvent(new Event("change"));
    expect(handlers.onTeamName).toHaveBeenLastCalledWith("home", "Lakers");
    const away = $<HTMLInputElement>(root, "#f-away-name");
    away.value = "Celtics";
    away.dispatchEvent(new Event("change"));
    expect(handlers.onTeamName).toHaveBeenLastCalledWith("away", "Celtics");
  });
});

describe("visibility", () => {
  it("hides and shows all sheet nodes together", () => {
    sheet.setHidden(true);
    expect(sheet.nodes.every((n) => n.hidden)).toBe(true);
    sheet.setHidden(false);
    expect(sheet.nodes.every((n) => !n.hidden)).toBe(true);
  });
});

describe("chart", () => {
  it("renders into the chart container without throwing when it has no size", () => {
    const spy = vi.spyOn(console, "error");
    sheet.render(gameWith(entries), []);
    expect(spy).not.toHaveBeenCalled();
    expect($(root, "#chart")).toBeTruthy();
  });
});

describe("projected range", () => {
  const range = () => $(root, ".estimate-range");

  it("is hidden until there is a prediction", () => {
    sheet.render(gameWith([]), []);
    expect(range().hidden).toBe(true);
  });

  it("shows both ranges under the projected final, below the numbers", () => {
    sheet.render(gameWith([{ period: 3, remaining: 432, home: 48, away: 45 }]), []);
    expect($(root, ".estimate-score").textContent).toBe("83 : 78");
    expect(range().hidden).toBe(false);
    expect(range().textContent).toBe("48–94 · 45–91");
    expect($(range(), ".home").textContent).toBe("48–94");
    expect($(range(), ".away").textContent).toBe("45–91");
  });

  it("shows the prior once the first entry is a 0:00 snapshot", () => {
    sheet.render(gameWith([{ period: 1, remaining: 600, home: 0, away: 0 }]), []);
    expect($(root, ".estimate-score").textContent).toBe("72 : 72");
    expect(range().textContent).toBe("0–108 · 0–108");
  });

  it("hides again when the last entry is removed", () => {
    sheet.render(gameWith(entries), []);
    expect(range().hidden).toBe(false);
    sheet.render(gameWith([]), []);
    expect(range().hidden).toBe(true);
  });
});

describe("win probability", () => {
  const win = () => $(root, ".estimate-win");

  it("is hidden until there is a prediction", () => {
    sheet.render(gameWith([]), []);
    expect(win().hidden).toBe(true);
  });

  it("shows both teams' chances under the range", () => {
    sheet.render(gameWith([{ period: 3, remaining: 432, home: 48, away: 45 }]), []);
    expect(win().hidden).toBe(false);
    expect($(root, ".estimate-range").nextElementSibling).toBe(win());
    expect(win().textContent).toBe("Win 70% · 30%");
    expect($(win(), ".home").textContent).toBe("70%");
    expect($(win(), ".away").textContent).toBe("30%");
  });

  it("caps an undecided game at 99% and shows 100% at the final buzzer", () => {
    sheet.render(gameWith([{ period: 4, remaining: 60, home: 90, away: 60 }]), []);
    expect(win().textContent).toBe("Win 99% · 1%");
    sheet.render(gameWith([{ period: 4, remaining: 0, home: 60, away: 90 }]), []);
    expect(win().textContent).toBe("Win 0% · 100%");
  });

  it("hides again when the last entry is removed", () => {
    sheet.render(gameWith(entries), []);
    expect(win().hidden).toBe(false);
    sheet.render(gameWith([]), []);
    expect(win().hidden).toBe(true);
  });
});

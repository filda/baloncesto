// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { mountHistory } from "../../src/app/view/history";
import type { HistoryView } from "../../src/app/view/history";
import { $, attach, click, gameWith, spies } from "./helpers";

let handlers: ReturnType<typeof spies>;
let history: HistoryView;
let root: HTMLElement;

beforeEach(() => {
  handlers = spies();
  history = mountHistory(handlers);
  root = attach(history.node);
});

const rows = () => [...root.querySelectorAll<HTMLElement>(".history-row")];
const snap = (home: number, away: number) => ({ period: 1, remaining: 300, home, away });

describe("history", () => {
  it("starts hidden and toggles", () => {
    expect(history.node.hidden).toBe(true);
    history.setHidden(false);
    expect(history.node.hidden).toBe(false);
    history.setHidden(true);
    expect(history.node.hidden).toBe(true);
  });

  it("shows a message when there are no games", () => {
    history.render([]);
    expect($(root, ".empty").textContent).toBe("No saved games");
    expect(rows()).toHaveLength(0);
  });

  it("renders a row per game with names, score, count and place", () => {
    history.render([
      gameWith([snap(10, 8), snap(30, 25)], "a", {
        homeName: "Lakers",
        awayName: "Celtics",
        location: { place: "Brno" },
      }),
      gameWith([snap(2, 1)], "b"),
    ]);
    const [first, second] = rows() as [HTMLElement, HTMLElement];
    expect(first.dataset.gameId).toBe("a");
    expect(second.dataset.gameId).toBe("b");
    expect($(first, ".history-names").textContent).toBe("Lakers – Celtics");
    expect($(first, ".history-score .home").textContent).toBe("30");
    expect($(first, ".history-score .away").textContent).toBe("25");
    expect($(first, ".history-count").textContent).toBe("2 entries");
    expect($(second, ".history-count").textContent).toBe("1 entry");
    expect($(first, ".history-place").textContent).toBe("Brno");
    expect(second.querySelector(".history-place")).toBeNull();
    expect($(first, ".history-date").textContent).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it("shows a dash for the score of a game without entries", () => {
    history.render([gameWith([], "z")]);
    expect($(root, ".history-score").textContent).toBe("— : —");
  });

  it("replaces previous rows on re-render", () => {
    history.render([gameWith([snap(1, 1)], "a"), gameWith([snap(1, 1)], "b")]);
    history.render([gameWith([snap(1, 1)], "c")]);
    expect(rows().map((r) => r.dataset.gameId)).toEqual(["c"]);
  });

  it("opens and deletes the game of the clicked row", () => {
    history.render([gameWith([snap(1, 1)], "a"), gameWith([snap(1, 1)], "b")]);
    const second = $(root, '[data-game-id="b"]');
    click($(second, "button.history-open"));
    expect(handlers.onOpen).toHaveBeenCalledWith("b");
    click($(second, "button.history-delete"));
    click($(second, "button.history-confirm-delete"));
    expect(handlers.onDelete).toHaveBeenCalledWith("b");
    click($(root, '[data-game-id="a"] button.history-open'));
    expect(handlers.onOpen).toHaveBeenLastCalledWith("a");
    expect(handlers.onOpen).toHaveBeenCalledTimes(2);
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });

  describe("delete confirmation", () => {
    const setup = () => {
      history.setHidden(false);
      history.render([gameWith([snap(1, 1)], "a"), gameWith([snap(1, 1)], "b")]);
      return $(root, '[data-game-id="a"]');
    };
    const strip = (row: Element) => $(row, ".history-confirm");
    const actions = (row: Element) => $(row, ":scope > .actions");

    it("is hidden until Delete is clicked and never calls the handler by itself", () => {
      const row = setup();
      expect(strip(row).hidden).toBe(true);
      expect(actions(row).hidden).toBe(false);
      click($(row, "button.history-delete"));
      expect(strip(row).hidden).toBe(false);
      expect(actions(row).hidden).toBe(true);
      expect(handlers.onDelete).not.toHaveBeenCalled();
    });

    it("asks DELETE THIS GAME? with DELETE and KEEP buttons", () => {
      const row = setup();
      click($(row, "button.history-delete"));
      expect($(row, ".history-confirm-text").textContent).toBe("DELETE THIS GAME?");
      expect($(row, ".history-confirm-delete").textContent).toBe("DELETE");
      expect($(row, ".history-keep").textContent).toBe("KEEP");
      expect(document.activeElement).toBe($(row, ".history-keep"));
    });

    it("KEEP restores the row buttons without deleting", () => {
      const row = setup();
      click($(row, "button.history-delete"));
      click($(row, ".history-keep"));
      expect(strip(row).hidden).toBe(true);
      expect(actions(row).hidden).toBe(false);
      expect(handlers.onDelete).not.toHaveBeenCalled();
      expect(document.activeElement).toBe($(row, "button.history-delete"));
    });

    it("DELETE calls the handler with the id of its own row", () => {
      const row = setup();
      click($(row, "button.history-delete"));
      click($(row, ".history-confirm-delete"));
      expect(handlers.onDelete).toHaveBeenCalledTimes(1);
      expect(handlers.onDelete).toHaveBeenCalledWith("a");
    });

    it("confirms per row", () => {
      const row = setup();
      const other = $(root, '[data-game-id="b"]');
      click($(row, "button.history-delete"));
      expect(strip(other).hidden).toBe(true);
      expect(actions(other).hidden).toBe(false);
    });
  });
});

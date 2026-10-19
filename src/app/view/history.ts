import { formatDateTime } from "../format";
import { lastSnapshot } from "../match";
import type { Game } from "../match";
import { button, el } from "./dom";

export interface HistoryHandlers {
  onOpen(id: string): void;
  onDelete(id: string): void;
}

export interface HistoryView {
  node: HTMLElement;
  setHidden(hidden: boolean): void;
  render(games: Game[]): void;
}

function scoreText(value: number | undefined): string {
  return value === undefined ? "—" : String(value);
}

export function mountHistory(handlers: HistoryHandlers): HistoryView {
  const history = el("section", "history");
  history.id = "history";
  history.setAttribute("aria-label", "Saved games");
  history.hidden = true;

  function render(games: Game[]): void {
    if (games.length === 0) {
      history.replaceChildren(el("p", "printed empty", "No saved games"));
      return;
    }
    const rows = games.map((game) => {
      const last = lastSnapshot(game);
      const item = el("article", "history-row");
      item.dataset.gameId = game.id;
      const meta = el("p", "history-meta");
      meta.append(
        el("span", "printed history-date", formatDateTime(game.createdAt)),
        el(
          "span",
          "printed history-count",
          `${game.snapshots.length} ${game.snapshots.length === 1 ? "entry" : "entries"}`,
        ),
      );
      const teams = el("p", "history-teams");
      teams.append(
        el("span", "printed history-names", `${game.homeName} – ${game.awayName}`),
        el("span", "hand history-score"),
      );
      const score = teams.lastElementChild as HTMLElement;
      score.append(
        el("span", "home", scoreText(last?.home)),
        " : ",
        el("span", "away", scoreText(last?.away)),
      );
      const place = game.location?.place;
      const placeLine = place ? [el("p", "printed history-place", place)] : [];
      const buttons = el("div", "actions");
      const confirm = el("div", "history-confirm");
      confirm.hidden = true;
      confirm.setAttribute("role", "group");
      confirm.setAttribute("aria-label", "Confirm delete");
      const ask = (asking: boolean): void => {
        buttons.hidden = asking;
        confirm.hidden = !asking;
      };
      const deleteButton = button("history-delete secondary", "Delete", () => {
        ask(true);
        keepButton.focus();
      });
      const keepButton = button("history-keep primary", "KEEP", () => {
        ask(false);
        deleteButton.focus();
      });
      const confirmButtons = el("div", "actions");
      confirmButtons.append(
        button("history-confirm-delete secondary", "DELETE", () => handlers.onDelete(game.id)),
        keepButton,
      );
      confirm.append(el("p", "printed history-confirm-text", "DELETE THIS GAME?"), confirmButtons);
      buttons.append(
        button("history-open primary", "Open", () => handlers.onOpen(game.id)),
        deleteButton,
      );
      item.append(meta, teams, ...placeLine, buttons, confirm);
      return item;
    });
    history.replaceChildren(...rows);
  }

  return {
    node: history,
    setHidden(hidden) {
      history.hidden = hidden;
    },
    render,
  };
}

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
      buttons.append(
        button("history-open primary", "Open", () => handlers.onOpen(game.id)),
        button("history-delete secondary", "Delete", () => handlers.onDelete(game.id)),
      );
      item.append(meta, teams, ...placeLine, buttons);
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

import type { FieldError, SnapshotInput } from "../../domain/validate";
import type { LocationStatus } from "../geo";
import type { Game, Side } from "../match";
import { button, el } from "./dom";
import { mountHistory } from "./history";
import type { HistoryHandlers } from "./history";
import { mountNewGame } from "./new-game";
import type { NewGameForm, NewGameHandlers } from "./new-game";
import { mountSheet } from "./sheet";
import type { SheetHandlers } from "./sheet";

export type { NewGameForm, Side };

export interface NavHandlers {
  onNew(): void;
  onHistory(): void;
  onBack(): void;
}

export type ViewHandlers = SheetHandlers & HistoryHandlers & NewGameHandlers & NavHandlers;

export type Screen = "sheet" | "history" | "new";

export interface View {
  render(game: Game, errors: FieldError[]): void;
  renderHistory(games: Game[]): void;
  showScreen(screen: Screen): void;
  setInput(input: SnapshotInput): void;
  /** Resets the new-game form (empty names and place, given date and time). */
  openNewForm(dateTime: string): void;
  setLocationStatus(status: LocationStatus): void;
  /** Status of the "+ ADD PLACE" lookup on the sheet (null: idle); re-renders the info line. */
  setPlaceStatus(status: LocationStatus | null): void;
  /** Fills the place field unless the user has already typed into it. */
  suggestPlace(place: string): void;
  focusHome(): void;
}

/** Fills `container` (owned by the caller) with the header and the three screens. */
export function mountView(container: HTMLElement, handlers: ViewHandlers): View {
  const newButton = button("nav-button", "New", () => handlers.onNew(), "btn-new");
  const historyButton = button("nav-button", "History", () => handlers.onHistory(), "btn-history");
  const backButton = button("nav-button", "Back", () => handlers.onBack(), "btn-back");
  const nav = el("nav", "sheet-nav");
  nav.append(newButton, historyButton, backButton);
  const header = el("header", "sheet-head");
  header.append(el("h1", "printed", "Baloncesto · scoresheet"), nav);

  const sheet = mountSheet(handlers);
  const history = mountHistory(handlers);
  const newGame = mountNewGame(handlers);
  container.replaceChildren(header, ...sheet.nodes, history.node, newGame.node);

  function showScreen(screen: Screen): void {
    const onSheet = screen === "sheet";
    sheet.setHidden(!onSheet);
    history.setHidden(screen !== "history");
    newGame.setHidden(screen !== "new");
    newButton.hidden = !onSheet;
    historyButton.hidden = !onSheet;
    backButton.hidden = screen !== "history";
  }

  showScreen("sheet");

  return {
    render: sheet.render,
    renderHistory: history.render,
    showScreen,
    setInput: sheet.setInput,
    openNewForm: newGame.open,
    setLocationStatus: newGame.setLocationStatus,
    setPlaceStatus: sheet.setPlaceStatus,
    suggestPlace: newGame.suggestPlace,
    focusHome: sheet.focusHome,
  };
}

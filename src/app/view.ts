import { formatClock } from "../domain/clock";
import { roundScore } from "../domain/predict";
import { renderChart } from "../chart/render";
import type { FieldError, Field, SnapshotInput } from "../domain/validate";
import { formatDateTime } from "./format";
import { currentPrediction, lastSnapshot } from "./match";
import type { Game } from "./match";

export interface ViewHandlers {
  onSubmit(input: SnapshotInput): void;
  onRemoveLast(): void;
  onNew(): void;
  onHistory(): void;
  onBack(): void;
  onOpen(id: string): void;
  onDelete(id: string): void;
}

export type Screen = "sheet" | "history";

export interface View {
  render(game: Game, errors: FieldError[]): void;
  renderHistory(games: Game[]): void;
  showScreen(screen: Screen): void;
  setInput(input: SnapshotInput): void;
  focusHome(): void;
}

interface FieldSpec {
  field: Field;
  label: string;
  inputMode: "numeric" | "decimal";
  placeholder?: string;
  className: string;
}

const FIELDS: FieldSpec[] = [
  { field: "period", label: "Period", inputMode: "numeric", className: "" },
  { field: "clock", label: "Time", inputMode: "decimal", placeholder: "m:ss", className: "" },
  { field: "home", label: "Home", inputMode: "numeric", className: "home" },
  { field: "away", label: "Away", inputMode: "numeric", className: "away" },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function scoreText(value: number | undefined): string {
  return value === undefined ? "—" : String(value);
}

export function mountView(root: HTMLElement, handlers: ViewHandlers): View {
  const header = el("header", "sheet-head");
  const nav = el("nav", "sheet-nav");
  const newButton = el("button", "nav-button", "New");
  newButton.type = "button";
  newButton.id = "btn-new";
  const historyButton = el("button", "nav-button", "History");
  historyButton.type = "button";
  historyButton.id = "btn-history";
  const backButton = el("button", "nav-button", "Back");
  backButton.type = "button";
  backButton.id = "btn-back";
  nav.append(newButton, historyButton, backButton);
  header.append(el("h1", "printed", "Baloncesto · scoresheet"), nav);

  const scoreline = el("section", "scoreline");
  scoreline.setAttribute("aria-label", "Current score");
  const homeScore = el("span", "hand home");
  const awayScore = el("span", "hand away");
  const homeCell = el("div", "side");
  homeCell.append(el("span", "printed", "Home"), homeScore);
  const awayCell = el("div", "side");
  awayCell.append(el("span", "printed", "Away"), awayScore);
  scoreline.append(homeCell, el("span", "hand colon", ":"), awayCell);

  const estimate = el("p", "estimate");
  const estimateLabel = el("span", "printed", "projected final");
  const estimateHome = el("span", "hand home");
  const estimateAway = el("span", "hand away");
  estimate.append(estimateLabel, " ", estimateHome, el("span", "hand", " : "), estimateAway);

  const chart = el("section", "chart");
  chart.id = "chart";
  chart.setAttribute("aria-label", "Chart");

  const form = el("form", "entry");
  form.noValidate = true;
  form.setAttribute("autocomplete", "off");
  const row = el("div", "entry-row");
  const inputs = {} as Record<Field, HTMLInputElement>;
  const errorNodes = {} as Record<Field, HTMLElement>;
  for (const spec of FIELDS) {
    const cell = el("div", `cell ${spec.className}`.trim());
    const id = `f-${spec.field}`;
    const label = el("label", "printed", spec.label);
    label.htmlFor = id;
    const input = el("input", "hand");
    input.id = id;
    input.name = spec.field;
    input.type = "text";
    input.inputMode = spec.inputMode;
    input.enterKeyHint = "done";
    if (spec.placeholder) input.placeholder = spec.placeholder;
    const error = el("p", "error");
    error.id = `${id}-error`;
    cell.append(label, input, error);
    row.append(cell);
    inputs[spec.field] = input;
    errorNodes[spec.field] = error;
  }
  const actions = el("div", "actions");
  const submit = el("button", "primary", "Record");
  submit.type = "submit";
  const remove = el("button", "secondary", "Undo last");
  remove.type = "button";
  actions.append(submit, remove);
  form.append(row, actions);

  const log = el("section", "log");
  const table = el("table");
  const caption = el("caption", "printed", "Log");
  const head = el("thead");
  const headRow = el("tr");
  for (const title of ["#", "Per.", "Time", "Home", "Away"]) {
    headRow.append(el("th", "printed", title));
  }
  head.append(headRow);
  const body = el("tbody");
  table.append(caption, head, body);
  log.append(table);

  const history = el("section", "history");
  history.id = "history";
  history.setAttribute("aria-label", "Saved games");
  history.hidden = true;

  const sheet = [scoreline, estimate, chart, form, log];
  const footer = document.querySelector("footer");
  root.replaceChildren(header, ...sheet, history);
  if (footer) root.append(footer);

  function readInput(): SnapshotInput {
    return {
      period: inputs.period.value,
      clock: inputs.clock.value,
      home: inputs.home.value,
      away: inputs.away.value,
    };
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onSubmit(readInput());
  });
  remove.addEventListener("click", () => handlers.onRemoveLast());
  newButton.addEventListener("click", () => handlers.onNew());
  historyButton.addEventListener("click", () => handlers.onHistory());
  backButton.addEventListener("click", () => handlers.onBack());

  let current: Game | null = null;
  new ResizeObserver(() => renderChart(chart, current?.snapshots ?? [])).observe(chart);

  function render(game: Game, errors: FieldError[]): void {
    current = game;
    renderChart(chart, game.snapshots);
    const last = lastSnapshot(game);
    homeScore.textContent = scoreText(last?.home);
    awayScore.textContent = scoreText(last?.away);

    const prediction = currentPrediction(game);
    estimateHome.textContent = prediction ? String(roundScore(prediction.home)) : "—";
    estimateAway.textContent = prediction ? String(roundScore(prediction.away)) : "—";

    for (const spec of FIELDS) {
      const message = errors.find((e) => e.field === spec.field)?.message ?? "";
      const input = inputs[spec.field];
      const node = errorNodes[spec.field];
      node.textContent = message;
      if (message) {
        input.setAttribute("aria-invalid", "true");
        input.setAttribute("aria-describedby", node.id);
      } else {
        input.removeAttribute("aria-invalid");
        input.removeAttribute("aria-describedby");
      }
    }

    remove.disabled = game.snapshots.length === 0;

    const rows = game.snapshots.map((snapshot, index) => {
      const tr = el("tr");
      tr.append(
        el("td", "printed", String(index + 1)),
        el("td", "hand", String(snapshot.period)),
        el("td", "hand", formatClock(snapshot.remaining)),
        el("td", "hand home", String(snapshot.home)),
        el("td", "hand away", String(snapshot.away)),
      );
      return tr;
    });
    body.replaceChildren(...rows.reverse());
    log.hidden = rows.length === 0;
  }

  function renderHistory(games: Game[]): void {
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
        el("span", "printed history-count", `${game.snapshots.length} entries`),
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
      const buttons = el("div", "actions");
      const open = el("button", "history-open primary", "Open");
      open.type = "button";
      open.addEventListener("click", () => handlers.onOpen(game.id));
      const del = el("button", "history-delete secondary", "Delete");
      del.type = "button";
      del.addEventListener("click", () => handlers.onDelete(game.id));
      buttons.append(open, del);
      item.append(meta, teams, buttons);
      return item;
    });
    history.replaceChildren(...rows);
  }

  function showScreen(screen: Screen): void {
    const onHistory = screen === "history";
    for (const node of sheet) node.hidden = onHistory;
    history.hidden = !onHistory;
    newButton.hidden = onHistory;
    historyButton.hidden = onHistory;
    backButton.hidden = !onHistory;
  }

  function setInput(values: SnapshotInput): void {
    inputs.period.value = values.period;
    inputs.clock.value = values.clock;
    inputs.home.value = values.home;
    inputs.away.value = values.away;
  }

  function focusHome(): void {
    inputs.home.focus();
    inputs.home.select();
  }

  showScreen("sheet");

  return { render, renderHistory, showScreen, setInput, focusHome };
}

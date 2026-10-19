import { formatClock } from "../domain/clock";
import { formatClockInput } from "../domain/clock-input";
import { roundScore } from "../domain/predict";
import { renderChart } from "../chart/render";
import type { FieldError, Field, SnapshotInput } from "../domain/validate";
import { formatDateTime } from "./format";
import { STATUS_TEXT } from "./geo";
import type { LocationStatus } from "./geo";
import {
  DEFAULT_AWAY_NAME,
  DEFAULT_HOME_NAME,
  MAX_TEAM_NAME_LENGTH,
  currentPrediction,
  gameInfoLine,
  lastSnapshot,
} from "./match";
import type { Game } from "./match";

export type Side = "home" | "away";

/** Raw values of the new-game form. */
export interface NewGameForm {
  homeName: string;
  awayName: string;
  /** `datetime-local` value, local time. */
  dateTime: string;
  place: string;
}

export interface ViewHandlers {
  onSubmit(input: SnapshotInput): void;
  /** Deletes the log entry at `index` (0-based, chronological order). */
  onRemoveEntry(index: number): void;
  onNew(): void;
  onTeamName(side: Side, value: string): void;
  onStart(form: NewGameForm): void;
  onCancel(): void;
  onHistory(): void;
  onBack(): void;
  onOpen(id: string): void;
  onDelete(id: string): void;
}

export type Screen = "sheet" | "history" | "new";

export interface View {
  render(game: Game, errors: FieldError[]): void;
  renderHistory(games: Game[]): void;
  showScreen(screen: Screen): void;
  setInput(input: SnapshotInput): void;
  /** Resets the new-game form (empty names and place, given date and time). */
  openNewForm(dateTime: string): void;
  setLocationStatus(status: LocationStatus): void;
  /** Fills the place field unless the user has already typed into it. */
  suggestPlace(place: string): void;
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
  { field: "clock", label: "Time", inputMode: "numeric", placeholder: "m:ss", className: "" },
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

  const teamInputs = {} as Record<Side, HTMLInputElement>;
  for (const side of ["home", "away"] as const) {
    const input = el("input", `printed team-name ${side}`);
    input.id = `f-${side}-name`;
    input.name = `${side}Name`;
    input.type = "text";
    input.maxLength = MAX_TEAM_NAME_LENGTH;
    input.enterKeyHint = "done";
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-label", `${side === "home" ? "Home" : "Away"} team name`);
    input.addEventListener("change", () => handlers.onTeamName(side, input.value));
    teamInputs[side] = input;
  }

  const info = el("p", "printed sheet-info");

  const estimate = el("section", "estimate");
  estimate.id = "estimate";
  estimate.setAttribute("aria-label", "Projected final");
  const estimateHome = el("span", "hand home");
  const estimateAway = el("span", "hand away");
  const estimateColon = el("span", "hand colon", " : ");
  const estimateScore = el("span", "estimate-score");
  estimateScore.append(estimateHome, estimateColon, estimateAway);
  estimate.append(teamInputs.home, estimateScore, teamInputs.away);

  const chart = el("section", "chart");
  chart.id = "chart";
  chart.setAttribute("aria-label", "Chart");

  const form = el("form", "entry");
  form.noValidate = true;
  form.setAttribute("autocomplete", "off");
  const row = el("div", "entry-row");
  const inputs = {} as Record<Field, HTMLInputElement>;
  const scoreLabels = {} as Record<Side, HTMLLabelElement>;
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
    if (spec.field === "home" || spec.field === "away") scoreLabels[spec.field] = label;
    cell.append(label, input, error);
    row.append(cell);
    inputs[spec.field] = input;
    errorNodes[spec.field] = error;
  }
  const actions = el("div", "actions");
  const submit = el("button", "primary", "Record");
  submit.type = "submit";
  submit.id = "btn-record";
  actions.append(submit);
  form.append(row, actions);

  // Select the existing text on focus so typing overwrites it. On touch devices the tap's
  // mouseup/click would collapse the selection again, so select once more after the tap and
  // swallow the first mouseup following the focus.
  for (const input of Object.values(inputs)) {
    let justFocused = false;
    input.addEventListener("focus", () => {
      justFocused = true;
      input.select();
      requestAnimationFrame(() => input.select());
      setTimeout(() => {
        input.select();
        justFocused = false;
      }, 0);
    });
    input.addEventListener("mouseup", (event) => {
      if (justFocused) event.preventDefault();
    });
    input.addEventListener("blur", () => {
      justFocused = false;
    });
  }
  inputs.clock.addEventListener("input", () => {
    const formatted = formatClockInput(inputs.clock.value);
    if (formatted === inputs.clock.value) return;
    inputs.clock.value = formatted;
    inputs.clock.setSelectionRange(formatted.length, formatted.length);
  });

  const log = el("section", "log");
  const table = el("table");
  const caption = el("caption", "printed", "Log");
  const head = el("thead");
  const headRow = el("tr");
  for (const title of ["#", "Per.", "Time", "Home", "Away"]) {
    headRow.append(el("th", "printed", title));
  }
  const deleteHead = el("th", "printed");
  deleteHead.setAttribute("aria-label", "Delete");
  headRow.append(deleteHead);
  head.append(headRow);
  const body = el("tbody");
  table.append(caption, head, body);
  log.append(table);

  const history = el("section", "history");
  history.id = "history";
  history.setAttribute("aria-label", "Saved games");
  history.hidden = true;

  const newGameSection = el("section", "newgame");
  newGameSection.id = "newgame";
  newGameSection.setAttribute("aria-label", "New game");
  newGameSection.hidden = true;
  const newForm = el("form", "newgame-form");
  newForm.id = "new-game-form";
  newForm.noValidate = true;
  newForm.setAttribute("autocomplete", "off");
  const newFields = el("div", "newgame-fields");
  function textField(
    id: string,
    name: string,
    label: string,
    type: "text" | "datetime-local",
    className = "",
  ): HTMLInputElement {
    const cell = el("div", `field ${className}`.trim());
    const labelNode = el("label", "printed", label);
    labelNode.htmlFor = id;
    const input = el("input", "hand");
    input.id = id;
    input.name = name;
    input.type = type;
    cell.append(labelNode, input);
    newFields.append(cell);
    return input;
  }
  const newHome = textField("n-home", "homeName", "Home team", "text", "home");
  const newAway = textField("n-away", "awayName", "Away team", "text", "away");
  newHome.maxLength = MAX_TEAM_NAME_LENGTH;
  newHome.placeholder = DEFAULT_HOME_NAME;
  newAway.maxLength = MAX_TEAM_NAME_LENGTH;
  newAway.placeholder = DEFAULT_AWAY_NAME;
  const newDate = textField("n-datetime", "dateTime", "Date & time", "datetime-local");
  const newPlace = textField("n-place", "place", "Place", "text");
  newPlace.enterKeyHint = "done";
  const locationStatus = el("p", "printed location-status");
  locationStatus.id = "location-status";
  locationStatus.setAttribute("role", "status");
  newFields.append(locationStatus);
  const newActions = el("div", "actions");
  const start = el("button", "primary", "Start game");
  start.type = "submit";
  start.id = "btn-start";
  const cancel = el("button", "secondary", "Cancel");
  cancel.type = "button";
  cancel.id = "btn-cancel";
  newActions.append(start, cancel);
  newForm.append(newFields, newActions);
  newGameSection.append(newForm);
  let placeTouched = false;
  newPlace.addEventListener("input", () => {
    placeTouched = true;
  });
  newForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onStart({
      homeName: newHome.value,
      awayName: newAway.value,
      dateTime: newDate.value,
      place: newPlace.value,
    });
  });
  cancel.addEventListener("click", () => handlers.onCancel());

  const sheet = [info, form, chart, estimate, log];
  const footer = document.querySelector("footer");
  root.replaceChildren(header, ...sheet, history, newGameSection);
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
  newButton.addEventListener("click", () => handlers.onNew());
  historyButton.addEventListener("click", () => handlers.onHistory());
  backButton.addEventListener("click", () => handlers.onBack());

  let current: Game | null = null;
  const namesOf = (game: Game) => ({ home: game.homeName, away: game.awayName });
  new ResizeObserver(() =>
    renderChart(chart, current?.snapshots ?? [], current ? namesOf(current) : undefined),
  ).observe(chart);

  function render(game: Game, errors: FieldError[]): void {
    current = game;
    renderChart(chart, game.snapshots, namesOf(game));
    teamInputs.home.value = game.homeName;
    teamInputs.away.value = game.awayName;
    scoreLabels.home.textContent = game.homeName;
    scoreLabels.away.textContent = game.awayName;
    info.textContent = gameInfoLine(game, formatDateTime);
    const prediction = currentPrediction(game);
    estimateHome.textContent = prediction ? String(roundScore(prediction.home)) : "—";
    estimateAway.textContent = prediction ? String(roundScore(prediction.away)) : "";
    estimateColon.hidden = estimateAway.hidden = !prediction;

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

    const rows = game.snapshots.map((snapshot, index) => {
      const tr = el("tr");
      const del = el("button", "log-delete", "×");
      del.type = "button";
      del.setAttribute("aria-label", `Delete entry ${index + 1}`);
      del.addEventListener("click", () => handlers.onRemoveEntry(index));
      const delCell = el("td", "log-action");
      delCell.append(del);
      tr.append(
        el("td", "printed", String(index + 1)),
        el("td", "hand", String(snapshot.period)),
        el("td", "hand", formatClock(snapshot.remaining)),
        el("td", "hand home", String(snapshot.home)),
        el("td", "hand away", String(snapshot.away)),
        delCell,
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
      const open = el("button", "history-open primary", "Open");
      open.type = "button";
      open.addEventListener("click", () => handlers.onOpen(game.id));
      const del = el("button", "history-delete secondary", "Delete");
      del.type = "button";
      del.addEventListener("click", () => handlers.onDelete(game.id));
      buttons.append(open, del);
      item.append(meta, teams, ...placeLine, buttons);
      return item;
    });
    history.replaceChildren(...rows);
  }

  function showScreen(screen: Screen): void {
    const onSheet = screen === "sheet";
    for (const node of sheet) node.hidden = !onSheet;
    history.hidden = screen !== "history";
    newGameSection.hidden = screen !== "new";
    newButton.hidden = !onSheet;
    historyButton.hidden = !onSheet;
    backButton.hidden = screen !== "history";
  }

  function setInput(values: SnapshotInput): void {
    inputs.period.value = values.period;
    inputs.clock.value = values.clock;
    inputs.home.value = values.home;
    inputs.away.value = values.away;
  }

  function openNewForm(dateTime: string): void {
    newHome.value = "";
    newAway.value = "";
    newDate.value = dateTime;
    newPlace.value = "";
    placeTouched = false;
  }

  function setLocationStatus(status: LocationStatus): void {
    locationStatus.textContent = STATUS_TEXT[status];
    locationStatus.dataset.status = status;
  }

  function suggestPlace(place: string): void {
    if (!placeTouched) newPlace.value = place;
  }

  function focusHome(): void {
    inputs.home.focus();
    inputs.home.select();
  }

  showScreen("sheet");

  return {
    render,
    renderHistory,
    showScreen,
    setInput,
    openNewForm,
    setLocationStatus,
    suggestPlace,
    focusHome,
  };
}

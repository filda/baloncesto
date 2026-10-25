import { formatClock } from "../../domain/clock";
import { completeClockInput, formatClockInput } from "../../domain/clock-input";
import { predictRange, roundScore } from "../../domain/predict";
import { rangeText, renderChart } from "../../chart/render";
import type { Field, FieldError, SnapshotInput } from "../../domain/validate";
import { formatDateTime } from "../format";
import type { LocationStatus } from "../geo";
import {
  MAX_TEAM_NAME_LENGTH,
  addPlaceLabel,
  currentPrediction,
  gameInfoLine,
  lastSnapshot,
  repeatedScoreCount,
} from "../match";
import type { Game, Side } from "../match";
import { button, el, selectOnFocus } from "./dom";

export interface SheetHandlers {
  onSubmit(input: SnapshotInput): void;
  /** Deletes the log entry at `index` (0-based, chronological order). */
  onRemoveEntry(index: number): void;
  /** Drops the entries whose score repeats in the next entry. */
  onConsolidate(): void;
  onAddPlace(): void;
  onTeamName(side: Side, value: string): void;
}

export interface SheetView {
  /** The nodes that make up the sheet screen, in document order. */
  nodes: HTMLElement[];
  setHidden(hidden: boolean): void;
  render(game: Game, errors: FieldError[]): void;
  setInput(input: SnapshotInput): void;
  /** Status of the "+ ADD PLACE" lookup (null: idle); re-renders the info line. */
  setPlaceStatus(status: LocationStatus | null): void;
  /** Focuses and selects the entry input used last (the home score until one was focused). */
  focusEntry(): void;
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

export function mountSheet(handlers: SheetHandlers): SheetView {
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
  const infoText = el("span", "sheet-info-text");
  const addPlace = button("place-button", "", () => handlers.onAddPlace(), "btn-add-place");
  info.append(infoText, addPlace);
  let placeStatus: LocationStatus | null = null;

  const estimate = el("section", "estimate");
  estimate.id = "estimate";
  estimate.setAttribute("aria-label", "Projected final");
  const estimateHome = el("span", "hand home");
  const estimateAway = el("span", "hand away");
  const estimateColon = el("span", "hand colon", " : ");
  const estimateScore = el("span", "estimate-score");
  estimateScore.append(estimateHome, estimateColon, estimateAway);
  const rangeHome = el("span", "home");
  const rangeAway = el("span", "away");
  const rangeLine = el("span", "printed estimate-range");
  rangeLine.append(rangeHome, " · ", rangeAway);
  rangeLine.hidden = true;
  estimate.append(teamInputs.home, estimateScore, teamInputs.away, rangeLine);

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
  const formError = el("p", "error form-error");
  formError.id = "form-error";
  formError.setAttribute("role", "alert");
  formError.setAttribute("aria-live", "assertive");
  form.append(row, actions, formError);
  form.addEventListener("input", () => {
    formError.textContent = "";
  });

  // Remembered so recording keeps the user in the field they were typing in.
  let lastInput = inputs.home;
  for (const input of Object.values(inputs)) {
    selectOnFocus(input);
    input.addEventListener("focus", () => {
      lastInput = input;
    });
  }
  inputs.clock.addEventListener("input", () => {
    const formatted = formatClockInput(inputs.clock.value);
    if (formatted === inputs.clock.value) return;
    inputs.clock.value = formatted;
    inputs.clock.setSelectionRange(formatted.length, formatted.length);
  });

  function completeClock(): void {
    inputs.clock.value = completeClockInput(inputs.clock.value);
  }
  inputs.clock.addEventListener("blur", completeClock);

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

  // Consolidation sits below the log, out of the way during a game, with an inline confirm.
  const consolidate = el("div", "log-consolidate");
  const consolidateActions = el("div", "actions");
  const consolidateConfirm = el("div", "log-confirm");
  consolidateConfirm.setAttribute("role", "group");
  consolidateConfirm.setAttribute("aria-label", "Confirm remove repeated scores");
  const askConsolidate = (asking: boolean): void => {
    consolidateActions.hidden = asking;
    consolidateConfirm.hidden = !asking;
  };
  const consolidateButton = button(
    "log-consolidate-button secondary",
    "",
    () => {
      askConsolidate(true);
      consolidateKeep.focus();
    },
    "btn-consolidate",
  );
  const consolidateKeep = button("log-consolidate-keep primary", "KEEP", () => {
    askConsolidate(false);
    consolidateButton.focus();
  });
  const consolidateConfirmText = el("p", "printed log-confirm-text");
  const consolidateConfirmButtons = el("div", "actions");
  consolidateConfirmButtons.append(
    button("log-consolidate-remove secondary", "REMOVE", () => handlers.onConsolidate()),
    consolidateKeep,
  );
  consolidateActions.append(consolidateButton);
  consolidateConfirm.append(consolidateConfirmText, consolidateConfirmButtons);
  consolidate.append(consolidateActions, consolidateConfirm);
  log.append(table, consolidate);

  const nodes = [info, form, chart, estimate, log];

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
    completeClock();
    handlers.onSubmit(readInput());
  });

  let current: Game | null = null;
  const namesOf = (game: Game) => ({ home: game.homeName, away: game.awayName });
  new ResizeObserver(() =>
    renderChart(chart, current?.snapshots ?? [], current ? namesOf(current) : undefined),
  ).observe(chart);

  function renderInfo(): void {
    if (!current) return;
    infoText.textContent = gameInfoLine(current, formatDateTime);
    const missing = !current.location?.place;
    addPlace.hidden = !missing;
    addPlace.textContent = addPlaceLabel(placeStatus);
    addPlace.disabled = placeStatus === "locating";
  }

  function render(game: Game, errors: FieldError[]): void {
    current = game;
    renderChart(chart, game.snapshots, namesOf(game));
    teamInputs.home.value = game.homeName;
    teamInputs.away.value = game.awayName;
    scoreLabels.home.textContent = game.homeName;
    scoreLabels.away.textContent = game.awayName;
    renderInfo();
    const prediction = currentPrediction(game);
    estimateHome.textContent = prediction ? String(roundScore(prediction.home)) : "—";
    estimateAway.textContent = prediction ? String(roundScore(prediction.away)) : "—";
    const last = prediction ? lastSnapshot(game) : null;
    const range = last ? predictRange(last) : null;
    rangeLine.hidden = !range;
    if (range) {
      rangeHome.textContent = rangeText({
        low: roundScore(range.home.low),
        high: roundScore(range.home.high),
      });
      rangeAway.textContent = rangeText({
        low: roundScore(range.away.low),
        high: roundScore(range.away.high),
      });
    }

    formError.textContent = errors.find((e) => e.field === "form")?.message ?? "";

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
      const del = button("log-delete", "×", () => handlers.onRemoveEntry(index));
      del.setAttribute("aria-label", `Delete entry ${index + 1}`);
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

    const repeated = repeatedScoreCount(game);
    consolidate.hidden = repeated === 0;
    askConsolidate(false);
    const entries = `${repeated} ${repeated === 1 ? "entry" : "entries"}`;
    consolidateButton.textContent = `Remove repeated scores (${repeated})`;
    consolidateConfirmText.textContent = `REMOVE ${entries.toUpperCase()} WITH A REPEATED SCORE?`;
  }

  return {
    nodes,
    setHidden(hidden) {
      for (const node of nodes) node.hidden = hidden;
    },
    render,
    setInput(values) {
      inputs.period.value = values.period;
      inputs.clock.value = values.clock;
      inputs.home.value = values.home;
      inputs.away.value = values.away;
    },
    setPlaceStatus(status) {
      placeStatus = status;
      renderInfo();
    },
    focusEntry() {
      lastInput.focus();
      lastInput.select();
    },
  };
}

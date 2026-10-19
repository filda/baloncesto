import { formatClock } from "../domain/clock";
import { roundScore } from "../domain/predict";
import { renderChart } from "../chart/render";
import type { FieldError, Field, SnapshotInput } from "../domain/validate";
import { currentPrediction, lastSnapshot } from "./match";
import type { Match } from "./match";

export interface ViewHandlers {
  onSubmit(input: SnapshotInput): void;
  onRemoveLast(): void;
}

export interface View {
  render(match: Match, errors: FieldError[]): void;
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
  { field: "period", label: "Perioda", inputMode: "numeric", className: "" },
  { field: "clock", label: "Čas", inputMode: "decimal", placeholder: "m:ss", className: "" },
  { field: "home", label: "Domácí", inputMode: "numeric", className: "home" },
  { field: "away", label: "Hosté", inputMode: "numeric", className: "away" },
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
  header.append(el("h1", "printed", "Baloncesto · zápis"));

  const scoreline = el("section", "scoreline");
  scoreline.setAttribute("aria-label", "Aktuální skóre");
  const homeScore = el("span", "hand home");
  const awayScore = el("span", "hand away");
  const homeCell = el("div", "side");
  homeCell.append(el("span", "printed", "Domácí"), homeScore);
  const awayCell = el("div", "side");
  awayCell.append(el("span", "printed", "Hosté"), awayScore);
  scoreline.append(homeCell, el("span", "hand colon", ":"), awayCell);

  const estimate = el("p", "estimate");
  const estimateLabel = el("span", "printed", "odhad konce");
  const estimateHome = el("span", "hand home");
  const estimateAway = el("span", "hand away");
  estimate.append(estimateLabel, " ", estimateHome, el("span", "hand", " : "), estimateAway);

  const chart = el("section", "chart");
  chart.id = "chart";
  chart.setAttribute("aria-label", "Graf");

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
  const submit = el("button", "primary", "Zapsat");
  submit.type = "submit";
  const remove = el("button", "secondary", "Smazat poslední");
  remove.type = "button";
  actions.append(submit, remove);
  form.append(row, actions);

  const log = el("section", "log");
  const table = el("table");
  const caption = el("caption", "printed", "Zapsané snímky");
  const head = el("thead");
  const headRow = el("tr");
  for (const title of ["#", "Per.", "Čas", "Dom.", "Hos."]) {
    headRow.append(el("th", "printed", title));
  }
  head.append(headRow);
  const body = el("tbody");
  table.append(caption, head, body);
  log.append(table);

  const footer = document.querySelector("footer");
  root.replaceChildren(header, scoreline, estimate, chart, form, log);
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

  let current: Match = { snapshots: [] };
  new ResizeObserver(() => renderChart(chart, current.snapshots)).observe(chart);

  function render(match: Match, errors: FieldError[]): void {
    current = match;
    renderChart(chart, match.snapshots);
    const last = lastSnapshot(match);
    homeScore.textContent = scoreText(last?.home);
    awayScore.textContent = scoreText(last?.away);

    const prediction = currentPrediction(match);
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

    remove.disabled = match.snapshots.length === 0;

    const rows = match.snapshots.map((snapshot, index) => {
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

  return { render, setInput, focusHome };
}

import { STATUS_TEXT } from "../geo";
import type { LocationStatus } from "../geo";
import { DEFAULT_AWAY_NAME, DEFAULT_HOME_NAME, MAX_TEAM_NAME_LENGTH } from "../match";
import type { NewGameFormValues } from "../match";
import { button, el } from "./dom";

export type NewGameForm = NewGameFormValues;

export interface NewGameHandlers {
  onStart(form: NewGameForm): void;
  onCancel(): void;
}

export interface NewGameView {
  node: HTMLElement;
  setHidden(hidden: boolean): void;
  /** Resets the form (empty names and place, given date and time). */
  open(dateTime: string): void;
  setLocationStatus(status: LocationStatus): void;
  /** Fills the place field unless the user has already typed into it. */
  suggestPlace(place: string): void;
  /** Flags the date field as invalid (empty message clears it). */
  setDateError(message: string): void;
}

export function mountNewGame(handlers: NewGameHandlers): NewGameView {
  const section = el("section", "newgame");
  section.id = "newgame";
  section.setAttribute("aria-label", "New game");
  section.hidden = true;
  const form = el("form", "newgame-form");
  form.id = "new-game-form";
  form.noValidate = true;
  form.setAttribute("autocomplete", "off");
  const fields = el("div", "newgame-fields");
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
    fields.append(cell);
    return input;
  }
  const home = textField("n-home", "homeName", "Home team", "text", "home");
  const away = textField("n-away", "awayName", "Away team", "text", "away");
  home.maxLength = MAX_TEAM_NAME_LENGTH;
  home.placeholder = DEFAULT_HOME_NAME;
  away.maxLength = MAX_TEAM_NAME_LENGTH;
  away.placeholder = DEFAULT_AWAY_NAME;
  const date = textField("n-datetime", "dateTime", "Date & time", "datetime-local");
  const dateError = el("p", "error");
  dateError.id = "n-datetime-error";
  date.parentElement?.append(dateError);
  function setDateError(message: string): void {
    dateError.textContent = message;
    if (message) {
      date.setAttribute("aria-invalid", "true");
      date.setAttribute("aria-describedby", dateError.id);
    } else {
      date.removeAttribute("aria-invalid");
      date.removeAttribute("aria-describedby");
    }
  }
  date.addEventListener("input", () => setDateError(""));
  const place = textField("n-place", "place", "Place", "text");
  place.enterKeyHint = "done";
  const status = el("p", "printed location-status");
  status.id = "location-status";
  status.setAttribute("role", "status");
  fields.append(status);
  const actions = el("div", "actions");
  const start = el("button", "primary", "Start game");
  start.type = "submit";
  start.id = "btn-start";
  actions.append(
    start,
    button("secondary", "Cancel", () => handlers.onCancel(), "btn-cancel"),
  );
  form.append(fields, actions);
  section.append(form);

  let placeTouched = false;
  place.addEventListener("input", () => {
    placeTouched = true;
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    handlers.onStart({
      homeName: home.value,
      awayName: away.value,
      dateTime: date.value,
      place: place.value,
    });
  });

  return {
    node: section,
    setHidden(hidden) {
      section.hidden = hidden;
    },
    open(dateTime) {
      home.value = "";
      away.value = "";
      date.value = dateTime;
      place.value = "";
      placeTouched = false;
      setDateError("");
    },
    setLocationStatus(next) {
      status.textContent = STATUS_TEXT[next];
      status.dataset.status = next;
    },
    setDateError,
    suggestPlace(suggestion) {
      if (!placeTouched) place.value = suggestion;
    },
  };
}

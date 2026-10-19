import "@fontsource/caveat/latin-400.css";
import "@fontsource/caveat/latin-ext-400.css";
import "@fontsource/caveat/latin-700.css";
import "@fontsource/caveat/latin-ext-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "./style.css";
import { registerSW } from "virtual:pwa-register";
import { mountUpdateBanner } from "./app/update-banner";
import { formatVersion } from "./footer";
import { parseDateTimeLocal, toDateTimeLocalValue } from "./app/format";
import { browserFetchJson, browserGetPosition, locate } from "./app/geo";
import type { Coords } from "./app/geo";
import {
  DEFAULT_AWAY_NAME,
  DEFAULT_HOME_NAME,
  addSnapshot,
  createGame as buildGame,
  lastSnapshot,
  newGame,
  nextInputDefaults,
  normalizeTeamName,
  removeLastSnapshot,
} from "./app/match";
import type { Game } from "./app/match";
import {
  deleteGame,
  findGame,
  listHistory,
  loadState,
  safeLocalStorage,
  saveState,
  setCurrent,
  upsertGame,
} from "./app/storage";
import { mountView } from "./app/view";
import type { NewGameForm } from "./app/view";
import { validateSnapshot } from "./domain/validate";

const HISTORY_HASH = "#/history";
const SHEET_HASH = "#/";
const NEW_HASH = "#/new";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const footer = document.createElement("footer");
  footer.className = "printed";
  footer.textContent = formatVersion(__APP_COMMIT__, __APP_BUILD_DATE__);
  app.append(footer);

  const storage = safeLocalStorage();
  let state = loadState(storage);
  const createGame = () => newGame(crypto.randomUUID(), new Date());
  let game: Game = findGame(state, state.currentId) ?? createGame();

  // Persistence rule: the current game is always written (names and place survive a reload even
  // before the first snapshot); the history only lists games with snapshots. An empty game that
  // is replaced by another one (new game, opened game) is simply dropped.
  function persist(): void {
    state = setCurrent(upsertGame(state, game), game.id);
    saveState(storage, state);
  }

  function switchTo(next: Game): void {
    if (game.snapshots.length === 0 && game.id !== next.id) state = deleteGame(state, game.id);
    game = next;
    persist();
  }

  function showGame(): void {
    view.render(game, []);
    view.setInput(nextInputDefaults(game));
  }

  // Bumped on every form opening so late geolocation results of a closed form are ignored.
  let formSession = 0;
  let coords: Coords | null = null;

  function openNewForm(): void {
    const session = ++formSession;
    coords = null;
    view.openNewForm(toDateTimeLocalValue(new Date()));
    void locate(
      { getPosition: browserGetPosition, fetchJson: browserFetchJson, storage },
      (update) => {
        if (session !== formSession) return;
        view.setLocationStatus(update.status);
        if (update.coords) coords = update.coords;
        if (update.place) view.suggestPlace(update.place);
      },
    );
  }

  function startGame(form: NewGameForm): void {
    formSession++;
    const created = buildGame({
      id: crypto.randomUUID(),
      createdAt: parseDateTimeLocal(form.dateTime) ?? new Date(),
      homeName: form.homeName,
      awayName: form.awayName,
      lat: coords?.lat,
      lon: coords?.lon,
      place: form.place,
    });
    switchTo(created);
    showGame();
    location.hash = SHEET_HASH;
  }

  function route(): void {
    if (location.hash === NEW_HASH) {
      view.showScreen("new");
      openNewForm();
    } else if (location.hash === HISTORY_HASH) {
      view.renderHistory(listHistory(state));
      view.showScreen("history");
    } else {
      view.showScreen("sheet");
    }
    window.scrollTo(0, 0);
  }

  const view = mountView(app, {
    onSubmit(input) {
      const result = validateSnapshot(input, lastSnapshot(game) ?? undefined);
      if (!result.ok) {
        view.render(game, result.errors);
        return;
      }
      game = addSnapshot(game, result.snapshot);
      persist();
      showGame();
      view.focusHome();
    },
    onRemoveLast() {
      game = removeLastSnapshot(game);
      persist();
      showGame();
    },
    onNew() {
      location.hash = NEW_HASH;
    },
    onTeamName(side, value) {
      game =
        side === "home"
          ? { ...game, homeName: normalizeTeamName(value, DEFAULT_HOME_NAME) }
          : { ...game, awayName: normalizeTeamName(value, DEFAULT_AWAY_NAME) };
      persist();
      view.render(game, []);
    },
    onStart: startGame,
    onCancel() {
      formSession++;
      location.hash = SHEET_HASH;
    },
    onHistory() {
      location.hash = HISTORY_HASH;
    },
    onBack() {
      location.hash = SHEET_HASH;
    },
    onOpen(id) {
      const opened = findGame(state, id);
      if (!opened) return;
      switchTo(opened);
      showGame();
      location.hash = SHEET_HASH;
    },
    onDelete(id) {
      if (!confirm("Delete this game?")) return;
      state = deleteGame(state, id);
      if (game.id === id) {
        game = createGame();
        showGame();
      }
      persist();
      route();
    },
  });

  window.addEventListener("hashchange", route);
  showGame();
  route();
}

const updateSW = registerSW({
  onNeedRefresh() {
    mountUpdateBanner(document.body, () => void updateSW(true));
  },
});

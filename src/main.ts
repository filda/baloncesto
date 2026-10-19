import "@fontsource/caveat/latin-400.css";
import "@fontsource/caveat/latin-ext-400.css";
import "@fontsource/caveat/latin-700.css";
import "@fontsource/caveat/latin-ext-700.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-ext-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-ext-500.css";
import "./style.css";
import { formatVersion } from "./footer";
import {
  addSnapshot,
  lastSnapshot,
  newGame,
  nextInputDefaults,
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
import { validateSnapshot } from "./domain/validate";

const HISTORY_HASH = "#/history";
const SHEET_HASH = "#/";

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

  // Persistence rule: a game is written to `games` once it has at least one snapshot.
  // An empty game that was never saved is not persisted (and is not current on reload);
  // a saved game that becomes empty again via undo stays saved.
  function persist(): void {
    const saved = game.snapshots.length > 0 || findGame(state, game.id) !== null;
    if (saved) state = upsertGame(state, game);
    state = setCurrent(state, saved ? game.id : null);
    saveState(storage, state);
  }

  function showGame(): void {
    view.render(game, []);
    view.setInput(nextInputDefaults(game));
  }

  function route(): void {
    if (location.hash === HISTORY_HASH) {
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
      if (game.snapshots.length > 0) {
        game = createGame();
        persist();
        showGame();
      }
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
      game = opened;
      persist();
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

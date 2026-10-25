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
import { createStorageBanner } from "./app/storage-banner";
import { mountUpdateBanner } from "./app/update-banner";
import { formatVersion } from "./footer";
import { toDateTimeLocalValue } from "./app/format";
import { browserFetchJson, browserGetPosition, locate } from "./app/geo";
import type { Coords } from "./app/geo";
import {
  draftNewGame,
  lastSnapshot,
  nextInputDefaults,
  shouldOpenNewFormOnStart,
} from "./app/match";
import { ROUTE_HASH, resolveHash } from "./app/router";
import { safeLocalStorage } from "./app/storage";
import { createStore } from "./app/store";
import { applyForeignWrite, watchStorage } from "./app/sync";
import { mountView } from "./app/view";
import type { NewGameForm } from "./app/view";
import { validateSnapshot } from "./domain/validate";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const viewRoot = document.createElement("div");
  viewRoot.id = "view";
  const footer = document.createElement("footer");
  footer.className = "printed";
  footer.textContent = formatVersion(__APP_COMMIT__, __APP_BUILD_DATE__);
  app.append(viewRoot, footer);

  const storage = safeLocalStorage();
  const storageBanner = createStorageBanner(document.body);
  if (!storage) storageBanner.report(false);
  const store = createStore({
    storage,
    onSave: (saved) => storageBanner.report(saved),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  });
  const locateDeps = { getPosition: browserGetPosition, fetchJson: browserFetchJson, storage };

  // Bumped when the current game changes so late "+ ADD PLACE" results are ignored.
  let placeSession = 0;

  function resetPlaceLookup(): void {
    placeSession++;
    view.setPlaceStatus(null);
  }

  function addPlaceToGame(): void {
    const session = ++placeSession;
    const id = store.game.id;
    void locate(locateDeps, (update) => {
      if (session !== placeSession || store.game.id !== id) return;
      if (update.status === "unavailable") {
        view.setPlaceStatus("unavailable");
      } else if (update.coords && (update.place || update.status === "place-unavailable")) {
        store.setLocation(update.coords, update.place);
        view.setPlaceStatus(null);
        view.render(store.game, []);
      } else {
        view.setPlaceStatus("locating");
      }
    });
  }

  function showGame(): void {
    view.render(store.game, []);
    view.setInput(nextInputDefaults(store.game));
  }

  // Bumped on every form opening so late geolocation results of a closed form are ignored.
  let formSession = 0;
  let coords: Coords | null = null;

  function openNewForm(): void {
    const session = ++formSession;
    coords = null;
    view.openNewForm(toDateTimeLocalValue(new Date()));
    void locate(locateDeps, (update) => {
      if (session !== formSession) return;
      view.setLocationStatus(update.status);
      if (update.coords) coords = update.coords;
      if (update.place) view.suggestPlace(update.place);
    });
  }

  function startGame(form: NewGameForm): void {
    const draft = draftNewGame(form, coords);
    if (!draft.ok) {
      view.setDateError(draft.errors.dateTime);
      return;
    }
    formSession++;
    resetPlaceLookup();
    store.startGame(draft.input);
    showGame();
    location.hash = ROUTE_HASH.sheet;
  }

  function route(): void {
    const { route: screen } = resolveHash(location.hash);
    if (screen === "new") {
      view.showScreen("new");
      openNewForm();
    } else if (screen === "history") {
      view.renderHistory(store.history());
      view.showScreen("history");
    } else {
      view.showScreen("sheet");
    }
    window.scrollTo(0, 0);
  }

  const view = mountView(viewRoot, {
    onSubmit(input) {
      const result = validateSnapshot(input, lastSnapshot(store.game) ?? undefined);
      if (!result.ok) {
        view.render(store.game, result.errors);
        return;
      }
      store.addSnapshot(result.snapshot);
      showGame();
      view.focusEntry();
    },
    onRemoveEntry(index) {
      store.removeSnapshot(index);
      showGame();
    },
    onConsolidate() {
      store.consolidate();
      showGame();
    },
    onNew() {
      location.hash = ROUTE_HASH.new;
    },
    onAddPlace: addPlaceToGame,
    onTeamName(side, value) {
      store.setTeamName(side, value);
      view.render(store.game, []);
    },
    onStart: startGame,
    onCancel() {
      formSession++;
      location.hash = ROUTE_HASH.sheet;
    },
    onHistory() {
      location.hash = ROUTE_HASH.history;
    },
    onBack() {
      location.hash = ROUTE_HASH.sheet;
    },
    onOpen(id) {
      if (!store.open(id)) return;
      resetPlaceLookup();
      showGame();
      location.hash = ROUTE_HASH.sheet;
    },
    onDelete(id) {
      if (store.remove(id)) {
        resetPlaceLookup();
        showGame();
      }
      route();
    },
  });

  window.addEventListener("hashchange", route);
  watchStorage(window, storage, () =>
    applyForeignWrite(store, {
      resetPlaceLookup,
      showGame,
      refreshHistory() {
        if (resolveHash(location.hash).route === "history") view.renderHistory(store.history());
      },
    }),
  );
  showGame();
  const start = resolveHash(location.hash);
  if (!start.known) history.replaceState(null, "", ROUTE_HASH.sheet);
  if (start.route === "sheet" && shouldOpenNewFormOnStart(store.restored)) {
    // Replace the entry so the form is not a history step; CANCEL later returns to the sheet.
    history.replaceState(null, "", ROUTE_HASH.new);
  }
  route();
}

const updateSW = registerSW({
  onNeedRefresh() {
    mountUpdateBanner(document.body, () => void updateSW(true));
  },
});

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
  emptyMatch,
  lastSnapshot,
  nextInputDefaults,
  removeLastSnapshot,
} from "./app/match";
import type { Match } from "./app/match";
import { mountView } from "./app/view";
import { validateSnapshot } from "./domain/validate";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const footer = document.createElement("footer");
  footer.className = "printed";
  footer.textContent = formatVersion(__APP_COMMIT__, __APP_BUILD_DATE__);
  app.append(footer);

  let match: Match = emptyMatch();

  const view = mountView(app, {
    onSubmit(input) {
      const result = validateSnapshot(input, lastSnapshot(match) ?? undefined);
      if (!result.ok) {
        view.render(match, result.errors);
        return;
      }
      match = addSnapshot(match, result.snapshot);
      view.render(match, []);
      view.setInput(nextInputDefaults(match));
      view.focusHome();
    },
    onRemoveLast() {
      match = removeLastSnapshot(match);
      view.render(match, []);
      view.setInput(nextInputDefaults(match));
    },
  });

  view.render(match, []);
  view.setInput(nextInputDefaults(match));
}

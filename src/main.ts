import "./style.css";
import { formatVersion } from "./footer";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Baloncesto";
  main.append(title);

  const footer = document.createElement("footer");
  footer.textContent = formatVersion(__APP_COMMIT__, __APP_BUILD_DATE__);

  app.append(main, footer);
}

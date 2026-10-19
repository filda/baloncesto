# Baloncesto

Jednoduchý extrapolační prediktor výsledku basketbalového zápasu.

## Popis funkcionality

Uživatel během zápasu opakovaně odečítá z tabule a zadává snímky: periodu, čas do konce periody a skóre domácího a hostujícího týmu. Aplikace z uběhlého času a rychlosti získávání bodů odhadne, kolik bodů který tým získá do konce zápasu. Do grafu vykreslí dvě křivky: skutečný průběh ze zadaných snímků a predikci do konce zápasu.
Zápasy se ukládají do localStorage.

### Pravidla zápasu

- Formát FIBA: 4 periody × 10 min.
- Prodloužení: perioda 5, 6, … = prodloužení po 5 min. V prodloužení se predikuje do konce aktuálního prodloužení.
- Čas se zadává jako `mm:ss` do konce periody (jako na tabuli), desetiny sekund se ignorují.

### Výpočetní model

- Lineární: tempo týmu = body / odehraný čas (za celý zápas); predikce = aktuální body + tempo × zbývající čas.
- Pokud je odehraný čas 0, predikce se nezobrazuje (jen známá data).
- Výstup: křivky + predikované konečné skóre (např. „82 : 76“) u konce grafu.
- Výpočet je čistá funkce v samostatném modulu, plně pokrytá unit testy.

### Data (localStorage)

- Zápas: id, názvy týmů, datum a čas, geolokace (souřadnice + název místa), seznam snímků `{perioda, zbývá, domácí, hosté}`.
- Klíč s verzí schématu (`baloncesto:v1`) pro budoucí migrace.
- Historie: seznam předchozích zápasů, otevření (pokračování / prohlížení grafu), smazání.

## Tech stack

- Vanilla TypeScript + Vite (dev server i build), bez frameworku.
- Graf: vlastní SVG, bez knihovny.
- Vitest (unit testy), Oxlint (lint), Oxfmt (formátování), Stryker (mutation testy).
- PWA: manifest + service worker (vite-plugin-pwa), funguje offline.
- GitHub workflow:
  - push na `main`: format check, lint, typecheck, testy, build → při úspěchu deploy do GitHub Pages (`base: /baloncesto/`).
  - Stryker: samostatný workflow spouštěný ručně (`workflow_dispatch`).
- Verze v patičce: commit hash (`GITHUB_SHA`, zkrácený) a datum buildu vložené přes Vite `define`.
- Lokální běh: `npm run dev`.

## UI

Vizuální směr: **papírový scoresheet**. Světlý papír, mřížka jako na zápisu o utkání, inkoustové barvy a rukopisné akcenty. Hlavně aby to nevypadalo jako všechny současné SPA, které generujou agenti.

- 4 inputy: perioda, čas, skóre domácí, skóre hosté + tlačítko pro přidání snímku.
- Validace vstupů: perioda ≥ 1, čas 0:00–10:00 (v prodloužení 5:00), skóre ≥ 0 a neklesající oproti předchozímu snímku.
- Graf zabírá většinu obrazovky, každý tým má svou křivku v pevné barvě (např. modrý a červený inkoust).
- Známá data sytější barvou, predikce světlejší (čárkovaně).
- Optimalizace pro mobilní obrazovku na výšku.
- Patička obsahuje verzi aplikace: commit hash a datum deploymentu.
- Možnost pojmenovat týmy.
- Tlačítko pro nový zápas: předvyplní datum, čas a geolokaci.
  - Geolokace přes Geolocation API, název místa přes reverse geocoding (Nominatim, dodržet usage policy, výsledek cachovat).
  - Při odmítnutí přístupu nebo bez sítě zůstane pole prázdné a jde vyplnit ručně.
- Historie zápasů (seznam, otevřít, smazat).

## Milníky

1. Scaffold (Vite + TS, Vitest, Oxlint, Oxfmt) + CI + deploy na GitHub Pages s verzí v patičce.
2. Doménový model: parsování času, převod perioda/čas → odehrané minuty, lineární predikce + testy.
3. UI vstupů a snímků + validace.
4. SVG graf (známá data + predikce, predikované skóre).
5. localStorage: ukládání, historie, otevření, smazání.
6. Nový zápas: pojmenování týmů, datum/čas, geolokace + reverse geocoding.
7. PWA (offline).
8. Stryker workflow.

## Agenti

S hlavním modelem domluvíme plán, ten potom deleguje úkoly na levnější submodely. Pokud není něco jasné, agent se zeptá. Jdeme nejrychlejší možnou cestou.

- Commity přímo do `main`, po každém dokončeném kroku se zelenými checky.
- Úkol je hotový, když projde format check, lint, typecheck, testy a build.
- Po změnách se pouštějí checky kromě mutation testů, ty se pouští na požádání uživatele.

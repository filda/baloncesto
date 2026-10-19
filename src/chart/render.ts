import type { Snapshot } from "../domain/predict";
import { computeChart } from "./geometry";
import type { Point, TeamSeries } from "./geometry";

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_LABEL_GAP = 14;

type Attrs = Record<string, string | number>;

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  text?: string,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

function points(list: Point[]): string {
  return list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function chartLabel(snapshots: Snapshot[], home: TeamSeries, away: TeamSeries): string {
  const last = snapshots.at(-1);
  if (!last) return "Score chart: no entries yet";
  const base = `Score chart: home ${last.home}, away ${last.away}`;
  if (home.finalLabel === null || away.finalLabel === null) return base;
  return `${base}, projected final ${home.finalLabel} : ${away.finalLabel}`;
}

/** Vertical positions of the two final labels, nudged apart when they would overlap. */
export function finalLabelYs(homeY: number, awayY: number): [number, number] {
  const gap = Math.abs(homeY - awayY);
  if (gap >= MIN_LABEL_GAP) return [homeY, awayY];
  const shift = (MIN_LABEL_GAP - gap) / 2;
  return homeY <= awayY ? [homeY - shift, awayY + shift] : [homeY + shift, awayY - shift];
}

export function renderChart(container: HTMLElement, snapshots: Snapshot[]): void {
  const width = Math.round(container.clientWidth);
  const height = Math.round(container.clientHeight);
  if (width <= 0 || height <= 0) {
    container.replaceChildren();
    return;
  }
  const model = computeChart(snapshots, width, height);
  const { plot } = model;

  const root = svg("svg", {
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
    role: "img",
    "aria-label": chartLabel(snapshots, model.home, model.away),
  });
  root.style.display = "block";

  const printed = {
    "font-family": "var(--printed-font)",
    fill: "var(--ink)",
  };

  for (const tick of model.yTicks) {
    root.append(
      svg("line", {
        x1: plot.left,
        x2: plot.right,
        y1: tick.y,
        y2: tick.y,
        stroke: "var(--ink)",
        "stroke-opacity": 0.14,
        "stroke-width": 1,
      }),
      svg(
        "text",
        {
          ...printed,
          x: plot.left - 5,
          y: tick.y,
          "text-anchor": "end",
          "dominant-baseline": "middle",
          "font-size": 10,
        },
        String(tick.value),
      ),
    );
  }

  for (const b of model.boundaries) {
    root.append(
      svg("line", {
        x1: b.x,
        x2: b.x,
        y1: plot.top,
        y2: plot.bottom,
        stroke: "var(--ink)",
        "stroke-opacity": 0.5,
        "stroke-width": 1,
        "stroke-dasharray": "3 3",
      }),
    );
  }
  for (const p of model.periodLabels) {
    root.append(
      svg(
        "text",
        {
          ...printed,
          x: p.x,
          y: plot.top - 7,
          "text-anchor": "middle",
          "font-size": 10,
          "letter-spacing": "0.14em",
        },
        p.label,
      ),
    );
  }

  root.append(
    svg("rect", {
      x: plot.left,
      y: plot.top,
      width: plot.right - plot.left,
      height: plot.bottom - plot.top,
      fill: "none",
      stroke: "var(--rule)",
      "stroke-width": 1,
    }),
  );

  if (snapshots.length === 0) {
    root.append(
      svg(
        "text",
        {
          ...printed,
          x: (plot.left + plot.right) / 2,
          y: (plot.top + plot.bottom) / 2,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": 12,
          "letter-spacing": "0.14em",
        },
        "RECORD THE FIRST SCORE",
      ),
    );
  }

  const homeTo = model.home.prediction?.to.y;
  const awayTo = model.away.prediction?.to.y;
  const [homeLabelY, awayLabelY] =
    homeTo !== undefined && awayTo !== undefined
      ? finalLabelYs(homeTo, awayTo)
      : [homeTo ?? 0, awayTo ?? 0];

  const teams: [string, TeamSeries, number][] = [
    ["var(--home)", model.home, homeLabelY],
    ["var(--away)", model.away, awayLabelY],
  ];
  for (const [color, team, labelY] of teams) {
    if (team.prediction) {
      const { from, to } = team.prediction;
      root.append(
        svg("line", {
          x1: from.x,
          y1: from.y,
          x2: to.x,
          y2: to.y,
          stroke: color,
          "stroke-opacity": 0.4,
          "stroke-width": 2.5,
          "stroke-dasharray": "6 4",
          "stroke-linecap": "round",
        }),
        svg("circle", {
          cx: to.x,
          cy: to.y,
          r: 4,
          fill: "var(--paper)",
          stroke: color,
          "stroke-width": 1.5,
        }),
        svg(
          "text",
          {
            x: to.x + 8,
            y: labelY,
            fill: color,
            "dominant-baseline": "middle",
            "font-family": "var(--hand-font)",
            "font-weight": 700,
            "font-size": 20,
          },
          String(team.finalLabel),
        ),
      );
    }
    root.append(
      svg("polyline", {
        points: points(team.known),
        fill: "none",
        stroke: color,
        "stroke-width": 2.5,
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
    for (const p of team.known.slice(team.known.length - snapshots.length)) {
      root.append(svg("circle", { cx: p.x, cy: p.y, r: 3, fill: color }));
    }
  }

  container.replaceChildren(root);
}

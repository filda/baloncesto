// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { renderChart } from "../../src/chart/render";
import type { Snapshot } from "../../src/domain/predict";

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement("div");
  Object.defineProperty(container, "clientWidth", { value: 338 });
  Object.defineProperty(container, "clientHeight", { value: 222 });
  document.body.replaceChildren(container);
});

const worked: Snapshot[] = [{ period: 3, remaining: 432, home: 48, away: 45 }];
const bands = () => [...container.querySelectorAll<SVGPathElement>("path.band")];
const rangeLabels = () => [...container.querySelectorAll("text.range-label")];

describe("range band", () => {
  it("draws one low-opacity filled path per team without a stroke", () => {
    renderChart(container, worked);
    const [home, away] = bands();
    expect(bands()).toHaveLength(2);
    expect(home?.getAttribute("fill")).toBe("var(--home)");
    expect(away?.getAttribute("fill")).toBe("var(--away)");
    for (const band of bands()) {
      expect(band.getAttribute("fill-opacity")).toBe("0.12");
      expect(band.getAttribute("stroke")).toBe("none");
      expect(band.getAttribute("d")).toMatch(/^M[\d.]+,[\d.-]+(L[\d.]+,[\d.-]+){25}Z$/);
    }
  });

  it("puts the bands underneath the dashed prediction lines", () => {
    renderChart(container, worked);
    const children = [...(container.querySelector("svg")?.children ?? [])];
    const lastBand = Math.max(...bands().map((b) => children.indexOf(b)));
    const firstDash = children.findIndex((c) => c.getAttribute("stroke-dasharray") === "6 4");
    expect(lastBand).toBeGreaterThanOrEqual(0);
    expect(lastBand).toBeLessThan(firstDash);
  });

  it("draws no band without a prediction", () => {
    renderChart(container, []);
    expect(bands()).toHaveLength(0);
    expect(rangeLabels()).toHaveLength(0);
    renderChart(container, [{ period: 1, remaining: 600, home: 0, away: 0 }]);
    expect(bands()).toHaveLength(0);
  });
});

describe("range labels", () => {
  it("prints the min–max in the team colour next to each final", () => {
    renderChart(container, worked);
    const labels = rangeLabels();
    expect(labels.map((l) => l.textContent)).toEqual(["68–101", "63–95"]);
    expect(labels.map((l) => l.getAttribute("fill"))).toEqual(["var(--home)", "var(--away)"]);
    expect(labels.every((l) => l.getAttribute("text-anchor") === "end")).toBe(true);
    expect(labels.every((l) => l.getAttribute("x") === "336")).toBe(true);
  });

  it("keeps the labels apart: the upper one above its final, the lower one below", () => {
    renderChart(container, worked);
    const finals = [...container.querySelectorAll("text")].filter(
      (t) => t.getAttribute("font-family") === "var(--hand-font)",
    );
    const [homeFinal, awayFinal] = finals.map((t) => Number(t.getAttribute("y")));
    const [homeRange, awayRange] = rangeLabels().map((t) => Number(t.getAttribute("y")));
    // home 84 is above away 79 on screen (smaller y)
    expect(homeRange).toBeLessThan(homeFinal ?? 0);
    expect(awayRange).toBeGreaterThan(awayFinal ?? 0);
  });

  it("adds the ranges to the aria-label", () => {
    renderChart(container, worked);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toBe(
      "Score chart: Home 48, Away 45, projected final 84 : 79 (home 68–101, away 63–95)",
    );
  });
});

import { describe, expect, it } from "vitest";
import { chartLabel, rangeLabelYs, rangeText } from "../../src/chart/render";

const series = (finalLabel: string | null, range: { low: number; high: number } | null = null) =>
  ({ finalLabel, range }) as never;

describe("chartLabel", () => {
  const last = [{ period: 2, remaining: 300, home: 30, away: 24 }];

  it("describes an empty chart", () => {
    expect(chartLabel([], series(null), series(null))).toBe("Score chart: no entries yet");
  });

  it("uses default and custom team names", () => {
    expect(chartLabel(last, series(null), series(null))).toBe("Score chart: Home 30, Away 24");
    expect(chartLabel(last, series("80"), series("64"), { home: "Lakers", away: "Celtics" })).toBe(
      "Score chart: Lakers 30, Celtics 24, projected final 80 : 64",
    );
  });

  it("appends the ranges when present", () => {
    const home = series("84", { low: 72, high: 96 });
    const away = series("79", { low: 67, high: 91 });
    expect(chartLabel(last, home, away)).toBe(
      "Score chart: Home 30, Away 24, projected final 84 : 79 (home 72–96, away 67–91)",
    );
  });
});

describe("rangeText", () => {
  it("joins min and max with an en dash", () => {
    expect(rangeText({ low: 72, high: 96 })).toBe("72–96");
  });
});

describe("rangeLabelYs", () => {
  it("puts the upper label's range above and the lower label's below", () => {
    expect(rangeLabelYs(50, 80)).toEqual([35, 95]);
    expect(rangeLabelYs(80, 50)).toEqual([95, 35]);
    expect(rangeLabelYs(60, 60)).toEqual([45, 75]);
  });
});

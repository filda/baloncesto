import { describe, expect, it } from "vitest";
import { chartLabel } from "../../src/chart/render";

const series = (finalLabel: string | null) => ({ finalLabel }) as never;

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
});

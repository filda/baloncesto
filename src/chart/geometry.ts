import {
  OVERTIME_LENGTH,
  REGULATION_LENGTH,
  REGULATION_PERIODS,
  elapsedSeconds,
  gameEndSeconds,
} from "../domain/clock";
import { predict, roundScore } from "../domain/predict";
import type { Snapshot } from "../domain/predict";

export const PADDING = { top: 22, right: 38, bottom: 10, left: 30 } as const;

const REGULATION_END = REGULATION_PERIODS * REGULATION_LENGTH;
const PERIOD_BOUNDS = Array.from(
  { length: REGULATION_PERIODS + 1 },
  (_, i) => i * REGULATION_LENGTH,
);

export interface Point {
  x: number;
  y: number;
}

export interface Tick {
  value: number;
  y: number;
}

export interface Boundary {
  seconds: number;
  x: number;
}

export interface PeriodLabel {
  label: string;
  x: number;
}

export interface TeamSeries {
  known: Point[];
  prediction: { from: Point; to: Point } | null;
  finalLabel: number | null;
}

export interface ChartModel {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  end: number;
  yMax: number;
  yTicks: Tick[];
  boundaries: Boundary[];
  periodLabels: PeriodLabel[];
  home: TeamSeries;
  away: TeamSeries;
}

type Team = "home" | "away";

export function computeChart(snapshots: Snapshot[], width: number, height: number): ChartModel {
  const plot = {
    left: PADDING.left,
    top: PADDING.top,
    right: width - PADDING.right,
    bottom: height - PADDING.bottom,
  };
  const last = snapshots.at(-1);
  const end = last ? gameEndSeconds(last.period) : REGULATION_END;
  const prediction = last ? predict(last) : null;

  const peak = Math.max(
    10,
    ...snapshots.flatMap((s) => [s.home, s.away]),
    ...(prediction ? [prediction.home, prediction.away] : []),
  );
  const yMax = Math.ceil((peak * 11) / 100) * 10;
  const step = yMax <= 60 ? 10 : 20;

  const x = (seconds: number): number => plot.left + (seconds / end) * (plot.right - plot.left);
  const y = (points: number): number => plot.bottom - (points / yMax) * (plot.bottom - plot.top);

  const yTicks: Tick[] = [];
  for (let value = 0; value <= yMax; value += step) yTicks.push({ value, y: y(value) });

  const edges = [...PERIOD_BOUNDS];
  for (let t = REGULATION_END + OVERTIME_LENGTH; t <= end; t += OVERTIME_LENGTH) edges.push(t);
  const boundaries: Boundary[] = edges
    .filter((seconds) => seconds > 0 && seconds < end)
    .map((seconds) => ({ seconds, x: x(seconds) }));
  const periodLabels: PeriodLabel[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const label = i < 4 ? String(i + 1) : `P${i - 3}`;
    periodLabels.push({ label, x: x((edges[i] + edges[i + 1]) / 2) });
  }

  function series(team: Team): TeamSeries {
    const known: Point[] = [];
    const first = snapshots[0];
    if (!first || elapsedSeconds(first.period, first.remaining) > 0) {
      known.push({ x: x(0), y: y(0) });
    }
    for (const s of snapshots) {
      known.push({ x: x(elapsedSeconds(s.period, s.remaining)), y: y(s[team]) });
    }
    if (!prediction) return { known, prediction: null, finalLabel: null };
    return {
      known,
      prediction: {
        from: known[known.length - 1],
        to: { x: x(end), y: y(prediction[team]) },
      },
      finalLabel: roundScore(prediction[team]),
    };
  }

  return {
    width,
    height,
    plot,
    end,
    yMax,
    yTicks,
    boundaries,
    periodLabels,
    home: series("home"),
    away: series("away"),
  };
}

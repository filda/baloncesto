import { formatClock } from "../domain/clock";
import { predict } from "../domain/predict";
import type { Prediction, Snapshot } from "../domain/predict";
import type { SnapshotInput } from "../domain/validate";

export interface Match {
  snapshots: Snapshot[];
}

export function emptyMatch(): Match {
  return { snapshots: [] };
}

export function addSnapshot(match: Match, snapshot: Snapshot): Match {
  return { snapshots: [...match.snapshots, snapshot] };
}

export function removeLastSnapshot(match: Match): Match {
  return { snapshots: match.snapshots.slice(0, -1) };
}

export function lastSnapshot(match: Match): Snapshot | null {
  return match.snapshots.at(-1) ?? null;
}

export function currentPrediction(match: Match): Prediction | null {
  const last = lastSnapshot(match);
  return last ? predict(last) : null;
}

export function nextInputDefaults(match: Match): SnapshotInput {
  const last = lastSnapshot(match);
  if (!last) return { period: "1", clock: "10:00", home: "0", away: "0" };
  return {
    period: String(last.period),
    clock: formatClock(last.remaining),
    home: String(last.home),
    away: String(last.away),
  };
}

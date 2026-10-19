export function formatVersion(commit: string, buildDate: string): string {
  const date = new Date(buildDate);
  const day = Number.isNaN(date.getTime()) ? buildDate : date.toISOString().slice(0, 10);
  return `version ${commit} · ${day}`;
}

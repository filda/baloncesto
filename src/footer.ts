export function formatVersion(commit: string, buildDate: string): string {
  const date = new Date(buildDate);
  return `version ${commit} · ${date.toISOString().slice(0, 10)}`;
}

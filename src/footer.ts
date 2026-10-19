export function formatVersion(commit: string, buildDate: string): string {
  const date = new Date(buildDate);
  const formatted = `${date.getUTCDate()}. ${date.getUTCMonth() + 1}. ${date.getUTCFullYear()}`;
  return `verze ${commit} · ${formatted}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local date and time as "yyyy-mm-dd hh:mm"; unparsable input is returned unchanged. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

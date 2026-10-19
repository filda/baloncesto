export type Route = "sheet" | "history" | "new";

export const ROUTE_HASH: Record<Route, string> = {
  sheet: "#/",
  history: "#/history",
  new: "#/new",
};

export interface ResolvedRoute {
  route: Route;
  /** False for an unrecognised hash; the caller should rewrite the URL to `ROUTE_HASH[route]`. */
  known: boolean;
}

/** Maps a location hash to a route. Empty and bare "#" mean the sheet; anything else unknown too. */
export function resolveHash(hash: string): ResolvedRoute {
  if (hash === "" || hash === "#" || hash === ROUTE_HASH.sheet)
    return { route: "sheet", known: true };
  if (hash === ROUTE_HASH.history) return { route: "history", known: true };
  if (hash === ROUTE_HASH.new) return { route: "new", known: true };
  return { route: "sheet", known: false };
}

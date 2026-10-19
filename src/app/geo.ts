import type { KeyValueStorage } from "./storage";

export const GEOCACHE_KEY = "baloncesto:geocache";
export const GEOCACHE_MAX_ENTRIES = 50;

export interface Coords {
  lat: number;
  lon: number;
}

export type LocationStatus = "locating" | "located" | "unavailable" | "place-unavailable";

export const STATUS_TEXT: Record<LocationStatus, string> = {
  locating: "Locating…",
  located: "Located",
  unavailable: "Location unavailable",
  "place-unavailable": "Place unavailable",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function firstText(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(record[key]);
    if (value !== null) return value;
  }
  return null;
}

/**
 * Readable place from a Nominatim `jsonv2` reverse result: venue (name, else amenity / leisure /
 * building) plus city, e.g. "Sportovní hala, Brno"; otherwise road plus city. A bare city or road
 * is still returned; null when nothing usable is present.
 */
export function placeFromNominatim(json: unknown): string | null {
  if (!isRecord(json)) return null;
  const address = isRecord(json.address) ? json.address : {};
  const building = text(address.building);
  const venue =
    text(json.name) ??
    firstText(address, ["amenity", "leisure"]) ??
    (building !== null && building !== "yes" ? building : null);
  const city = firstText(address, ["city", "town", "village", "municipality"]);
  const primary = venue ?? text(address.road);
  if (primary === null) return city;
  return city === null || city === primary ? primary : `${primary}, ${city}`;
}

/** Coordinates rounded to 3 decimals (~100 m), used as the cache key. */
export function cacheKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`;
}

type GeoCache = Record<string, string>;

function readCache(storage: KeyValueStorage | null): GeoCache {
  if (!storage) return {};
  try {
    const raw = storage.getItem(GEOCACHE_KEY);
    if (raw === null) return {};
    const data: unknown = JSON.parse(raw);
    if (!isRecord(data)) return {};
    const cache: GeoCache = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === "string") cache[key] = value;
    }
    return cache;
  } catch {
    return {};
  }
}

export function getCachedPlace(
  storage: KeyValueStorage | null,
  lat: number,
  lon: number,
): string | null {
  return readCache(storage)[cacheKey(lat, lon)] ?? null;
}

/** Stores a place; the oldest entries (insertion order) are dropped beyond the limit. */
export function putCachedPlace(
  storage: KeyValueStorage | null,
  lat: number,
  lon: number,
  place: string,
): void {
  if (!storage) return;
  const cache = readCache(storage);
  const key = cacheKey(lat, lon);
  delete cache[key];
  cache[key] = place;
  const keys = Object.keys(cache);
  for (const old of keys.slice(0, Math.max(0, keys.length - GEOCACHE_MAX_ENTRIES))) {
    delete cache[old];
  }
  try {
    storage.setItem(GEOCACHE_KEY, JSON.stringify(cache));
  } catch {
    // The cache is an optimisation only.
  }
}

export function nominatimUrl(lat: number, lon: number): string {
  return `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17`;
}

export interface LocateDeps {
  /** Rejects when the position cannot be obtained (denied, timeout, unsupported). */
  getPosition(): Promise<Coords>;
  /** Resolves with parsed JSON; rejects on network or HTTP errors. */
  fetchJson(url: string): Promise<unknown>;
  storage: KeyValueStorage | null;
}

export interface LocateUpdate {
  status: LocationStatus;
  coords?: Coords;
  place?: string;
}

/**
 * One position lookup and at most one reverse-geocoding request, no retries.
 * `onUpdate` receives each status change; place is set once it is known.
 */
export async function locate(
  deps: LocateDeps,
  onUpdate: (update: LocateUpdate) => void,
): Promise<void> {
  onUpdate({ status: "locating" });
  let coords: Coords;
  try {
    coords = await deps.getPosition();
  } catch {
    onUpdate({ status: "unavailable" });
    return;
  }
  const cached = getCachedPlace(deps.storage, coords.lat, coords.lon);
  if (cached !== null) {
    onUpdate({ status: "located", coords, place: cached });
    return;
  }
  onUpdate({ status: "located", coords });
  let place: string | null = null;
  try {
    place = placeFromNominatim(await deps.fetchJson(nominatimUrl(coords.lat, coords.lon)));
  } catch {
    place = null;
  }
  if (place === null) {
    onUpdate({ status: "place-unavailable", coords });
    return;
  }
  putCachedPlace(deps.storage, coords.lat, coords.lon, place);
  onUpdate({ status: "located", coords, place });
}

/** Wraps navigator.geolocation (cheap position: no high accuracy, 10 s timeout, 10 min cache). */
export function browserGetPosition(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
      (error) => reject(new Error(error.message)),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
    );
  });
}

export const FETCH_TIMEOUT_MS = 8000;

/** A hanging request is aborted after the timeout so the lookup ends as "place-unavailable". */
export async function browserFetchJson(
  url: string,
  signal: AbortSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS),
): Promise<unknown> {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

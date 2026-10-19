import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GEOCACHE_KEY,
  GEOCACHE_MAX_ENTRIES,
  STATUS_TEXT,
  browserFetchJson,
  browserGetPosition,
  cacheKey,
  getCachedPlace,
  locate,
  nominatimUrl,
  placeFromNominatim,
  putCachedPlace,
} from "../../src/app/geo";
import type { LocateDeps, LocateUpdate } from "../../src/app/geo";
import type { KeyValueStorage } from "../../src/app/storage";

class FakeStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

describe("placeFromNominatim", () => {
  it("combines the venue name with the city", () => {
    expect(
      placeFromNominatim({ name: "Sportovní hala", address: { city: "Brno", road: "Ulice" } }),
    ).toBe("Sportovní hala, Brno");
  });

  it("uses town or village when there is no city", () => {
    expect(placeFromNominatim({ name: "Hala", address: { town: "Tábor" } })).toBe("Hala, Tábor");
    expect(placeFromNominatim({ name: "Hala", address: { village: "Lhota" } })).toBe("Hala, Lhota");
  });

  it("falls back to amenity, leisure and building when the name is empty", () => {
    expect(placeFromNominatim({ name: "", address: { amenity: "School", city: "Brno" } })).toBe(
      "School, Brno",
    );
    expect(placeFromNominatim({ address: { leisure: "Sports Centre", city: "Brno" } })).toBe(
      "Sports Centre, Brno",
    );
    expect(placeFromNominatim({ address: { building: "Gym", city: "Brno" } })).toBe("Gym, Brno");
  });

  it("ignores the generic building value yes", () => {
    expect(
      placeFromNominatim({ address: { building: "yes", road: "Main St", city: "Brno" } }),
    ).toBe("Main St, Brno");
  });

  it("falls back to road plus city, or road alone", () => {
    expect(placeFromNominatim({ address: { road: "Main St", city: "Brno" } })).toBe(
      "Main St, Brno",
    );
    expect(placeFromNominatim({ address: { road: "Main St" } })).toBe("Main St");
  });

  it("does not repeat a name equal to the city", () => {
    expect(placeFromNominatim({ name: "Brno", address: { city: "Brno" } })).toBe("Brno");
  });

  it("returns a bare city when it is all there is", () => {
    expect(placeFromNominatim({ address: { city: "Brno" } })).toBe("Brno");
  });

  it("returns null when nothing is usable", () => {
    expect(placeFromNominatim(null)).toBeNull();
    expect(placeFromNominatim("x")).toBeNull();
    expect(placeFromNominatim({})).toBeNull();
    expect(placeFromNominatim({ name: " ", address: { country: "Czechia" } })).toBeNull();
    expect(placeFromNominatim({ name: 5, address: "x" })).toBeNull();
  });
});

describe("cacheKey", () => {
  it("rounds to 3 decimals", () => {
    expect(cacheKey(50.08046, 14.42074)).toBe("50.080,14.421");
    expect(cacheKey(50.0801, 14.4209)).toBe("50.080,14.421");
    expect(cacheKey(-1, 2)).toBe("-1.000,2.000");
  });
});

describe("geocode cache", () => {
  it("stores and reads places under the rounded key", () => {
    const storage = new FakeStorage();
    expect(getCachedPlace(storage, 50.0801, 14.4209)).toBeNull();
    putCachedPlace(storage, 50.0801, 14.4209, "Hall, Prague");
    expect(getCachedPlace(storage, 50.0803, 14.4207)).toBe("Hall, Prague");
    expect(JSON.parse(storage.data.get(GEOCACHE_KEY) as string)).toEqual({
      "50.080,14.421": "Hall, Prague",
    });
  });

  it("drops the oldest entries beyond the limit", () => {
    const storage = new FakeStorage();
    for (let i = 0; i < GEOCACHE_MAX_ENTRIES + 3; i++) putCachedPlace(storage, i, 0, `P${i}`);
    const cache = JSON.parse(storage.data.get(GEOCACHE_KEY) as string) as Record<string, string>;
    expect(Object.keys(cache)).toHaveLength(GEOCACHE_MAX_ENTRIES);
    expect(getCachedPlace(storage, 0, 0)).toBeNull();
    expect(getCachedPlace(storage, 2, 0)).toBeNull();
    expect(getCachedPlace(storage, 3, 0)).toBe("P3");
    expect(getCachedPlace(storage, GEOCACHE_MAX_ENTRIES + 2, 0)).toBe(
      `P${GEOCACHE_MAX_ENTRIES + 2}`,
    );
  });

  it("refreshes an existing key as the newest", () => {
    const storage = new FakeStorage();
    for (let i = 0; i < GEOCACHE_MAX_ENTRIES; i++) putCachedPlace(storage, i, 0, `P${i}`);
    putCachedPlace(storage, 0, 0, "again");
    putCachedPlace(storage, 99, 0, "new");
    expect(getCachedPlace(storage, 0, 0)).toBe("again");
    expect(getCachedPlace(storage, 1, 0)).toBeNull();
  });

  it("tolerates missing storage, corrupt data and write failures", () => {
    expect(getCachedPlace(null, 1, 2)).toBeNull();
    expect(() => putCachedPlace(null, 1, 2, "x")).not.toThrow();
    const corrupt = new FakeStorage();
    corrupt.setItem(GEOCACHE_KEY, "{nope");
    expect(getCachedPlace(corrupt, 1, 2)).toBeNull();
    putCachedPlace(corrupt, 1, 2, "x");
    expect(getCachedPlace(corrupt, 1, 2)).toBe("x");
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem() {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem() {},
    };
    expect(() => putCachedPlace(full, 1, 2, "x")).not.toThrow();
  });

  it("ignores non-string entries and non-object data", () => {
    const storage = new FakeStorage();
    storage.setItem(GEOCACHE_KEY, JSON.stringify({ "1.000,2.000": 5, "3.000,4.000": "ok" }));
    expect(getCachedPlace(storage, 1, 2)).toBeNull();
    expect(getCachedPlace(storage, 3, 4)).toBe("ok");
    storage.setItem(GEOCACHE_KEY, "[]");
    expect(getCachedPlace(storage, 3, 4)).toBeNull();
  });
});

describe("nominatimUrl", () => {
  it("builds the reverse-geocoding request", () => {
    expect(nominatimUrl(49.2, 16.6)).toBe(
      "https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=49.2&lon=16.6&zoom=17",
    );
  });
});

describe("locate", () => {
  function run(overrides: Partial<LocateDeps>) {
    const storage = new FakeStorage();
    const urls: string[] = [];
    const deps: LocateDeps = {
      getPosition: () => Promise.resolve({ lat: 49.2, lon: 16.6 }),
      fetchJson: (url) => {
        urls.push(url);
        return Promise.resolve({ name: "Hala", address: { city: "Brno" } });
      },
      storage,
      ...overrides,
    };
    const updates: LocateUpdate[] = [];
    const done = locate(deps, (u) => updates.push(u));
    return { done, updates, urls, storage: deps.storage };
  }

  it("locates, geocodes once and caches the result", async () => {
    const r = run({});
    await r.done;
    expect(r.updates.map((u) => u.status)).toEqual(["locating", "located", "located"]);
    expect(r.updates.at(-1)).toEqual({
      status: "located",
      coords: { lat: 49.2, lon: 16.6 },
      place: "Hala, Brno",
    });
    expect(r.urls).toEqual([nominatimUrl(49.2, 16.6)]);
    expect(getCachedPlace(r.storage, 49.2, 16.6)).toBe("Hala, Brno");
  });

  it("uses the cache without a request", async () => {
    const storage = new FakeStorage();
    putCachedPlace(storage, 49.2, 16.6, "Cached");
    const r = run({ storage });
    await r.done;
    expect(r.urls).toEqual([]);
    expect(r.updates.at(-1)).toEqual({
      status: "located",
      coords: { lat: 49.2, lon: 16.6 },
      place: "Cached",
    });
  });

  it("reports unavailable location without any request", async () => {
    const r = run({ getPosition: () => Promise.reject(new Error("denied")) });
    await r.done;
    expect(r.updates.map((u) => u.status)).toEqual(["locating", "unavailable"]);
    expect(r.urls).toEqual([]);
  });

  it("keeps the coordinates when the fetch fails, without retrying", async () => {
    let calls = 0;
    const r = run({
      fetchJson: () => {
        calls++;
        return Promise.reject(new Error("offline"));
      },
    });
    await r.done;
    expect(calls).toBe(1);
    expect(r.updates.at(-1)).toEqual({
      status: "place-unavailable",
      coords: { lat: 49.2, lon: 16.6 },
    });
    expect(getCachedPlace(r.storage, 49.2, 16.6)).toBeNull();
  });

  it("reports place unavailable when the response has nothing usable", async () => {
    const r = run({ fetchJson: () => Promise.resolve({ error: "Unable to geocode" }) });
    await r.done;
    expect(r.updates.at(-1)?.status).toBe("place-unavailable");
    expect(getCachedPlace(r.storage, 49.2, 16.6)).toBeNull();
  });
});

describe("constants", () => {
  it("exposes stable keys and status texts", () => {
    expect(GEOCACHE_KEY).toBe("baloncesto:geocache");
    expect(STATUS_TEXT).toEqual({
      locating: "Locating…",
      located: "Located",
      unavailable: "Location unavailable",
      "place-unavailable": "Place unavailable",
    });
  });
});

describe("placeFromNominatim fallbacks", () => {
  it("ignores the generic building value yes but uses a named building", () => {
    expect(
      placeFromNominatim({ address: { building: "yes", road: "Main St", city: "Brno" } }),
    ).toBe("Main St, Brno");
    expect(
      placeFromNominatim({ address: { building: "Gym", road: "Main St", city: "Brno" } }),
    ).toBe("Gym, Brno");
  });

  it("falls back through town, village and municipality", () => {
    expect(placeFromNominatim({ address: { town: "Tn", road: "R" } })).toBe("R, Tn");
    expect(placeFromNominatim({ address: { village: "Vl", road: "R" } })).toBe("R, Vl");
    expect(placeFromNominatim({ address: { municipality: "Mu", road: "R" } })).toBe("R, Mu");
    expect(placeFromNominatim({ address: { municipality: "Mu" } })).toBe("Mu");
  });
});

describe("browser wrappers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects when geolocation is unsupported", async () => {
    vi.stubGlobal("navigator", {});
    await expect(browserGetPosition()).rejects.toThrow("Geolocation is not supported");
    vi.stubGlobal("navigator", undefined);
    await expect(browserGetPosition()).rejects.toThrow("Geolocation is not supported");
  });

  it("resolves coordinates and requests a cheap position", async () => {
    const getCurrentPosition = vi.fn(
      (ok: (p: unknown) => void, _fail: unknown, _options: unknown) =>
        ok({ coords: { latitude: 49.2, longitude: 16.6 } }),
    );
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition } });
    await expect(browserGetPosition()).resolves.toEqual({ lat: 49.2, lon: 16.6 });
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(getCurrentPosition.mock.calls[0]?.[2]).toEqual({
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    });
  });

  it("rejects with the error message when the position fails", async () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_ok: unknown, fail: (e: { message: string }) => void) =>
          fail({ message: "User denied" }),
      },
    });
    await expect(browserGetPosition()).rejects.toThrow("User denied");
  });

  it("fetches JSON with an Accept header", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ a: 1 }) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(browserFetchJson("https://example.test/x")).resolves.toEqual({ a: 1 });
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/x", {
      headers: { Accept: "application/json" },
    });
  });

  it("rejects on a non-OK response without reading the body", async () => {
    const json = vi.fn();
    vi.stubGlobal("fetch", () => Promise.resolve({ ok: false, status: 503, json }));
    await expect(browserFetchJson("https://example.test/x")).rejects.toThrow("HTTP 503");
    expect(json).not.toHaveBeenCalled();
  });
});

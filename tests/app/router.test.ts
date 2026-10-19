import { describe, expect, it } from "vitest";
import { ROUTE_HASH, resolveHash } from "../../src/app/router";

describe("resolveHash", () => {
  it.each([
    ["", "sheet"],
    ["#", "sheet"],
    ["#/", "sheet"],
    ["#/history", "history"],
    ["#/new", "new"],
  ] as const)("resolves %j to the known route %s", (hash, route) => {
    expect(resolveHash(hash)).toEqual({ route, known: true });
  });

  it.each(["#/nope", "#/history/", "#history", "#/NEW", "garbage", "#/ "])(
    "falls back to the sheet for the unknown hash %j",
    (hash) => {
      expect(resolveHash(hash)).toEqual({ route: "sheet", known: false });
    },
  );

  it("exposes the canonical hash of every route", () => {
    expect(ROUTE_HASH).toEqual({ sheet: "#/", history: "#/history", new: "#/new" });
    for (const [route, hash] of Object.entries(ROUTE_HASH)) {
      expect(resolveHash(hash)).toEqual({ route, known: true });
    }
  });
});

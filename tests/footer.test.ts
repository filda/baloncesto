import { describe, expect, it } from "vitest";
import { formatVersion } from "../src/footer";

describe("formatVersion", () => {
  it("formats commit and ISO date", () => {
    expect(formatVersion("a1b2c3d", "2026-10-19T08:30:00.000Z")).toBe(
      "version a1b2c3d · 2026-10-19",
    );
  });

  it("uses UTC and zero-pads", () => {
    expect(formatVersion("dev", "2026-01-05T23:59:59.000Z")).toBe("version dev · 2026-01-05");
  });

  it("renders the raw string when the date is invalid", () => {
    expect(formatVersion("dev", "not-a-date")).toBe("version dev · not-a-date");
    expect(formatVersion("dev", "")).toBe("version dev · ");
  });

  it("exposes test globals", () => {
    expect(__APP_COMMIT__).toBe("test123");
  });
});

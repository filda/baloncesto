import { describe, expect, it } from "vitest";
import { formatVersion } from "../src/footer";

describe("formatVersion", () => {
  it("formats commit and Czech date", () => {
    expect(formatVersion("a1b2c3d", "2026-10-19T08:30:00.000Z")).toBe(
      "verze a1b2c3d · 19. 10. 2026",
    );
  });

  it("uses UTC and does not zero-pad", () => {
    expect(formatVersion("dev", "2026-01-05T23:59:59.000Z")).toBe("verze dev · 5. 1. 2026");
  });

  it("exposes test globals", () => {
    expect(__APP_COMMIT__).toBe("test123");
  });
});

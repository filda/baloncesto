import { describe, expect, it } from "vitest";
import { formatDateTime } from "../../src/app/format";

describe("formatDateTime", () => {
  it("formats local date and time with zero padding", () => {
    expect(formatDateTime(new Date(2026, 0, 5, 7, 3).toISOString())).toBe("2026-01-05 07:03");
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59).toISOString())).toBe("2026-12-31 23:59");
  });

  it("returns unparsable input unchanged", () => {
    expect(formatDateTime("nope")).toBe("nope");
  });
});

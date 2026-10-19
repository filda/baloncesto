import { describe, expect, it } from "vitest";
import { parseClock } from "../../src/domain/clock";
import { completeClockInput, formatClockInput } from "../../src/domain/clock-input";

describe("formatClockInput", () => {
  it.each([
    ["", ""],
    ["5", "5"],
    ["0", "0"],
    ["53", "5:3"],
    ["530", "5:30"],
    ["1000", "10:00"],
    ["1234", "12:34"],
    ["12345", "12:34"],
    ["0007", "00:07"],
    ["007", "0:07"],
    ["1:23", "1:23"],
    ["10:00", "10:00"],
    ["5:30", "5:30"],
    ["abc", ""],
    ["a1b2c3", "1:23"],
    [" 5 : 3 0 ", "5:30"],
    ["5.30", "5:30"],
    [":", ""],
  ])("formats %j as %j", (raw, expected) => {
    expect(formatClockInput(raw)).toBe(expected);
  });

  it("is idempotent", () => {
    for (const raw of ["", "5", "53", "530", "1000", "12345", "0007", "a1b2"]) {
      const once = formatClockInput(raw);
      expect(formatClockInput(once)).toBe(once);
    }
  });

  it("produces values that parseClock accepts when complete", () => {
    expect(parseClock(formatClockInput("530"))).toBe(330);
    expect(parseClock(formatClockInput("1000"))).toBe(600);
    expect(parseClock(formatClockInput("007"))).toBe(7);
    expect(parseClock(formatClockInput("0007"))).toBe(7);
    expect(parseClock(formatClockInput("1:23"))).toBe(83);
  });

  it("does not treat incomplete values as valid", () => {
    expect(parseClock(formatClockInput("5"))).toBeNull();
    expect(parseClock(formatClockInput("53"))).toBeNull();
  });
});

describe("completeClockInput", () => {
  it.each([
    ["", ""],
    ["4", "4:00"],
    ["0", "0:00"],
    ["9", "9:00"],
    ["4:4", "4:40"],
    ["0:0", "0:00"],
    ["10:5", "10:50"],
    ["5:30", "5:30"],
    ["10:00", "10:00"],
    ["00:07", "00:07"],
    ["44", "44"],
    ["123", "123"],
    ["4:", "4:"],
    [":4", ":4"],
    ["4:444", "4:444"],
    ["100:5", "100:5"],
    ["abc", "abc"],
    [" 4", " 4"],
    ["4 ", "4 "],
    ["4:4 ", "4:4 "],
    ["4:x", "4:x"],
    ["x:4", "x:4"],
  ])("completes %j to %j", (value, expected) => {
    expect(completeClockInput(value)).toBe(expected);
  });

  it("completes typed digits to a value parseClock accepts", () => {
    expect(parseClock(completeClockInput(formatClockInput("44")))).toBe(280);
    expect(parseClock(completeClockInput(formatClockInput("4")))).toBe(240);
    expect(parseClock(completeClockInput(formatClockInput("1")))).toBe(60);
  });

  it("always yields a parsable time when the typed digits form a valid time", () => {
    for (let length = 1; length <= 4; length++) {
      for (let n = 0; n < 10 ** length; n++) {
        const digits = String(n).padStart(length, "0");
        const formatted = formatClockInput(digits);
        const completed = completeClockInput(formatted);
        const [minutes = "", rest = ""] = formatted.split(":");
        const seconds = formatted.includes(":") ? (rest.length === 1 ? rest + "0" : rest) : "00";
        if (Number(seconds) >= 60 || minutes === "") continue;
        expect(parseClock(completed)).toBe(Number(minutes) * 60 + Number(seconds));
      }
    }
  });
});

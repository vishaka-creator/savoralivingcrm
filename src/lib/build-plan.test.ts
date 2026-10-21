import { describe, expect, it } from "vitest";
import { parseSetsPlanned, tomorrowInIndia } from "./build-plan";

describe("tomorrowInIndia", () => {
  it("uses India time: 20:00 UTC on Oct 21 is already Oct 22 in India, so tomorrow is Oct 23", () => {
    expect(tomorrowInIndia(new Date("2026-10-21T20:00:00Z"))).toBe("2026-10-23");
  });
  it("10:06 UTC on Oct 21 gives Oct 22", () => {
    expect(tomorrowInIndia(new Date("2026-10-21T10:06:00Z"))).toBe("2026-10-22");
  });
});

describe("parseSetsPlanned", () => {
  it("accepts whole numbers", () => expect(parseSetsPlanned("12")).toBe(12));
  it("treats blank as 0", () => expect(parseSetsPlanned("")).toBe(0));
  it("rejects negatives and decimals", () => {
    expect(parseSetsPlanned("-3")).toBeNull();
    expect(parseSetsPlanned("2.5")).toBeNull();
  });
});

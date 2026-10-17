import Decimal from "decimal.js";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("humo", () => {
  it("las dependencias base cargan", () => {
    expect(new Decimal("3800000").div("18.50").toFixed(0)).toBe("205405");
    expect(z.number().int().parse(298000)).toBe(298000);
    fc.assert(fc.property(fc.integer(), (n) => n + 0 === n));
  });
});

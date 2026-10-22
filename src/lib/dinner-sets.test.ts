import { describe, expect, it } from "vitest";
import { computeDinnerSet, defaultDinnerRecipe, matchWareForPiece, parseQtyPerSet } from "./dinner-sets";

const stock = new Map([
  ["platter", 9],
  ["dinner", 52],
  ["quarter", 40],
  ["katori", 36],
  ["serving", 14],
]);
const skuFor: Record<string, string> = {
  "Regal platter": "platter",
  "Dinner plate": "dinner",
  "Quarter plate": "quarter",
  Katori: "katori",
  "Serving bowl": "serving",
};
const recipe = (guests: number) =>
  defaultDinnerRecipe(guests).map((p) => ({ ...p, sku_id: skuFor[p.piece_name]! }));

describe("defaultDinnerRecipe", () => {
  it("set for 4 is 1 regal platter, 4 dinner plates, 4 quarter plates, 4 katoris, 2 serving bowls", () => {
    expect(defaultDinnerRecipe(4).map((p) => p.qty_per_set)).toEqual([1, 4, 4, 4, 2]);
  });
  it("set for 6 is 1 regal platter, 6 of each plate and katori, 3 serving bowls", () => {
    expect(defaultDinnerRecipe(6).map((p) => p.qty_per_set)).toEqual([1, 6, 6, 6, 3]);
  });
});

describe("computeDinnerSet", () => {
  it("set for 4 from 9/52/40/36/14 pieces makes 7, held back by serving bowls", () => {
    const r = computeDinnerSet(recipe(4), stock);
    expect(r.setsPossible).toBe(7);
    expect(r.piecesPerSet).toBe(15);
    expect(r.rows[r.limitingIndex!]!.item.piece_name).toBe("Serving bowl");
  });
  it("set for 6 from the same stock makes 4", () => {
    expect(computeDinnerSet(recipe(6), stock).setsPossible).toBe(4);
  });
  it("a piece not linked to a ware means 0 sets", () => {
    const items = recipe(4).map((p) => (p.piece_name === "Katori" ? { ...p, sku_id: null } : p));
    expect(computeDinnerSet(items, stock).setsPossible).toBe(0);
  });
  it("a piece set to 0 per set is ignored", () => {
    const items = recipe(4).map((p) => (p.piece_name === "Serving bowl" ? { ...p, qty_per_set: 0 } : p));
    expect(computeDinnerSet(items, stock).setsPossible).toBe(9);
  });
});

describe("matchWareForPiece", () => {
  const wares = [
    { id: "sq", name: "Ariane Square platter (Square Plate)", stock: 27 },
    { id: "qp", name: "Quater plate 22cm", stock: 152 },
  ];
  it("does not mistake a square plate for a quarter plate", () => {
    expect(matchWareForPiece("Quarter plate", [wares[0]!])).toBeNull();
  });
  it("matches the misspelt 'Quater plate'", () => {
    expect(matchWareForPiece("Quarter plate", wares)).toBe("qp");
  });
});

describe("parseQtyPerSet", () => {
  it("accepts whole numbers", () => expect(parseQtyPerSet("6")).toBe(6));
  it("rejects decimals and negatives", () => {
    expect(parseQtyPerSet("1.5")).toBeNull();
    expect(parseQtyPerSet("-2")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { buildWareSheetRows, columnLetter, readBlockReason, writeBlockReason } from "./sheet-tabs";

describe("excluded tabs", () => {
  it("blocks reading and writing the Sales sheet, ignoring case and spaces", () => {
    expect(readBlockReason("  sales  SHEET ")).not.toBeNull();
    expect(writeBlockReason("Sales sheet")).not.toBeNull();
  });
  it("blocks the ledger, box stock and name print tabs", () => {
    for (const t of ["Debit/Credit per month", "Boxes Stock by Vineet", "Name Print Sheet"]) {
      expect(readBlockReason(t)).not.toBeNull();
      expect(writeBlockReason(t)).not.toBeNull();
    }
  });
  it("never overwrites production cost tabs", () => {
    expect(writeBlockReason("Zebra Production cost")).not.toBeNull();
  });
  it("allows a new CRM tab and reading collection tabs", () => {
    expect(writeBlockReason("CRM - Zebra")).toBeNull();
    expect(readBlockReason("PARAKEET")).toBeNull();
  });
});

describe("buildWareSheetRows", () => {
  it("works out sets from stock: 18 pcs at 4 per set is 4 sets", () => {
    const rows = buildWareSheetRows([
      {
        name: "Plate", code: null, product_name: null, dimensions_catalogue: null,
        approx_weight_grams: null, ordered_quantity: null, pieces_per_set: 4,
        influencer_stock: 0, store_stock: 0, cost_price: null, mrp: null,
        influencer_remarks: null, showroom_remarks: null, sales_remarks: null,
        remarks: null, image_url: null, printed_image_url: null, stockInHand: 18,
      },
    ]);
    expect(rows[1]![8]).toBe(4);
  });
});

describe("columnLetter", () => {
  it("maps 19 to S and 27 to AA", () => {
    expect(columnLetter(19)).toBe("S");
    expect(columnLetter(27)).toBe("AA");
  });
});

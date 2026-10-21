/**
 * Rules for picking a Google Sheet tab by name in the sync menu, plus the
 * row layout used when the CRM writes a collection out to a tab.
 * Browser-safe (no server imports) so the dialog can reuse the same checks.
 */
import { parseWareRemarks } from "./ware-remarks";

/** Tabs the CRM must never read from or write to (per spec). */
export const PROTECTED_TABS = [
  "Debit/Credit per month",
  "Boxes Stock by Vineet",
  "Name Print Sheet",
  "Sales sheet",
];

export const tabKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export function isProtectedTab(name: string): boolean {
  const key = tabKey(name);
  return PROTECTED_TABS.some((t) => tabKey(t) === key);
}

/** Production-cost tabs are manual reference sheets: readable, never overwritten. */
export function isCostTab(name: string): boolean {
  return /production cost|costing/i.test(name);
}

/** Why a tab can't be written to, or null when it's allowed. */
export function writeBlockReason(name: string): string | null {
  if (!name.trim()) return "Type a tab name.";
  if (name.trim().length > 100) return "Tab names can be at most 100 characters.";
  if (isProtectedTab(name)) return `"${name.trim()}" is excluded from sync and can't be changed by the CRM.`;
  if (isCostTab(name)) return "Production cost tabs are kept as manual reference and can't be overwritten.";
  return null;
}

/** Why a tab can't be read from, or null when it's allowed. */
export function readBlockReason(name: string): string | null {
  if (!name.trim()) return "Pick a tab.";
  if (isProtectedTab(name)) return `"${name.trim()}" is excluded from sync.`;
  return null;
}

export const suggestedTabName = (collectionName: string) => `CRM - ${collectionName}`;

export interface WareForSheet {
  name: string;
  code: string | null;
  product_name: string | null;
  dimensions_catalogue: string | null;
  approx_weight_grams: number | null;
  ordered_quantity: number | null;
  pieces_per_set: number | null;
  influencer_stock: number | null;
  store_stock: number | null;
  cost_price: number | null;
  mrp: number | null;
  influencer_remarks: string | null;
  showroom_remarks: string | null;
  sales_remarks: string | null;
  remarks: string | null;
  image_url: string | null;
  printed_image_url: string | null;
  stockInHand: number;
}

export const SHEET_HEADER = [
  "Product (Ware)",
  "Code",
  "Product Name",
  "Dimension in Catalogue",
  "Approx Weight (gm)",
  "Ordered Quantity",
  "Stock in Hand",
  "Pieces per set",
  "Sets can be made",
  "Influencer Stock",
  "Stock on Sales",
  "Cost Price",
  "MRP",
  "Influencer remarks",
  "Showroom remarks",
  "Sales remarks",
  "Other remarks",
  "Images",
  "Final Printed Image",
];

const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v));

export function buildWareSheetRows(wares: WareForSheet[]): (string | number)[][] {
  return [
    SHEET_HEADER,
    ...wares.map((w) => {
      const parsed = parseWareRemarks(w.remarks);
      const perSet = Math.max(1, Number(w.pieces_per_set ?? 4));
      return [
        w.name,
        w.code ?? "",
        w.product_name ?? "",
        w.dimensions_catalogue ?? "",
        n(w.approx_weight_grams),
        n(w.ordered_quantity),
        w.stockInHand,
        perSet,
        Math.floor(Math.max(0, w.stockInHand) / perSet),
        n(w.influencer_stock),
        n(w.store_stock),
        n(w.cost_price),
        n(w.mrp),
        w.influencer_remarks ?? parsed.influencer,
        w.showroom_remarks ?? parsed.showroom,
        w.sales_remarks ?? "",
        parsed.other,
        w.image_url ?? "",
        w.printed_image_url ?? "",
      ];
    }),
  ];
}

/** Column letter for a 1-based column number (1 → A, 27 → AA). */
export function columnLetter(col: number): string {
  let s = "";
  let c = col;
  while (c > 0) {
    const r = (c - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

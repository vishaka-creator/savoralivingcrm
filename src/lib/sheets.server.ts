/**
 * Google Sheets sync layer (server-only).
 *
 * Reads the Savora workbook through the Lovable connector gateway and maps
 * messy sheet rows into a normalised internal shape. It tolerates blank rows,
 * merged/offset header cells, total rows and mixed date formats.
 */
import {
  COLLECTIONS,
  HEADER_KEYWORDS,
  SPREADSHEET_ID,
  type CollectionSlug,
} from "./savora-config";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

type Row = (string | number | boolean | null)[];

export interface ProductRow {
  name: string;
  code: string | null;
  quantity: number | null;
  stock: number | null;
  cost: number | null;
  weight: number | null;
  dimensions: string | null;
  dimensionsCatalogue: string | null;
  productName: string | null;
  image: string | null;
  printedImage: string | null;
}


async function batchGet(ranges: string[]): Promise<Row[][]> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets connection is not configured for this project.");
  }
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
      },
    },
  );
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets gateway failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { valueRanges?: { values?: Row[] }[] };
  return (json.valueRanges ?? []).map((v) => v.values ?? []);
}

/* ------------------------------ primitives ------------------------------ */

const text = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();

export function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = text(v).replace(/[₹$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}


function findHeader(rows: Row[]): { index: number; cols: Record<string, number> } | null {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i] ?? [];
    // Each key keeps the column whose header matched its most specific keyword,
    // so "Product (Ware)" wins over a generic "Collection & Ware" column.
    const best: Record<string, { idx: number; rank: number }> = {};
    row.forEach((cell, idx) => {
      const label = text(cell).toLowerCase();
      if (!label) return;
      for (const [key, keywords] of Object.entries(HEADER_KEYWORDS)) {
        const rank = keywords.findIndex((k) => label.includes(k));
        if (rank === -1) continue;
        const owner = Object.entries(best).find(([k, v]) => k !== key && v.idx === idx);
        if (owner && owner[1].rank <= rank) continue;
        const current = best[key];
        if (current && current.rank <= rank) continue;
        if (owner) delete best[owner[0]];
        best[key] = { idx, rank };
      }
    });
    const cols: Record<string, number> = {};
    for (const [key, v] of Object.entries(best)) cols[key] = v.idx;
    if (
      cols["name"] !== undefined &&
      (cols["quantity"] !== undefined || cols["stock"] !== undefined || cols["code"] !== undefined)
    ) {
      return { index: i, cols };
    }
  }
  return null;
}


const isTotalRow = (s: string) => /^(total|grand total|sub total)/i.test(s);

/** Parse any "list of wares" style tab into product rows. */
export function parseProducts(rows: Row[]): ProductRow[] {
  const header = findHeader(rows);
  if (!header) return [];
  const { index, cols } = header;
  const cell = (row: Row, key: string): string | null =>
    cols[key] !== undefined ? text(row[cols[key]!]) || null : null;
  const out: ProductRow[] = [];
  for (let i = index + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const name = text(row[cols["name"] ?? -1]);
    const code = cols["code"] !== undefined ? text(row[cols["code"]!]) : "";
    if (!name && !code) continue;
    if (isTotalRow(name) || isTotalRow(code)) continue;
    const label = name || code;
    if (/^(combos?|set offered|sale|display)$/i.test(label)) continue;
    out.push({
      name: label,
      code: code || null,
      quantity: cols["quantity"] !== undefined ? toNumber(row[cols["quantity"]!]) : null,
      stock: cols["stock"] !== undefined ? toNumber(row[cols["stock"]!]) : null,
      cost: cols["cost"] !== undefined ? toNumber(row[cols["cost"]!]) : null,
      weight: cols["weight"] !== undefined ? toNumber(row[cols["weight"]!]) : null,
      dimensions: cell(row, "dimensions"),
      dimensionsCatalogue: cell(row, "dimensionsCatalogue"),
      productName: cell(row, "productName"),
      image: cell(row, "image"),
      printedImage: cell(row, "printedImage"),
    });
  }
  return out;
}


const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");


/* --------------------------------- fetch -------------------------------- */

export interface SheetSnapshot {
  perCollection: Partial<Record<CollectionSlug, { products: ProductRow[] }>>;
  tabsRead: string[];
}

/** A1 range with the sheet name safely quoted (escapes embedded quotes). */
export function toA1Range(sheetName: string, cellRange: string): string {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'!${cellRange}`;
}

/**
 * Read the collection tabs. Pass `only` to read a subset of collections
 * (e.g. just Orchid); omit it to read all five.
 */
export async function fetchSnapshot(only?: CollectionSlug[]): Promise<SheetSnapshot> {
  // Only the five collection tabs (ware list + production cost) are synced;
  // ledger, boxes-stock and sales tabs are excluded per spec.
  const targets = only?.length ? COLLECTIONS.filter((c) => only.includes(c.slug)) : COLLECTIONS;
  const ranges: string[] = [];
  for (const c of targets) {
    ranges.push(toA1Range(c.sheetTab, "A1:N200"));
    ranges.push(toA1Range(c.costTab, "A1:N200"));
  }

  const grids = await batchGet(ranges);

  const perCollection: SheetSnapshot["perCollection"] = {};
  targets.forEach((c, i) => {
    const stockRows = parseProducts(grids[i * 2] ?? []);
    const costRows = parseProducts(grids[i * 2 + 1] ?? []);
    const costByKey = new Map<string, ProductRow>();
    for (const r of costRows) {
      if (r.code) costByKey.set(normalise(r.code), r);
      costByKey.set(normalise(r.name), r);
    }

    const merged = new Map<string, ProductRow>();
    const upsert = (r: ProductRow) => {
      const key = normalise(r.code || r.name);
      const prev = merged.get(key);
      const match = costByKey.get(normalise(r.code || "")) ?? costByKey.get(normalise(r.name));
      merged.set(key, {
        name: prev?.name || r.name,
        code: prev?.code ?? r.code,
        quantity: prev?.quantity ?? r.quantity ?? match?.quantity ?? null,
        stock: prev?.stock ?? r.stock ?? match?.stock ?? null,
        cost: prev?.cost ?? r.cost ?? match?.cost ?? null,
        weight: prev?.weight ?? r.weight ?? match?.weight ?? null,
        dimensions: prev?.dimensions ?? r.dimensions ?? match?.dimensions ?? null,
        dimensionsCatalogue:
          prev?.dimensionsCatalogue ?? r.dimensionsCatalogue ?? match?.dimensionsCatalogue ?? null,
        productName: prev?.productName ?? r.productName ?? match?.productName ?? null,
        image: prev?.image ?? r.image ?? match?.image ?? null,
        printedImage: prev?.printedImage ?? r.printedImage ?? match?.printedImage ?? null,
      });
    };
    stockRows.forEach(upsert);
    // Cost tabs sometimes hold wares the collection tab omits.
    costRows.forEach(upsert);

    perCollection[c.slug] = { products: [...merged.values()] };
  });

  return {
    perCollection,
    tabsRead: ranges.map((r) => r.slice(1, r.indexOf("'!", 1))),
  };
}

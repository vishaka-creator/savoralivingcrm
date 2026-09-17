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


export interface BoxRow {
  collection_slug: CollectionSlug;
  product: string;
  code: string | null;
  quantity: number;
  foam: boolean | null;
  print_status: string | null;
}

export interface SaleRow {
  month: string | null;
  client_name: string;
  billing_details: string | null;
  amount: number | null;
  status: string | null;
  source_row: string;
}

export interface ExpenseRow {
  month: string | null;
  spend_date: string | null;
  vendor: string | null;
  amount: number | null;
  remarks: string | null;
  source_row: string;
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

/** Handles dd.mm.yyyy, d/m/yyyy, yyyy-mm-dd and Sheets serial numbers. */
export function toISODate(v: unknown): string | null {
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = text(v);
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (m) {
    const yRaw = m[3]!;
    const year = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    // dd.mm.yyyy is the dominant sheet format; fall back to m/d for slashes.
    const slashed = s.includes("/");
    const a = Number(m[1]);
    const b = Number(m[2]);
    const day = slashed ? (a > 12 ? a : b) : a;
    const month = slashed ? (a > 12 ? b : a) : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
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

function resolveBoxCollection(raw: string): CollectionSlug | null {
  const n = normalise(raw);
  if (!n) return null;
  for (const c of COLLECTIONS) {
    if (c.boxAliases.some((a) => normalise(a) === n)) return c.slug;
  }
  for (const c of COLLECTIONS) {
    if (c.boxAliases.some((a) => n.includes(normalise(a)))) return c.slug;
  }
  return null;
}

/** Boxes tab: several stacked blocks, all with the same column shape. */
export function parseBoxes(rows: Row[]): BoxRow[] {
  const out: BoxRow[] = [];
  for (const row of rows) {
    const collectionRaw = text(row?.[1]);
    const product = text(row?.[2]);
    const qty = toNumber(row?.[4]);
    if (!collectionRaw || !product || qty === null) continue;
    if (isTotalRow(collectionRaw) || /^collection/i.test(collectionRaw)) continue;
    const slug = resolveBoxCollection(collectionRaw);
    if (!slug) continue; // out-of-scope collection (e.g. Parakeet)
    const foamRaw = text(row?.[7]).toLowerCase();
    out.push({
      collection_slug: slug,
      product,
      code: text(row?.[3]) || null,
      quantity: qty,
      foam: foamRaw === "yes" ? true : foamRaw === "no" ? false : null,
      print_status: text(row?.[6]) || null,
    });
  }
  return out;
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Debit/Credit per month: expenses in cols B–F, client sales in cols I–L. */
export function parseLedger(rows: Row[]): { sales: SaleRow[]; expenses: ExpenseRow[] } {
  const sales: SaleRow[] = [];
  const expenses: ExpenseRow[] = [];
  let month: string | null = null;

  rows.forEach((row, i) => {
    const first = text(row?.[0]);
    if (first && MONTHS.includes(first.toLowerCase())) {
      month = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    }

    const vendor = text(row?.[1]);
    const spendAmount = toNumber(row?.[3]);
    if (vendor && spendAmount !== null && !/^dealers$/i.test(vendor)) {
      expenses.push({
        month,
        spend_date: toISODate(row?.[2]),
        vendor,
        amount: spendAmount,
        remarks: text(row?.[4]) || null,
        source_row: `${LEDGER_TAB}:${i}`,
      });
    }

    const client = text(row?.[8]);
    const saleAmount = toNumber(row?.[10]);
    if (client && !/^client name$/i.test(client) && saleAmount !== null) {
      sales.push({
        month,
        client_name: client,
        billing_details: text(row?.[9]) || null,
        amount: saleAmount,
        status: text(row?.[11]) || null,
        source_row: `${LEDGER_TAB}:${i}`,
      });
    }
  });

  return { sales, expenses };
}

/* --------------------------------- fetch -------------------------------- */

export interface SheetSnapshot {
  perCollection: Record<
    CollectionSlug,
    { products: ProductRow[]; boxes: BoxRow[] }
  >;
  sales: SaleRow[];
  expenses: ExpenseRow[];
  tabsRead: string[];
}

export async function fetchSnapshot(): Promise<SheetSnapshot> {
  const ranges: string[] = [];
  for (const c of COLLECTIONS) {
    ranges.push(`${c.sheetTab}!A1:N200`);
    ranges.push(`${c.costTab}!A1:N200`);
  }
  ranges.push(`${BOXES_TAB}!A1:H200`);
  ranges.push(`${LEDGER_TAB}!A1:L400`);

  const grids = await batchGet(ranges);

  const perCollection = {} as SheetSnapshot["perCollection"];
  COLLECTIONS.forEach((c, i) => {
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

    perCollection[c.slug] = {
      products: [...merged.values()],
      boxes: [],
    };
  });

  const boxes = parseBoxes(grids[COLLECTIONS.length * 2] ?? []);
  for (const b of boxes) perCollection[b.collection_slug].boxes.push(b);

  const ledger = parseLedger(grids[COLLECTIONS.length * 2 + 1] ?? []);

  return {
    perCollection,
    sales: ledger.sales,
    expenses: ledger.expenses,
    tabsRead: ranges.map((r) => r.split("!")[0]!),
  };
}

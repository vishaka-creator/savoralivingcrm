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
} from "./savora-config";
import { columnLetter, tabKey } from "./sheet-tabs";

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


function gatewayHeaders(): Record<string, string> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets connection is not configured for this project.");
  }
  return { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey };
}

/** Live list of tab names in the workbook. */
export async function listSheetTabs(): Promise<string[]> {
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties.title`,
    { headers: gatewayHeaders() },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets request failed [${res.status}]: ${body}`);
  }
  const json = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return (json.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
}

async function batchGet(ranges: string[]): Promise<Row[][]> {
  if (!ranges.length) return [];
  const qs = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join("&");
  const res = await fetch(
    `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values:batchGet?${qs}&valueRenderOption=UNFORMATTED_VALUE`,
    { headers: gatewayHeaders() },
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
  perCollection: Record<string, { products: ProductRow[] }>;
  tabsRead: string[];
  /** Collections whose ware-list tab was not found in the workbook. */
  missingTabs: string[];
}

/** A1 range with the sheet name safely quoted (escapes embedded quotes). */
export function toA1Range(sheetName: string, cellRange: string): string {
  const escaped = sheetName.replace(/'/g, "''");
  return `'${escaped}'!${cellRange}`;
}

export interface SyncTarget {
  slug: string;
  name: string;
  /** Ware-list tab name as stored in the CRM (matched to the live tab ignoring case/spaces). */
  sheetTab: string;
  /** Optional production-cost tab used to fill missing ware details. */
  costTab: string | null;
}

/** Default targets: the five built-in collections. */
export const DEFAULT_TARGETS: SyncTarget[] = COLLECTIONS.map((c) => ({
  slug: c.slug,
  name: c.name,
  sheetTab: c.sheetTab,
  costTab: c.costTab,
}));


/**
 * Read the ware-list tab (and cost tab, when there is one) for each target.
 * Tab names are resolved against the live workbook so "Parakeet" finds
 * "PARAKEET". Targets whose ware-list tab is missing are reported, not read.
 */
export async function fetchSnapshot(targets: SyncTarget[] = DEFAULT_TARGETS): Promise<SheetSnapshot> {
  // Only collection tabs (ware list + production cost) are synced;
  // ledger, boxes-stock and sales tabs are excluded per spec.
  const live = await listSheetTabs();
  const liveByKey = new Map(live.map((t) => [tabKey(t), t]));

  const ranges: string[] = [];
  const plan: { target: SyncTarget; stockIdx: number; costIdx: number | null }[] = [];
  const missingTabs: string[] = [];
  for (const t of targets) {
    const stockTab = liveByKey.get(tabKey(t.sheetTab));
    if (!stockTab) {
      missingTabs.push(`${t.name}: "${t.sheetTab}"`);
      continue;
    }
    const stockIdx = ranges.push(toA1Range(stockTab, "A1:N200")) - 1;
    const costTab = t.costTab ? liveByKey.get(tabKey(t.costTab)) : undefined;
    const costIdx = costTab ? ranges.push(toA1Range(costTab, "A1:N200")) - 1 : null;
    plan.push({ target: t, stockIdx, costIdx });
  }

  const grids = await batchGet(ranges);

  const perCollection: SheetSnapshot["perCollection"] = {};
  plan.forEach(({ target: c, stockIdx, costIdx }) => {
    const stockRows = parseProducts(grids[stockIdx] ?? []);
    const costRows = costIdx === null ? [] : parseProducts(grids[costIdx] ?? []);
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
    missingTabs,
  };
}

/* --------------------------------- write -------------------------------- */

/** Range for a URL path: encode the tab name but keep "!" and ":" readable. */
const pathRange = (range: string) => encodeURIComponent(range).replace(/%3A/gi, ":");

async function sheetsFetch(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { ...gatewayHeaders(), "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Sheets gateway write failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

/**
 * Write rows to a tab, creating the tab when it doesn't exist. An existing tab
 * is cleared and replaced only when `allowReplace` is set. Values are written
 * as-is (RAW) so remarks starting with "=" never turn into formulas.
 */
export async function writeSheetTab(
  tab: string,
  values: (string | number)[][],
  opts: { allowReplace: boolean },
): Promise<{ tab: string; created: boolean; rows: number }> {
  const live = await listSheetTabs();
  const existing = live.find((t) => tabKey(t) === tabKey(tab));
  if (existing && !opts.allowReplace) {
    throw new Error(`The tab "${existing}" already has data. Tick "Replace this tab" to overwrite it.`);
  }
  const title = existing ?? tab.trim();
  const base = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}`;

  if (existing) {
    await sheetsFetch(`${base}/values/${pathRange(toA1Range(title, "A:ZZ"))}:clear`, {
      method: "POST",
      body: "{}",
    });
  } else {
    await sheetsFetch(`${base}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
  }

  const width = Math.max(1, ...values.map((r) => r.length));
  const range = toA1Range(title, `A1:${columnLetter(width)}${Math.max(1, values.length)}`);
  await sheetsFetch(`${base}/values/${pathRange(range)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });
  return { tab: title, created: !existing, rows: Math.max(0, values.length - 1) };
}

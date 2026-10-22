/**
 * Dinner set math — pure, shared by the dashboard and server functions.
 * A dinner set (e.g. "Dinner set for 4") is a recipe of pieces, each linked to a ware.
 * Sets possible = the smallest of floor(pieces in stock / pieces per set) across its pieces.
 */

export const MAX_QTY_PER_SET = 1000;

export interface DinnerItemInput {
  piece_name: string;
  sku_id: string | null;
  qty_per_set: number;
}

export interface DinnerItemResult<T extends DinnerItemInput = DinnerItemInput> {
  item: T;
  linked: boolean;
  onHand: number;
  /** Full sets this piece's stock covers; null when the piece is not needed (0 per set). */
  enoughFor: number | null;
}

export interface DinnerSetResult<T extends DinnerItemInput = DinnerItemInput> {
  rows: DinnerItemResult<T>[];
  setsPossible: number;
  piecesPerSet: number;
  /** Index into rows of the piece holding the sets back, or null. */
  limitingIndex: number | null;
}

export function computeDinnerSet<T extends DinnerItemInput>(
  items: T[],
  stockBySku: Map<string, number>,
): DinnerSetResult<T> {
  const rows = items.map((item) => {
    const linked = !!item.sku_id && stockBySku.has(item.sku_id);
    const onHand = linked ? Math.max(0, Number(stockBySku.get(item.sku_id!) ?? 0)) : 0;
    const qty = Math.max(0, Math.floor(Number(item.qty_per_set) || 0));
    return { item, linked, onHand, enoughFor: qty > 0 ? Math.floor(onHand / qty) : null };
  });
  let limitingIndex: number | null = null;
  rows.forEach((r, i) => {
    if (r.enoughFor === null) return;
    if (limitingIndex === null || r.enoughFor < rows[limitingIndex]!.enoughFor!) limitingIndex = i;
  });
  return {
    rows,
    setsPossible: limitingIndex === null ? 0 : rows[limitingIndex]!.enoughFor!,
    piecesPerSet: rows.reduce((a, r) => a + Math.max(0, Math.floor(Number(r.item.qty_per_set) || 0)), 0),
    limitingIndex,
  };
}

/** Standard dinner set: 1 regal platter, a dinner plate, quarter plate and katori per guest, a serving bowl per 2 guests. */
export function defaultDinnerRecipe(guests: number): { piece_name: string; qty_per_set: number }[] {
  return [
    { piece_name: "Regal platter", qty_per_set: 1 },
    { piece_name: "Dinner plate", qty_per_set: guests },
    { piece_name: "Quarter plate", qty_per_set: guests },
    { piece_name: "Katori", qty_per_set: guests },
    { piece_name: "Serving bowl", qty_per_set: Math.ceil(guests / 2) },
  ];
}

const PIECE_PATTERNS: Record<string, RegExp[]> = {
  "regal platter": [/regal\s*platter/i, /oval\s*platter/i],
  "dinner plate": [/dinner\s*plate/i, /flat\s*plate.*27/i, /coupe\s*plate.*27/i, /flat\s*plate/i],
  "quarter plate": [/\bquar?ter\b.*plate/i, /flat\s*plate.*22/i, /coupe\s*plate.*23/i],
  katori: [/katori/i, /fruit\s*bowl.*10/i, /fruit\s*bowl/i],
  "serving bowl": [/serving\s*bowl/i, /noodle\s*bowl/i],
};

/** Best-guess ware for a standard piece name (checks ware name, then product name): first matching pattern wins, ties go to the ware with most stock. */
export function matchWareForPiece(
  pieceName: string,
  wares: { id: string; name: string; productName?: string | null; stock: number }[],
): string | null {
  const patterns = PIECE_PATTERNS[pieceName.trim().toLowerCase()];
  if (!patterns) return null;
  for (const re of patterns) {
    const hits = wares.filter((w) => re.test(w.name)).sort((a, b) => b.stock - a.stock);
    if (hits.length) return hits[0]!.id;
  }
  for (const re of patterns) {
    const hits = wares.filter((w) => re.test(w.productName ?? "")).sort((a, b) => b.stock - a.stock);
    if (hits.length) return hits[0]!.id;
  }
  return null;
}

/** Parse a typed pieces-per-set number: whole, 0–1000; blank means 0. Returns null when invalid. */
export function parseQtyPerSet(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return 0;
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n <= MAX_QTY_PER_SET ? n : null;
}

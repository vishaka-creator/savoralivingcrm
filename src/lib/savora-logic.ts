/**
 * Pure kitting math — shared by server functions and (potentially) the UI.
 * Kept out of *.functions.ts so server-fn splitting can't drop it.
 */

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export interface SetComponent {
  component: string;
  perSet: number;
  onHand: number;
  possible: number;
}

export interface SetBuildable {
  setName: string;
  buildable: number;
  limitedBy: "materials" | "boxes" | null;
  limitingComponent: string | null;
  components: SetComponent[];
  boxQty: number | null;
}

export interface BomInput {
  set_name: string;
  component_name: string;
  qty_required_per_set: number;
  box_code: string | null;
}

export interface MaterialInput {
  name: string;
  code: string | null;
  quantity: number;
}

export interface BoxInput {
  product: string;
  code: string | null;
  quantity_on_hand: number;
}

/**
 * For each set (e.g. "Dinner set of 4"), how many complete sets can be built?
 * A component needing 4 pieces per set with 132 on hand yields 33 sets;
 * the set total is the smallest of every component (and the box, if mapped).
 */
export function computeSets(
  boms: BomInput[],
  materials: MaterialInput[],
  boxes: BoxInput[],
): SetBuildable[] {
  const bySet = new Map<string, BomInput[]>();
  for (const b of boms) {
    if (!bySet.has(b.set_name)) bySet.set(b.set_name, []);
    bySet.get(b.set_name)!.push(b);
  }

  const findMaterial = (name: string) => {
    const n = norm(name);
    return (
      materials.find((m) => norm(m.code ?? "") === n) ??
      materials.find((m) => norm(m.name) === n) ??
      materials.find((m) => norm(m.name).includes(n) || n.includes(norm(m.name)))
    );
  };

  return [...bySet.entries()].map(([setName, rows]) => {
    const components: SetComponent[] = rows.map((r) => {
      const onHand = Number(findMaterial(r.component_name)?.quantity ?? 0);
      const perSet = Number(r.qty_required_per_set) || 1;
      return {
        component: r.component_name,
        perSet,
        onHand,
        possible: Math.floor(onHand / perSet),
      };
    });

    const boxCode = rows.find((r) => r.box_code)?.box_code ?? null;
    const boxMatch = boxCode
      ? boxes.find(
          (b) => norm(b.code ?? "") === norm(boxCode) || norm(b.product) === norm(boxCode),
        )
      : null;
    const boxQty = boxMatch ? Number(boxMatch.quantity_on_hand) : null;

    const materialLimit = components.length ? Math.min(...components.map((c) => c.possible)) : 0;
    const buildable = boxQty === null ? materialLimit : Math.min(materialLimit, boxQty);
    const limitedBy: SetBuildable["limitedBy"] = !components.length
      ? null
      : boxQty !== null && boxQty < materialLimit
        ? "boxes"
        : "materials";
    const limiting =
      components.slice().sort((a, b) => a.possible - b.possible)[0]?.component ?? null;

    return {
      setName,
      buildable,
      limitedBy,
      limitingComponent: limitedBy === "materials" ? limiting : null,
      components,
      boxQty,
    };
  });
}

export function groupBy<T, K>(rows: T[], key: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const r of rows) {
    const k = key(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(r);
  }
  return map;
}

export function monthName(d = new Date()) {
  return d.toLocaleString("en-US", { month: "long" });
}

export function previousMonthName(d = new Date()) {
  const prev = new Date(d);
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  return monthName(prev);
}

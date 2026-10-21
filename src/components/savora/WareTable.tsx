import { Fragment, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WareRowActions } from "@/components/savora/WareRowActions";
import { updateWareStock } from "@/lib/savora.functions";

export const LOW_STOCK_PCS = 5;
import { inr, num } from "@/lib/format";

export interface WareTableRow {
  id: string;
  ware: string;
  code: string | null;
  dimensionsCatalogue: string | null;
  productName: string | null;
  imageUrl: string | null;
  printedImageUrl: string | null;
  orderedQuantity: number | null;
  approxWeight: number | null;
  piecesPerSet: number;
  soldSets: number;
  soldPcs: number;
  salesRemarks: string | null;
  influencerStock: number;
  storeStock: number;
  costPrice: number | null;
  mrp: number | null;
  remarks: string | null;
  influencerRemarks?: string | null;
  showroomRemarks?: string | null;
  wareMediaPath?: string | null;
  wareMediaUrl?: string | null;
  stockInHand: number;
  threshold: number;
}

type ColumnKey =
  | "ware"
  | "code"
  | "dimensionsCatalogue"
  | "productName"
  | "images"
  | "orderedQuantity"
  | "printedImage"
  | "approxWeight"
  | "setsBuildable"
  | "influencerStock"
  | "storeStock"
  | "costPrice"
  | "mrp"
  | "remarks"
  | "stock";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  ware: "Product (Ware)",
  code: "Code",
  dimensionsCatalogue: "Dimension in Catalogue",
  productName: "Product Name",
  images: "Images",
  orderedQuantity: "Ordered Quantity",
  printedImage: "Final Printed Image",
  approxWeight: "Approx Weight (gm)",
  setsBuildable: "Sets can be made",
  influencerStock: "Influencer Stock",
  storeStock: "Stock on Sales",
  costPrice: "Cost Price",
  mrp: "MRP",
  remarks: "Remarks / Where Given",
  stock: "Stock",
};

const DEFAULT_ORDER: ColumnKey[] = [
  "ware",
  "code",
  "dimensionsCatalogue",
  "productName",
  "images",
  "orderedQuantity",
  "printedImage",
  "approxWeight",
  "setsBuildable",
  "influencerStock",
  "storeStock",
  "costPrice",
  "mrp",
  "remarks",
  "stock",
];

const NUMERIC: ColumnKey[] = [
  "orderedQuantity",
  "approxWeight",
  "setsBuildable",
  "influencerStock",
  "storeStock",
  "costPrice",
  "mrp",
  "stock",
];

const STORAGE_KEY = "savora.wareColumnOrder.v1";

function loadOrder(): ColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as string[];
    const kept = parsed.map((k) => (k === "actualSales" ? "setsBuildable" : k)).filter((k): k is ColumnKey => DEFAULT_ORDER.includes(k as ColumnKey));
    const missing = DEFAULT_ORDER.filter((k) => !kept.includes(k));
    return [...kept, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

const COMBO_RE = /\bmini|combo|special/i;

function groupWares(wares: WareTableRow[]) {
  const main: WareTableRow[] = [];
  const combos: WareTableRow[] = [];
  for (const w of wares) {
    const label = `${w.ware} ${w.productName ?? ""}`;
    (COMBO_RE.test(label) ? combos : main).push(w);
  }
  const groups: { key: string; title: string; rows: WareTableRow[] }[] = [];
  if (main.length) groups.push({ key: "main", title: "Wares", rows: main });
  if (combos.length)
    groups.push({ key: "combos", title: "Minis & special combos", rows: combos });
  return groups;
}

export function WareTable({
  wares,
  canEdit,
  onMove,
  onReorder,
  isReordering,
}: {
  wares: WareTableRow[];
  canEdit: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onReorder?: (ids: string[]) => void;
  isReordering: boolean;
}) {
  const [dragRow, setDragRow] = useState<string | null>(null);
  const [overRow, setOverRow] = useState<string | null>(null);

  const dropRowOn = (targetId: string) => {
    if (!dragRow || dragRow === targetId || !onReorder) return;
    const ids = wares.map((w) => w.id);
    const from = ids.indexOf(dragRow);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragRow);
    onReorder(ids);
  };

  const groups = useMemo(() => groupWares(wares), [wares]);

  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_ORDER);

  useEffect(() => {
    setColumns(loadOrder());
  }, []);

  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  const [overKey, setOverKey] = useState<ColumnKey | null>(null);

  const persist = (next: ColumnKey[]) => {
    setColumns(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage failures */
    }
  };

  const shift = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const next = [...columns];
    [next[index], next[target]] = [next[target]!, next[index]!];
    persist(next);
  };

  const dropOn = (target: ColumnKey) => {
    if (!dragKey || dragKey === target) return;
    const next = columns.filter((k) => k !== dragKey);
    next.splice(next.indexOf(target), 0, dragKey);
    persist(next);
  };

  const moveByKeyboard = (key: ColumnKey, direction: -1 | 1) => {
    shift(columns.indexOf(key), direction);
  };

  const resetColumns = () => {
    setColumns(DEFAULT_ORDER);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  const isCustom = useMemo(
    () => columns.join("|") !== DEFAULT_ORDER.join("|"),
    [columns],
  );

  return (
    <div className="panel overflow-x-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          Drag a column header onto another to reorder columns (or focus a header and press the
          arrow keys) — the order is remembered on this device.
          {canEdit
            ? " Rows can be dragged onto each other to reorder wares. Sets can be made is stock ÷ pieces per set; editing it updates stock in hand."
            : ""}
        </p>
        {isCustom && (
          <Button variant="ghost" size="sm" onClick={resetColumns}>
            Reset columns
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            {canEdit && <TableHead className="w-16">Order</TableHead>}
            {columns.map((key) => (
              <TableHead
                key={key}
                draggable
                onDragStart={(e) => {
                  setDragKey(key);
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", key);
                }}
                onDragOver={(e) => {
                  if (!dragKey || dragKey === key) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setOverKey(key);
                }}
                onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
                onDrop={(e) => {
                  e.preventDefault();
                  dropOn(key);
                  setDragKey(null);
                  setOverKey(null);
                }}
                onDragEnd={() => {
                  setDragKey(null);
                  setOverKey(null);
                }}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    moveByKeyboard(key, -1);
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    moveByKeyboard(key, 1);
                  }
                }}
                aria-grabbed={dragKey === key || undefined}
                title="Drag to reorder"
                className={`cursor-grab select-none transition-colors active:cursor-grabbing ${
                  NUMERIC.includes(key) ? "text-right" : ""
                } ${key === "ware" ? "min-w-56" : "min-w-32"} ${
                  dragKey === key ? "opacity-50" : ""
                } ${overKey === key ? "bg-primary/10 ring-1 ring-inset ring-primary/40" : ""}`}
              >
                <div
                  className={`flex items-center gap-1.5 ${
                    NUMERIC.includes(key) ? "justify-end" : ""
                  }`}
                >
                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{COLUMN_LABELS[key]}</span>
                </div>
              </TableHead>
            ))}
            {canEdit && <TableHead className="w-24">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <Fragment key={group.key}>
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + (canEdit ? 2 : 0)}
                  className="bg-muted/50 py-2"
                >
                  <span className="label-caps">{group.title}</span>
                  <span className="num ml-2 text-xs text-muted-foreground">
                    {num(group.rows.length)}
                  </span>
                </TableCell>
              </TableRow>
              {group.rows.map((w) => {
                const i = wares.findIndex((x) => x.id === w.id);
                return (
                  <TableRow
                    key={w.id}
                    draggable={canEdit && !!onReorder}
                    onDragStart={(e) => {
                      setDragRow(w.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", w.id);
                    }}
                    onDragOver={(e) => {
                      if (!dragRow || dragRow === w.id) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      setOverRow(w.id);
                    }}
                    onDragLeave={() => setOverRow((k) => (k === w.id ? null : k))}
                    onDrop={(e) => {
                      e.preventDefault();
                      dropRowOn(w.id);
                      setDragRow(null);
                      setOverRow(null);
                    }}
                    onDragEnd={() => {
                      setDragRow(null);
                      setOverRow(null);
                    }}
                    className={`${dragRow === w.id ? "opacity-50" : ""} ${
                      overRow === w.id ? "bg-primary/10" : ""
                    }`}
                  >
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <GripVertical
                            className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
                            aria-hidden
                          />
                          <div className="flex flex-col">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              aria-label={`Move ${w.ware} up`}
                              disabled={i === 0 || isReordering}
                              onClick={() => onMove(i, -1)}
                            >
                              <ChevronUp className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              aria-label={`Move ${w.ware} down`}
                              disabled={i === wares.length - 1 || isReordering}
                              onClick={() => onMove(i, 1)}
                            >
                              <ChevronDown className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {columns.map((key) => (
                      <Cell key={key} column={key} ware={w} canEdit={canEdit} />
                    ))}
                    {canEdit && (
                      <TableCell>
                        <WareRowActions ware={w} />
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </Fragment>
          ))}
          {!wares.length && (
            <TableRow>
              <TableCell
                colSpan={columns.length + (canEdit ? 2 : 0)}
                className="text-sm text-muted-foreground"
              >
                No wares synced for this collection yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function Cell({
  column,
  ware,
  canEdit,
}: {
  column: ColumnKey;
  ware: WareTableRow;
  canEdit: boolean;
}) {
  switch (column) {
    case "ware":
      return <TableCell className="font-medium">{ware.ware}</TableCell>;
    case "code":
      return <TableCell className="num text-muted-foreground">{ware.code ?? "—"}</TableCell>;
    case "dimensionsCatalogue":
      return <TableCell className="num">{ware.dimensionsCatalogue ?? "—"}</TableCell>;
    case "productName":
      return <TableCell>{ware.productName ?? "—"}</TableCell>;
    case "images":
      return (
        <TableCell>
          {ware.wareMediaUrl ? (
            ware.wareMediaPath?.endsWith(".pdf") ? (
              <a href={ware.wareMediaUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">PDF</a>
            ) : (
              <Thumb url={ware.wareMediaUrl} alt={`${ware.ware} uploaded image`} />
            )
          ) : (
            <Thumb url={ware.imageUrl} alt={`${ware.ware} reference image`} />
          )}
        </TableCell>
      );
    case "orderedQuantity":
      return <TableCell className="num text-right">{num(ware.orderedQuantity)}</TableCell>;
    case "printedImage":
      return (
        <TableCell>
          <Thumb url={ware.printedImageUrl} alt={`${ware.ware} final printed image`} />
        </TableCell>
      );
    case "approxWeight":
      return (
        <TableCell className="num text-right">
          {ware.approxWeight === null ? "—" : num(ware.approxWeight)}
        </TableCell>
      );
    case "setsBuildable":
      return <SetsCell ware={ware} canEdit={canEdit} />;
    case "influencerStock":
      return <TableCell className="num text-right">{num(ware.influencerStock)}</TableCell>;
    case "storeStock":
      return <TableCell className="num text-right">{num(ware.storeStock)}</TableCell>;
    case "costPrice":
      return <TableCell className="num text-right">{ware.costPrice === null ? "—" : inr(ware.costPrice)}</TableCell>;
    case "mrp":
      return <TableCell className="num text-right">{ware.mrp === null ? "—" : inr(ware.mrp)}</TableCell>;
    case "remarks":
      return (
        <TableCell className="min-w-56 max-w-72 whitespace-normal text-xs text-muted-foreground">
          {ware.influencerRemarks && <p><span className="font-medium text-foreground">Influencers:</span> {ware.influencerRemarks}</p>}
          {ware.showroomRemarks && <p><span className="font-medium text-foreground">Showroom:</span> {ware.showroomRemarks}</p>}
          {ware.remarks && <p>{ware.remarks}</p>}
          {!ware.influencerRemarks && !ware.showroomRemarks && !ware.remarks && "—"}
        </TableCell>
      );
    case "stock":
      return (
        <TableCell className="num text-right">
          <span className="inline-flex items-center gap-1.5">
            {ware.stockInHand < LOW_STOCK_PCS && (
              <AlertTriangle className="size-3.5 text-warning" />
            )}
            {num(ware.stockInHand)}
          </span>
        </TableCell>
      );
  }
}

function SetsCell({ ware, canEdit }: { ware: WareTableRow; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateWareStock);
  const perSet = Math.max(1, ware.piecesPerSet);
  const current = Math.floor(ware.stockInHand / perSet);
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    setValue(String(current));
  }, [current]);

  const mutation = useMutation({
    mutationFn: (sets: number) =>
      save({ data: { id: ware.id, stock_in_hand: sets * perSet + (ware.stockInHand % perSet) } }),
    onSuccess: () => {
      toast.success("Saved · stock updated");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setValue(String(current));
    },
  });

  const commit = () => {
    const next = Number(value);
    if (!Number.isInteger(next) || next < 0) {
      setValue(String(current));
      return;
    }
    if (next === current) return;
    mutation.mutate(next);
  };

  if (!canEdit) {
    return <TableCell className="num text-right">{num(current)}</TableCell>;
  }

  return (
    <TableCell className="text-right">
      <Input
        type="number"
        min={0}
        value={value}
        disabled={mutation.isPending}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={`${ware.ware} sets can be made`}
        className="num ml-auto h-8 w-20 text-right"
      />
      <span className="mt-0.5 block text-[10px] text-muted-foreground">sets of {perSet}</span>
    </TableCell>
  );
}

function Thumb({ url, alt }: { url: string | null; alt: string }) {
  if (!url || !/^https?:\/\//.test(url)) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="size-10 rounded border border-border object-cover"
      />
    </a>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
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
import { updateWareSales } from "@/lib/savora.functions";
import { num } from "@/lib/format";

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
  | "soldSets"
  | "soldPcs"
  | "stock";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  ware: "Product (Ware)",
  code: "Code",
  dimensionsCatalogue: "Dimension in Catalogue",
  productName: "Product Name",
  images: "Images",
  orderedQuantity: "Orderd Quantity",
  printedImage: "Final Printed Image",
  approxWeight: "Approx Weight (gm)",
  soldSets: "Sales — Sets",
  soldPcs: "Sales — Pcs",
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
  "soldSets",
  "soldPcs",
  "stock",
];

const NUMERIC: ColumnKey[] = [
  "orderedQuantity",
  "approxWeight",
  "soldSets",
  "soldPcs",
  "stock",
];

const STORAGE_KEY = "savora.wareColumnOrder.v1";

function loadOrder(): ColumnKey[] {
  if (typeof window === "undefined") return DEFAULT_ORDER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORDER;
    const parsed = JSON.parse(raw) as string[];
    const kept = parsed.filter((k): k is ColumnKey => DEFAULT_ORDER.includes(k as ColumnKey));
    const missing = DEFAULT_ORDER.filter((k) => !kept.includes(k));
    return [...kept, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

export function WareTable({
  wares,
  canEdit,
  onMove,
  isReordering,
}: {
  wares: WareTableRow[];
  canEdit: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  isReordering: boolean;
}) {
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
            ? " Sales in sets and pieces are editable; saving reduces the stock in hand automatically."
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
          {wares.map((w, i) => (
            <TableRow key={w.id}>
              {canEdit && (
                <TableCell>
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
          <Thumb url={ware.imageUrl} alt={`${ware.ware} reference image`} />
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
    case "soldSets":
      return <SalesCell ware={ware} field="sets" canEdit={canEdit} />;
    case "soldPcs":
      return <SalesCell ware={ware} field="pcs" canEdit={canEdit} />;
    case "stock":
      return (
        <TableCell className="num text-right">
          <span className="inline-flex items-center gap-1.5">
            {ware.stockInHand <= ware.threshold && (
              <AlertTriangle className="size-3.5 text-warning" />
            )}
            {num(ware.stockInHand)}
          </span>
        </TableCell>
      );
  }
}

function SalesCell({
  ware,
  field,
  canEdit,
}: {
  ware: WareTableRow;
  field: "sets" | "pcs";
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(updateWareSales);
  const current = field === "sets" ? ware.soldSets : ware.soldPcs;
  const [value, setValue] = useState(String(current));

  useEffect(() => {
    setValue(String(current));
  }, [current]);

  const mutation = useMutation({
    mutationFn: (next: number) =>
      save({
        data: {
          id: ware.id,
          sold_sets: field === "sets" ? next : ware.soldSets,
          sold_pcs: field === "pcs" ? next : ware.soldPcs,
          pieces_per_set: ware.piecesPerSet,
        },
      }),
    onSuccess: (res) => {
      const delta = res.piecesDelta ?? 0;
      toast.success(
        delta === 0
          ? "Sales updated"
          : `Sales updated · stock ${delta > 0 ? "reduced" : "restored"} by ${Math.abs(delta)} pcs`,
      );
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setValue(String(current));
    },
  });

  const commit = () => {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
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
        aria-label={`${ware.ware} sales in ${field === "sets" ? "sets" : "pieces"}`}
        className="num ml-auto h-8 w-20 text-right"
      />
      {field === "sets" && (
        <span className="mt-0.5 block text-[10px] text-muted-foreground">
          {num(ware.piecesPerSet)} pcs/set
        </span>
      )}
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

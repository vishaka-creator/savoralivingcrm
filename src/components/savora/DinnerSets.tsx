import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Sparkles, Trash2, UtensilsCrossed, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { computeDinnerSet, defaultDinnerRecipe, parseQtyPerSet } from "@/lib/dinner-sets";
import {
  addStandardDinnerSets,
  deleteDinnerSet,
  getDinnerSets,
  saveDinnerSet,
  suggestDinnerSets,
  updateDinnerSetItemQty,
} from "@/lib/dinner-sets.functions";
import { num } from "@/lib/format";

export type DinnerWare = { id: string; ware: string; productName: string | null; stockInHand: number };
type Item = { id?: string; piece_name: string; sku_id: string | null; qty_per_set: number };
type DinnerSet = { id: string; name: string; guests: number; items: Item[] };
type Draft = { id: string | null; name: string; guests: number; items: Item[] };

const NONE = "__none__";

export function DinnerSets({
  slug,
  collectionName,
  wares,
  canEdit,
}: {
  slug: string;
  collectionName: string;
  wares: DinnerWare[];
  canEdit: boolean;
}) {
  const fetchSets = useServerFn(getDinnerSets);
  const queryKey = ["dinner-sets", slug];
  const { data, isPending, error } = useQuery({ queryKey, queryFn: () => fetchSets({ data: { slug } }) });
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["dinner-sets", slug] });

  const stock = useMemo(() => new Map(wares.map((w) => [w.id, w.stockInHand])), [wares]);
  const wareName = (id: string | null) => wares.find((w) => w.id === id)?.ware ?? null;

  const [editing, setEditing] = useState<Draft | null>(null);
  const addStandard = useServerFn(addStandardDinnerSets);
  const addStandardMutation = useMutation({
    mutationFn: () => addStandard({ data: { slug } }),
    onSuccess: () => {
      toast.success("Dinner sets for 4 and 6 added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sets = (data?.sets ?? []) as DinnerSet[];

  return (
    <section className="panel p-5" aria-labelledby={`dinner-sets-${slug}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <UtensilsCrossed className="size-3.5 text-primary" /> {collectionName} · Dinner sets
          </p>
          <h2 id={`dinner-sets-${slug}`} className="mt-1 text-xl">Dinner sets you can make</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Worked out from the pieces in stock above.{canEdit ? " Change any per-set number to change the recipe." : ""}
          </p>
        </div>
        {canEdit && sets.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditing({ id: null, name: "Dinner set for 8", guests: 8, items: defaultDinnerRecipe(8).map((p) => ({ ...p, sku_id: null })) })}
          >
            <Plus className="size-4" /> Add set size
          </Button>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p>}

      {isPending ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      ) : sets.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
          No dinner sets for this collection yet.
          {canEdit && (
            <Button className="ml-3" size="sm" onClick={() => addStandardMutation.mutate()} disabled={addStandardMutation.isPending}>
              <Plus className="size-4" /> Add sets for 4 and 6
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {sets.map((set) => (
            <DinnerSetCard
              key={set.id}
              set={set}
              stock={stock}
              wareName={wareName}
              canEdit={canEdit}
              onEdit={() => setEditing({ id: set.id, name: set.name, guests: set.guests, items: set.items.map((i) => ({ ...i })) })}
              onSaved={refresh}
            />
          ))}
        </div>
      )}

      {sets.length > 1 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Each set is counted on its own from the same stock, so making one size uses up pieces the other would need.
        </p>
      )}

      <DinnerAiHelp slug={slug} canEdit={canEdit} stock={stock} wareName={wareName} sets={sets} onApplied={refresh} />

      {editing && (
        <EditDinnerSetDialog
          slug={slug}
          draft={editing}
          wares={wares}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            refresh();
          }}
        />
      )}
    </section>
  );
}

function DinnerSetCard({
  set,
  stock,
  wareName,
  canEdit,
  onEdit,
  onSaved,
}: {
  set: DinnerSet;
  stock: Map<string, number>;
  wareName: (id: string | null) => string | null;
  canEdit: boolean;
  onEdit: () => void;
  onSaved: () => void;
}) {
  const result = computeDinnerSet(set.items, stock);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps">{set.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">{num(result.piecesPerSet)} pieces per set</p>
          {canEdit && (
            <Button variant="ghost" size="sm" className="-ml-2 mt-1 h-7 px-2 text-xs" onClick={onEdit}>
              <Pencil className="size-3.5" /> Edit recipe
            </Button>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="metric text-4xl leading-none text-primary">{num(result.setsPossible)}</div>
          <div className="mt-1 text-xs text-muted-foreground">sets can be made</div>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="label-caps py-2 pr-2 font-semibold">Piece</th>
              <th className="label-caps px-2 py-2 text-right font-semibold">Per set</th>
              <th className="label-caps px-2 py-2 text-right font-semibold">Pcs in stock</th>
              <th className="label-caps py-2 pl-2 text-right font-semibold">Enough for</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => {
              const limiting = index === result.limitingIndex && result.rows.length > 1;
              return (
                <tr key={row.item.id ?? index} className={`border-b border-border last:border-0 ${limiting ? "bg-warning/10" : ""}`}>
                  <td className="py-2 pr-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{row.item.piece_name}</span>
                      {limiting && (
                        <Badge variant="outline" className="border-warning px-1.5 py-0 text-[10px] text-warning">
                          Holding back
                        </Badge>
                      )}
                    </div>
                    <div className={`text-xs ${row.linked ? "text-muted-foreground" : "text-warning"}`}>
                      {row.linked ? wareName(row.item.sku_id) : "No ware linked"}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    {canEdit && row.item.id ? (
                      <QtyInput itemId={row.item.id} value={row.item.qty_per_set} label={`${row.item.piece_name} per set in ${set.name}`} onSaved={onSaved} />
                    ) : (
                      <span className="num">{num(row.item.qty_per_set)}</span>
                    )}
                  </td>
                  <td className="num px-2 py-2 text-right">{num(row.onHand)}</td>
                  <td className="num py-2 pl-2 text-right">
                    {row.enoughFor === null ? "—" : limiting ? <b>{num(row.enoughFor)}</b> : num(row.enoughFor)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QtyInput({ itemId, value, label, onSaved }: { itemId: string; value: number; label: string; onSaved: () => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const save = useServerFn(updateDinnerSetItemQty);
  const mutation = useMutation({
    mutationFn: (qty: number) => save({ data: { id: itemId, qty_per_set: qty } }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setText(String(value));
    },
  });
  const commit = () => {
    const qty = parseQtyPerSet(text);
    if (qty === null) {
      toast.error("Enter a whole number from 0 to 1000");
      setText(String(value));
      return;
    }
    if (qty !== value) mutation.mutate(qty);
  };
  return (
    <Input
      inputMode="numeric"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      disabled={mutation.isPending}
      className="num ml-auto h-8 w-16 text-center"
    />
  );
}

function EditDinnerSetDialog({
  slug,
  draft: initial,
  wares,
  onClose,
  onSaved,
}: {
  slug: string;
  draft: Draft;
  wares: DinnerWare[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useServerFn(saveDinnerSet);
  const remove = useServerFn(deleteDinnerSet);
  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: draft.id,
          collection_slug: slug,
          name: draft.name.trim(),
          guests: draft.guests,
          items: draft.items
            .filter((i) => i.piece_name.trim())
            .map((i) => ({ piece_name: i.piece_name.trim(), sku_id: i.sku_id, qty_per_set: i.qty_per_set })),
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: () => remove({ data: { id: draft.id! } }),
    onSuccess: () => {
      toast.success("Dinner set deleted");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setItem = (index: number, patch: Partial<Item>) =>
    setDraft((d) => ({ ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...patch } : it)) }));
  const valid = draft.name.trim() && draft.guests >= 1 && draft.items.some((i) => i.piece_name.trim());

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? `Edit ${initial.name}` : "Add a dinner set size"}</DialogTitle>
          <DialogDescription>Choose the pieces, which ware each one uses, and how many go in one set.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="space-y-1.5">
            <Label htmlFor="dinner-name">Set name</Label>
            <Input id="dinner-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dinner-guests">For how many</Label>
            <Input
              id="dinner-guests"
              inputMode="numeric"
              value={String(draft.guests)}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                setDraft({ ...draft, guests: Math.min(50, n) });
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_72px_32px] gap-2 sm:grid">
            <span className="label-caps">Piece</span>
            <span className="label-caps">Ware</span>
            <span className="label-caps text-right">Per set</span>
            <span />
          </div>
          {draft.items.map((item, index) => (
            <div key={index} className="grid grid-cols-[minmax(0,1fr)_72px_32px] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_72px_32px]">
              <Input aria-label="Piece name" value={item.piece_name} onChange={(e) => setItem(index, { piece_name: e.target.value })} placeholder="e.g. Katori" />
              <div className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
                <Select value={item.sku_id ?? NONE} onValueChange={(v) => setItem(index, { sku_id: v === NONE ? null : v })}>
                  <SelectTrigger aria-label={`Ware for ${item.piece_name || "piece"}`}>
                    <SelectValue placeholder="Pick a ware" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No ware linked</SelectItem>
                    {wares.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.ware} · {num(w.stockInHand)} pcs
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                aria-label={`${item.piece_name || "Piece"} per set`}
                inputMode="numeric"
                className="num text-center"
                value={String(item.qty_per_set)}
                onChange={(e) => setItem(index, { qty_per_set: Math.min(1000, Number(e.target.value.replace(/\D/g, "")) || 0) })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label={`Remove ${item.piece_name || "piece"}`}
                onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }))}
              >
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { piece_name: "", sku_id: null, qty_per_set: 1 }] }))}
          >
            <Plus className="size-4" /> Add piece
          </Button>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {draft.id ? (
            confirmDelete ? (
              <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                Yes, delete this set
              </Button>
            ) : (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Delete set
              </Button>
            )
          ) : (
            <span />
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={!valid || saveMutation.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Proposal = { id: string | null; name: string; guests: number; items: Item[] };

function DinnerAiHelp({
  slug,
  canEdit,
  stock,
  wareName,
  sets,
  onApplied,
}: {
  slug: string;
  canEdit: boolean;
  stock: Map<string, number>;
  wareName: (id: string | null) => string | null;
  sets: DinnerSet[];
  onApplied: () => void;
}) {
  const [request, setRequest] = useState("");
  const [result, setResult] = useState<{ answer: string; proposals: Proposal[] } | null>(null);
  const ask = useServerFn(suggestDinnerSets);
  const save = useServerFn(saveDinnerSet);
  const askMutation = useMutation({
    mutationFn: () => ask({ data: { slug, request: request.trim() } }),
    onSuccess: (r) => setResult(r),
    onError: (e: Error) => toast.error(e.message),
  });
  const applyMutation = useMutation({
    mutationFn: async (proposals: Proposal[]) => {
      for (const p of proposals) {
        await save({ data: { id: p.id, collection_slug: slug, name: p.name, guests: p.guests, items: p.items } });
      }
    },
    onSuccess: () => {
      toast.success("AI suggestion applied");
      setResult(null);
      setRequest("");
      onApplied();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  useEffect(() => setResult(null), [slug]);

  return (
    <div className="mt-5 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-4">
      <p className="label-caps inline-flex items-center gap-1.5 text-primary">
        <Sparkles className="size-3.5" /> AI help
      </p>
      <form
        className="mt-2 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (request.trim()) askMutation.mutate();
        }}
      >
        <Textarea
          aria-label="Tell AI what to change"
          rows={1}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (request.trim()) askMutation.mutate();
            }
          }}
          placeholder={'e.g. "Add a soup bowl to the set for 6" or "What mix of 4 and 6 sets uses the most stock?"'}
          className="min-h-10 flex-1 resize-none bg-card"
          maxLength={600}
        />
        <Button type="submit" disabled={!request.trim() || askMutation.isPending}>
          {askMutation.isPending ? "Thinking…" : "Ask AI"}
        </Button>
      </form>

      {result && (
        <div className="mt-3 space-y-3">
          {result.answer && (
            <div className="ask-answer text-sm">
              <ReactMarkdown>{result.answer}</ReactMarkdown>
            </div>
          )}
          {result.proposals.length > 0 && (
            <div className="space-y-2">
              <p className="label-caps">Suggested recipe changes</p>
              {result.proposals.map((p, i) => {
                const current = sets.find((s) => s.id === p.id);
                const after = computeDinnerSet(p.items, stock).setsPossible;
                const before = current ? computeDinnerSet(current.items, stock).setsPossible : null;
                return (
                  <div key={i} className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        {p.name} <span className="text-xs text-muted-foreground">{current ? "· change" : "· new"}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Sets can be made: {before !== null ? `${num(before)} → ` : ""}
                        <b className="text-foreground">{num(after)}</b>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {p.items
                        .map((it) => `${it.qty_per_set} ${it.piece_name}${it.sku_id ? ` (${wareName(it.sku_id)})` : " (no ware)"}`)
                        .join(" · ")}
                    </p>
                  </div>
                );
              })}
              <div className="flex gap-2">
                {canEdit ? (
                  <Button size="sm" onClick={() => applyMutation.mutate(result.proposals)} disabled={applyMutation.isPending}>
                    Apply
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">Only editors can apply changes.</p>
                )}
                <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {result.proposals.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing is saved until you press Apply on a suggested change.</p>
          )}
        </div>
      )}
    </div>
  );
}

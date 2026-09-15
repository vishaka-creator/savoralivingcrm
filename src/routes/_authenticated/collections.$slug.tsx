import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteCombination, deleteCosting, getCollectionDetail, getCollectionWorkspace, saveCombination, saveCosting } from "@/lib/savora.functions";
import { inr, num, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/collections/$slug")({
  head: ({ params }) => {
    const pretty = params.slug
      .split("-")
      .map((w) => w[0]?.toUpperCase() + w.slice(1))
      .join(" ");
    return {
      meta: [
        { title: `${pretty} — stock & sets buildable | Savora CRM` },
        {
          name: "description",
          content: `Raw material stock, boxes by SKU, sets buildable and sales for the Savora ${pretty} collection.`,
        },
        { property: "og:title", content: `${pretty} — Savora CRM` },
        {
          property: "og:description",
          content: `Stock, boxes and sets buildable for the ${pretty} collection.`,
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CollectionDetail,
});

function CollectionDetail() {
  const { slug } = Route.useParams();
  const fetchDetail = useServerFn(getCollectionDetail);
  const fetchWorkspace = useServerFn(getCollectionWorkspace);
  const { data, isPending, error } = useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchDetail({ data: { slug } }),
  });
  const { data: workspace } = useQuery({ queryKey: ["collection-workspace", slug], queryFn: () => fetchWorkspace({ data: { slug } }) });
  const client = useQueryClient();
  const [costingDraft, setCostingDraft] = useState({ item_name: "", material_cost: "0", box_cost: "0", notes: "" });
  const [comboDraft, setComboDraft] = useState({ combo_name: "", item: "", quantity: "1", combo_price: "0", notes: "" });
  const saveCost = useServerFn(saveCosting);
  const removeCost = useServerFn(deleteCosting);
  const saveCombo = useServerFn(saveCombination);
  const removeCombo = useServerFn(deleteCombination);
  const refresh = () => client.invalidateQueries({ queryKey: ["collection-workspace", slug] });
  const costMutation = useMutation({ mutationFn: () => saveCost({ data: { collection_slug: slug, item_name: costingDraft.item_name, material_cost: Number(costingDraft.material_cost), box_cost: Number(costingDraft.box_cost), notes: costingDraft.notes || null } }), onSuccess: () => { toast.success("Costing line saved"); setCostingDraft({ item_name: "", material_cost: "0", box_cost: "0", notes: "" }); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const comboMutation = useMutation({ mutationFn: () => saveCombo({ data: { collection_slug: slug, combo_name: comboDraft.combo_name, items_included: [{ item: comboDraft.item, quantity: Number(comboDraft.quantity) }], combo_price: Number(comboDraft.combo_price), notes: comboDraft.notes || null } }), onSuccess: () => { toast.success("Combination saved"); setComboDraft({ combo_name: "", item: "", quantity: "1", combo_price: "0", notes: "" }); refresh(); }, onError: (e: Error) => toast.error(e.message) });

  return (
    <AppShell>
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Dashboard
      </Link>

      {error && (
        <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </p>
      )}

      {isPending && <Skeleton className="mt-6 h-64" />}

      {data && (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="label-caps">Collection</p>
              <h1 className="mt-1 text-3xl">{data.collection.name}</h1>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <div>Sheet tab: {data.collection.sheet_tab}</div>
              <div>
                {data.materials.length} wares · {data.boxes.length} box SKUs ·{" "}
                {inr(data.sales.reduce((a, s) => a + s.amount, 0))} lifetime sales
              </div>
            </div>
          </div>

          <Tabs defaultValue="sets" className="mt-8">
            <TabsList>
              <TabsTrigger value="sets">Sets buildable</TabsTrigger>
              <TabsTrigger value="materials">Stock in hand</TabsTrigger>
              <TabsTrigger value="boxes">Boxes</TabsTrigger>
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="costing">Costing</TabsTrigger>
              <TabsTrigger value="combos">Special combinations</TabsTrigger>
            </TabsList>

            <TabsContent value="sets" className="space-y-4">
              {!data.sets.length && (
                <p className="panel p-5 text-sm text-muted-foreground">
                  No set recipes yet for this collection. An admin can add them under Admin → Set
                  recipes (e.g. "Dinner set of 4" needing 4 dinner plates per set).
                </p>
              )}
              {data.sets.map((set) => (
                <div key={set.setName} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg">{set.setName}</h2>
                      <p className="text-sm text-muted-foreground">
                        {set.limitedBy === "boxes"
                          ? `Capped by boxes in hand (${num(set.boxQty)})`
                          : set.limitingComponent
                            ? `Limited by ${set.limitingComponent}`
                            : "No components mapped"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="label-caps">Complete sets</div>
                      <div className="metric text-4xl text-primary">{num(set.buildable)}</div>
                    </div>
                  </div>

                  <Table className="mt-4">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead className="text-right">Per set</TableHead>
                        <TableHead className="text-right">In hand</TableHead>
                        <TableHead className="text-right">Sets possible</TableHead>
                        <TableHead className="w-40">Headroom</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {set.components.map((c) => {
                        const worst = c.possible === set.buildable;
                        return (
                          <TableRow key={c.component}>
                            <TableCell className="font-medium">{c.component}</TableCell>
                            <TableCell className="num text-right">×{c.perSet}</TableCell>
                            <TableCell className="num text-right">{num(c.onHand)}</TableCell>
                            <TableCell
                              className={`num text-right ${worst ? "font-semibold text-warning" : ""}`}
                            >
                              {num(c.possible)}
                            </TableCell>
                            <TableCell>
                              <Progress
                                value={
                                  set.buildable && c.possible
                                    ? Math.min(100, (set.buildable / c.possible) * 100)
                                    : 0
                                }
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="materials">
              <div className="panel overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ware</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">Ordered</TableHead>
                      <TableHead className="text-right">In hand</TableHead>
                      <TableHead className="text-right">Low at</TableHead>
                      <TableHead className="text-right">Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.materials.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="num text-muted-foreground">{m.code ?? "—"}</TableCell>
                        <TableCell className="num text-right">{num(m.orderedQuantity)}</TableCell>
                        <TableCell className="num text-right">
                          <span className="inline-flex items-center gap-1.5">
                            {m.quantity <= m.threshold && (
                              <AlertTriangle className="size-3.5 text-warning" />
                            )}
                            {num(m.quantity)} {m.unit}
                          </span>
                        </TableCell>
                        <TableCell className="num text-right text-muted-foreground">
                          {num(m.threshold)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {relativeTime(m.lastSynced)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="boxes">
              <div className="panel overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Box / product</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead className="text-right">In hand</TableHead>
                      <TableHead className="text-right">Production cost</TableHead>
                      <TableHead>Foam</TableHead>
                      <TableHead>Print</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.boxes.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.product}</TableCell>
                        <TableCell className="num text-muted-foreground">{b.code ?? "—"}</TableCell>
                        <TableCell className="num text-right">{num(b.quantity_on_hand)}</TableCell>
                        <TableCell className="num text-right">{inr(b.production_cost)}</TableCell>
                        <TableCell>
                          {b.foam === null ? "—" : b.foam ? "Yes" : "No"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {b.print_status ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="sales">
              <div className="panel overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.month ?? "—"}</TableCell>
                        <TableCell className="font-medium">{s.client_name ?? "—"}</TableCell>
                        <TableCell className="num text-right">{inr(s.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{s.status ?? "—"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
            <TabsContent value="costing" className="space-y-4">
              <div className="panel p-5"><h2 className="text-lg">Add costing line</h2><div className="mt-4 grid gap-3 sm:grid-cols-4"><Input placeholder="Item name" value={costingDraft.item_name} onChange={(e) => setCostingDraft({ ...costingDraft, item_name: e.target.value })} /><Input type="number" min="0" placeholder="Material cost" value={costingDraft.material_cost} onChange={(e) => setCostingDraft({ ...costingDraft, material_cost: e.target.value })} /><Input type="number" min="0" placeholder="Box cost" value={costingDraft.box_cost} onChange={(e) => setCostingDraft({ ...costingDraft, box_cost: e.target.value })} /><Button disabled={!costingDraft.item_name.trim() || costMutation.isPending} onClick={() => costMutation.mutate()}><Plus className="mr-2 size-4" />Add line</Button></div></div>
              <div className="panel overflow-hidden"><Table><TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Material</TableHead><TableHead className="text-right">Box</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader><TableBody>{(workspace?.costing ?? []).map((line) => <TableRow key={line.id}><TableCell className="font-medium">{line.item_name}</TableCell><TableCell className="num text-right">{inr(line.material_cost)}</TableCell><TableCell className="num text-right">{inr(line.box_cost)}</TableCell><TableCell className="num text-right font-medium">{inr(line.total_cost)}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" aria-label={`Delete ${line.item_name}`} onClick={() => removeCost({ data: { id: line.id } }).then(refresh).catch((e: Error) => toast.error(e.message))}><Trash2 className="size-4 text-destructive" /></Button></TableCell></TableRow>)}</TableBody></Table>{!workspace?.costing.length && <p className="p-8 text-center text-sm text-muted-foreground">No costing lines yet.</p>}</div>
            </TabsContent>
            <TabsContent value="combos" className="space-y-4">
              <div className="panel p-5"><h2 className="text-lg">Add special combination</h2><div className="mt-4 grid gap-3 sm:grid-cols-5"><Input placeholder="Combination name" value={comboDraft.combo_name} onChange={(e) => setComboDraft({ ...comboDraft, combo_name: e.target.value })} /><Input placeholder="Included ware" value={comboDraft.item} onChange={(e) => setComboDraft({ ...comboDraft, item: e.target.value })} /><Input type="number" min="0.01" placeholder="Qty" value={comboDraft.quantity} onChange={(e) => setComboDraft({ ...comboDraft, quantity: e.target.value })} /><Input type="number" min="0" placeholder="Price" value={comboDraft.combo_price} onChange={(e) => setComboDraft({ ...comboDraft, combo_price: e.target.value })} /><Button disabled={!comboDraft.combo_name.trim() || !comboDraft.item.trim() || comboMutation.isPending} onClick={() => comboMutation.mutate()}><Plus className="mr-2 size-4" />Add combo</Button></div></div>
              <div className="grid gap-4 md:grid-cols-2">{(workspace?.combinations ?? []).map((combo) => <div key={combo.id} className="panel p-5"><div className="flex items-start justify-between"><div><h2 className="font-medium">{combo.combo_name}</h2><p className="mt-1 text-sm text-muted-foreground">{(combo.items_included as Array<{ item: string; quantity: number }>).map((item) => `${item.quantity} × ${item.item}`).join(", ")}</p></div><Button variant="ghost" size="icon" aria-label={`Delete ${combo.combo_name}`} onClick={() => removeCombo({ data: { id: combo.id } }).then(refresh).catch((e: Error) => toast.error(e.message))}><Trash2 className="size-4 text-destructive" /></Button></div><p className="metric mt-5 text-xl">{inr(combo.combo_price)}</p></div>)}</div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

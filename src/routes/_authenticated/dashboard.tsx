import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  BarChart3,
  Plus,
  PackageCheck,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

import { AppShell, useMe } from "@/components/savora/AppShell";
import { WareTable } from "@/components/savora/WareTable";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";


import { createCollection, getDashboard, reorderWares } from "@/lib/savora.functions";
import { inr, num, trend } from "@/lib/format";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Savora Inventory & Sales CRM" },
      {
        name: "description",
        content:
          "Stock in hand, sets buildable and month-to-date sales across Zebra, Mini, Le Cirque, Mahjong and Orchid.",
      },
      { property: "og:title", content: "Savora CRM dashboard" },
      {
        property: "og:description",
        content: "Stock in hand, sets buildable and month-to-date sales for every collection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

const accent: Record<string, string> = {
  zebra: "bg-collection-zebra",
  mini: "bg-collection-mini",
  "le-cirque": "bg-collection-cirque",
  mahjong: "bg-collection-mahjong",
  orchid: "bg-collection-orchid",
};

function Dashboard() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isPending, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
  });

  const [selected, setSelected] = useState<string | null>(null);
  const cards = data?.cards ?? [];
  const active = cards.find((c) => c.slug === selected) ?? cards[0] ?? null;

  const { data: me } = useMe();
  const canReorder = !!me?.isAdmin;
  const queryClient = useQueryClient();
  const saveOrder = useServerFn(reorderWares);
  const [order, setOrder] = useState<string[] | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setOrder(null);
    setShowAll(false);
  }, [active?.slug]);

  const reorder = useMutation({
    mutationFn: (vars: { slug: string; ids: string[] }) =>
      saveOrder({ data: { collection_slug: vars.slug, orderedIds: vars.ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const baseWares = active?.wares ?? [];
  const wares = order
    ? (order.map((id) => baseWares.find((w) => w.id === id)).filter(Boolean) as typeof baseWares)
    : baseWares;
  const visibleWares = showAll ? wares : wares.slice(0, 5);

  const move = (index: number, direction: -1 | 1) => {
    if (!active) return;
    const target = index + direction;
    if (target < 0 || target >= wares.length) return;
    const ids = wares.map((w) => w.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    setOrder(ids);
    reorder.mutate({ slug: active.slug, ids });
  };

  const applyOrder = (ids: string[]) => {
    if (!active) return;
    setOrder(ids);
    reorder.mutate({ slug: active.slug, ids });
  };

  const delta = data && trend(data.totals.salesThisMonth, data.totals.salesLastMonth);


  return (
    <AppShell lastSync={data?.lastSync ?? null}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Overview</p>
          <h1 className="mt-1 text-3xl">Stock, Inventory &amp; sales</h1>
        </div>
        {data && (
          <p className="max-w-sm text-sm text-muted-foreground">
            Sets buildable are calculated from pieces per set (sets of 2 and 4) against the stock
            in hand, then capped by boxes available.
          </p>
        )}
      </div>

      {error && (
        <div className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isPending
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)
          : data && (
              <>
                <Kpi
                  label={`Sales · ${data.totals.thisMonth}`}
                  value={inr(data.totals.salesThisMonth)}
                  icon={TrendingUp}
                  hint={
                    delta === null || delta === undefined
                      ? `vs ${data.totals.lastMonth}: —`
                      : `${delta >= 0 ? "+" : ""}${delta}% vs ${data.totals.lastMonth}`
                  }
                />
                <Kpi
                  label="Sets buildable"
                  value={num(cards.reduce((a, c) => a + c.setsBuildable, 0))}
                  icon={PackageCheck}
                  hint={`${cards.reduce((a, c) => a + c.setDefinitions, 0)} set recipes defined`}
                />
                <Kpi
                  label="Boxes in hand"
                  value={num(data.totals.boxes)}
                  icon={Boxes}
                  hint={`${cards.reduce((a, c) => a + c.boxSkuCount, 0)} box SKUs`}
                />
                <Kpi
                  label="Low stock items"
                  value={num(cards.reduce((a, c) => a + c.lowStockCount, 0))}
                  icon={AlertTriangle}
                  hint={`${data.totals.pending} sales rows not yet received`}
                  tone={cards.reduce((a, c) => a + c.lowStockCount, 0) > 0 ? "warning" : "default"}
                />
              </>
            )}
      </div>

      <div className="mt-12">
        <h2 className="text-xl">Ware list</h2>
        <p className="text-sm text-muted-foreground">
          Pick a collection on the left; its wares are listed on the right.
        </p>
      </div>

      {isPending ? (
        <Skeleton className="mt-4 h-64" />
      ) : (
        active && (
          <div className="mt-4 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
            {/* Left: subject list */}
           <nav className="panel h-fit p-2 lg:sticky lg:top-6">
             <div className="flex items-center justify-between border-b border-border px-2 pb-2">
               <span className="label-caps">Collections</span>
               {canReorder && <AddCollectionButton />}
             </div>
              <ul className="space-y-1">
                {cards.map((c) => {
                  const isActive = c.slug === active.slug;
                  return (
                    <li key={c.slug}>
                      <button
                        type="button"
                        onClick={() => setSelected(c.slug)}
                        aria-current={isActive ? "true" : undefined}
                        className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span
                          className={`size-2 shrink-0 rounded-full ${accent[c.slug] ?? "bg-primary"}`}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        <span className="num shrink-0 text-xs text-muted-foreground">
                          {num(c.skuCount)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Right: selected collection detail */}
            <div className="min-w-0 space-y-4">
              <div className="panel grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 sm:flex sm:flex-wrap sm:justify-between">
                <div className="flex min-w-0 flex-wrap gap-8">
                  <Stat label="Sets buildable" value={num(active.setsBuildable)} emphasise />
                  <Stat label="Pieces in hand" value={num(active.totalMaterial)} />
                  <Stat label="Boxes" value={num(active.boxCount)} />
                  <Stat label="Sales this month" value={inr(active.monthSales)} />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {active.lowStockCount > 0 && (
                    <Badge variant="outline" className="border-warning text-warning">
                      {active.lowStockCount} low
                    </Badge>
                  )}
                  <Link
                    to="/collections/$slug"
                    params={{ slug: active.slug }}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    Open collection <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>

               <SalesChart wares={wares} />

               <WareTable
                 wares={visibleWares}
                canEdit={canReorder}
                onMove={move}
                onReorder={applyOrder}
                isReordering={reorder.isPending}
              />
               {wares.length > 5 && (
                 <Button
                   variant="outline"
                   className="w-full"
                   onClick={() => setShowAll((value) => !value)}
                 >
                   {showAll ? "Show only 5 items" : `Show all ${wares.length} items`}
                 </Button>
               )}


            </div>
          </div>
        )
      )}
    </AppShell>
  );
}

function SalesChart({ wares }: { wares: Array<{ ware: string; soldSets: number; soldPcs: number; piecesPerSet: number }> }) {
  const chartData = wares
    .map((ware) => ({
      name: ware.ware.length > 18 ? `${ware.ware.slice(0, 18)}…` : ware.ware,
      sales: ware.soldSets * ware.piecesPerSet + ware.soldPcs,
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  return (
    <section className="panel p-5" aria-labelledby="product-sales-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="label-caps">Top 5 products</p>
          <h2 id="product-sales-heading" className="mt-1 text-xl">Product sales</h2>
        </div>
        <BarChart3 className="size-5 text-muted-foreground" />
      </div>
      {chartData.some((item) => item.sales > 0) ? (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "var(--color-muted)" }} />
              <Bar dataKey="sales" name="Pieces sold" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Sales will appear here as products are recorded.</p>
      )}
    </section>
  );
}

function AddCollectionButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sheetTab, setSheetTab] = useState("");
  const queryClient = useQueryClient();
  const add = useServerFn(createCollection);
  const mutation = useMutation({
    mutationFn: () => {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      return add({ data: { name: name.trim(), slug, sheet_tab: sheetTab.trim() || name.trim(), shopify_handle: null } });
    },
    onSuccess: () => {
      toast.success("Collection added");
      setName("");
      setSheetTab("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Add collection">
          <Plus className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add collection</DialogTitle>
          <DialogDescription>Add a new subject to the collection list. Wares can be synced into it later.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="collection-name">Collection name</Label><Input id="collection-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Coastal" /></div>
          <div className="space-y-1.5"><Label htmlFor="collection-sheet">Sheet tab</Label><Input id="collection-sheet" value={sheetTab} onChange={(event) => setSheetTab(event.target.value)} placeholder="Optional" /></div>
        </div>
        <DialogFooter><Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>Add collection</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function Stat({
  label,
  value,
  emphasise = false,
}: {
  label: string;
  value: string;
  emphasise?: boolean;
}) {
  return (
    <div>
      <div className="label-caps">{label}</div>
      <div className={`metric mt-1 ${emphasise ? "text-2xl text-primary" : "text-xl"}`}>
        {value}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="label-caps">{label}</span>
        <Icon className={`size-4 ${tone === "warning" ? "text-warning" : "text-muted-foreground"}`} />
      </div>
      <div className="metric mt-3 text-3xl">{value}</div>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

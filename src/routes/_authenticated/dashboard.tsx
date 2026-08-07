import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, Boxes, PackageCheck, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/savora.functions";
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

  const delta =
    data && trend(data.totals.salesThisMonth, data.totals.salesLastMonth);

  return (
    <AppShell lastSync={data?.lastSync ?? null}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-caps">Overview</p>
          <h1 className="mt-1 text-3xl">Stock, kitting &amp; sales</h1>
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
                  value={num(data.cards.reduce((a, c) => a + c.setsBuildable, 0))}
                  icon={PackageCheck}
                  hint={`${data.cards.reduce((a, c) => a + c.setDefinitions, 0)} set recipes defined`}
                />
                <Kpi
                  label="Boxes in hand"
                  value={num(data.totals.boxes)}
                  icon={Boxes}
                  hint={`${data.cards.reduce((a, c) => a + c.boxSkuCount, 0)} box SKUs`}
                />
                <Kpi
                  label="Low stock items"
                  value={num(data.cards.reduce((a, c) => a + c.lowStockCount, 0))}
                  icon={AlertTriangle}
                  hint={`${data.totals.pending} sales rows not yet received`}
                  tone={
                    data.cards.reduce((a, c) => a + c.lowStockCount, 0) > 0 ? "warning" : "default"
                  }
                />
              </>
            )}
      </div>

      <h2 className="mt-12 text-xl">Collections</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isPending
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          : data?.cards.map((c) => (
              <Link
                key={c.slug}
                to="/collections/$slug"
                params={{ slug: c.slug }}
                className="panel group relative overflow-hidden p-5 transition-shadow hover:shadow-raised"
              >
                <span
                  className={`absolute inset-x-0 top-0 h-1 ${accent[c.slug] ?? "bg-primary"}`}
                />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{c.sheetTab}</p>
                  </div>
                  {c.lowStockCount > 0 && (
                    <Badge variant="outline" className="border-warning text-warning">
                      {c.lowStockCount} low
                    </Badge>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <Cell label="Sets buildable" value={num(c.setsBuildable)} emphasise />
                  <Cell label="Pieces in hand" value={num(c.totalMaterial)} />
                  <Cell label="Boxes" value={num(c.boxCount)} />
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                  <span>
                    {c.skuCount} wares · {inr(c.monthSales)} this month
                  </span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
      </div>
    </AppShell>
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

function Cell({
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

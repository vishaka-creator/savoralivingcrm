import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft } from "lucide-react";

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
import { getCollectionDetail } from "@/lib/savora.functions";
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
  const { data, isPending, error } = useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchDetail({ data: { slug } }),
  });

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
          </Tabs>
        </>
      )}
    </AppShell>
  );
}

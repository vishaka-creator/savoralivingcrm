import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
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
import { getSalesOverview } from "@/lib/savora.functions";
import { inr } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Monthly sales & expenses — Savora CRM" },
      {
        name: "description",
        content:
          "Month-by-month Savora sales by client and collection, alongside vendor expenses from the ledger.",
      },
      { property: "og:title", content: "Monthly sales & expenses — Savora CRM" },
      {
        property: "og:description",
        content: "Savora sales by month, client and collection with vendor expenses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SalesPage,
});

const MONTH_ORDER = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

function SalesPage() {
  const fetchSales = useServerFn(getSalesOverview);
  const { data, isPending } = useQuery({
    queryKey: ["sales-overview"],
    queryFn: () => fetchSales(),
  });

  const byMonth = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { month: string; sales: number; expenses: number }>();
    const get = (m: string) => {
      const key = m || "Unknown";
      if (!map.has(key)) map.set(key, { month: key, sales: 0, expenses: 0 });
      return map.get(key)!;
    };
    for (const s of data.sales) get(s.month ?? "Unknown").sales += s.amount;
    for (const e of data.expenses) get(e.month ?? "Unknown").expenses += e.amount;
    return [...map.values()].sort(
      (a, b) =>
        MONTH_ORDER.indexOf(a.month.toLowerCase()) - MONTH_ORDER.indexOf(b.month.toLowerCase()),
    );
  }, [data]);

  const totalSales = data?.sales.reduce((a, s) => a + s.amount, 0) ?? 0;
  const totalExpenses = data?.expenses.reduce((a, e) => a + e.amount, 0) ?? 0;

  return (
    <AppShell>
      <p className="label-caps">Money</p>
      <h1 className="mt-1 text-3xl">Monthly sales &amp; expenses</h1>

      {isPending ? (
        <Skeleton className="mt-8 h-72" />
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Total sales" value={inr(totalSales)} />
            <Stat label="Total expenses" value={inr(totalExpenses)} />
            <Stat label="Net" value={inr(totalSales - totalExpenses)} />
          </div>

          <div className="panel mt-6 p-5">
            <h2 className="text-lg">Sales vs expenses by month</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(v: number | string) => inr(Number(v))}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="sales" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--color-chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <Tabs defaultValue="sales" className="mt-8">
            <TabsList>
              <TabsTrigger value="sales">Sales ({data?.sales.length ?? 0})</TabsTrigger>
              <TabsTrigger value="expenses">Expenses ({data?.expenses.length ?? 0})</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <div className="panel overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Collection</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.month ?? "—"}</TableCell>
                        <TableCell className="num text-muted-foreground">
                          {s.sale_date ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{s.client_name ?? "—"}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {s.collection_slug?.replace("-", " ") ?? "unassigned"}
                        </TableCell>
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

            <TabsContent value="expenses">
              <div className="panel overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.expenses.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.month ?? "—"}</TableCell>
                        <TableCell className="num text-muted-foreground">
                          {e.spend_date ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{e.vendor ?? "—"}</TableCell>
                        <TableCell className="num text-right">{inr(e.amount)}</TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {e.remarks ?? "—"}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-5">
      <div className="label-caps">{label}</div>
      <div className="metric mt-2 text-2xl">{value}</div>
    </div>
  );
}

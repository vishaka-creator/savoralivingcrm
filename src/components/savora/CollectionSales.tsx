import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, RefreshCw, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { ChartTypeToggle, CHART_COLORS, SimplePie, useChartType } from "@/components/savora/ChartType";
import { getSetsRecommendation } from "@/lib/ask-crm.functions";
import { num } from "@/lib/format";

const COLLECTION_COLOR: Record<string, string> = {
  zebra: "var(--color-chart-1)",
  mini: "var(--color-chart-2)",
  "le-cirque": "var(--color-chart-3)",
  mahjong: "var(--color-chart-4)",
  orchid: "var(--color-chart-5)",
};

type SalesWare = { soldSets: number; soldPcs: number; piecesPerSet: number };
type SalesCard = { slug: string; name: string; wares: SalesWare[] };

export const piecesSold = (w: SalesWare) => w.soldSets * Math.max(1, w.piecesPerSet) + w.soldPcs;

/** Pieces sold per collection, from each ware's recorded sales. */
export function collectionSales(cards: SalesCard[]) {
  return cards
    .map((c, i) => ({
      slug: c.slug,
      name: c.name,
      value: c.wares.reduce((a, w) => a + piecesSold(w), 0),
      color: COLLECTION_COLOR[c.slug] ?? CHART_COLORS[i % CHART_COLORS.length]!,
    }))
    .sort((a, b) => b.value - a.value);
}

export function CollectionSalesCard({ cards }: { cards: SalesCard[] }) {
  const [type, setType] = useChartType("collection-sales", "pie");
  const data = collectionSales(cards);
  const total = data.reduce((a, d) => a + d.value, 0);
  const leader = data[0] && data[0].value > 0 ? data[0] : null;

  return (
    <div className="panel p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-caps">Pieces sold</p>
          <h2 className="mt-1 text-xl">Sales by collection</h2>
        </div>
        <ChartTypeToggle value={type} onChange={setType} label="Sales by collection" />
      </div>

      {leader ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1.5 text-sm">
          <Crown className="size-4 text-primary" />
          <span>
            <span className="font-semibold">{leader.name}</span> sold the most —{" "}
            <span className="num">{num(leader.value)}</span> pcs (
            {Math.round((leader.value / total) * 100)}% of {num(total)})
          </span>
        </p>
      ) : null}

      {total > 0 ? (
        <div className="mt-3 h-56">
          {type === "pie" ? (
            <SimplePie valueLabel="Pieces sold" formatValue={(v) => `${num(v)} pcs`} data={data} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} formatter={(v) => [`${num(Number(v))} pcs`, "Pieces sold"]} />
                <Bar dataKey="value" name="Pieces sold" radius={[3, 3, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.slug} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">Sales will appear here once wares have sales recorded.</p>
      )}
    </div>
  );
}

export function SetsRecommendation() {
  const fetchRecommendation = useServerFn(getSetsRecommendation);
  const [result, setResult] = useState<{ answer: string; generatedAt: string } | null>(null);
  const mutation = useMutation({
    mutationFn: () => fetchRecommendation(),
    onSuccess: setResult,
  });

  return (
    <section className="panel mt-4 p-5" aria-labelledby="sets-ai-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" /> AI recommendation
          </p>
          <h2 id="sets-ai-heading" className="mt-1 text-xl">Sets buildable — what sold more</h2>
        </div>
        <Button
          size="sm"
          variant={result ? "outline" : "default"}
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {result ? <RefreshCw className="mr-2 size-4" /> : <Sparkles className="mr-2 size-4" />}
          {mutation.isPending ? "Thinking…" : result ? "Refresh" : "Get recommendation"}
        </Button>
      </div>

      {mutation.isError && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {(mutation.error as Error).message}
        </p>
      )}
      {result ? (
        <div className="ask-answer mt-3 text-sm">
          <ReactMarkdown>{result.answer}</ReactMarkdown>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(result.generatedAt).toLocaleTimeString()}
          </p>
        </div>
      ) : (
        !mutation.isPending && (
          <p className="mt-3 text-sm text-muted-foreground">
            Find out which collection and which ware sold the most, and which sets to build next.
          </p>
        )
      )}
      {mutation.isPending && !result && (
        <p className="mt-3 text-sm text-muted-foreground">Reading sales and stock…</p>
      )}
    </section>
  );
}

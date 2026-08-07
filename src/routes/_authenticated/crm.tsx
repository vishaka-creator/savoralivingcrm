import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCrmItems } from "@/lib/savora.functions";
import { num, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Item tracking — Savora CRM" },
      {
        name: "description",
        content:
          "Track every Savora item through raw material, box made, set assemblable and sold, with the latest activity log.",
      },
      { property: "og:title", content: "Item tracking — Savora CRM" },
      {
        property: "og:description",
        content: "Every item from raw material through box made, set assemblable and sold.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CrmPage,
});

const STAGES = ["Raw material", "Box made", "Set assemblable"] as const;

function CrmPage() {
  const fetchItems = useServerFn(getCrmItems);
  const { data, isPending } = useQuery({ queryKey: ["crm"], queryFn: () => fetchItems() });
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [collection, setCollection] = useState("all");

  const collections = useMemo(
    () => [...new Set((data?.items ?? []).map((i) => i.collection))].sort(),
    [data],
  );

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (i) =>
        (stage === "all" || i.stage === stage) &&
        (collection === "all" || i.collection === collection) &&
        (!needle ||
          i.item.toLowerCase().includes(needle) ||
          (i.code ?? "").toLowerCase().includes(needle)),
    );
  }, [data, q, stage, collection]);

  return (
    <AppShell>
      <p className="label-caps">CRM</p>
      <h1 className="mt-1 text-3xl">Item tracking</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">
        Each item as it moves from raw ware to box made to set assemblable. Set rows show how many
        complete sets are currently possible.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          placeholder="Search item or code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={collection} onValueChange={setCollection}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Collection" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All collections</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c} value={c} className="capitalize">
                {c.replace("-", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="mt-6 h-64" />
      ) : (
        <div className="panel mt-6 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.key}>
                  <TableCell className="font-medium">{i.item}</TableCell>
                  <TableCell className="num text-muted-foreground">{i.code ?? "—"}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">
                    {i.collection.replace("-", " ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={i.stage === "Set assemblable" ? "default" : "secondary"}>
                      {i.stage}
                    </Badge>
                  </TableCell>
                  <TableCell className="num text-right">{num(i.quantity)}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {relativeTime(i.lastUpdated)}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nothing matches those filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <h2 className="mt-12 text-xl">Recent activity</h2>
      <div className="panel mt-4 divide-y divide-border">
        {(data?.activity ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span>
              <span className="font-medium">{a.action}</span>
              <span className="text-muted-foreground"> · {a.detail ?? ""}</span>
            </span>
            <span className="whitespace-nowrap text-xs text-muted-foreground">
              {a.actor_email ?? "system"} · {relativeTime(a.created_at)}
            </span>
          </div>
        ))}
        {!data?.activity.length && (
          <p className="px-5 py-6 text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
      </div>
    </AppShell>
  );
}

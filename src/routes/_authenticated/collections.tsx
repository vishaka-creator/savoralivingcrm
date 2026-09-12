import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Boxes, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppShell } from "@/components/savora/AppShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard } from "@/lib/savora.functions";
import { num } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/collections")({
  head: () => ({ meta: [
    { title: "Collections — Savora CRM" },
    { name: "description", content: "Open any Savora collection to manage wares, costing, combinations, stock and sales." },
    { property: "og:title", content: "Collections — Savora CRM" },
    { property: "og:description", content: "Manage every Savora collection in one workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: CollectionsPage,
});

function CollectionsPage() {
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isPending } = useQuery({ queryKey: ["collections-index"], queryFn: () => fetchDashboard() });
  return <AppShell lastSync={data?.lastSync ?? null}><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="label-caps">Workspace</p><h1 className="mt-1 text-3xl">Collections</h1><p className="mt-2 text-sm text-muted-foreground">Open a collection to edit its wares, costing and special combinations.</p></div><Button variant="outline" asChild><Link to="/dashboard"><Plus className="mr-2 size-4" />Manage collections</Link></Button></div>{isPending ? <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-44" />)}</div> : <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{(data?.cards ?? []).map((collection) => <Link key={collection.slug} to="/collections/$slug" params={{ slug: collection.slug }} className="panel group p-5 transition-colors hover:border-primary/40"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-md bg-secondary"><Boxes className="size-5 text-primary" /></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" /></div><h2 className="mt-5 text-xl">{collection.name}</h2><p className="mt-1 text-sm text-muted-foreground">{num(collection.skuCount)} wares · {num(collection.boxSkuCount)} box SKUs</p><div className="mt-5 flex gap-6 text-sm"><div><span className="label-caps">Sets</span><p className="metric mt-1 text-lg">{num(collection.setsBuildable)}</p></div><div><span className="label-caps">Stock</span><p className="metric mt-1 text-lg">{num(collection.totalMaterial)}</p></div></div></Link>)}</div>}</AppShell>;
}
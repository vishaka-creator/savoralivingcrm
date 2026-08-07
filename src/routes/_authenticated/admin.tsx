import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { AppShell, useMe } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  deleteBomRow,
  getAdminOverview,
  getCollectionDetail,
  setLowStockThreshold,
  setUserRole,
  upsertBomRow,
} from "@/lib/savora.functions";
import { COLLECTIONS } from "@/lib/savora-config";
import { num, relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — set recipes, roles & sync | Savora CRM" },
      {
        name: "description",
        content:
          "Admin controls for Savora CRM: define pieces per set for sets of 2 and 4, manage roles, thresholds and Google Sheets sync history.",
      },
      { property: "og:title", content: "Admin — Savora CRM" },
      {
        property: "og:description",
        content: "Set recipes, user roles, low-stock thresholds and sync history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: me, isPending: mePending } = useMe();

  if (mePending) {
    return (
      <AppShell>
        <Skeleton className="h-64" />
      </AppShell>
    );
  }

  if (!me?.isAdmin) {
    return (
      <AppShell>
        <div className="panel p-8">
          <h1 className="text-2xl">Admin only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is a Viewer. Ask an admin to upgrade you if you need to edit set recipes,
            thresholds or run a sync.
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <p className="label-caps">Admin</p>
      <h1 className="mt-1 text-3xl">Configuration</h1>

      <Tabs defaultValue="sets" className="mt-8">
        <TabsList>
          <TabsTrigger value="sets">Set recipes</TabsTrigger>
          <TabsTrigger value="thresholds">Low-stock alerts</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="sync">Sync history</TabsTrigger>
        </TabsList>
        <TabsContent value="sets">
          <SetRecipes />
        </TabsContent>
        <TabsContent value="thresholds">
          <Thresholds />
        </TabsContent>
        <TabsContent value="users">
          <Users />
        </TabsContent>
        <TabsContent value="sync">
          <SyncHistory />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function useCollection(slug: string) {
  const fetchDetail = useServerFn(getCollectionDetail);
  return useQuery({
    queryKey: ["collection", slug],
    queryFn: () => fetchDetail({ data: { slug } }),
  });
}

function SetRecipes() {
  const [slug, setSlug] = useState(COLLECTIONS[0].slug);
  const { data, isPending } = useCollection(slug);
  const queryClient = useQueryClient();
  const upsert = useServerFn(upsertBomRow);
  const remove = useServerFn(deleteBomRow);

  const [setName, setSetName] = useState("Set of 4");
  const [component, setComponent] = useState("");
  const [perSet, setPerSet] = useState("4");
  const [boxCode, setBoxCode] = useState("");

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          collection_slug: slug,
          set_name: setName.trim(),
          component_name: component.trim(),
          qty_required_per_set: Number(perSet),
          box_code: boxCode.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Recipe line saved");
      setComponent("");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Line removed");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="panel p-5">
        <h2 className="text-lg">Pieces per set</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tell the system what a set contains — e.g. a set of 4 needs 4 dinner plates, a set of 2
          needs 2 mugs. Sets buildable = stock in hand ÷ pieces per set, taking the lowest
          component and capping at boxes available.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Collection</Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COLLECTIONS.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setName">Set name</Label>
            <Input id="setName" value={setName} onChange={(e) => setSetName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="component">Component (ware)</Label>
            <Input
              id="component"
              list="ware-options"
              placeholder="Dinner plate"
              value={component}
              onChange={(e) => setComponent(e.target.value)}
            />
            <datalist id="ware-options">
              {(data?.materials ?? []).map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="perSet">Pieces per set</Label>
            <Input
              id="perSet"
              type="number"
              min="1"
              step="1"
              value={perSet}
              onChange={(e) => setPerSet(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="boxCode">Box code (optional)</Label>
            <Input
              id="boxCode"
              placeholder="e.g. ZB-4"
              value={boxCode}
              onChange={(e) => setBoxCode(e.target.value)}
            />
          </div>
        </div>

        <Button
          className="mt-4"
          onClick={() => save.mutate()}
          disabled={!component.trim() || !setName.trim() || save.isPending}
        >
          Add / update line
        </Button>
      </div>

      {isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Set</TableHead>
                <TableHead>Component</TableHead>
                <TableHead className="text-right">Per set</TableHead>
                <TableHead>Box code</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.bom ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.set_name}</TableCell>
                  <TableCell>{b.component_name}</TableCell>
                  <TableCell className="num text-right">×{b.qty_required_per_set}</TableCell>
                  <TableCell className="num text-muted-foreground">{b.box_code ?? "—"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete line"
                      onClick={() => del.mutate(b.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data?.bom.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No recipe lines for this collection yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Thresholds() {
  const [slug, setSlug] = useState(COLLECTIONS[0].slug);
  const { data, isPending } = useCollection(slug);
  const queryClient = useQueryClient();
  const update = useServerFn(setLowStockThreshold);

  const save = useMutation({
    mutationFn: (vars: { skuId: string; threshold: number }) => update({ data: vars }),
    onSuccess: () => {
      toast.success("Threshold saved");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Label>Collection</Label>
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLLECTIONS.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ware</TableHead>
                <TableHead className="text-right">In hand</TableHead>
                <TableHead className="w-40">Warn below</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.materials ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="num text-right">{num(m.quantity)}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      defaultValue={m.threshold}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (value !== m.threshold) save.mutate({ skuId: m.id, threshold: value });
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function useAdminOverview() {
  const fetchOverview = useServerFn(getAdminOverview);
  return useQuery({ queryKey: ["admin-overview"], queryFn: () => fetchOverview() });
}

function Users() {
  const { data, isPending } = useAdminOverview();
  const queryClient = useQueryClient();
  const update = useServerFn(setUserRole);
  const save = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "viewer" }) => update({ data: vars }),
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isPending) return <Skeleton className="h-48" />;

  return (
    <div className="panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="w-40">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.users ?? []).map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{relativeTime(u.created_at)}</TableCell>
              <TableCell>
                <Select
                  value={u.role}
                  onValueChange={(role) =>
                    save.mutate({ userId: u.id, role: role as "admin" | "viewer" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SyncHistory() {
  const { data, isPending } = useAdminOverview();
  if (isPending) return <Skeleton className="h-48" />;

  return (
    <div className="panel overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Scope</TableHead>
            <TableHead className="text-right">Rows</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.syncLog ?? []).map((s) => (
            <TableRow key={s.id}>
              <TableCell>{relativeTime(s.synced_at)}</TableCell>
              <TableCell>{s.source}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground">
                {s.tab_or_endpoint ?? "—"}
                {s.message ? ` · ${s.message}` : ""}
              </TableCell>
              <TableCell className="num text-right">{num(s.row_count)}</TableCell>
              <TableCell>
                <Badge variant={s.status === "ok" ? "secondary" : "destructive"}>{s.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
          {!data?.syncLog.length && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No syncs yet — hit “Sync now” in the header.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

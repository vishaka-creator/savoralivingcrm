import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, LogOut, LayoutGrid, Boxes, Users, CalendarDays, Shield, Menu, Sparkles, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getMe, listSyncCollections, syncNow } from "@/lib/savora.functions";
import { relativeTime } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const SYNC_DOT: Record<string, string> = {
  zebra: "bg-collection-zebra",
  mini: "bg-collection-mini",
  "le-cirque": "bg-collection-cirque",
  mahjong: "bg-collection-mahjong",
  orchid: "bg-collection-orchid",
};

export const meQueryKey = ["me"];

export function useMe() {
  const fetchMe = useServerFn(getMe);
  return useQuery({ queryKey: meQueryKey, queryFn: () => fetchMe(), staleTime: 60_000 });
}

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/collections", label: "Collections", icon: Boxes },
  { to: "/crm", label: "Contacts", icon: Users },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ask", label: "Ask CRM", icon: Sparkles },
] as const;

export function AppShell({
  children,
  lastSync,
}: {
  children: ReactNode;
  lastSync?: { synced_at: string; status: string } | null;
}) {
  const { data: me } = useMe();
  const canEdit = !!me?.isAdmin;
  const visibleNav = canEdit ? navItems : navItems.filter((item) => item.to !== "/ask");
  const queryClient = useQueryClient();
  const router = useRouter();
  const runSync = useServerFn(syncNow);
  const fetchSyncCollections = useServerFn(listSyncCollections);
  const { data: syncCollections = [] } = useQuery({
    queryKey: ["sync-collections"],
    queryFn: () => fetchSyncCollections(),
    staleTime: 60_000,
  });

  const sync = useMutation({
    mutationFn: (collection: string | undefined) =>
      runSync({ data: collection ? { collection } : undefined }),
    onSuccess: (result) => {
      const scope =
        result.collections.length === 1 ? ` from ${result.collections[0]}` : "";
      if (result.ok) {
        toast.success(`Synced ${result.counts.wares} wares${scope}`, {
          description: result.missingTabs.length
            ? `Skipped — sheet tab not found: ${result.missingTabs.join("; ")}`
            : undefined,
        });
      } else {
        toast.error(result.message ?? "Sync failed");
      }
      queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link to="/dashboard" className="flex items-baseline gap-2">
            <span className="font-display text-xl tracking-tight">Savora</span>
            <span className="label-caps hidden sm:inline">Inventory &amp; Sales</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {visibleNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
            {canEdit && (
              <Link
                to="/admin"
                activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              >
                <Shield className="size-4" />
                Admin
              </Link>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="icon" className="md:hidden" aria-label="Open navigation"><Menu className="size-4" /></Button></SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetTitle className="mb-5 font-display text-xl">Savora CRM</SheetTitle>
                <nav className="grid gap-1">
                  {[...visibleNav, ...(canEdit ? [{ to: "/admin", label: "Admin", icon: Shield }] : [])].map((item) => <Link key={item.to} to={item.to} className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-foreground hover:bg-secondary"><item.icon className="size-4" />{item.label}</Link>)}
                </nav>
              </SheetContent>
            </Sheet>
            <div className="hidden text-right sm:block">
              <div className="label-caps">Last synced</div>
              <div className="num text-xs text-foreground">
                {lastSync ? relativeTime(lastSync.synced_at) : "never"}
                {lastSync?.status === "error" && (
                  <span className="ml-1 text-destructive">(failed)</span>
                )}
              </div>
            </div>
            {canEdit && <div className="flex items-center">
              <Button
                size="sm"
                onClick={() => sync.mutate(undefined)}
                disabled={sync.isPending}
                className="gap-2 rounded-r-none"
              >
                <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">{sync.isPending ? "Syncing" : "Sync now"}</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    disabled={sync.isPending}
                    className="rounded-l-none border-l border-primary-foreground/25 px-2"
                    aria-label="Choose a collection to sync"
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Sync from Google Sheet</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => sync.mutate(undefined)}>
                    All collections
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {syncCollections.map((c) => (
                    <DropdownMenuItem key={c.slug} onSelect={() => sync.mutate(c.slug)} className="gap-2">
                      <span className={`size-2.5 rounded-full ${SYNC_DOT[c.slug] ?? "bg-primary"}`} aria-hidden />
                      Only {c.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>}
            <div className="flex items-center gap-2">
              <Badge variant={canEdit ? "secondary" : "outline"}>
                {!me ? "…" : canEdit ? "Admin" : "View only"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

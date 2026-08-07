import { Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, LogOut, LayoutGrid, IndianRupee, ListChecks, Shield } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getMe, syncNow } from "@/lib/savora.functions";
import { relativeTime } from "@/lib/format";

export const meQueryKey = ["me"];

export function useMe() {
  const fetchMe = useServerFn(getMe);
  return useQuery({ queryKey: meQueryKey, queryFn: () => fetchMe(), staleTime: 60_000 });
}

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/sales", label: "Sales", icon: IndianRupee },
  { to: "/crm", label: "Tracking", icon: ListChecks },
] as const;

export function AppShell({
  children,
  lastSync,
}: {
  children: ReactNode;
  lastSync?: { synced_at: string; status: string } | null;
}) {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const router = useRouter();
  const runSync = useServerFn(syncNow);

  const sync = useMutation({
    mutationFn: () => runSync(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(
          `Synced ${result.counts.skus} wares, ${result.counts.boxes} box lines, ${result.counts.sales} sales rows`,
        );
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

          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
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
            {me?.isAdmin && (
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

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="label-caps">Last synced</div>
              <div className="num text-xs text-foreground">
                {lastSync ? relativeTime(lastSync.synced_at) : "never"}
                {lastSync?.status === "error" && (
                  <span className="ml-1 text-destructive">(failed)</span>
                )}
              </div>
            </div>
            {me?.isAdmin && (
              <Button
                size="sm"
                onClick={() => sync.mutate()}
                disabled={sync.isPending}
                className="gap-2"
              >
                <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} />
                {sync.isPending ? "Syncing" : "Sync now"}
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {me?.role ?? "…"}
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

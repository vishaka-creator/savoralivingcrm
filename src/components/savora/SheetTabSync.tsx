import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getSheetTabs, syncNow, writeCollectionToSheet } from "@/lib/savora.functions";
import { readBlockReason, suggestedTabName, tabKey, writeBlockReason } from "@/lib/sheet-tabs";

type Direction = "in" | "out";

export function SheetTabSyncDialog({
  open,
  onOpenChange,
  collections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: { slug: string; name: string }[];
}) {
  const queryClient = useQueryClient();
  const fetchTabs = useServerFn(getSheetTabs);
  const runSync = useServerFn(syncNow);
  const runWrite = useServerFn(writeCollectionToSheet);

  const [direction, setDirection] = useState<Direction>("in");
  const [collection, setCollection] = useState("");
  const [tab, setTab] = useState("");
  const [replace, setReplace] = useState(false);

  const tabs = useQuery({
    queryKey: ["sheet-tabs"],
    queryFn: () => fetchTabs(),
    enabled: open,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (open && !collection && collections[0]) setCollection(collections[0].slug);
  }, [open, collection, collections]);

  const collectionName = collections.find((c) => c.slug === collection)?.name ?? "";
  const existing = useMemo(
    () => (tabs.data ?? []).find((t) => tabKey(t.name) === tabKey(tab)) ?? null,
    [tabs.data, tab],
  );
  const pickable = (tabs.data ?? []).filter((t) => (direction === "in" ? t.canRead : t.canWrite));

  useEffect(() => setReplace(false), [tab, direction]);

  const problem =
    !collection
      ? "Pick a collection."
      : direction === "in"
        ? readBlockReason(tab) ?? (tab.trim() && tabs.data && !existing ? `There's no tab called "${tab.trim()}" in the sheet.` : null)
        : writeBlockReason(tab);

  const run = useMutation({
    mutationFn: async () => {
      if (direction === "in") {
        const result = await runSync({ data: { collection, tab: tab.trim() } });
        if (!result.ok) throw new Error(result.message ?? "Sync failed");
        return `Brought ${result.counts.wares} wares from "${tab.trim()}" into ${collectionName}`;
      }
      const result = await runWrite({ data: { collection, tab: tab.trim(), replace } });
      return `Sent ${result.rows} ${result.collection} wares to ${result.created ? "new " : ""}tab "${result.tab}"`;
    },
    onSuccess: (msg) => {
      toast.success(msg);
      queryClient.invalidateQueries();
      onOpenChange(false);
      setTab("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsReplace = direction === "out" && !!existing;
  const canRun = !problem && !!tab.trim() && (!needsReplace || replace) && !run.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync a specific sheet tab</DialogTitle>
          <DialogDescription>
            Choose a tab in the Savora Google Sheet and which way the data should go.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <ToggleGroup
            type="single"
            value={direction}
            onValueChange={(v) => v && setDirection(v as Direction)}
            className="grid grid-cols-2 gap-2"
          >
            <ToggleGroupItem value="in" variant="outline" className="h-auto justify-start gap-2 py-2 text-left">
              <Download className="size-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">Bring into CRM</span>
                <span className="block text-xs text-muted-foreground">Read wares from the tab</span>
              </span>
            </ToggleGroupItem>
            <ToggleGroupItem value="out" variant="outline" className="h-auto justify-start gap-2 py-2 text-left">
              <Upload className="size-4 shrink-0" />
              <span>
                <span className="block text-sm font-medium">Send to sheet</span>
                <span className="block text-xs text-muted-foreground">Write CRM data to the tab</span>
              </span>
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="grid gap-2">
            <Label>{direction === "in" ? "Bring wares into collection" : "Send wares from collection"}</Label>
            <Select value={collection} onValueChange={setCollection}>
              <SelectTrigger><SelectValue placeholder="Pick a collection" /></SelectTrigger>
              <SelectContent>
                {collections.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="sheet-tab-name">Sheet tab name</Label>
              {direction === "out" && collectionName && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setTab(suggestedTabName(collectionName))}
                >
                  Use "{suggestedTabName(collectionName)}"
                </button>
              )}
            </div>
            <Input
              id="sheet-tab-name"
              list="sheet-tab-options"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
              placeholder={direction === "in" ? "e.g. PARAKEET" : "Type a new or existing tab name"}
              maxLength={100}
              autoComplete="off"
            />
            <datalist id="sheet-tab-options">
              {pickable.map((t) => <option key={t.name} value={t.name} />)}
            </datalist>
            {tabs.isLoading && <p className="text-xs text-muted-foreground">Loading tabs from the sheet…</p>}
            {tabs.error && <p className="text-xs text-destructive">{(tabs.error as Error).message}</p>}
            {pickable.length > 0 && (
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {pickable.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => setTab(t.name)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${tabKey(t.name) === tabKey(tab) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-secondary"}`}
                  >
                    {t.name.trim()}
                  </button>
                ))}
              </div>
            )}
            {tab.trim() && problem && <p className="text-xs text-destructive">{problem}</p>}
            {direction === "out" && tab.trim() && !problem && !existing && tabs.data && (
              <p className="text-xs text-muted-foreground">A new tab called "{tab.trim()}" will be added to the sheet.</p>
            )}
          </div>

          {needsReplace && !problem && (
            <label className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <Checkbox checked={replace} onCheckedChange={(v) => setReplace(v === true)} className="mt-0.5" />
              <span>
                <span className="block font-medium">Replace this tab</span>
                <span className="block text-xs text-muted-foreground">
                  "{existing!.name.trim()}" already exists. Everything on it will be cleared and replaced with {collectionName}'s CRM data.
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => run.mutate()} disabled={!canRun}>
            {run.isPending ? "Working…" : direction === "in" ? "Bring into CRM" : "Send to sheet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

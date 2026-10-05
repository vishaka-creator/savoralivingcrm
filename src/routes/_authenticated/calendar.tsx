import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteCalendarEvent, getCalendarEvents, saveCalendarEvent } from "@/lib/savora.functions";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [
    { title: "Calendar — Savora CRM" },
    { name: "description", content: "Plan Savora deliveries, client meetings, trade shows and major events." },
    { property: "og:title", content: "Calendar — Savora CRM" },
    { property: "og:description", content: "Plan Savora CRM events and keep Google Calendar in sync." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex" },
  ] }),
  component: CalendarPage,
});

type Draft = { title: string; type_tag: "restock" | "client" | "trade_show" | "delivery" | "other"; start_time: string; end_time: string; is_major: boolean; notes: string; sync_google: boolean };
const emptyDraft: Draft = { title: "", type_tag: "other", start_time: "", end_time: "", is_major: false, notes: "", sync_google: true };

function CalendarPage() {
  const fetchEvents = useServerFn(getCalendarEvents);
  const save = useServerFn(saveCalendarEvent);
  const remove = useServerFn(deleteCalendarEvent);
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["calendar-events"], queryFn: () => fetchEvents() });
  const [draft, setDraft] = useState<Draft | null>(null);
  const saveMutation = useMutation({
    mutationFn: (value: Draft) => save({ data: { ...value, start_time: new Date(value.start_time).toISOString(), end_time: value.end_time ? new Date(value.end_time).toISOString() : null, notes: value.notes || null } }),
    onSuccess: () => { toast.success("Event saved"); setDraft(null); queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (event: { id: string; google_calendar_event_id: string | null }) => remove({ data: event }),
    onSuccess: () => { toast.success("Event removed"); queryClient.invalidateQueries({ queryKey: ["calendar-events"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const events = data?.events ?? [];

  return <AppShell><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="label-caps">Planning</p><h1 className="mt-1 text-3xl">Calendar</h1><p className="mt-2 text-sm text-muted-foreground">Upcoming events for the Savora team, with major moments kept in view.</p></div><Button onClick={() => setDraft({ ...emptyDraft })}><Plus className="mr-2 size-4" />Add event</Button></div>
    {isPending ? <Skeleton className="mt-8 h-64" /> : <div className="mt-8 grid gap-3">{events.map((event) => <div key={event.id} className="panel flex flex-wrap items-center gap-4 p-5"><div className="grid size-11 place-items-center rounded-md bg-secondary"><CalendarDays className="size-5 text-primary" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-medium">{event.title}</h2>{event.is_major && <Badge>Major</Badge>}<Badge variant="secondary">{event.type_tag.replace("_", " ")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{new Date(event.start_time).toLocaleString()} {event.notes ? ` · ${event.notes}` : ""}</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground">{event.calendar_source === "google" && <span className="inline-flex items-center gap-1"><Check className="size-3.5" />Google Calendar</span>}<Button variant="ghost" size="icon" aria-label={`Delete ${event.title}`} onClick={() => { if (window.confirm(`Delete ${event.title}?`)) deleteMutation.mutate({ id: event.id, google_calendar_event_id: event.google_calendar_event_id }); }}><Trash2 className="size-4 text-destructive" /></Button></div></div>)}{!events.length && <div className="panel p-10 text-center text-sm text-muted-foreground">No events planned yet.</div>}</div>}
    {draft && <EventEditor draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSave={() => saveMutation.mutate(draft)} pending={saveMutation.isPending} />}
  </AppShell>;
}

function EventEditor({ draft, onChange, onClose, onSave, pending }: { draft: Draft; onChange: (value: Draft) => void; onClose: () => void; onSave: () => void; pending: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4" role="dialog" aria-modal="true" aria-label="Add calendar event"><div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl"><div className="flex items-start justify-between"><div><p className="label-caps">Calendar</p><h2 className="mt-1 text-xl">Add event</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">×</Button></div><div className="mt-6 space-y-4"><div className="space-y-1.5"><Label htmlFor="event-title">Title</Label><Input id="event-title" value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="event-type">Type</Label><select id="event-type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.type_tag} onChange={(event) => onChange({ ...draft, type_tag: event.target.value as Draft["type_tag"] })}><option value="client">Client</option><option value="delivery">Delivery</option><option value="restock">Restock</option><option value="trade_show">Trade show</option><option value="other">Other</option></select></div><div className="space-y-1.5"><Label htmlFor="event-start">Starts</Label><Input id="event-start" type="datetime-local" value={draft.start_time} onChange={(event) => onChange({ ...draft, start_time: event.target.value })} /></div></div><div className="space-y-1.5"><Label htmlFor="event-end">Ends (optional)</Label><Input id="event-end" type="datetime-local" value={draft.end_time} onChange={(event) => onChange({ ...draft, end_time: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="event-notes">Notes</Label><Textarea id="event-notes" value={draft.notes} onChange={(event) => onChange({ ...draft, notes: event.target.value })} /></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.is_major} onCheckedChange={(checked) => onChange({ ...draft, is_major: checked === true })} />Mark as major event</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.sync_google} onCheckedChange={(checked) => onChange({ ...draft, sync_google: checked === true })} />Sync to Google Calendar</label></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={!draft.title.trim() || !draft.start_time || pending}>Save event</Button></div></div></div>;
}
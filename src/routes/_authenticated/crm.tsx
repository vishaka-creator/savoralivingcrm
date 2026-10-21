import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell, useMe } from "@/components/savora/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getContacts, saveContact, deleteContact } from "@/lib/savora.functions";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "Contacts — Savora CRM" },
      { name: "description", content: "Manage Savora B2B and B2C contacts in one editable workspace." },
      { property: "og:title", content: "Contacts — Savora CRM" },
      { property: "og:description", content: "Manage Savora B2B and B2C contacts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContactsPage,
});

type ContactDraft = { id?: string; type: "b2b" | "b2c"; name: string; company: string; phone: string; email: string; remarks: string };
const emptyDraft: ContactDraft = { type: "b2b", name: "", company: "", phone: "", email: "", remarks: "" };

function ContactsPage() {
  const fetchContacts = useServerFn(getContacts);
  const save = useServerFn(saveContact);
  const remove = useServerFn(deleteContact);
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const canEdit = !!me?.isAdmin;
  const { data, isPending } = useQuery({ queryKey: ["contacts"], queryFn: () => fetchContacts() });
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const mutation = useMutation({
    mutationFn: (value: ContactDraft) => save({ data: { ...value, email: value.email || null, company: value.company || null, phone: value.phone || null, remarks: value.remarks.trim() || null } }),
    onSuccess: () => { toast.success("Contact saved"); setDraft(null); queryClient.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => { toast.success("Contact removed"); queryClient.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  const contacts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.contacts ?? []).filter((contact) => !needle || [contact.name, contact.company, contact.email, contact.remarks].some((value) => value?.toLowerCase().includes(needle)));
  }, [data, query]);

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="label-caps">CRM</p><h1 className="mt-1 text-3xl">Contacts</h1><p className="mt-2 text-sm text-muted-foreground">Keep B2B relationships and B2C customers close to the work.</p></div>
        {canEdit && <Button onClick={() => setDraft({ ...emptyDraft })}><Plus className="mr-2 size-4" />Add contact</Button>}
      </div>
      <div className="relative mt-6 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search contacts" /></div>
      {isPending ? <Skeleton className="mt-6 h-64" /> : <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {contacts.map((contact) => <div key={contact.id} className="panel p-5">
          <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-secondary"><Users className="size-4 text-primary" /></span><div><h2 className="font-medium">{contact.name}</h2><p className="text-sm text-muted-foreground">{contact.company ?? "Independent"}</p></div></div><Badge variant="secondary">{contact.type.toUpperCase()}</Badge></div>
          <div className="mt-5 space-y-1 text-sm text-muted-foreground"><p className="break-all">{contact.email ?? "No email"}</p><p>{contact.phone ?? "No phone"}</p></div>
          {contact.remarks && <div className="mt-4 rounded-md border-l-2 border-primary bg-secondary/60 px-3 py-2"><p className="label-caps">Remarks</p><p className="mt-1 whitespace-pre-line text-sm text-foreground" title={contact.remarks}>{contact.remarks}</p></div>}
          {canEdit && <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" size="icon" aria-label={`Edit ${contact.name}`} onClick={() => setDraft({ id: contact.id, type: contact.type as "b2b" | "b2c", name: contact.name, company: contact.company ?? "", phone: contact.phone ?? "", email: contact.email ?? "", remarks: contact.remarks ?? "" })}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" aria-label={`Delete ${contact.name}`} onClick={() => { if (window.confirm(`Delete ${contact.name}?`)) deleteMutation.mutate(contact.id); }}><Trash2 className="size-4 text-destructive" /></Button></div>}
        </div>)}
        {!contacts.length && <div className="panel col-span-full p-10 text-center text-sm text-muted-foreground">No contacts match your search.</div>}
      </div>}
      {draft && canEdit && <ContactEditor draft={draft} onChange={setDraft} onClose={() => setDraft(null)} onSave={() => mutation.mutate(draft)} pending={mutation.isPending} />}
    </AppShell>
  );
}

function ContactEditor({ draft, onChange, onClose, onSave, pending }: { draft: ContactDraft; onChange: (value: ContactDraft) => void; onClose: () => void; onSave: () => void; pending: boolean }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-4" role="dialog" aria-modal="true" aria-label="Edit contact"><div className="w-full max-w-lg rounded-lg border border-border bg-background p-6 shadow-xl"><div className="flex items-start justify-between"><div><p className="label-caps">Contact</p><h2 className="mt-1 text-xl">{draft.id ? "Edit contact" : "Add contact"}</h2></div><Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">×</Button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="contact-name">Name</Label><Input id="contact-name" value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="contact-company">Company</Label><Input id="contact-company" value={draft.company} onChange={(event) => onChange({ ...draft, company: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="contact-email">Email</Label><Input id="contact-email" type="email" value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="contact-phone">Phone</Label><Input id="contact-phone" value={draft.phone} onChange={(event) => onChange({ ...draft, phone: event.target.value })} /></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="contact-remarks">Remarks</Label><Textarea id="contact-remarks" rows={3} maxLength={1000} value={draft.remarks} placeholder="e.g. Buying head at the store, met at the Delhi trade fair" onChange={(event) => onChange({ ...draft, remarks: event.target.value })} /></div></div><div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={!draft.name.trim() || pending}>Save contact</Button></div></div></div>;
}
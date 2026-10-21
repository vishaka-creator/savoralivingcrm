import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppShell } from "@/components/savora/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askCrm } from "@/lib/ask-crm.functions";

export const Route = createFileRoute("/_authenticated/ask")({
  head: () => ({
    meta: [
      { title: "Ask CRM — Savora Inventory & Sales CRM" },
      { name: "description", content: "Ask questions about Savora stock, sets that can be built, low stock and remarks." },
      { property: "og:title", content: "Ask CRM — Savora" },
      { property: "og:description", content: "Plain-language answers about Savora stock and buildable sets." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AskPage,
});

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "How many sets can be built in each collection?",
  "Which wares are below 5 pieces in stock?",
  "Which ware is limiting the most sets in Zebra?",
  "How much stock is with influencers right now?",
];

function AskPage() {
  const ask = useServerFn(askCrm);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (vars: { question: string; history: Turn[] }) => ask({ data: vars }),
    onSuccess: (res) => setTurns((t) => [...t, { role: "assistant", content: res.answer }]),
    onError: (e: Error, vars) => {
      setError(e.message);
      setTurns((t) => t.slice(0, -1));
      setDraft(vars.question);
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, mutation.isPending]);

  const send = (text: string) => {
    const question = text.trim();
    if (!question || mutation.isPending) return;
    setError(null);
    const history = turns.slice(-10);
    setTurns((t) => [...t, { role: "user", content: question }]);
    setDraft("");
    mutation.mutate({ question, history });
  };

  return (
    <AppShell lastSync={null}>
      <div className="mx-auto flex max-w-3xl flex-col">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-caps">AI assistant</p>
            <h1 className="mt-1 text-3xl">Ask CRM</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask about stock, sets that can be built, low stock and remarks. Answers use your live CRM data.
            </p>
          </div>
          {turns.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => { setTurns([]); setError(null); }}>
              <RotateCcw className="mr-2 size-4" /> New chat
            </Button>
          )}
        </div>

        <div className="mt-6 space-y-4">
          {turns.length === 0 && (
            <div className="panel p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-primary" /> Try asking
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-md border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-secondary/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                  {t.content}
                </div>
              </div>
            ) : (
              <div key={i} className="panel ask-answer px-5 py-4 text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.content}</ReactMarkdown>
              </div>
            ),
          )}

          {mutation.isPending && (
            <div className="panel px-5 py-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2"><Sparkles className="size-4 animate-pulse text-primary" /> Checking your stock…</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="panel sticky bottom-4 mt-6 flex items-end gap-2 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="e.g. How many sets can be built?"
            aria-label="Ask a question about your CRM"
            rows={1}
            className="min-h-10 resize-none border-0 shadow-none focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={!draft.trim() || mutation.isPending} aria-label="Send question">
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { parseSetsPlanned } from "@/lib/build-plan";
import { num } from "@/lib/format";
import { getBuildPlans, saveBuildPlan } from "@/lib/savora.functions";

type PlanCard = { slug: string; name: string; setsBuildable: number };

const DOT: Record<string, string> = {
  zebra: "bg-collection-zebra",
  mini: "bg-collection-mini",
  "le-cirque": "bg-collection-cirque",
  mahjong: "bg-collection-mahjong",
  orchid: "bg-collection-orchid",
};

const dayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export function TomorrowPlan({ cards }: { cards: PlanCard[] }) {
  const fetchPlans = useServerFn(getBuildPlans);
  const { data } = useQuery({ queryKey: ["build-plans"], queryFn: () => fetchPlans() });
  const planned = (slug: string) =>
    data?.plans.find((p) => p.collection_slug === slug)?.sets_planned ?? 0;
  const total = cards.reduce((a, c) => a + planned(c.slug), 0);

  return (
    <section className="panel mt-4 p-5" aria-labelledby="tomorrow-plan-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-primary" /> Task for tomorrow
            {data ? ` · ${dayLabel(data.planDate)}` : ""}
          </p>
          <h2 id="tomorrow-plan-heading" className="mt-1 text-xl">Sets to build</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Total planned <span className="num font-semibold text-foreground">{num(total)}</span> sets
        </p>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <PlanRow
            key={c.slug}
            card={c}
            planDate={data?.planDate ?? null}
            saved={planned(c.slug)}
          />
        ))}
      </ul>
    </section>
  );
}

function PlanRow({
  card,
  planDate,
  saved,
}: {
  card: PlanCard;
  planDate: string | null;
  saved: number;
}) {
  const queryClient = useQueryClient();
  const save = useServerFn(saveBuildPlan);
  const { data: me } = useMe();
  const canEdit = !!me?.isAdmin;
  const [value, setValue] = useState(String(saved));
  useEffect(() => setValue(String(saved)), [saved]);

  const mutation = useMutation({
    mutationFn: (sets: number) =>
      save({ data: { collection_slug: card.slug, plan_date: planDate!, sets_planned: sets } }),
    onSuccess: () => {
      toast.success(`Saved · ${card.name} tomorrow's plan`);
      queryClient.invalidateQueries({ queryKey: ["build-plans"] });
      queryClient.invalidateQueries({ queryKey: ["crm-overview"] });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setValue(String(saved));
    },
  });

  const commit = () => {
    const n = parseSetsPlanned(value);
    if (n === null) {
      toast.error("Enter a whole number of sets (0 or more).");
      setValue(String(saved));
      return;
    }
    setValue(String(n));
    if (n !== saved && planDate && canEdit) mutation.mutate(n);
  };

  const current = parseSetsPlanned(value) ?? saved;
  const over = current > card.setsBuildable;
  const id = `plan-${card.slug}`;

  return (
    <li className="rounded-md border border-border bg-background/60 p-3">
      <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
        <span className={`size-2.5 shrink-0 rounded-full ${DOT[card.slug] ?? "bg-primary"}`} />
        {card.name}
      </label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        disabled={!planDate || mutation.isPending}
        readOnly={!canEdit}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="num mt-2 h-10 text-lg font-semibold"
        aria-describedby={`${id}-hint`}
      />
      <p
        id={`${id}-hint`}
        className={`mt-1.5 text-xs ${over ? "text-warning" : "text-muted-foreground"}`}
      >
        {over
          ? `More than the ${num(card.setsBuildable)} sets stock allows now`
          : `Stock allows ${num(card.setsBuildable)} sets`}
      </p>
    </li>
  );
}

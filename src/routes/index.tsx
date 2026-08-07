import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, LayoutGrid, LineChart, PackageCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Savora Inventory & Sales CRM — internal operations" },
      {
        name: "description",
        content:
          "Sign in to Savora's internal CRM: raw material stock, boxes by SKU, how many sets are buildable, and monthly sales across all five collections.",
      },
      { property: "og:title", content: "Savora Inventory & Sales CRM" },
      {
        property: "og:description",
        content:
          "Live stock, kitting and sales for Zebra, Mini, Le Cirque, Mahjong and Orchid — synced from Google Sheets.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const highlights = [
  { icon: Boxes, title: "Raw material stock", body: "Every ware, per collection, with low-stock flags." },
  { icon: PackageCheck, title: "Sets buildable", body: "Sets of 2 and 4 costed against pieces and boxes in hand." },
  { icon: LineChart, title: "Monthly sales", body: "Sales and expenses by month, client and collection." },
  { icon: LayoutGrid, title: "Item tracking", body: "Raw → box made → set assemblable → sold." },
];

function Landing() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="label-caps">Savora · internal tool</p>
        <h1 className="mt-3 max-w-2xl text-4xl leading-tight sm:text-5xl">
          Inventory, kitting and sales for every Savora collection.
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          One dashboard over the Google Sheets your team already maintains — Zebra, Mini,
          Le Cirque, Mahjong and Orchid — so you know what's in hand and how many sets you
          can still build.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" disabled={checking}>
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>
              Request access
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((h) => (
            <div key={h.title} className="panel p-5">
              <h.icon className="size-5 text-primary" />
              <h2 className="mt-3 text-base">{h.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{h.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "reset"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — Savora Inventory & Sales CRM" },
      {
        name: "description",
        content:
          "Sign in or create your Savora CRM account. Access to inventory, kitting and sales data requires a confirmed email address.",
      },
      { property: "og:title", content: "Sign in — Savora CRM" },
      {
        property: "og:description",
        content: "Confirmed-email access to Savora inventory, kitting and sales data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState(mode === "signup" ? "signup" : "signin");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
       if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.message.toLowerCase().includes("not confirmed")
          ? "Confirm your email first — check your inbox for the link."
          : error.message,
      );
      return;
    }
    router.navigate({ to: "/dashboard", replace: true });
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password: String(form.get("password")),
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name: String(form.get("name") ?? "").trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(email);
  }

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email")).trim();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`Reset link sent to ${email}`);
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    router.navigate({ to: "/dashboard", replace: true });
  }

  if (sentTo) {
    return (
      <Wrapper>
        <MailCheck className="size-8 text-primary" />
        <h1 className="mt-4 text-2xl">Confirm your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
           We sent a confirmation link to <span className="text-foreground">{sentTo}</span>. Open it
           to activate your account, then sign in. Every confirmed CRM account has Admin access.
        </p>
        <Button className="mt-6 w-full" variant="outline" onClick={() => setSentTo(null)}>
          Back to sign in
        </Button>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <Link to="/" className="font-display text-2xl tracking-tight">
        Savora
      </Link>
      <p className="label-caps mt-1">Inventory &amp; Sales CRM</p>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Sign up</TabsTrigger>
          <TabsTrigger value="reset">Reset</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4">
            <Field name="email" type="email" label="Work email" autoComplete="email" />
            <Field
              name="password"
              type="password"
              label="Password"
              autoComplete="current-password"
            />
            <Submit busy={busy}>Sign in</Submit>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={handleSignUp} className="space-y-4">
            <Field name="name" label="Full name" autoComplete="name" required={false} />
            <Field name="email" type="email" label="Work email" autoComplete="email" />
            <Field
              name="password"
              type="password"
              label="Password (min 8 characters)"
              autoComplete="new-password"
              minLength={8}
            />
            <Submit busy={busy}>Create account</Submit>
            <p className="text-xs text-muted-foreground">
              You'll need to confirm your email before your first sign-in.
            </p>
          </form>
        </TabsContent>

        <TabsContent value="reset">
          <form onSubmit={handleReset} className="space-y-4">
            <Field name="email" type="email" label="Work email" autoComplete="email" />
            <Submit busy={busy}>Send reset link</Submit>
          </form>
        </TabsContent>
      </Tabs>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
        Continue with Google
      </Button>
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="panel w-full max-w-md p-8">{children}</div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  required = true,
  minLength,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
      />
    </div>
  );
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="w-full" disabled={busy}>
      {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
      {children}
    </Button>
  );
}

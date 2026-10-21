CREATE TABLE public.build_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL,
  plan_date date NOT NULL,
  sets_planned integer NOT NULL DEFAULT 0 CHECK (sets_planned >= 0 AND sets_planned <= 100000),
  updated_by uuid,
  updated_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_slug, plan_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.build_plans TO authenticated;
GRANT ALL ON public.build_plans TO service_role;
ALTER TABLE public.build_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage build plans" ON public.build_plans FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER build_plans_touch_updated_at BEFORE UPDATE ON public.build_plans FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
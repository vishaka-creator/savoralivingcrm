ALTER TABLE public.collections ADD COLUMN IF NOT EXISTS cover_image text;

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'b2b' CHECK (type IN ('b2b', 'b2c')),
  name text NOT NULL,
  company text,
  phone text,
  email text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.collection_costing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  sku_id uuid REFERENCES public.skus(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  material_cost numeric NOT NULL DEFAULT 0,
  box_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_costing TO authenticated;
GRANT ALL ON public.collection_costing TO service_role;
ALTER TABLE public.collection_costing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage collection costing" ON public.collection_costing FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.special_combinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  combo_name text NOT NULL,
  items_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  combo_price numeric NOT NULL DEFAULT 0,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.special_combinations TO authenticated;
GRANT ALL ON public.special_combinations TO service_role;
ALTER TABLE public.special_combinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage special combinations" ON public.special_combinations FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.crm_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  type_tag text NOT NULL DEFAULT 'other',
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  is_major boolean NOT NULL DEFAULT false,
  notes text,
  google_calendar_event_id text,
  calendar_source text NOT NULL DEFAULT 'manual',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_events TO authenticated;
GRANT ALL ON public.crm_events TO service_role;
ALTER TABLE public.crm_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage CRM events" ON public.crm_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  low_stock_pcs_threshold numeric NOT NULL DEFAULT 5,
  low_stock_sets_threshold numeric NOT NULL DEFAULT 12,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users manage app settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
INSERT INTO public.app_settings (id, low_stock_pcs_threshold, low_stock_sets_threshold)
VALUES (1, 5, 12)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.touch_crm_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contacts_touch_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
CREATE TRIGGER collection_costing_touch_updated_at BEFORE UPDATE ON public.collection_costing FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
CREATE TRIGGER special_combinations_touch_updated_at BEFORE UPDATE ON public.special_combinations FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
CREATE TRIGGER crm_events_touch_updated_at BEFORE UPDATE ON public.crm_events FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
CREATE TRIGGER app_settings_touch_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
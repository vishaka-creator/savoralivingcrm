-- roles
CREATE TYPE public.app_role AS ENUM ('admin','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing int;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name'), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing FROM public.user_roles;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN existing = 0 THEN 'admin'::public.app_role ELSE 'viewer'::public.app_role END)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- domain tables
CREATE TABLE public.collections (
  slug text PRIMARY KEY,
  name text NOT NULL,
  sheet_tab text NOT NULL,
  shopify_handle text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  ordered_quantity numeric,
  shopify_product_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_slug, name)
);

CREATE TABLE public.raw_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid NOT NULL REFERENCES public.skus(id) ON DELETE CASCADE UNIQUE,
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pcs',
  low_stock_threshold numeric NOT NULL DEFAULT 20,
  last_synced timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.boxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON DELETE CASCADE,
  code text,
  product text NOT NULL,
  quantity_on_hand numeric NOT NULL DEFAULT 0,
  production_cost numeric,
  foam boolean,
  print_status text,
  last_synced timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_slug, product, code)
);

CREATE TABLE public.bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON DELETE CASCADE,
  set_name text NOT NULL,
  component_name text NOT NULL,
  qty_required_per_set numeric NOT NULL DEFAULT 1,
  box_code text,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_slug, set_name, component_name)
);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text,
  sale_date date,
  collection_slug text REFERENCES public.collections(slug) ON DELETE SET NULL,
  client_name text,
  billing_details text,
  amount numeric,
  status text,
  source_row text,
  last_synced timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_row)
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month text,
  spend_date date,
  vendor text,
  amount numeric,
  remarks text,
  source_row text UNIQUE,
  last_synced timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL,
  tab_or_endpoint text,
  synced_at timestamptz NOT NULL DEFAULT now(),
  row_count int,
  status text NOT NULL DEFAULT 'ok',
  message text
);

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid,
  actor_email text,
  action text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- grants + RLS: all authenticated users can read; admins edit config tables; server writes sync data
GRANT SELECT ON public.collections, public.skus, public.raw_materials, public.boxes, public.bom, public.sales, public.expenses, public.sync_log, public.activity_log TO authenticated;
GRANT UPDATE ON public.raw_materials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.bom TO authenticated;
GRANT ALL ON public.collections, public.skus, public.raw_materials, public.boxes, public.bom, public.sales, public.expenses, public.sync_log, public.activity_log TO service_role;

ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read collections" ON public.collections FOR SELECT TO authenticated USING (true);
CREATE POLICY "read skus" ON public.skus FOR SELECT TO authenticated USING (true);
CREATE POLICY "read raw_materials" ON public.raw_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins update thresholds" ON public.raw_materials FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read boxes" ON public.boxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "read bom" ON public.bom FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage bom" ON public.bom FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "read sync_log" ON public.sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "read activity_log" ON public.activity_log FOR SELECT TO authenticated USING (true);

INSERT INTO public.collections (slug, name, sheet_tab, shopify_handle, sort_order) VALUES
  ('zebra','Zebra','ZEBRA ','masai',1),
  ('mini','Mini','MINI','masai-minis',2),
  ('le-cirque','Le Cirque','LE CIRQUE','le-cirque',3),
  ('mahjong','Mahjong','MAHJONG',NULL,4),
  ('orchid','Orchid','EDEN BLOOM ','eden-bloom',5);
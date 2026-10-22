CREATE TABLE public.dinner_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_slug text NOT NULL REFERENCES public.collections(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  guests integer NOT NULL CHECK (guests BETWEEN 1 AND 50),
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dinner_sets TO authenticated;
GRANT ALL ON public.dinner_sets TO service_role;
ALTER TABLE public.dinner_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read dinner sets" ON public.dinner_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage dinner sets" ON public.dinner_sets FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER dinner_sets_touch_updated_at BEFORE UPDATE ON public.dinner_sets FOR EACH ROW EXECUTE FUNCTION public.touch_crm_updated_at();
CREATE INDEX dinner_sets_collection_idx ON public.dinner_sets (collection_slug, sort_order);

CREATE TABLE public.dinner_set_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dinner_set_id uuid NOT NULL REFERENCES public.dinner_sets(id) ON DELETE CASCADE,
  piece_name text NOT NULL CHECK (char_length(piece_name) BETWEEN 1 AND 80),
  sku_id uuid REFERENCES public.skus(id) ON DELETE SET NULL,
  qty_per_set integer NOT NULL DEFAULT 1 CHECK (qty_per_set BETWEEN 0 AND 1000),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dinner_set_items TO authenticated;
GRANT ALL ON public.dinner_set_items TO service_role;
ALTER TABLE public.dinner_set_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read dinner set items" ON public.dinner_set_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage dinner set items" ON public.dinner_set_items FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX dinner_set_items_set_idx ON public.dinner_set_items (dinner_set_id, sort_order);

-- Default recipes for every collection: dinner set for 4 and for 6.
INSERT INTO public.dinner_sets (collection_slug, name, guests, sort_order)
SELECT c.slug, v.name, v.guests, v.ord
FROM public.collections c
CROSS JOIN (VALUES ('Dinner set for 4', 4, 0), ('Dinner set for 6', 6, 1)) AS v(name, guests, ord);

WITH pieces(piece_name, ord, qty4, qty6) AS (
  VALUES ('Regal platter', 0, 1, 1), ('Dinner plate', 1, 4, 6), ('Quarter plate', 2, 4, 6), ('Katori', 3, 4, 6), ('Serving bowl', 4, 2, 3)
),
patterns(piece_name, pri, pat) AS (
  VALUES
    ('Regal platter', 1, '%regal%platter%'), ('Regal platter', 2, '%oval platter%'),
    ('Dinner plate', 1, '%dinner plate%'), ('Dinner plate', 2, '%flat plate%27%'), ('Dinner plate', 3, '%coupe plate%27%'), ('Dinner plate', 4, '%flat plate%'),
    ('Quarter plate', 1, '%qua%ter%plate%'), ('Quarter plate', 2, '%flat plate%22%'), ('Quarter plate', 3, '%coupe plate%23%'),
    ('Katori', 1, '%katori%'), ('Katori', 2, '%fruit bowl%10%'), ('Katori', 3, '%fruit bowl%'),
    ('Serving bowl', 1, '%serving bowl%'), ('Serving bowl', 2, '%noodle bowl%')
),
matches AS (
  SELECT DISTINCT ON (s.collection_slug, p.piece_name) s.collection_slug, p.piece_name, s.id AS sku_id
  FROM public.skus s
  JOIN patterns p ON s.name ILIKE p.pat
  LEFT JOIN public.raw_materials m ON m.sku_id = s.id
  ORDER BY s.collection_slug, p.piece_name, p.pri, COALESCE(m.quantity_on_hand, 0) DESC
)
INSERT INTO public.dinner_set_items (dinner_set_id, piece_name, sku_id, qty_per_set, sort_order)
SELECT d.id, pc.piece_name, mt.sku_id, CASE WHEN d.guests = 4 THEN pc.qty4 ELSE pc.qty6 END, pc.ord
FROM public.dinner_sets d
CROSS JOIN pieces pc
LEFT JOIN matches mt ON mt.collection_slug = d.collection_slug AND mt.piece_name = pc.piece_name;
ALTER TABLE public.skus ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY collection_slug ORDER BY name) AS rn
  FROM public.skus
)
UPDATE public.skus s SET sort_order = r.rn FROM ranked r WHERE r.id = s.id AND s.sort_order IS NULL;

CREATE INDEX IF NOT EXISTS skus_collection_sort_idx ON public.skus (collection_slug, sort_order);
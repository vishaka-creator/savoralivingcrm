DELETE FROM public.skus s
WHERE NOT EXISTS (
  SELECT 1 FROM public.raw_materials rm
  WHERE rm.sku_id = s.id
    AND rm.last_synced >= (SELECT max(rm2.last_synced) FROM public.raw_materials rm2)
);
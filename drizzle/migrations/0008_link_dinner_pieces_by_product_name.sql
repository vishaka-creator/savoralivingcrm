UPDATE public.dinner_set_items i SET sku_id = s.id
FROM public.dinner_sets d, public.skus s
WHERE i.dinner_set_id = d.id AND i.sku_id IS NULL AND i.piece_name = 'Regal platter'
  AND s.collection_slug = d.collection_slug AND s.product_name ILIKE '%regal%platter%';
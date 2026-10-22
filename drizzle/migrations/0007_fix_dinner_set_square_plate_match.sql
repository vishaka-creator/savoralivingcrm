UPDATE public.dinner_set_items i SET sku_id = NULL
FROM public.skus s
WHERE i.sku_id = s.id AND i.piece_name = 'Quarter plate' AND s.name ILIKE '%square%';
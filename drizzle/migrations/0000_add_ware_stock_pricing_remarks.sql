ALTER TABLE public.skus
  ADD COLUMN influencer_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN store_stock numeric NOT NULL DEFAULT 0,
  ADD COLUMN cost_price numeric,
  ADD COLUMN mrp numeric,
  ADD COLUMN remarks text;

COMMENT ON COLUMN public.skus.influencer_stock IS 'Manual count of ware held by influencers.';
COMMENT ON COLUMN public.skus.store_stock IS 'Manual count of ware available as stock on sales.';
COMMENT ON COLUMN public.skus.cost_price IS 'Manual per-ware cost price.';
COMMENT ON COLUMN public.skus.mrp IS 'Manual per-ware maximum retail price.';
COMMENT ON COLUMN public.skus.remarks IS 'Manual note recording where or to whom the ware was given.';
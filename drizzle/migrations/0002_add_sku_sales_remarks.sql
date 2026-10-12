ALTER TABLE public.skus ADD COLUMN sales_remarks text;
COMMENT ON COLUMN public.skus.sales_remarks IS 'Manual per-ware remarks for the Sales section; excluded from Google Sheets synchronization.';
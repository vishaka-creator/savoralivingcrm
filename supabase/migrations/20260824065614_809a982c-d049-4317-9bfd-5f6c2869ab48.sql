ALTER TABLE public.skus ALTER COLUMN pieces_per_set SET DEFAULT 4;
UPDATE public.skus SET pieces_per_set = 4;
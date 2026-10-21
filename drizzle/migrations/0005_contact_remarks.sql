ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_lower_key ON public.contacts (lower(email)) WHERE email IS NOT NULL AND source = 'gmail';
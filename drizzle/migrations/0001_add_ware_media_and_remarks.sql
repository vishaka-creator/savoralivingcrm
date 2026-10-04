ALTER TABLE public.skus ADD COLUMN ware_media_path text;
ALTER TABLE public.skus ADD COLUMN influencer_remarks text;
ALTER TABLE public.skus ADD COLUMN showroom_remarks text;
CREATE POLICY "Authenticated users read Savora ware media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'savora-ware-media');
CREATE POLICY "Authenticated users upload Savora ware media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'savora-ware-media');
CREATE POLICY "Authenticated users update Savora ware media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'savora-ware-media') WITH CHECK (bucket_id = 'savora-ware-media');
CREATE POLICY "Authenticated users delete Savora ware media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'savora-ware-media');
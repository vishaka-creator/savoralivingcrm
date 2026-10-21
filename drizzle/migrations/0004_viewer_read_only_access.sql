-- Everyone signed in can read; only admins can change data.
DROP POLICY IF EXISTS "Authenticated users manage app settings" ON public.app_settings;
CREATE POLICY "Signed-in users read app settings" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage app settings" ON public.app_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users manage build plans" ON public.build_plans;
CREATE POLICY "Signed-in users read build plans" ON public.build_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage build plans" ON public.build_plans FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users manage collection costing" ON public.collection_costing;
CREATE POLICY "Signed-in users read collection costing" ON public.collection_costing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage collection costing" ON public.collection_costing FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users manage contacts" ON public.contacts;
CREATE POLICY "Signed-in users read contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contacts" ON public.contacts FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users manage CRM events" ON public.crm_events;
CREATE POLICY "Signed-in users read CRM events" ON public.crm_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage CRM events" ON public.crm_events FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users manage special combinations" ON public.special_combinations;
CREATE POLICY "Signed-in users read special combinations" ON public.special_combinations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage special combinations" ON public.special_combinations FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Ware media: everyone signed in can view, only admins upload/replace/delete.
DROP POLICY IF EXISTS "Authenticated users upload Savora ware media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users update Savora ware media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users delete Savora ware media" ON storage.objects;
CREATE POLICY "Admins upload Savora ware media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'savora-ware-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update Savora ware media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'savora-ware-media' AND private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'savora-ware-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete Savora ware media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'savora-ware-media' AND private.has_role(auth.uid(), 'admin'::public.app_role));
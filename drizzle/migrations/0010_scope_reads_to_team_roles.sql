CREATE OR REPLACE FUNCTION private.is_team_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin'::public.app_role, 'viewer'::public.app_role)
  )
$$;
REVOKE ALL ON FUNCTION private.is_team_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_team_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "authenticated read activity_log" ON public.activity_log;
CREATE POLICY "Team members read activity_log" ON public.activity_log FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read app settings" ON public.app_settings;
CREATE POLICY "Team members read app settings" ON public.app_settings FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read bom" ON public.bom;
CREATE POLICY "Team members read bom" ON public.bom FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read boxes" ON public.boxes;
CREATE POLICY "Team members read boxes" ON public.boxes FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read build plans" ON public.build_plans;
CREATE POLICY "Team members read build plans" ON public.build_plans FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read collection costing" ON public.collection_costing;
CREATE POLICY "Team members read collection costing" ON public.collection_costing FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read collections" ON public.collections;
CREATE POLICY "Team members read collections" ON public.collections FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read contacts" ON public.contacts;
CREATE POLICY "Team members read contacts" ON public.contacts FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read CRM events" ON public.crm_events;
CREATE POLICY "Team members read CRM events" ON public.crm_events FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read dinner set items" ON public.dinner_set_items;
CREATE POLICY "Team members read dinner set items" ON public.dinner_set_items FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read dinner sets" ON public.dinner_sets;
CREATE POLICY "Team members read dinner sets" ON public.dinner_sets FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "authenticated read expenses" ON public.expenses;
CREATE POLICY "Team members read expenses" ON public.expenses FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read raw_materials" ON public.raw_materials;
CREATE POLICY "Team members read raw_materials" ON public.raw_materials FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "authenticated read sales" ON public.sales;
CREATE POLICY "Team members read sales" ON public.sales FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read skus" ON public.skus;
CREATE POLICY "Team members read skus" ON public.skus FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "Signed-in users read special combinations" ON public.special_combinations;
CREATE POLICY "Team members read special combinations" ON public.special_combinations FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));

DROP POLICY IF EXISTS "read sync_log" ON public.sync_log;
CREATE POLICY "Team members read sync_log" ON public.sync_log FOR SELECT TO authenticated USING (private.is_team_member((select auth.uid())));
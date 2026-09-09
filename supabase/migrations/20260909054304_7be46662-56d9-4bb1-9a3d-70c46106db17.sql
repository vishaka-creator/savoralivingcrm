DROP POLICY IF EXISTS "admins read activity_log" ON public.activity_log;
CREATE POLICY "authenticated read activity_log" ON public.activity_log FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins read expenses" ON public.expenses;
CREATE POLICY "authenticated read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins read sales" ON public.sales;
CREATE POLICY "authenticated read sales" ON public.sales FOR SELECT TO authenticated USING (true);
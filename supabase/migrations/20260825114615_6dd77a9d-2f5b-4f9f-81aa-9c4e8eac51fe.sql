-- profiles: own or admin
DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;
CREATE POLICY "profiles readable by owner or admin" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- user_roles: own or admin
DROP POLICY IF EXISTS "roles readable by authenticated" ON public.user_roles;
CREATE POLICY "roles readable by owner or admin" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- activity_log: admins only
DROP POLICY IF EXISTS "read activity_log" ON public.activity_log;
CREATE POLICY "admins read activity_log" ON public.activity_log
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- expenses: admins only
DROP POLICY IF EXISTS "read expenses" ON public.expenses;
CREATE POLICY "admins read expenses" ON public.expenses
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- sales: admins only
DROP POLICY IF EXISTS "read sales" ON public.sales;
CREATE POLICY "admins read sales" ON public.sales
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- security definer functions should not be callable by API roles
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
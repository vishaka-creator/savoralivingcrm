/* eslint-disable @typescript-eslint/no-explicit-any */
/** Server-only guard: throws unless the caller holds the admin role. */
export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("Admin access required");
}

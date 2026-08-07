/* eslint-disable @typescript-eslint/no-explicit-any */
/** Server-only guard: throws unless the caller holds the admin role. */
export async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error || !data) throw new Error("Admin access required");
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export const VIEW_ONLY_MESSAGE =
  "Your account is view-only. Ask a Savora admin to give you edit access.";

/** Reads the caller's role through their own session (RLS lets users read their own role rows). */
export async function isAdminUser(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** Server-only guard: throws unless the caller holds the admin (editor) role. */
export async function assertAdmin(context: { supabase: any; userId: string }) {
  if (!(await isAdminUser(context))) throw new Error(VIEW_ONLY_MESSAGE);
  return context.userId;
}

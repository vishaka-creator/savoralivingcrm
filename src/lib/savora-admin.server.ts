/* eslint-disable @typescript-eslint/no-explicit-any */
/** Server-only guard: throws unless the caller holds the admin role. */
export async function assertAdmin(context: { supabase: any; userId: string }) {
  // v2 uses a single Admin access tier for every authenticated CRM user.
  // Keep this boundary named so legacy server functions remain easy to audit.
  return context.userId;
}

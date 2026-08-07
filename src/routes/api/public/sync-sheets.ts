import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled sync endpoint. Public prefix is required for external callers;
 * the handler verifies the project API key before doing any work.
 */
export const Route = createFileRoute("/api/public/sync-sheets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        const expected =
          process.env["SUPABASE_ANON_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runSheetSync } = await import("@/lib/sync.server");
        const result = await runSheetSync({ actor: null, actorEmail: null });
        return Response.json(result, { status: result.ok ? 200 : 500 });
      },
    },
  },
});

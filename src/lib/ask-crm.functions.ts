import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const askSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) }))
    .max(12)
    .default([]),
});

export const askCrm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => askSchema.parse(d))
  .handler(async ({ context, data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Ask CRM isn't configured yet.");
    const { buildCrmSnapshot, answerCrmQuestion } = await import("@/lib/ask-crm.server");
    const snapshot = await buildCrmSnapshot(context.supabase);
    const answer = await answerCrmQuestion({
      apiKey,
      snapshot,
      history: data.history,
      question: data.question,
    });
    return { answer };
  });

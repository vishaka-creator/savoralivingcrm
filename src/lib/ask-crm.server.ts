import { createOpenAI } from "@ai-sdk/openai";
import { streamText, type ModelMessage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";
import { computeSets } from "./savora-logic";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";
const LOW_STOCK_PCS = 5;

export type AskTurn = { role: "user" | "assistant"; content: string };

/** Compact, read-only snapshot of the CRM that the assistant answers from. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildCrmSnapshot(supabase: SupabaseClient<any>) {
  const [collections, skus, materials, boxes, boms] = await Promise.all([
    supabase.from("collections").select("slug, name").order("sort_order"),
    supabase
      .from("skus")
      .select(
        "id, collection_slug, name, code, product_name, pieces_per_set, influencer_stock, store_stock, cost_price, mrp, influencer_remarks, showroom_remarks, sales_remarks, remarks",
      )
      .order("sort_order", { ascending: true, nullsFirst: false }),
    supabase.from("raw_materials").select("sku_id, quantity_on_hand"),
    supabase.from("boxes").select("collection_slug, product, code, quantity_on_hand"),
    supabase.from("bom").select("collection_slug, set_name, component_name, qty_required_per_set, box_code"),
  ]);
  for (const r of [collections, skus, materials, boxes, boms]) if (r.error) throw new Error(r.error.message);

  const stockBySku = new Map((materials.data ?? []).map((m) => [m.sku_id, Number(m.quantity_on_hand ?? 0)]));

  return (collections.data ?? []).map((c) => {
    const mySkus = (skus.data ?? []).filter((s) => s.collection_slug === c.slug);
    const myBoxes = (boxes.data ?? []).filter((b) => b.collection_slug === c.slug);
    const recipes = computeSets(
      (boms.data ?? []).filter((b) => b.collection_slug === c.slug),
      mySkus.map((s) => ({ name: s.name, code: s.code, quantity: stockBySku.get(s.id) ?? 0 })),
      myBoxes.map((b) => ({ product: b.product, code: b.code, quantity_on_hand: Number(b.quantity_on_hand ?? 0) })),
    );
    return {
      collection: c.name,
      setsBuildableFromRecipes: recipes.reduce((a, s) => a + s.buildable, 0),
      setRecipes: recipes.map((r) => ({
        set: r.setName,
        buildable: r.buildable,
        limitedBy: r.limitedBy,
        limitingComponent: r.limitingComponent,
        boxesAvailable: r.boxQty,
        components: r.components.map((x) => ({ ware: x.component, perSet: x.perSet, inStock: x.onHand, setsPossible: x.possible })),
      })),
      boxes: myBoxes.map((b) => ({ box: b.product, code: b.code, qty: Number(b.quantity_on_hand ?? 0) })),
      wares: mySkus.map((s) => {
        const stock = stockBySku.get(s.id) ?? 0;
        const perSet = Math.max(1, Number(s.pieces_per_set ?? 4));
        return {
          ware: s.name,
          productName: s.product_name,
          code: s.code,
          stockInHand: stock,
          piecesPerSet: perSet,
          setsCanBeMade: Math.floor(stock / perSet),
          lowStock: stock < LOW_STOCK_PCS,
          influencerStock: Number(s.influencer_stock ?? 0),
          stockOnSales: Number(s.store_stock ?? 0),
          costPrice: s.cost_price === null ? null : Number(s.cost_price),
          mrp: s.mrp === null ? null : Number(s.mrp),
          influencerRemarks: s.influencer_remarks,
          showroomRemarks: s.showroom_remarks,
          salesRemarks: s.sales_remarks,
          otherRemarks: s.remarks,
        };
      }),
    };
  });
}

const INSTRUCTIONS = `You are "Ask CRM", the assistant inside the Savora Inventory & Sales CRM (a tableware brand).
Answer only from the CRM snapshot provided. If the data does not contain the answer, say so plainly.
Rules:
- "Sets can be made" for a ware = floor(stock in hand / pieces per set).
- Set recipes show complete sets buildable from all components; the smallest component (or boxes) limits the total.
- A ware is low stock when stock in hand is below ${LOW_STOCK_PCS} pieces.
- Prices are in Indian Rupees (₹).
- Be concise. Use short bullet lists or a small markdown table when listing several wares. Show totals when asked "how many".
- Never invent wares, numbers or people.`;

export class AskCrmError extends Error {}

function friendlyError(error: unknown): AskCrmError {
  const status = (error as { statusCode?: number })?.statusCode;
  if (status === 402) return new AskCrmError("AI credits have run out. Add credits in Settings → Plans & credits, then ask again.");
  if (status === 429) return new AskCrmError("Too many questions at once. Please wait a minute and try again.");
  if (status === 403) return new AskCrmError((error as Error).message || "AI access is blocked for this workspace.");
  if (status === 401) return new AskCrmError("Ask CRM isn't configured yet.");
  return new AskCrmError("Ask CRM couldn't answer right now. Please try again shortly.");
}

export async function answerCrmQuestion(opts: {
  apiKey: string;
  snapshot: unknown;
  history: AskTurn[];
  question: string;
}) {
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey: opts.apiKey,
    headers: { "Lovable-API-Key": opts.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const messages: ModelMessage[] = [
    { role: "user", content: `CRM snapshot (JSON, current as of now):\n${JSON.stringify(opts.snapshot)}` },
    ...opts.history.map((t) => ({ role: t.role, content: t.content }) as ModelMessage),
    { role: "user", content: opts.question },
  ];

  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  let text = "";
  try {
    text = await result.text;
  } catch (error) {
    streamError ??= error;
  }
  if (streamError) {
    console.error("Ask CRM gateway error", streamError);
    throw friendlyError(streamError);
  }
  if (!text.trim()) throw new AskCrmError("Ask CRM didn't return an answer. Try rephrasing your question.");
  return text;
}

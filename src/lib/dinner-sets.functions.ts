import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/savora-admin.server";
import { computeDinnerSet, defaultDinnerRecipe, matchWareForPiece, MAX_QTY_PER_SET } from "@/lib/dinner-sets";

const itemSchema = z.object({
  piece_name: z.string().trim().min(1).max(80),
  sku_id: z.string().uuid().nullable(),
  qty_per_set: z.number().int().min(0).max(MAX_QTY_PER_SET),
});

const setSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  collection_slug: z.string().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  guests: z.number().int().min(1).max(50),
  items: z.array(itemSchema).min(1).max(30),
});

type Ctx = { supabase: any; userId: string; claims?: { email?: string } | null }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function logActivity(context: Ctx, action: string, detail: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("activity_log").insert({
    actor: context.userId,
    actor_email: context.claims?.email ?? null,
    action,
    detail,
  });
}

async function loadCollectionWares(context: Ctx, slug: string) {
  const { data, error } = await context.supabase
    .from("skus")
    .select("id, name, product_name, raw_materials(quantity_on_hand)")
    .eq("collection_slug", slug);
  if (error) throw new Error(error.message);
  return (data ?? []).map((s: { id: string; name: string; product_name: string | null; raw_materials: unknown }) => {
    const rm = Array.isArray(s.raw_materials) ? s.raw_materials[0] : s.raw_materials;
    return {
      id: s.id,
      name: s.name,
      productName: s.product_name,
      stock: Number((rm as { quantity_on_hand?: number } | null)?.quantity_on_hand ?? 0),
    };
  });
}

async function loadSets(context: Ctx, slug: string) {
  const { data, error } = await context.supabase
    .from("dinner_sets")
    .select("id, name, guests, sort_order, updated_at, updated_by_email, dinner_set_items(id, piece_name, sku_id, qty_per_set, sort_order)")
    .eq("collection_slug", slug)
    .order("sort_order")
    .order("guests");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: d.id as string,
    name: d.name as string,
    guests: Number(d.guests),
    updatedAt: d.updated_at as string,
    updatedBy: (d.updated_by_email as string | null) ?? null,
    items: ((d.dinner_set_items ?? []) as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({ id: i.id as string, piece_name: i.piece_name as string, sku_id: (i.sku_id as string | null) ?? null, qty_per_set: Number(i.qty_per_set) })),
  }));
}

async function writeSet(context: Ctx, data: z.infer<typeof setSchema>) {
  const wares = await loadCollectionWares(context, data.collection_slug);
  const wareIds = new Set(wares.map((w) => w.id));
  for (const item of data.items) {
    if (item.sku_id && !wareIds.has(item.sku_id)) throw new Error(`"${item.piece_name}" is linked to a ware outside this collection.`);
  }
  const meta = { name: data.name, guests: data.guests, updated_by: context.userId, updated_by_email: context.claims?.email ?? null };
  let id = data.id ?? null;
  if (id) {
    const { data: row, error } = await context.supabase
      .from("dinner_sets").update(meta).eq("id", id).eq("collection_slug", data.collection_slug).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That dinner set no longer exists.");
    const del = await context.supabase.from("dinner_set_items").delete().eq("dinner_set_id", id);
    if (del.error) throw new Error(del.error.message);
  } else {
    const { data: last } = await context.supabase
      .from("dinner_sets").select("sort_order").eq("collection_slug", data.collection_slug)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await context.supabase
      .from("dinner_sets")
      .insert({ ...meta, collection_slug: data.collection_slug, sort_order: Number(last?.sort_order ?? -1) + 1 })
      .select("id").single();
    if (error) throw new Error(error.message);
    id = row.id as string;
  }
  const ins = await context.supabase.from("dinner_set_items").insert(
    data.items.map((item, i) => ({ dinner_set_id: id, piece_name: item.piece_name, sku_id: item.sku_id, qty_per_set: item.qty_per_set, sort_order: i })),
  );
  if (ins.error) throw new Error(ins.error.message);
  return id!;
}

export const getDinnerSets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ context, data }) => ({ sets: await loadSets(context, data.slug) }));

export const saveDinnerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => setSchema.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const id = await writeSet(context, data);
    await logActivity(context, data.id ? "dinner_set.update" : "dinner_set.create", `${data.id ? "Updated" : "Added"} ${data.name} (${data.collection_slug})`);
    return { id };
  });

export const updateDinnerSetItemQty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), qty_per_set: z.number().int().min(0).max(MAX_QTY_PER_SET) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase
      .from("dinner_set_items").update({ qty_per_set: data.qty_per_set }).eq("id", data.id)
      .select("piece_name, dinner_set_id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("That piece no longer exists.");
    await context.supabase.from("dinner_sets")
      .update({ updated_by: context.userId, updated_by_email: context.claims?.email ?? null }).eq("id", row.dinner_set_id);
    await logActivity(context, "dinner_set.update", `Set ${row.piece_name} to ${data.qty_per_set} per dinner set`);
    return { ok: true };
  });

export const deleteDinnerSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { data: row, error } = await context.supabase.from("dinner_sets").delete().eq("id", data.id).select("name").maybeSingle();
    if (error) throw new Error(error.message);
    if (row) await logActivity(context, "dinner_set.delete", `Deleted ${row.name}`);
    return { ok: true };
  });

/** Adds the standard dinner sets for 4 and 6 to a collection that has none yet, linking pieces to its wares by name. */
export const addStandardDinnerSets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const existing = await loadSets(context, data.slug);
    if (existing.length) throw new Error("This collection already has dinner sets.");
    const wares = await loadCollectionWares(context, data.slug);
    for (const guests of [4, 6]) {
      await writeSet(context, {
        collection_slug: data.slug,
        name: `Dinner set for ${guests}`,
        guests,
        items: defaultDinnerRecipe(guests).map((p) => ({ ...p, sku_id: matchWareForPiece(p.piece_name, wares) })),
      });
    }
    await logActivity(context, "dinner_set.create", `Added standard dinner sets for 4 and 6 (${data.slug})`);
    return { ok: true };
  });

const DINNER_INSTRUCTIONS = `You help the Savora team plan dinner sets for one tableware collection.
You get a JSON snapshot: the collection's wares (id, name, productName, stock = pieces in stock) and its current dinner set recipes (each piece links to a ware by sku_id, with qty_per_set).
Sets possible for a recipe = the smallest floor(stock / qty_per_set) across its pieces; an unlinked piece counts as 0 stock. Several recipes share the same stock.
Reply with ONLY a JSON object, no code fences:
{"answer": "<short markdown answer, under 90 words, bullets allowed>", "proposals": [{"id": "<existing recipe id or null for a new recipe>", "name": "...", "guests": <number>, "items": [{"piece_name": "...", "sku_id": "<ware id from the snapshot or null>", "qty_per_set": <whole number>}]}]}
Rules:
- Only include proposals when the user asks to change, add or create a recipe. For questions (e.g. best mix, what is holding sets back), answer and return "proposals": [].
- Each proposal lists the recipe's full piece list, not just the changes. Keep existing ids when changing a recipe.
- Only use sku_id values that appear in the wares list; pick the ware whose name best fits the piece. Never invent wares or numbers.`;

const proposalSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  guests: z.coerce.number().int().min(1).max(50),
  items: z.array(z.object({
    piece_name: z.string().trim().min(1).max(80),
    sku_id: z.string().nullable().optional(),
    qty_per_set: z.coerce.number().int().min(0).max(MAX_QTY_PER_SET),
  })).min(1).max(30),
});

function parseAiJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const suggestDinnerSets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ slug: z.string().min(1).max(40), request: z.string().trim().min(1).max(600) }).parse(d))
  .handler(async ({ context, data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI help isn't configured yet.");
    const [wares, sets, collection] = await Promise.all([
      loadCollectionWares(context, data.slug),
      loadSets(context, data.slug),
      context.supabase.from("collections").select("name").eq("slug", data.slug).maybeSingle(),
    ]);
    const stock = new Map(wares.map((w) => [w.id, w.stock]));
    const snapshot = {
      collection: collection.data?.name ?? data.slug,
      wares,
      recipes: sets.map((s) => ({
        id: s.id,
        name: s.name,
        guests: s.guests,
        setsPossible: computeDinnerSet(s.items, stock).setsPossible,
        items: s.items.map(({ piece_name, sku_id, qty_per_set }) => ({ piece_name, sku_id, qty_per_set })),
      })),
    };
    const { answerCrmQuestion } = await import("@/lib/ask-crm.server");
    const text = await answerCrmQuestion({ apiKey, snapshot, history: [], question: data.request, instructions: DINNER_INSTRUCTIONS });

    const parsed = parseAiJson(text) as { answer?: unknown; proposals?: unknown } | null;
    if (!parsed) return { answer: text, proposals: [] };
    const wareIds = new Set(wares.map((w) => w.id));
    const setIds = new Set(sets.map((s) => s.id));
    const proposals = (Array.isArray(parsed.proposals) ? parsed.proposals : [])
      .map((p) => proposalSchema.safeParse(p))
      .filter((r) => r.success)
      .map((r) => {
        const p = r.data!;
        return {
          id: p.id && setIds.has(p.id) ? p.id : null,
          name: p.name,
          guests: p.guests,
          items: p.items.map((i) => ({ piece_name: i.piece_name, sku_id: i.sku_id && wareIds.has(i.sku_id) ? i.sku_id : null, qty_per_set: i.qty_per_set })),
        };
      })
      .slice(0, 6);
    return { answer: typeof parsed.answer === "string" ? parsed.answer : "", proposals };
  });

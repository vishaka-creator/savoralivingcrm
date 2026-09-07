import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeSets,
  groupBy,
  monthName as currentMonthName,
  previousMonthName,
} from "@/lib/savora-logic";
import { assertAdmin } from "@/lib/savora-admin.server";

const slugSchema = z.object({ slug: z.string().min(1).max(40) });

/* ------------------------------- identity ------------------------------- */

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, name, email").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roleList = (roles ?? []).map((r) => r.role);
    return {
      userId,
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      isAdmin: roleList.includes("admin"),
      role: roleList.includes("admin") ? "admin" : "viewer",
    };
  });

/* ------------------------------- dashboard ------------------------------ */


export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [collections, skus, materials, boxes, boms, sales, sync] = await Promise.all([
      supabase.from("collections").select("*").order("sort_order"),
      supabase
        .from("skus")
        .select(
          "id, collection_slug, name, code, unit, ordered_quantity, approx_weight_grams, dimensions, dimensions_catalogue, product_name, image_url, printed_image_url, pieces_per_set, sold_sets, sold_pcs",
        )
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name"),


      supabase.from("raw_materials").select("sku_id, quantity_on_hand, low_stock_threshold, unit"),
      supabase.from("boxes").select("*"),
      supabase.from("bom").select("*"),
      supabase.from("sales").select("*"),
      supabase.from("sync_log").select("*").order("synced_at", { ascending: false }).limit(1),
    ]);

    const materialBySku = new Map((materials.data ?? []).map((m) => [m.sku_id, m]));
    const thisMonth = currentMonthName();
    const lastMonth = previousMonthName();

    const cards = (collections.data ?? []).map((c) => {
      const mySkus = (skus.data ?? []).filter((s) => s.collection_slug === c.slug);
      const rows = mySkus.map((s) => {
        const m = materialBySku.get(s.id);
        return {
          name: s.name,
          code: s.code,
          quantity: Number(m?.quantity_on_hand ?? 0),
          threshold: Number(m?.low_stock_threshold ?? 20),
        };
      });
      const myBoxes = (boxes.data ?? []).filter((b) => b.collection_slug === c.slug);
      const sets = computeSets(
        (boms.data ?? []).filter((b) => b.collection_slug === c.slug),
        rows,
        myBoxes,
      );
      const mySales = (sales.data ?? []).filter((s) => s.collection_slug === c.slug);
      return {
        slug: c.slug,
        name: c.name,
        sheetTab: c.sheet_tab,
        shopifyHandle: c.shopify_handle,
        skuCount: rows.length,
        lowStockCount: rows.filter((r) => r.quantity <= r.threshold).length,
        totalMaterial: rows.reduce((a, r) => a + r.quantity, 0),
        boxCount: myBoxes.reduce((a, b) => a + Number(b.quantity_on_hand), 0),
        boxSkuCount: myBoxes.length,
        setsBuildable: sets.reduce((a, s) => a + s.buildable, 0),
        setDefinitions: sets.length,
        monthSales: mySales
          .filter((s) => (s.month ?? "").toLowerCase() === thisMonth.toLowerCase())
          .reduce((a, s) => a + Number(s.amount ?? 0), 0),
        // Sheet-style ware list (mirrors the Google Sheet column order).
        wares: mySkus.map((s) => {
          const m = materialBySku.get(s.id);
          return {
            id: s.id,
            ware: s.name,
            code: s.code,
            dimensions: s.dimensions,
            approxWeight:
              s.approx_weight_grams === null ? null : Number(s.approx_weight_grams),
            dimensionsCatalogue: s.dimensions_catalogue,
            productName: s.product_name,
            imageUrl: s.image_url,
            printedImageUrl: s.printed_image_url,
            orderedQuantity: s.ordered_quantity === null ? null : Number(s.ordered_quantity),
            piecesPerSet: Number(s.pieces_per_set ?? 4),
            soldSets: Number(s.sold_sets ?? 0),
            soldPcs: Number(s.sold_pcs ?? 0),
            stockInHand: Number(m?.quantity_on_hand ?? 0),
            threshold: Number(m?.low_stock_threshold ?? 20),
          };
        }),
      };
    });


    const monthTotal = (m: string) =>
      (sales.data ?? [])
        .filter((s) => (s.month ?? "").toLowerCase() === m.toLowerCase())
        .reduce((a, s) => a + Number(s.amount ?? 0), 0);

    return {
      cards,
      totals: {
        salesThisMonth: monthTotal(thisMonth),
        salesLastMonth: monthTotal(lastMonth),
        thisMonth,
        lastMonth,
        boxes: (boxes.data ?? []).reduce((a, b) => a + Number(b.quantity_on_hand), 0),
        unassignedSales: (sales.data ?? []).filter((s) => !s.collection_slug).length,
        pending: (sales.data ?? []).filter((s) => (s.status ?? "").toLowerCase() !== "recieved" && (s.status ?? "").toLowerCase() !== "received").length,
      },
      lastSync: sync.data?.[0] ?? null,
    };
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().trim().min(1).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        sheet_tab: z.string().trim().min(1).max(120),
        shopify_handle: z.string().trim().max(120).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("collections")
      .select("slug")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("A collection with this slug already exists");

    const { data: last } = await supabaseAdmin
      .from("collections")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("collections").insert({
      slug: data.slug,
      name: data.name,
      sheet_tab: data.sheet_tab,
      shopify_handle: data.shopify_handle || null,
      sort_order: Number(last?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "collection.create",
      detail: `Created collection ${data.name}`,
    });
    return { ok: true };
  });

export const getCollectionDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => slugSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const [{ data: collection }, skus, boxes, boms, sales] = await Promise.all([
      supabase.from("collections").select("*").eq("slug", data.slug).maybeSingle(),
      supabase
        .from("skus")
        .select("id, name, code, unit, ordered_quantity, raw_materials(quantity_on_hand, low_stock_threshold, unit, last_synced)")
        .eq("collection_slug", data.slug)
        .order("name"),
      supabase.from("boxes").select("*").eq("collection_slug", data.slug).order("product"),
      supabase.from("bom").select("*").eq("collection_slug", data.slug).order("set_name"),
      supabase.from("sales").select("*").eq("collection_slug", data.slug),
    ]);

    if (!collection) throw new Error("Collection not found");

    const materials = (skus.data ?? []).map((s) => {
      const rm = Array.isArray(s.raw_materials) ? s.raw_materials[0] : s.raw_materials;
      return {
        id: s.id,
        name: s.name,
        code: s.code,
        unit: rm?.unit ?? s.unit,
        orderedQuantity: s.ordered_quantity === null ? null : Number(s.ordered_quantity),
        quantity: Number(rm?.quantity_on_hand ?? 0),
        threshold: Number(rm?.low_stock_threshold ?? 20),
        lastSynced: rm?.last_synced ?? null,
      };
    });

    const sets = computeSets(boms.data ?? [], materials, boxes.data ?? []);

    return {
      collection,
      materials,
      boxes: (boxes.data ?? []).map((b) => ({
        ...b,
        quantity_on_hand: Number(b.quantity_on_hand),
        production_cost: b.production_cost === null ? null : Number(b.production_cost),
      })),
      bom: boms.data ?? [],
      sets,
      sales: (sales.data ?? []).map((s) => ({ ...s, amount: Number(s.amount ?? 0) })),
    };
  });

export const getSalesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [sales, expenses, collections] = await Promise.all([
      supabase.from("sales").select("*").order("month"),
      supabase.from("expenses").select("*").order("spend_date", { ascending: false }),
      supabase.from("collections").select("slug, name").order("sort_order"),
    ]);
    return {
      sales: (sales.data ?? []).map((s) => ({ ...s, amount: Number(s.amount ?? 0) })),
      expenses: (expenses.data ?? []).map((e) => ({ ...e, amount: Number(e.amount ?? 0) })),
      collections: collections.data ?? [],
    };
  });

export const getCrmItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [skus, materials, boxes, boms, sales, activity] = await Promise.all([
      supabase.from("skus").select("id, name, code, collection_slug, unit"),
      supabase.from("raw_materials").select("sku_id, quantity_on_hand, low_stock_threshold, last_synced"),
      supabase.from("boxes").select("*"),
      supabase.from("bom").select("*"),
      supabase.from("sales").select("*"),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(50),
    ]);

    const materialBySku = new Map((materials.data ?? []).map((m) => [m.sku_id, m]));
    const items: {
      key: string;
      item: string;
      code: string | null;
      collection: string;
      stage: string;
      quantity: number;
      lastUpdated: string | null;
    }[] = [];

    for (const s of skus.data ?? []) {
      const m = materialBySku.get(s.id);
      items.push({
        key: `mat-${s.id}`,
        item: s.name,
        code: s.code,
        collection: s.collection_slug,
        stage: "Raw material",
        quantity: Number(m?.quantity_on_hand ?? 0),
        lastUpdated: m?.last_synced ?? null,
      });
    }
    for (const b of boxes.data ?? []) {
      items.push({
        key: `box-${b.id}`,
        item: b.product,
        code: b.code,
        collection: b.collection_slug,
        stage: "Box made",
        quantity: Number(b.quantity_on_hand),
        lastUpdated: b.last_synced,
      });
    }
    for (const [slug, group] of groupBy(boms.data ?? [], (b) => b.collection_slug)) {
      const mats = (skus.data ?? [])
        .filter((s) => s.collection_slug === slug)
        .map((s) => ({
          name: s.name,
          code: s.code,
          quantity: Number(materialBySku.get(s.id)?.quantity_on_hand ?? 0),
        }));
      const sets = computeSets(group, mats, (boxes.data ?? []).filter((b) => b.collection_slug === slug));
      for (const set of sets) {
        items.push({
          key: `set-${slug}-${set.setName}`,
          item: set.setName,
          code: null,
          collection: slug,
          stage: "Set assemblable",
          quantity: set.buildable,
          lastUpdated: null,
        });
      }
    }

    return {
      items,
      orders: (sales.data ?? []).map((s) => ({ ...s, amount: Number(s.amount ?? 0) })),
      activity: activity.data ?? [],
    };
  });


/* --------------------------------- admin -------------------------------- */


export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [profiles, roles, syncLog, activity] = await Promise.all([
      supabase.from("profiles").select("id, name, email, created_at").order("created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("sync_log").select("*").order("synced_at", { ascending: false }).limit(20),
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    const roleByUser = new Map((roles.data ?? []).map((r) => [r.user_id, r.role]));
    return {
      users: (profiles.data ?? []).map((p) => ({ ...p, role: roleByUser.get(p.id) ?? "viewer" })),
      syncLog: syncLog.data ?? [],
      activity: activity.data ?? [],
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), role: z.enum(["admin", "viewer"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "role.update",
      detail: `Set role ${data.role} for ${data.userId}`,
    });
    return { ok: true };
  });

export const setLowStockThreshold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ skuId: z.string().uuid(), threshold: z.number().min(0).max(100000) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("raw_materials")
      .update({ low_stock_threshold: data.threshold })
      .eq("sku_id", data.skuId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "threshold.update",
      detail: `Low-stock threshold set to ${data.threshold}`,
    });
    return { ok: true };
  });

export const upsertBomRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        collection_slug: z.string().min(1).max(40),
        set_name: z.string().trim().min(1).max(120),
        component_name: z.string().trim().min(1).max(160),
        qty_required_per_set: z.number().min(0.01).max(1000),
        box_code: z.string().trim().max(80).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      collection_slug: data.collection_slug,
      set_name: data.set_name,
      component_name: data.component_name,
      qty_required_per_set: data.qty_required_per_set,
      box_code: data.box_code || null,
      source: "manual",
    };
    const { error } = data.id
      ? await supabaseAdmin.from("bom").update(payload).eq("id", data.id)
      : await supabaseAdmin
          .from("bom")
          .upsert(payload, { onConflict: "collection_slug,set_name,component_name" });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "bom.upsert",
      detail: `${data.collection_slug} · ${data.set_name} · ${data.component_name} × ${data.qty_required_per_set}`,
    });
    return { ok: true };
  });

export const deleteBomRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bom").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "bom.delete",
      detail: `Removed BOM row ${data.id}`,
    });
    return { ok: true };
  });

/* --------------------------------- order -------------------------------- */

export const reorderWares = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        collection_slug: z.string().min(1).max(40),
        orderedIds: z.array(z.string().uuid()).min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < data.orderedIds.length; i++) {
      const { error } = await supabaseAdmin
        .from("skus")
        .update({ sort_order: i + 1 })
        .eq("id", data.orderedIds[i]!)
        .eq("collection_slug", data.collection_slug);
      if (error) throw new Error(error.message);
    }
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "wares.reorder",
      detail: `${data.collection_slug} · ${data.orderedIds.length} wares reordered`,
    });
    return { ok: true };
  });

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : null));

export const updateWare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(200),
        code: nullableText(80),
        dimensions_catalogue: nullableText(200),
        product_name: nullableText(200),
        image_url: nullableText(600),
        printed_image_url: nullableText(600),
        ordered_quantity: z.number().min(0).max(1000000).nullable().optional(),
        approx_weight_grams: z.number().min(0).max(1000000).nullable().optional(),
        stock_in_hand: z.number().min(0).max(1000000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, stock_in_hand, ...fields } = data;
    const { error } = await supabaseAdmin
      .from("skus")
      .update({
        name: fields.name,
        code: fields.code ?? null,
        dimensions_catalogue: fields.dimensions_catalogue ?? null,
        product_name: fields.product_name ?? null,
        image_url: fields.image_url ?? null,
        printed_image_url: fields.printed_image_url ?? null,
        ordered_quantity: fields.ordered_quantity ?? null,
        approx_weight_grams: fields.approx_weight_grams ?? null,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (typeof stock_in_hand === "number") {
      const { error: stockError } = await supabaseAdmin
        .from("raw_materials")
        .update({ quantity_on_hand: stock_in_hand })
        .eq("sku_id", id);
      if (stockError) throw new Error(stockError.message);
    }

    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "ware.update",
      detail: `Updated ware ${data.name}`,
    });
    return { ok: true };
  });

/* ---------------------------- sales in sets/pcs -------------------------- */

export const updateWareSales = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        sold_sets: z.number().min(0).max(1000000),
        sold_pcs: z.number().min(0).max(1000000),
        pieces_per_set: z.number().min(1).max(1000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sku, error: skuError } = await supabaseAdmin
      .from("skus")
      .select("id, name, pieces_per_set, sold_sets, sold_pcs")
      .eq("id", data.id)
      .maybeSingle();
    if (skuError) throw new Error(skuError.message);
    if (!sku) throw new Error("Ware not found");

    const oldPps = Number(sku.pieces_per_set ?? 4);
    const newPps = data.pieces_per_set ?? oldPps;
    const oldPieces = Number(sku.sold_sets ?? 0) * oldPps + Number(sku.sold_pcs ?? 0);
    const newPieces = data.sold_sets * newPps + data.sold_pcs;
    const delta = newPieces - oldPieces;

    const { error: updateError } = await supabaseAdmin
      .from("skus")
      .update({ sold_sets: data.sold_sets, sold_pcs: data.sold_pcs, pieces_per_set: newPps })
      .eq("id", data.id);
    if (updateError) throw new Error(updateError.message);

    let stock: number | null = null;
    if (delta !== 0) {
      const { data: material } = await supabaseAdmin
        .from("raw_materials")
        .select("id, quantity_on_hand")
        .eq("sku_id", data.id)
        .maybeSingle();
      if (material) {
        stock = Math.max(0, Number(material.quantity_on_hand ?? 0) - delta);
        const { error: stockError } = await supabaseAdmin
          .from("raw_materials")
          .update({ quantity_on_hand: stock })
          .eq("id", material.id);
        if (stockError) throw new Error(stockError.message);
      }
    }

    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "ware.sales",
      detail: `${sku.name}: ${data.sold_sets} set(s) × ${newPps} + ${data.sold_pcs} pcs sold · stock ${
        delta > 0 ? "-" : "+"
      }${Math.abs(delta)}`,
    });

    return { ok: true, stockInHand: stock, piecesDelta: delta };
  });



export const deleteWare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("raw_materials").delete().eq("sku_id", data.id);
    const { error } = await supabaseAdmin.from("skus").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("activity_log").insert({
      actor: context.userId,
      actor_email: context.claims?.email ?? null,
      action: "ware.delete",
      detail: `Deleted ware ${data.id}`,
    });
    return { ok: true };
  });


/* ---------------------------------- sync -------------------------------- */


export const syncNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { runSheetSync } = await import("./sync.server");
    return runSheetSync({
      actor: context.userId,
      actorEmail: (context.claims as { email?: string } | null)?.email ?? null,
    });
  });

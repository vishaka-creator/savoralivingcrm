/**
 * Writes the Google Sheet snapshot into the database (server-only).
 */
import { COLLECTIONS, DEFAULT_LOW_STOCK_THRESHOLD } from "./savora-config";
import { fetchSnapshot } from "./sheets.server";

export interface SyncResult {
  ok: boolean;
  syncedAt: string;
  counts: { skus: number; boxes: number; sales: number; expenses: number };
  message?: string;
}

export async function runSheetSync(opts: {
  actor?: string | null;
  actorEmail?: string | null;
}): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const syncedAt = new Date().toISOString();

  try {
    const snapshot = await fetchSnapshot();
    let skuCount = 0;
    let boxCount = 0;

    for (const c of COLLECTIONS) {
      const bundle = snapshot.perCollection[c.slug];

      // --- SKUs + raw material stock -------------------------------------
      const skuRows = bundle.products
        .filter((p) => p.name)
        .map((p) => ({
          collection_slug: c.slug,
          name: p.name.slice(0, 200),
          code: p.code,
          ordered_quantity: p.quantity,
        }));

      if (skuRows.length) {
        const { data: upserted, error } = await supabaseAdmin
          .from("skus")
          .upsert(skuRows, { onConflict: "collection_slug,name" })
          .select("id, name");
        if (error) throw new Error(`skus: ${error.message}`);
        skuCount += upserted?.length ?? 0;

        const byName = new Map((upserted ?? []).map((s) => [s.name, s.id]));
        const materialRows = bundle.products
          .filter((p) => p.name && byName.has(p.name.slice(0, 200)))
          .map((p) => ({
            sku_id: byName.get(p.name.slice(0, 200))!,
            quantity_on_hand: p.quantity ?? 0,
            last_synced: syncedAt,
          }));

        // Preserve manually configured thresholds: only insert when missing.
        const { data: existing } = await supabaseAdmin
          .from("raw_materials")
          .select("sku_id")
          .in("sku_id", materialRows.map((r) => r.sku_id));
        const known = new Set((existing ?? []).map((r) => r.sku_id));

        const inserts = materialRows
          .filter((r) => !known.has(r.sku_id))
          .map((r) => ({ ...r, low_stock_threshold: DEFAULT_LOW_STOCK_THRESHOLD }));
        if (inserts.length) {
          const { error: insErr } = await supabaseAdmin.from("raw_materials").insert(inserts);
          if (insErr) throw new Error(`raw_materials insert: ${insErr.message}`);
        }
        for (const r of materialRows.filter((r) => known.has(r.sku_id))) {
          await supabaseAdmin
            .from("raw_materials")
            .update({ quantity_on_hand: r.quantity_on_hand, last_synced: syncedAt })
            .eq("sku_id", r.sku_id);
        }
      }

      // --- Boxes ----------------------------------------------------------
      const costByKey = new Map<string, number>();
      for (const p of bundle.products) {
        if (p.cost === null) continue;
        if (p.code) costByKey.set(normKey(p.code), p.cost);
        costByKey.set(normKey(p.name), p.cost);
      }
      const boxRows = bundle.boxes.map((b) => ({
        collection_slug: c.slug,
        product: b.product.slice(0, 200),
        code: b.code,
        quantity_on_hand: b.quantity,
        production_cost:
          costByKey.get(normKey(b.code ?? "")) ?? costByKey.get(normKey(b.product)) ?? null,
        foam: b.foam,
        print_status: b.print_status,
        last_synced: syncedAt,
      }));
      if (boxRows.length) {
        const { error } = await supabaseAdmin
          .from("boxes")
          .upsert(boxRows, { onConflict: "collection_slug,product,code" });
        if (error) throw new Error(`boxes: ${error.message}`);
        boxCount += boxRows.length;
      }
    }

    // --- Sales + expenses -------------------------------------------------
    if (snapshot.sales.length) {
      const { error } = await supabaseAdmin
        .from("sales")
        .upsert(
          snapshot.sales.map((s) => ({ ...s, last_synced: syncedAt })),
          { onConflict: "source_row" },
        );
      if (error) throw new Error(`sales: ${error.message}`);
    }
    if (snapshot.expenses.length) {
      const { error } = await supabaseAdmin
        .from("expenses")
        .upsert(
          snapshot.expenses.map((e) => ({ ...e, last_synced: syncedAt })),
          { onConflict: "source_row" },
        );
      if (error) throw new Error(`expenses: ${error.message}`);
    }

    await supabaseAdmin.from("sync_log").insert({
      source: "sheets",
      tab_or_endpoint: `${snapshot.tabsRead.length} tabs`,
      synced_at: syncedAt,
      row_count: skuCount + boxCount + snapshot.sales.length + snapshot.expenses.length,
      status: "ok",
    });
    if (opts.actor) {
      await supabaseAdmin.from("activity_log").insert({
        actor: opts.actor,
        actor_email: opts.actorEmail ?? null,
        action: "sync.sheets",
        detail: `Synced ${skuCount} wares, ${boxCount} box lines, ${snapshot.sales.length} sales rows`,
      });
    }

    return {
      ok: true,
      syncedAt,
      counts: {
        skus: skuCount,
        boxes: boxCount,
        sales: snapshot.sales.length,
        expenses: snapshot.expenses.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    console.error("Sheet sync failed:", message);
    await supabaseAdmin.from("sync_log").insert({
      source: "sheets",
      tab_or_endpoint: "batchGet",
      synced_at: syncedAt,
      row_count: 0,
      status: "error",
      message: message.slice(0, 500),
    });
    return {
      ok: false,
      syncedAt,
      counts: { skus: 0, boxes: 0, sales: 0, expenses: 0 },
      message,
    };
  }
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Writes the Google Sheet snapshot into the database (server-only).
 *
 * Only the five collection tabs are synced. Sales, expenses and box stock
 * are excluded from the sheet sync per spec — they live in the CRM and are
 * edited in-app; existing rows are left untouched.
 */
import { COLLECTIONS, DEFAULT_LOW_STOCK_THRESHOLD } from "./savora-config";
import { fetchSnapshot } from "./sheets.server";

export interface SyncResult {
  ok: boolean;
  syncedAt: string;
  counts: { wares: number };
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
          approx_weight_grams: p.weight,
          dimensions: p.dimensions,
          dimensions_catalogue: p.dimensionsCatalogue,
          product_name: p.productName,
          image_url: p.image,
          printed_image_url: p.printedImage,
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
            quantity_on_hand: p.stock ?? p.quantity ?? 0,
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
    }

    await supabaseAdmin.from("sync_log").insert({
      source: "sheets",
      tab_or_endpoint: `${snapshot.tabsRead.length} tabs`,
      synced_at: syncedAt,
      row_count: skuCount,
      status: "ok",
    });
    if (opts.actor) {
      await supabaseAdmin.from("activity_log").insert({
        actor: opts.actor,
        actor_email: opts.actorEmail ?? null,
        action: "sync.sheets",
        detail: `Synced ${skuCount} wares from ${snapshot.tabsRead.length} collection tabs`,
      });
    }

    return {
      ok: true,
      syncedAt,
      counts: { wares: skuCount },
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
      counts: { wares: 0 },
      message,
    };
  }
}

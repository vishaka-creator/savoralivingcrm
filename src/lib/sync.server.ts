/**
 * Writes the Google Sheet snapshot into the database (server-only).
 *
 * Only collection ware-list tabs (plus the built-in production-cost tabs) are
 * synced. Every collection in the CRM is synced from its saved sheet tab, so
 * collections added in-app (e.g. Parakeet) sync too. Sales, expenses and box
 * stock are excluded from the sheet sync per spec — existing rows are left
 * untouched.
 */
import { COLLECTIONS, DEFAULT_LOW_STOCK_THRESHOLD } from "./savora-config";
import { fetchSnapshot, type SyncTarget } from "./sheets.server";

export interface SyncResult {
  ok: boolean;
  syncedAt: string;
  counts: { wares: number };
  /** Collections that were refreshed in this run. */
  collections: string[];
  /** Collections skipped because their sheet tab was not found. */
  missingTabs: string[];
  message?: string;
}

export async function runSheetSync(opts: {
  actor?: string | null;
  actorEmail?: string | null;
  /** Limit the sync to these collection slugs; omit for every collection. */
  collections?: string[] | undefined;
  /** Read this sheet tab instead of the collection's usual one (single collection only). */
  tab?: string | undefined;
}): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const syncedAt = new Date().toISOString();
  let names: string[] = [];
  let scopeLabel = "all collections";

  try {
    const { data: rows, error: colErr } = await supabaseAdmin
      .from("collections")
      .select("slug, name, sheet_tab")
      .order("sort_order");
    if (colErr) throw new Error(`collections: ${colErr.message}`);

    const all: SyncTarget[] = (rows ?? []).map((r) => {
      const builtIn = COLLECTIONS.find((c) => c.slug === r.slug);
      return {
        slug: r.slug,
        name: r.name,
        sheetTab: builtIn?.sheetTab ?? r.sheet_tab ?? r.name,
        costTab: builtIn?.costTab ?? null,
      };
    });
    let targets = opts.collections?.length
      ? all.filter((c) => opts.collections!.includes(c.slug))
      : all;
    if (!targets.length) throw new Error("That collection doesn't exist in the CRM.");
    if (opts.tab) {
      if (targets.length !== 1) throw new Error("Pick one collection to bring a tab into.");
      // A hand-picked tab is read on its own, without the cost tab fallback.
      targets = [{ ...targets[0]!, sheetTab: opts.tab, costTab: null }];
    }
    names = targets.map((c) => c.name);
    if (opts.collections?.length) scopeLabel = names.join(", ");
    if (opts.tab) scopeLabel = `${scopeLabel} from tab "${opts.tab}"`;

    const snapshot = await fetchSnapshot(targets);
    if (snapshot.missingTabs.length === targets.length) {
      throw new Error(`Sheet tab not found for ${snapshot.missingTabs.join("; ")}`);
    }
    let skuCount = 0;

    for (const c of targets) {
      const bundle = snapshot.perCollection[c.slug];
      if (!bundle) continue;


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
      tab_or_endpoint: `${scopeLabel} (${snapshot.tabsRead.length} tabs)`.slice(0, 200),
      synced_at: syncedAt,
      row_count: skuCount,
      status: "ok",
    });
    if (opts.actor) {
      await supabaseAdmin.from("activity_log").insert({
        actor: opts.actor,
        actor_email: opts.actorEmail ?? null,
        action: "sync.sheets",
        detail: `Synced ${skuCount} wares from ${scopeLabel}`,
      });
    }

    return {
      ok: true,
      syncedAt,
      counts: { wares: skuCount },
      collections: names,
      missingTabs: snapshot.missingTabs,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error";
    console.error("Sheet sync failed:", message);
    await supabaseAdmin.from("sync_log").insert({
      source: "sheets",
      tab_or_endpoint: `batchGet: ${scopeLabel}`.slice(0, 200),
      synced_at: syncedAt,
      row_count: 0,
      status: "error",
      message: message.slice(0, 500),
    });
    return {
      ok: false,
      syncedAt,
      counts: { wares: 0 },
      collections: names,
      missingTabs: [],
      message,
    };
  }
}

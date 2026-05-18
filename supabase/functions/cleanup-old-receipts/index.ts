import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RETENTION_DAYS = 15;
const BATCH_SIZE = 500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    console.log(`[cleanup-old-receipts] Deleting receipts older than ${cutoff}`);

    let totalDeleted = 0;
    let totalOrphans = 0;
    let totalErrors = 0;
    let totalBytes = 0;

    // Loop through old storage objects in pages
    while (true) {
      const { data: objects, error: listErr } = await supabase.rpc("list_old_receipts", {
        cutoff,
        max_rows: BATCH_SIZE,
      });

      if (listErr) {
        console.error("[cleanup-old-receipts] List error:", listErr);
        return new Response(
          JSON.stringify({ error: listErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!objects || objects.length === 0) break;

      const paths = objects.map((o: any) => o.name);

      // Identify orphans (no DB reference) vs regenerable — chunk to avoid URL length limits
      const referencedPaths = new Set<string>();
      const referencedIds: string[] = [];
      const CHUNK = 50;
      for (let i = 0; i < paths.length; i += CHUNK) {
        const slice = paths.slice(i, i + CHUNK);
        const { data: refs, error: refErr } = await supabase
          .from("pickup_requests")
          .select("id, receipt_file_path")
          .in("receipt_file_path", slice);
        if (refErr) {
          console.error("[cleanup-old-receipts] Ref lookup error:", refErr);
          continue;
        }
        for (const r of refs || []) {
          referencedPaths.add((r as any).receipt_file_path);
          referencedIds.push((r as any).id);
        }
      }
      const orphanCount = paths.filter((p) => !referencedPaths.has(p)).length;

      // Delete from storage
      const { data: removed, error: removeErr } = await supabase.storage
        .from("receipts")
        .remove(paths);

      if (removeErr) {
        console.error("[cleanup-old-receipts] Remove error:", removeErr);
        totalErrors += paths.length;
      } else {
        totalDeleted += removed?.length || 0;
        totalOrphans += orphanCount;
        totalBytes += objects.reduce(
          (sum: number, o: any) => sum + (Number(o.size) || 0),
          0
        );
      }

      // Clear receipt_file_path so receipt-download knows to regenerate
      if (referencedIds.length > 0) {
        await supabase
          .from("pickup_requests")
          .update({ receipt_file_path: null })
          .in("id", referencedIds);
      }

      console.log(
        `[cleanup-old-receipts] Batch: removed=${paths.length}, orphans=${orphanCount}, referenced=${referencedIds.length}`
      );

      if (objects.length < BATCH_SIZE) break;
      // No offset increment needed — objects were removed and the next list won't include them
    }

    const freedMb = (totalBytes / 1024 / 1024).toFixed(2);
    const summary = {
      cutoff,
      retention_days: RETENTION_DAYS,
      deleted_files: totalDeleted,
      orphans: totalOrphans,
      regenerable_cleared: totalDeleted - totalOrphans,
      freed_mb: freedMb,
      errors: totalErrors,
    };
    console.log("[cleanup-old-receipts] Done:", summary);

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[cleanup-old-receipts] Fatal:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

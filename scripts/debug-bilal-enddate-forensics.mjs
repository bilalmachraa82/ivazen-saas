#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l.slice(i + 1).trim().replace(/^['"]|['"]$/g, ""),
      ];
    }),
);
const s = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const BILAL = "5a994a12-8364-4320-ac35-e93f81edcf10";

console.log("=== Any Bilal history with end_date=2026-03-30 since 2026-04-16? ===");
const { data: a } = await s
  .from("at_sync_history")
  .select("id,created_at,end_date,status,reason_code,records_imported")
  .eq("client_id", BILAL)
  .eq("end_date", "2026-03-30")
  .gte("created_at", "2026-04-16");
console.log("count:", a?.length, JSON.stringify(a, null, 2));

console.log("\n=== Distribution of end_date values in Bilal's history ===");
const { data: b } = await s
  .from("at_sync_history")
  .select("end_date,created_at")
  .eq("client_id", BILAL)
  .gte("created_at", "2026-03-25")
  .order("created_at", { ascending: false });
const counts = {};
for (const r of b ?? []) {
  const key = `end_date=${r.end_date}  (day of created_at=${r.created_at.slice(0,10)})`;
  counts[key] = (counts[key] || 0) + 1;
}
for (const [k, v] of Object.entries(counts)) console.log(`${v}x ${k}`);
console.log("\nTotal:", b?.length);

console.log("\n=== Same check for Helene ===");
const { data: hc } = await s
  .from("at_sync_history")
  .select("end_date,created_at")
  .eq("client_id", "af826459-7260-4b3c-9b97-08077299e356")
  .gte("created_at", "2026-03-25")
  .order("created_at", { ascending: false });
const counts2 = {};
for (const r of hc ?? []) {
  const key = `end_date=${r.end_date}  (day=${r.created_at.slice(0,10)})`;
  counts2[key] = (counts2[key] || 0) + 1;
}
for (const [k, v] of Object.entries(counts2)) console.log(`${v}x ${k}`);

console.log("\n=== Batch 2026-04-18: all at_sync_history rows (how many per end_date) ===");
const { data: batch } = await s
  .from("at_sync_history")
  .select("client_id,end_date,status,reason_code,records_imported,records_skipped")
  .gte("created_at", "2026-04-18T00:00:00Z")
  .lte("created_at", "2026-04-18T23:59:59Z")
  .order("created_at", { ascending: true });
console.log("total rows in batch:", batch?.length);
const dist = {};
for (const r of batch ?? []) {
  dist[r.end_date] = (dist[r.end_date] || 0) + 1;
}
console.log("end_date distribution:", dist);

// Just the anomalies
console.log("\nAny rows with end_date != 2026-04-18 in that batch:");
for (const r of batch ?? []) {
  if (r.end_date !== "2026-04-18") {
    console.log("  ", JSON.stringify(r));
  }
}

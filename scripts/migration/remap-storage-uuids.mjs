/**
 * remap-storage-uuids.mjs
 *
 * After storage files have been copied from old Supabase to new (with old UUID paths),
 * this script:
 * 1. Updates image_path in invoices and sales_invoices tables (old UUID → new UUID)
 * 2. Copies each file from old-UUID path to new-UUID path in the new storage
 * 3. Deletes the old-UUID paths from new storage
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=ey... node scripts/migration/remap-storage-uuids.mjs
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const NEW_SUPABASE_URL = "https://dmprkdvkzzjtixlatnlx.supabase.co";
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "invoices";
const MAPPINGS_FILE = "/tmp/id_mappings.txt";

if (!NEW_SERVICE_KEY) {
  console.error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// The 8 old folder UUIDs that exist in storage
const OLD_FOLDERS = [
  "0bbbadf5-7bcf-4a18-81c8-0e83e8e3e33e",
  "311e6110-6402-436f-92e5-6a9a8e07f5cd",
  "93770a8d-2db9-42d3-bda0-de3daaedd340",
  "9f228c9f-11e1-442a-9077-3ad14c621261",
  "a3f28050-711c-4a37-9994-0a85059f19d6",
  "b829798b-96c1-4c34-a078-a711dfd83e56",
  "dc6ccdc2-9d5e-4fd3-883b-e01a70ed4a62",
  "f86cd4e8-6ac7-4e60-a5eb-ff57df5015dc",
];

function loadMappings() {
  const raw = readFileSync(MAPPINGS_FILE, "utf-8");
  const lines = raw.split("\n").slice(1);
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split("→").map((s) => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      map.set(parts[0], parts[1]);
    }
  }
  return map;
}

function remapPath(path, mappings) {
  let result = path;
  for (const [oldId, newId] of mappings) {
    if (result.includes(oldId)) {
      result = result.replaceAll(oldId, newId);
    }
  }
  return result;
}

// ── Step 1: Update image_path in DB ──────────────────────

async function updateImagePaths(supabase, mappings) {
  console.log("\n=== STEP 1: Update image_path in database ===\n");

  for (const table of ["invoices", "sales_invoices"]) {
    console.log(`  Table: ${table}`);

    // Fetch rows with image_path containing any old UUID
    const { data: rows, error } = await supabase
      .from(table)
      .select("id, image_path")
      .not("image_path", "is", null);

    if (error) {
      console.error(`  Error fetching ${table}:`, error.message);
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`  No rows with image_path.`);
      continue;
    }

    console.log(`  Found ${rows.length} rows with image_path.`);
    let updated = 0;

    for (const row of rows) {
      const newPath = remapPath(row.image_path, mappings);
      if (newPath !== row.image_path) {
        const { error: updateErr } = await supabase
          .from(table)
          .update({ image_path: newPath })
          .eq("id", row.id);

        if (updateErr) {
          console.error(`  Error updating id=${row.id}:`, updateErr.message);
        } else {
          updated++;
        }
      }
    }
    console.log(`  Updated ${updated}/${rows.length} rows.\n`);
  }
}

// ── Step 2: Move files in storage ────────────────────────

async function moveStorageFiles(mappings) {
  console.log("=== STEP 2: Move files in storage (old UUID → new UUID) ===\n");

  let moved = 0;
  let errors = 0;

  for (const oldFolder of OLD_FOLDERS) {
    const newFolder = mappings.get(oldFolder);
    if (!newFolder) {
      console.log(`  WARNING: No mapping for ${oldFolder}`);
      continue;
    }
    if (oldFolder === newFolder) {
      console.log(`  SKIP: ${oldFolder} (same UUID)`);
      continue;
    }

    console.log(`  ${oldFolder} → ${newFolder}`);

    // List all files recursively
    const filePaths = await listAllFiles(oldFolder);
    console.log(`    ${filePaths.length} files to move`);

    for (const oldPath of filePaths) {
      const newPath = oldPath.replace(oldFolder, newFolder);
      try {
        // Download from old path
        const dlRes = await fetch(
          `${NEW_SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(oldPath)}`,
          { headers: { Authorization: `Bearer ${NEW_SERVICE_KEY}` } }
        );
        if (!dlRes.ok) throw new Error(`download ${dlRes.status}`);
        const buffer = await dlRes.arrayBuffer();

        // Upload to new path
        const ulRes = await fetch(
          `${NEW_SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(newPath)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${NEW_SERVICE_KEY}`,
              "Content-Type": dlRes.headers.get("content-type") || "application/pdf",
              "x-upsert": "true",
            },
            body: Buffer.from(buffer),
          }
        );
        if (!ulRes.ok) throw new Error(`upload ${ulRes.status} ${await ulRes.text()}`);

        // Delete old path
        const delRes = await fetch(
          `${NEW_SUPABASE_URL}/storage/v1/object/${BUCKET}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${NEW_SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ prefixes: [oldPath] }),
          }
        );

        moved++;
        console.log(`    OK: ${oldPath.split("/").pop()}`);
      } catch (err) {
        console.error(`    FAIL: ${oldPath} — ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n  Moved: ${moved}, Errors: ${errors}`);
}

async function listAllFiles(prefix) {
  const res = await fetch(`${NEW_SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NEW_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    }),
  });
  if (!res.ok) return [];
  const entries = await res.json();
  const files = [];
  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      const subFiles = await listAllFiles(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// ── Step 3: Verify ───────────────────────────────────────

async function verify(supabase, mappings) {
  console.log("\n=== STEP 3: Verify ===\n");

  // Check a few image_paths in DB
  for (const table of ["invoices", "sales_invoices"]) {
    const { data } = await supabase
      .from(table)
      .select("image_path")
      .not("image_path", "is", null)
      .limit(3);

    console.log(`  ${table} sample paths:`);
    for (const row of data || []) {
      const hasOldUuid = OLD_FOLDERS.some((f) => row.image_path?.includes(f));
      console.log(`    ${hasOldUuid ? "OLD" : " OK"} ${row.image_path}`);
    }
  }

  // Count files in new storage folders
  let totalFiles = 0;
  for (const oldFolder of OLD_FOLDERS) {
    const newFolder = mappings.get(oldFolder);
    if (!newFolder) continue;
    const files = await listAllFiles(newFolder);
    console.log(`  Storage ${newFolder}: ${files.length} files`);
    totalFiles += files.length;
  }
  console.log(`\n  Total files in new storage: ${totalFiles}`);
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  console.log("Loading ID mappings...");
  const mappings = loadMappings();
  console.log(`Loaded ${mappings.size} mappings.\n`);

  // Verify all 8 folders have mappings
  for (const f of OLD_FOLDERS) {
    console.log(`  ${f} → ${mappings.get(f) || "MISSING!"}`);
  }

  const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await updateImagePaths(supabase, mappings);
  await moveStorageFiles(mappings);
  await verify(supabase, mappings);

  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

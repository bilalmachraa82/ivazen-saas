/**
 * migrate-storage.mjs
 *
 * Migrates storage files from the OLD Supabase project to the NEW one,
 * remapping user-UUID folder names according to /tmp/id_mappings.txt.
 *
 * Also patches the `image_path` column in `invoices` and `sales_invoices`
 * tables on the NEW project so paths point to the new UUIDs.
 *
 * Usage:
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=ey... \
 *   SUPABASE_SERVICE_ROLE_KEY=ey... \
 *   node scripts/migration/migrate-storage.mjs
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const OLD_SUPABASE_URL = 'https://oqvvtcfvjkghrwaatprx.supabase.co';
const OLD_SERVICE_KEY  = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_SUPABASE_URL = 'https://dmprkdvkzzjtixlatnlx.supabase.co';
const NEW_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKET = 'invoices';
const MAPPINGS_FILE = '/tmp/id_mappings.txt';

// Known top-level folders in old storage
const OLD_FOLDERS = [
  '0bbbadf5-7bcf-4a18-81c8-0e83e8e3e33e',
  '311e6110-6402-436f-92e5-6a9a8e07f5cd',
  '93770a8d-2db9-42d3-bda0-de3daaedd340',
  '9f228c9f-11e1-442a-9077-3ad14c621261',
  'a3f28050-711c-4a37-9994-0a85059f19d6',
  'b829798b-96c1-4c34-a078-a711dfd83e56',
  'dc6ccdc2-9d5e-4fd3-883b-e01a70ed4a62',
  'f86cd4e8-6ac7-4e60-a5eb-ff57df5015dc',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadMappings() {
  const raw = readFileSync(MAPPINGS_FILE, 'utf-8');
  const lines = raw.split('\n').slice(1); // skip header
  const map = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Format: "old_uuid → new_uuid"  (the arrow is the Unicode char →, U+2192)
    const parts = trimmed.split('→').map(s => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      map.set(parts[0], parts[1]);
    }
  }
  return map;
}

/** Replace any old UUID in a path string with its new UUID. */
function remapPath(path, mappings) {
  let result = path;
  for (const [oldId, newId] of mappings) {
    if (result.includes(oldId)) {
      result = result.replaceAll(oldId, newId);
    }
  }
  return result;
}

/** Supabase Storage REST: list objects in a folder. */
async function listObjects(supabaseUrl, serviceKey, bucket, prefix) {
  const url = `${supabaseUrl}/storage/v1/object/list/${bucket}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix,
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    }),
  });
  if (!res.ok) {
    throw new Error(`listObjects(${prefix}): ${res.status} ${await res.text()}`);
  }
  return res.json(); // array of { name, id, metadata, ... }
}

/** Download a file from Supabase Storage via the authenticated endpoint. */
async function downloadFile(supabaseUrl, serviceKey, bucket, filePath) {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(filePath)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) {
    throw new Error(`downloadFile(${filePath}): ${res.status} ${await res.text()}`);
  }
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || 'application/octet-stream',
  };
}

/** Upload a file to Supabase Storage. */
async function uploadFile(supabaseUrl, serviceKey, bucket, filePath, buffer, contentType) {
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${encodeURIComponent(filePath)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    throw new Error(`uploadFile(${filePath}): ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/** Recursively list all file paths under a folder in a bucket. */
async function listAllFiles(supabaseUrl, serviceKey, bucket, prefix) {
  const entries = await listObjects(supabaseUrl, serviceKey, bucket, prefix);
  const files = [];

  for (const entry of entries) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.id === null) {
      // It's a folder — recurse
      const subFiles = await listAllFiles(supabaseUrl, serviceKey, bucket, fullPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push(fullPath);
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Step 1: Update image_path in DB
// ---------------------------------------------------------------------------
async function updateImagePaths(mappings) {
  console.log('\n=== STEP 1: Update image_path in database ===\n');

  const supabase = createClient(NEW_SUPABASE_URL, NEW_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const table of ['invoices', 'sales_invoices']) {
    console.log(`Processing table: ${table}`);

    // Fetch all rows that have an image_path
    const { data: rows, error } = await supabase
      .from(table)
      .select('id, image_path')
      .not('image_path', 'is', null);

    if (error) {
      console.error(`  Error fetching ${table}:`, error.message);
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`  No rows with image_path found in ${table}.`);
      continue;
    }

    console.log(`  Found ${rows.length} rows with image_path in ${table}.`);

    let updatedCount = 0;
    for (const row of rows) {
      const newPath = remapPath(row.image_path, mappings);
      if (newPath !== row.image_path) {
        const { error: updateError } = await supabase
          .from(table)
          .update({ image_path: newPath })
          .eq('id', row.id);

        if (updateError) {
          console.error(`  Error updating ${table} id=${row.id}:`, updateError.message);
        } else {
          updatedCount++;
          console.log(`  [${table}] ${row.image_path}  =>  ${newPath}`);
        }
      }
    }
    console.log(`  Updated ${updatedCount}/${rows.length} rows in ${table}.\n`);
  }
}

// ---------------------------------------------------------------------------
// Step 2: Migrate storage files
// ---------------------------------------------------------------------------
async function migrateStorageFiles(mappings) {
  console.log('\n=== STEP 2: Migrate storage files ===\n');

  let totalDownloaded = 0;
  let totalUploaded = 0;
  let totalErrors = 0;

  for (const oldFolder of OLD_FOLDERS) {
    const newFolder = mappings.get(oldFolder);
    if (!newFolder) {
      console.warn(`WARNING: No mapping found for folder ${oldFolder} — skipping.`);
      continue;
    }

    console.log(`\nFolder: ${oldFolder} => ${newFolder}`);

    // List all files recursively in this old folder
    let files;
    try {
      files = await listAllFiles(OLD_SUPABASE_URL, OLD_SERVICE_KEY, BUCKET, oldFolder);
    } catch (err) {
      console.error(`  Error listing files in ${oldFolder}:`, err.message);
      totalErrors++;
      continue;
    }

    console.log(`  Found ${files.length} file(s)`);

    for (const oldFilePath of files) {
      const newFilePath = remapPath(oldFilePath, mappings);
      try {
        // Download from old
        const { buffer, contentType } = await downloadFile(
          OLD_SUPABASE_URL, OLD_SERVICE_KEY, BUCKET, oldFilePath
        );
        totalDownloaded++;

        // Upload to new
        await uploadFile(
          NEW_SUPABASE_URL, NEW_SERVICE_KEY, BUCKET, newFilePath, buffer, contentType
        );
        totalUploaded++;

        console.log(`  OK: ${oldFilePath} => ${newFilePath} (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (err) {
        console.error(`  FAIL: ${oldFilePath} => ${err.message}`);
        totalErrors++;
      }
    }
  }

  console.log(`\n--- Storage migration summary ---`);
  console.log(`  Downloaded: ${totalDownloaded}`);
  console.log(`  Uploaded:   ${totalUploaded}`);
  console.log(`  Errors:     ${totalErrors}`);

  return totalUploaded;
}

// ---------------------------------------------------------------------------
// Step 3: Verify
// ---------------------------------------------------------------------------
async function verifyNewStorage(mappings) {
  console.log('\n=== STEP 3: Verify files in new storage ===\n');

  let totalFiles = 0;
  for (const oldFolder of OLD_FOLDERS) {
    const newFolder = mappings.get(oldFolder);
    if (!newFolder) continue;

    try {
      const files = await listAllFiles(NEW_SUPABASE_URL, NEW_SERVICE_KEY, BUCKET, newFolder);
      console.log(`  ${newFolder}: ${files.length} file(s)`);
      totalFiles += files.length;
    } catch (err) {
      console.error(`  ${newFolder}: ERROR listing — ${err.message}`);
    }
  }

  console.log(`\n  TOTAL files in new storage: ${totalFiles}`);
  return totalFiles;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  // Validate env
  if (!OLD_SERVICE_KEY) {
    console.error('Missing env: OLD_SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!NEW_SERVICE_KEY) {
    console.error('Missing env: SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('Loading ID mappings...');
  const mappings = loadMappings();
  console.log(`Loaded ${mappings.size} mappings.`);

  // Check that all 8 old folders have mappings
  for (const folder of OLD_FOLDERS) {
    if (!mappings.has(folder)) {
      console.error(`FATAL: No mapping for storage folder ${folder}`);
      process.exit(1);
    } else {
      console.log(`  ${folder} => ${mappings.get(folder)}`);
    }
  }

  // Step 1: Update DB paths
  await updateImagePaths(mappings);

  // Step 2: Migrate files
  const uploaded = await migrateStorageFiles(mappings);

  // Step 3: Verify
  const verified = await verifyNewStorage(mappings);

  console.log('\n=== DONE ===');
  console.log(`Uploaded ${uploaded} files, verified ${verified} files in new storage.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

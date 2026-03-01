/**
 * Edge Function para deploy no LOVABLE CLOUD
 *
 * Esta função corre DENTRO do projecto Lovable, onde tem acesso automático
 * à service role key do Supabase antigo. Ela:
 * 1. Lista todos os ficheiros no bucket "invoices"
 * 2. Faz download de cada ficheiro
 * 3. Faz upload para o NOVO Supabase (dmprkdvkzzjtixlatnlx)
 *
 * Deploy: Criar esta função no Lovable via chat/editor
 * Invocar: POST /functions/v1/migrate-storage com header Authorization
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const NEW_SUPABASE_URL = "https://dmprkdvkzzjtixlatnlx.supabase.co";
const BUCKET = "invoices";

// 8 known user folders in old storage
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

Deno.serve(async (req) => {
  try {
    // Get the new service key from the request body
    const { new_service_key } = await req.json();
    if (!new_service_key) {
      return new Response(JSON.stringify({ error: "missing new_service_key in body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // OLD Supabase client (Lovable's auto-injected credentials)
    const oldUrl = Deno.env.get("SUPABASE_URL")!;
    const oldKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oldClient = createClient(oldUrl, oldKey);

    // Results tracking
    const results: { path: string; status: string; size?: number }[] = [];
    let success = 0;
    let failed = 0;

    for (const folder of OLD_FOLDERS) {
      // List files in root of folder
      const { data: rootFiles, error: rootErr } = await oldClient.storage
        .from(BUCKET)
        .list(folder, { limit: 500 });

      if (rootErr) {
        results.push({ path: folder, status: `list error: ${rootErr.message}` });
        continue;
      }

      // Collect all file paths (root + sales/ subfolder)
      const filePaths: string[] = [];

      for (const item of rootFiles || []) {
        if (item.id) {
          // It's a file
          filePaths.push(`${folder}/${item.name}`);
        } else {
          // It's a folder (likely "sales/") — list its contents
          const { data: subFiles } = await oldClient.storage
            .from(BUCKET)
            .list(`${folder}/${item.name}`, { limit: 500 });

          for (const subItem of subFiles || []) {
            if (subItem.id) {
              filePaths.push(`${folder}/${item.name}/${subItem.name}`);
            }
          }
        }
      }

      // Download each file and upload to new Supabase
      for (const filePath of filePaths) {
        try {
          // Download from old
          const { data: fileData, error: dlError } = await oldClient.storage
            .from(BUCKET)
            .download(filePath);

          if (dlError || !fileData) {
            results.push({ path: filePath, status: `download error: ${dlError?.message}` });
            failed++;
            continue;
          }

          // Upload to new via REST API (keeping SAME path — remapping done separately)
          const uploadUrl = `${NEW_SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(filePath)}`;
          const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${new_service_key}`,
              "Content-Type": fileData.type || "application/pdf",
              "x-upsert": "true",
            },
            body: fileData,
          });

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            results.push({ path: filePath, status: `upload error: ${uploadRes.status} ${errText}` });
            failed++;
          } else {
            results.push({ path: filePath, status: "ok", size: fileData.size });
            success++;
          }
        } catch (err) {
          results.push({ path: filePath, status: `error: ${err.message}` });
          failed++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        summary: { success, failed, total: success + failed },
        results,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

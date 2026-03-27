/**
 * try-vendas-sync.mjs — Try to sync vendas for Rafael and Maria
 * Tests both sync-efatura (SOAP) and sync-recibos-verdes (portal scraping)
 */
const SUPABASE_URL = 'https://dmprkdvkzzjtixlatnlx.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcHJrZHZrenpqdGl4bGF0bmx4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTQ0NDc1NiwiZXhwIjoyMDg3MDIwNzU2fQ.N1NlcwgzsJ7ZZ-xpN29Xvr79vUZMUaY5QZFWjZHNWIY';

const RAFAEL_ID = 'f1c74244-ccbc-4140-9224-9df9472a345c';
const MARIA_ID = '75e5b973-6b8f-47ba-a1bb-c6988eed86e1';

async function callEdgeFunction(functionName, body) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: resp.status, text: text.slice(0, 500), json };
}

async function main() {
  // 1. Try sync-efatura with correct param name
  console.log('=== sync-efatura for Rafael (compras) ===');
  const r1 = await callEdgeFunction('sync-efatura', {
    clientId: RAFAEL_ID,
    source: 'manual',
    force: true
  });
  console.log(`Status: ${r1.status}`);
  console.log(`Response: ${r1.text}`);

  // 2. Try sync-recibos-verdes for Rafael (vendas)
  console.log('\n=== sync-recibos-verdes for Rafael ===');
  const r2 = await callEdgeFunction('sync-recibos-verdes', {
    clientId: RAFAEL_ID,
    source: 'manual',
    force: true
  });
  console.log(`Status: ${r2.status}`);
  console.log(`Response: ${r2.text}`);

  // 3. Try sync-recibos-verdes for Maria
  console.log('\n=== sync-recibos-verdes for Maria ===');
  const r3 = await callEdgeFunction('sync-recibos-verdes', {
    clientId: MARIA_ID,
    source: 'manual',
    force: true
  });
  console.log(`Status: ${r3.status}`);
  console.log(`Response: ${r3.text}`);

  // 4. Check what edge functions exist for sales
  console.log('\n=== Check batch-classify-sales ===');
  const r4 = await callEdgeFunction('batch-classify-sales', {
    clientId: RAFAEL_ID,
  });
  console.log(`Status: ${r4.status}`);
  console.log(`Response: ${r4.text}`);

  // 5. Rafael: check how the 12 existing sales were created
  console.log('\n=== Rafael: source of existing 12 sales ===');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: rafSales } = await supabase.from('sales_invoices')
    .select('document_number, document_date, created_at, data_source, efatura_source')
    .eq('client_id', RAFAEL_ID)
    .order('created_at', { ascending: true })
    .limit(3);
  console.log('First 3 sales:');
  for (const s of rafSales || []) {
    console.log(`  ${s.document_number} | created:${s.created_at?.slice(0,10)} | source:${s.data_source || s.efatura_source || 'unknown'}`);
  }

  // 6. Check if there's a data_source or import_batch column
  const { data: sampleSale } = await supabase.from('sales_invoices')
    .select('*').eq('client_id', RAFAEL_ID).limit(1);
  if (sampleSale?.length) {
    const cols = Object.keys(sampleSale[0]);
    const sourceCols = cols.filter(c => c.includes('source') || c.includes('import') || c.includes('batch'));
    console.log('\nSource-related columns:', sourceCols.join(', '));
  }
}

main().catch(console.error);

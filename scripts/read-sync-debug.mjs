#!/usr/bin/env node
import { getSupabaseClient } from './_env.mjs';
const s = getSupabaseClient();
const id = process.argv[2] ?? '98cc667c-d5e8-4dfd-a70c-74ab29f6c50f';
const { data } = await s
  .from('at_sync_history')
  .select('id, start_date, end_date, status, reason_code, metadata')
  .eq('id', id)
  .single();
console.log(JSON.stringify(data, null, 2));

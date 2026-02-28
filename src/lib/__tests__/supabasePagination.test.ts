import { describe, it, expect } from 'vitest';
import { fetchAllByCursor, fetchAllPages } from '@/lib/supabasePagination';

interface Row {
  id: string;
  payment_date: string;
  value: number;
}

function buildRows(count: number): Row[] {
  const baseDate = new Date('2026-12-31T00:00:00Z');
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() - Math.floor(i / 10));
    return {
      id: String(count - i).padStart(6, '0'),
      payment_date: d.toISOString().slice(0, 10),
      value: i + 1,
    };
  });
}

describe('supabasePagination helpers', () => {
  it('fetchAllPages should retrieve more than 1000 rows', async () => {
    const rows = buildRows(3000);

    const result = await fetchAllPages<Row>(
      async (from, to) => ({
        data: rows.slice(from, to + 1),
        error: null,
      }),
      { pageSize: 1000 }
    );

    expect(result).toHaveLength(3000);
    expect(result[0].id).toBe(rows[0].id);
    expect(result[result.length - 1].id).toBe(rows[rows.length - 1].id);
  });

  it('fetchAllByCursor should retrieve more than 1000 rows using keyset pagination', async () => {
    const rows = buildRows(3000);

    const result = await fetchAllByCursor<Row>(
      async (cursor, pageSize) => {
        if (!cursor) {
          return { data: rows.slice(0, pageSize), error: null };
        }

        const idx = rows.findIndex(
          (r) => r.payment_date === cursor.payment_date && r.id === cursor.id
        );
        const start = idx >= 0 ? idx + 1 : rows.length;
        return { data: rows.slice(start, start + pageSize), error: null };
      },
      {
        pageSize: 750,
        getCursorKey: (row) => `${row.payment_date}|${row.id}`,
      }
    );

    expect(result).toHaveLength(3000);
    expect(result[0].id).toBe(rows[0].id);
    expect(result[result.length - 1].id).toBe(rows[rows.length - 1].id);
  });

  it('fetchAllByCursor should stop safely if backend repeats the same cursor page', async () => {
    const rows = buildRows(1200);
    let calls = 0;

    const result = await fetchAllByCursor<Row>(
      async (_cursor, pageSize) => {
        calls += 1;
        return { data: rows.slice(0, pageSize), error: null };
      },
      {
        pageSize: 1000,
        getCursorKey: (row) => `${row.payment_date}|${row.id}`,
      }
    );

    expect(calls).toBe(2);
    expect(result).toHaveLength(1000);
  });
});

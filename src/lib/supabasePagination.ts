import type { PostgrestError } from '@supabase/supabase-js';

type PageFetcher<T> = (
  from: number,
  to: number,
) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }> | PromiseLike<any>;

interface FetchAllPagesOptions {
  pageSize?: number;
}

/**
 * Fetches all rows from Supabase in pages to bypass the default 1000-row response cap.
 */
export async function fetchAllPages<T>(
  fetchPage: PageFetcher<T>,
  options: FetchAllPagesOptions = {},
): Promise<T[]> {
  const pageSize = Math.max(1, options.pageSize ?? 1000);
  const results: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await fetchPage(from, to);

    if (error) throw error;

    const page = data ?? [];
    if (page.length === 0) break;

    results.push(...page);

    if (page.length < pageSize) break;
    from += pageSize;
  }

  return results;
}

type CursorFetcher<T> = (
  cursor: T | null,
  pageSize: number,
) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }> | PromiseLike<any>;

interface FetchAllByCursorOptions<T> {
  pageSize?: number;
  maxPages?: number;
  getCursorKey?: (row: T) => string;
}

/**
 * Cursor-based pagination helper (keyset pagination).
 * Useful when offset/range pagination can hit platform row caps or become unstable on large tables.
 */
export async function fetchAllByCursor<T>(
  fetchPage: CursorFetcher<T>,
  options: FetchAllByCursorOptions<T> = {},
): Promise<T[]> {
  const pageSize = Math.max(1, options.pageSize ?? 1000);
  const maxPages = Math.max(1, options.maxPages ?? 100);
  const getCursorKey =
    options.getCursorKey ??
    ((row: T) => {
      const maybeId = (row as { id?: string }).id;
      return maybeId ?? JSON.stringify(row);
    });

  const results: T[] = [];
  let cursor: T | null = null;
  let lastCursorKey: string | null = null;
  let lastFirstRowKey: string | null = null;

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await fetchPage(cursor, pageSize);
    if (error) throw error;

    const chunk = data ?? [];
    if (chunk.length === 0) break;

    const firstRowKey = getCursorKey(chunk[0]);
    if (lastFirstRowKey && firstRowKey === lastFirstRowKey) {
      // Defensive break if backend repeats the same page window.
      break;
    }

    if (cursor) {
      const cursorKey = getCursorKey(cursor);
      if (firstRowKey === cursorKey) {
        // Backend returned the same page again; stop to avoid duplicate accumulation.
        break;
      }
    }

    results.push(...chunk);

    if (chunk.length < pageSize) break;

    const nextCursor = chunk[chunk.length - 1];
    const cursorKey = getCursorKey(nextCursor);
    if (cursorKey === lastCursorKey) {
      // Defensive break to avoid loops in case the backend returns a repeated page.
      break;
    }

    lastCursorKey = cursorKey;
    lastFirstRowKey = firstRowKey;
    cursor = nextCursor;
  }

  return results;
}

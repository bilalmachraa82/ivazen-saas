import { describe, expect, it } from 'vitest';

import { pickDuplicateKeepIndex } from '../duplicateResolution';

describe('duplicateResolution', () => {
  it('prefers the copy with a real uploaded file over an AT placeholder', () => {
    const keepIndex = pickDuplicateKeepIndex([
      {
        created_at: '2026-03-20T09:00:00.000Z',
        image_path: 'at-webservice/doc-1',
        status: 'validated',
        supplier_nif: '501234567',
      },
      {
        created_at: '2026-03-20T10:00:00.000Z',
        image_path: '550e8400-e29b-41d4-a716-446655440000/1710930000_fatura.pdf',
        status: 'pending',
        supplier_nif: '501234567',
      },
    ]);

    expect(keepIndex).toBe(1);
  });

  it('falls back to validated when neither copy has a real file', () => {
    const keepIndex = pickDuplicateKeepIndex([
      {
        created_at: '2026-03-20T09:00:00.000Z',
        image_path: 'at-webservice/doc-1',
        status: 'pending',
        supplier_nif: '501234567',
      },
      {
        created_at: '2026-03-20T10:00:00.000Z',
        image_path: 'at-webservice/doc-2',
        status: 'validated',
        supplier_nif: '501234567',
      },
    ]);

    expect(keepIndex).toBe(1);
  });

  it('falls back to the oldest record when scores tie', () => {
    const keepIndex = pickDuplicateKeepIndex([
      {
        created_at: '2026-03-20T09:00:00.000Z',
        status: 'pending',
        supplier_nif: '501234567',
      },
      {
        created_at: '2026-03-20T10:00:00.000Z',
        status: 'pending',
        supplier_nif: '501234567',
      },
    ]);

    expect(keepIndex).toBe(0);
  });
});

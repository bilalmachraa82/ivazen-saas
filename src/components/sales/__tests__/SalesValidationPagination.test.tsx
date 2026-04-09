import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SalesValidationPagination } from '../SalesValidationPagination';

describe('SalesValidationPagination', () => {
  it('renders the current page summary and item range', () => {
    const html = renderToStaticMarkup(
      <SalesValidationPagination
        page={2}
        totalPages={3}
        totalCount={123}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );

    expect(html).toContain('Pagina 3 de 3');
    expect(html).toContain('101-123 de 123');
  });

  it('renders nothing when there are no invoices', () => {
    const html = renderToStaticMarkup(
      <SalesValidationPagination
        page={0}
        totalPages={1}
        totalCount={0}
        pageSize={50}
        onPageChange={vi.fn()}
      />,
    );

    expect(html).toBe('');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { CheckCircle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { ZenEmptyState } from '../ZenEmptyState';

describe('ZenEmptyState', () => {
  it('renders safely when called with the success variant used by reconciliation flows', () => {
    expect(() =>
      renderToStaticMarkup(
        <ZenEmptyState
          icon={CheckCircle}
          title="Tudo reconciliado"
          description="Nao foram encontradas divergencias."
          variant={'success' as never}
        />,
      ),
    ).not.toThrow();
  });
});

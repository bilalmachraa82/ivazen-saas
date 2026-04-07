import { renderToStaticMarkup } from 'react-dom/server';
import { CheckCircle } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { ZenEmptyState } from '../ZenEmptyState';

describe('ZenEmptyState', () => {
  it('renders safely with the success variant', () => {
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

  it('renders safely with the warning variant', () => {
    expect(() =>
      renderToStaticMarkup(
        <ZenEmptyState
          icon={CheckCircle}
          title="Atenção"
          description="Existem itens que requerem revisao."
          variant={'warning' as never}
        />,
      ),
    ).not.toThrow();
  });

  it('falls back to default styles when an unknown variant is passed', () => {
    let html: string;
    expect(() => {
      html = renderToStaticMarkup(
        <ZenEmptyState
          icon={CheckCircle}
          title="Estado desconhecido"
          description="Variante nao reconhecida."
          variant={'nonexistent' as never}
        />,
      );
    }).not.toThrow();

    // Verify it rendered the default variant classes (from-muted)
    expect(html!).toContain('from-muted');
  });
});

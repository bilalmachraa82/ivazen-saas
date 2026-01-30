import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCategoryDescription,
  getLegalReference,
} from '../modelo10PdfGenerator';

// Mock jsPDF since we can't generate actual PDFs in tests
vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 210,
        getHeight: () => 297,
      },
    },
    setFillColor: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setDrawColor: vi.fn(),
    rect: vi.fn(),
    text: vi.fn(),
    line: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    getCurrentPageInfo: () => ({ pageNumber: 1 }),
  })),
}));

describe('Modelo 10 PDF Generator', () => {
  describe('getCategoryDescription', () => {
    it('deve retornar descrição correcta para categoria A', () => {
      expect(getCategoryDescription('A')).toBe('Trabalho Dependente');
    });

    it('deve retornar descrição correcta para categoria B', () => {
      expect(getCategoryDescription('B')).toBe('Empresarial/Profissional');
    });

    it('deve retornar descrição correcta para categoria E', () => {
      expect(getCategoryDescription('E')).toBe('Rendimentos de Capitais');
    });

    it('deve retornar descrição correcta para categoria F', () => {
      expect(getCategoryDescription('F')).toBe('Rendimentos Prediais');
    });

    it('deve retornar descrição correcta para categoria G', () => {
      expect(getCategoryDescription('G')).toBe('Incrementos Patrimoniais');
    });

    it('deve retornar descrição correcta para categoria H', () => {
      expect(getCategoryDescription('H')).toBe('Pensões');
    });

    it('deve retornar descrição correcta para categoria R', () => {
      expect(getCategoryDescription('R')).toBe('Retenções IRC');
    });

    it('deve retornar "Outro" para categoria desconhecida', () => {
      expect(getCategoryDescription('X')).toBe('Outro');
    });
  });

  describe('getLegalReference', () => {
    it('deve retornar referência legal correcta para categoria A', () => {
      expect(getLegalReference('A')).toBe('Art. 99º CIRS');
    });

    it('deve retornar referência legal correcta para categoria B', () => {
      expect(getLegalReference('B')).toBe('Art. 101º CIRS');
    });

    it('deve retornar referência legal correcta para categoria E', () => {
      expect(getLegalReference('E')).toBe('Art. 71º CIRS');
    });

    it('deve retornar referência legal correcta para categoria F', () => {
      expect(getLegalReference('F')).toBe('Art. 101º CIRS');
    });

    it('deve retornar referência legal correcta para categoria G', () => {
      expect(getLegalReference('G')).toBe('Art. 72º CIRS');
    });

    it('deve retornar referência legal correcta para categoria H', () => {
      expect(getLegalReference('H')).toBe('Art. 99º-A CIRS');
    });

    it('deve retornar referência legal correcta para categoria R', () => {
      expect(getLegalReference('R')).toBe('Art. 94º CIRC');
    });

    it('deve retornar referência padrão para categoria desconhecida', () => {
      expect(getLegalReference('X')).toBe('Art. 119º CIRS');
    });
  });

  describe('Categorias CIRS/CIRC', () => {
    const categories = ['A', 'B', 'E', 'F', 'G', 'H', 'R'];

    it('deve ter descrição para todas as categorias conhecidas', () => {
      categories.forEach(cat => {
        const desc = getCategoryDescription(cat);
        expect(desc).not.toBe('Outro');
      });
    });

    it('deve ter referência legal para todas as categorias conhecidas', () => {
      categories.forEach(cat => {
        const ref = getLegalReference(cat);
        expect(ref).toContain('Art.');
      });
    });

    it('categoria A (trabalho dependente) deve referenciar CIRS', () => {
      expect(getLegalReference('A')).toContain('CIRS');
    });

    it('categoria R (retenções IRC) deve referenciar CIRC', () => {
      expect(getLegalReference('R')).toContain('CIRC');
    });
  });
});

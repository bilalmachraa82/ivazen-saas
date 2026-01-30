/**
 * NIF Aggregator Tests
 * Tests for aggregating income and withholding records by NIF
 */

import { describe, it, expect } from 'vitest';
import {
  aggregateATRecords,
  mergeAggregations,
  toModelo10Format,
  generateAggregationReport,
} from '../nifAggregator';
import { ATReciboRecord } from '../atRecibosParser';

// Helper to create test records using name-based grouping
function createTestRecord(
  overrides: Partial<ATReciboRecord> = {}
): ATReciboRecord {
  return {
    id: `test-${Math.random()}`,
    referencia: 'REF-001',
    nif: '',  // Empty NIF - will use name grouping
    numContrato: 'C001',
    numRecibo: 'R001',
    nomeEmitente: 'Test Emitter',
    nomeCliente: 'Test Client',
    dataInicio: new Date('2025-01-15'),
    dataFim: new Date('2025-01-31'),
    valorBruto: 1000,
    retencao: 250,
    taxaRetencao: 0.25,
    valorLiquido: 750,
    categoria: 'B_INDEPENDENTES',
    linha: 1,
    ficheiro: 'test.xls',
    warnings: [],
    ...overrides,
  };
}

describe('nifAggregator', () => {
  describe('aggregateATRecords with name grouping', () => {
    it('should aggregate records by name when using agruparPorNome', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Joao Silva', valorBruto: 1000, retencao: 230 }),
        createTestRecord({ nomeEmitente: 'Joao Silva', valorBruto: 2000, retencao: 460 }),
        createTestRecord({ nomeEmitente: 'Maria Santos', valorBruto: 500, retencao: 115 }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });

      expect(result.success).toBe(true);
      expect(result.totalNIFs).toBe(2);
      expect(result.totalBruto).toBe(3500);
      expect(result.totalRetencao).toBe(805);
    });

    it('should filter by year', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test1', dataInicio: new Date('2025-01-15') }),
        createTestRecord({ nomeEmitente: 'Test2', dataInicio: new Date('2024-01-15') }),
      ];

      const result = aggregateATRecords(records, { ano: 2025, agruparPorNome: true });

      expect(result.totalNIFs).toBe(1);
    });

    it('should filter by category', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test1', categoria: 'B_INDEPENDENTES' }),
        createTestRecord({ nomeEmitente: 'Test2', categoria: 'F_PREDIAIS' }),
      ];

      const result = aggregateATRecords(records, { categoria: 'B_INDEPENDENTES', agruparPorNome: true });

      expect(result.totalNIFs).toBe(1);
      const first = Array.from(result.byNIF.values())[0];
      expect(first.categoria).toBe('B_INDEPENDENTES');
    });

    it('should filter by minimum value', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test1', valorBruto: 1000 }),
        createTestRecord({ nomeEmitente: 'Test2', valorBruto: 50 }),
      ];

      const result = aggregateATRecords(records, { minValor: 100, agruparPorNome: true });

      expect(result.totalNIFs).toBe(1);
      expect(result.totalBruto).toBe(1000);
    });

    it('should calculate average withholding rate', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test', valorBruto: 1000, retencao: 230 }), // 23%
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const first = Array.from(result.byNIF.values())[0];

      expect(first?.taxaMedia).toBeCloseTo(23, 0);
    });

    it('should track name variations', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nif: 'TEST001', nomeEmitente: 'João Silva' }),
        createTestRecord({ nif: 'TEST001', nomeEmitente: 'Joao Silva' }),
        createTestRecord({ nif: 'TEST001', nomeEmitente: 'João Silva' }),
      ];

      // Using incluirSemNIF to keep invalid NIFs
      const result = aggregateATRecords(records, { incluirSemNIF: true });
      const first = Array.from(result.byNIF.values())[0];

      expect(first?.nomes.length).toBe(2);
      expect(first?.avisos.length).toBeGreaterThan(0);
    });

    it('should track date range', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({
          nomeEmitente: 'Test',
          dataInicio: new Date('2025-03-01'),
          dataFim: new Date('2025-03-31'),
        }),
        createTestRecord({
          nomeEmitente: 'Test',
          dataInicio: new Date('2025-01-01'),
          dataFim: new Date('2025-01-31'),
        }),
        createTestRecord({
          nomeEmitente: 'Test',
          dataInicio: new Date('2025-06-01'),
          dataFim: new Date('2025-06-30'),
        }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const first = Array.from(result.byNIF.values())[0];

      expect(first?.primeiroDocumento.getMonth()).toBe(0); // January
      expect(first?.ultimoDocumento.getMonth()).toBe(5); // June
    });

    it('should track source files', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test', ficheiro: 'file1.xls' }),
        createTestRecord({ nomeEmitente: 'Test', ficheiro: 'file2.xls' }),
        createTestRecord({ nomeEmitente: 'Test', ficheiro: 'file1.xls' }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const first = Array.from(result.byNIF.values())[0];

      expect(first?.fontes.length).toBe(2);
      expect(first?.fontes).toContain('file1.xls');
      expect(first?.fontes).toContain('file2.xls');
    });

    it('should group by category totals', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test1', categoria: 'B_INDEPENDENTES', valorBruto: 1000 }),
        createTestRecord({ nomeEmitente: 'Test1', categoria: 'B_INDEPENDENTES', valorBruto: 2000 }),
        createTestRecord({ nomeEmitente: 'Test2', categoria: 'F_PREDIAIS', valorBruto: 500 }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });

      expect(result.byCategoria.size).toBe(2);
      expect(result.byCategoria.get('B_INDEPENDENTES')?.totalBruto).toBe(3000);
      expect(result.byCategoria.get('F_PREDIAIS')?.totalBruto).toBe(500);
    });

    it('should skip records without NIF when incluirSemNIF is false', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nif: 'TEST001', valorBruto: 1000 }),
        createTestRecord({ nif: '', valorBruto: 500 }),
      ];

      // This will skip both since TEST001 is invalid and '' is empty
      const result = aggregateATRecords(records, { incluirSemNIF: false });

      expect(result.totalNIFs).toBe(0);
    });
  });

  describe('mergeAggregations', () => {
    it('should merge multiple aggregation results', () => {
      const result1 = aggregateATRecords([
        createTestRecord({ nomeEmitente: 'Test1', valorBruto: 1000, retencao: 230 }),
      ], { agruparPorNome: true });

      const result2 = aggregateATRecords([
        createTestRecord({ nomeEmitente: 'Test1', valorBruto: 2000, retencao: 460 }),
        createTestRecord({ nomeEmitente: 'Test2', valorBruto: 500, retencao: 115 }),
      ], { agruparPorNome: true });

      const merged = mergeAggregations([result1, result2]);

      expect(merged.totalNIFs).toBe(2);
      expect(merged.totalBruto).toBe(3500);
    });

    it('should merge sources correctly', () => {
      const result1 = aggregateATRecords([
        createTestRecord({ nomeEmitente: 'Test', ficheiro: 'file1.xls' }),
      ], { agruparPorNome: true });

      const result2 = aggregateATRecords([
        createTestRecord({ nomeEmitente: 'Test', ficheiro: 'file2.xls' }),
      ], { agruparPorNome: true });

      const merged = mergeAggregations([result1, result2]);
      const first = Array.from(merged.byNIF.values())[0];

      expect(first?.fontes.length).toBe(2);
    });
  });

  describe('toModelo10Format', () => {
    it('should skip entries without valid NIF in name-based aggregation', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nif: '', nomeEmitente: 'Test' }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const modelo10 = toModelo10Format(result);

      // Name-based entries don't have valid NIFs for Modelo 10
      expect(modelo10.length).toBe(0);
    });
  });

  describe('generateAggregationReport', () => {
    it('should generate a text report', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({
          nomeEmitente: 'João Silva',
          valorBruto: 10000,
          retencao: 2300,
        }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const report = generateAggregationReport(result);

      expect(report).toContain('RELATÓRIO DE AGREGAÇÃO POR NIF');
      expect(report).toContain('João Silva');
    });

    it('should include category breakdown', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test1', categoria: 'B_INDEPENDENTES' }),
        createTestRecord({ nomeEmitente: 'Test2', categoria: 'F_PREDIAIS' }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const report = generateAggregationReport(result);

      expect(report).toContain('POR CATEGORIA');
      expect(result.byCategoria.size).toBe(2);
    });

    it('should include warnings for name variations', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nif: 'TEST', nomeEmitente: 'Name 1' }),
        createTestRecord({ nif: 'TEST', nomeEmitente: 'Name 2' }),
      ];

      const result = aggregateATRecords(records, { incluirSemNIF: true });
      const first = Array.from(result.byNIF.values())[0];

      // Multiple name variations should trigger a warning
      expect(first?.avisos.some(a => a.includes('Múltiplas'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty records array', () => {
      const result = aggregateATRecords([]);

      expect(result.success).toBe(true);
      expect(result.totalNIFs).toBe(0);
      expect(result.totalBruto).toBe(0);
    });

    it('should handle records with zero values', () => {
      const records: ATReciboRecord[] = [
        createTestRecord({ nomeEmitente: 'Test', valorBruto: 0, retencao: 0 }),
      ];

      const result = aggregateATRecords(records, { agruparPorNome: true });

      expect(result.totalBruto).toBe(0);
    });

    it('should calculate totals correctly with many records', () => {
      const records: ATReciboRecord[] = [];
      for (let i = 0; i < 100; i++) {
        records.push(createTestRecord({
          nomeEmitente: 'Test',
          valorBruto: 100,
          retencao: 23,
        }));
      }

      const result = aggregateATRecords(records, { agruparPorNome: true });
      const first = Array.from(result.byNIF.values())[0];

      expect(first?.totalBruto).toBe(10000);
      expect(first?.totalRetencao).toBe(2300);
      expect(first?.numDocumentos).toBe(100);
    });
  });
});

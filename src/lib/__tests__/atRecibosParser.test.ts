import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseATExcel,
  ATParseResult,
  ATCategoria,
  convertToModelo10Format,
  formatCurrency,
  getCategoriaDisplayName,
  TAXAS_RETENCAO,
} from '../atRecibosParser';

/**
 * Testes do Parser de Recibos AT (ListaRecibos.xls)
 *
 * Para testar com dados reais:
 * 1. Coloque o ficheiro ListaRecibos.xls em src/lib/__tests__/fixtures/
 * 2. Execute: npx vitest src/lib/__tests__/atRecibosParser.test.ts
 */

// Helper to create a mock Excel file
function createMockExcelFile(data: Record<string, any>[], filename = 'test.xlsx'): File {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new File([buffer], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

describe('AT Recibos Parser', () => {

  describe('Taxas de Retenção (OE2026)', () => {
    it('deve ter taxa de 23% para trabalho independente (Cat. B) - OE2026', () => {
      expect(TAXAS_RETENCAO['B_INDEPENDENTES']).toBe(0.23);
    });

    it('deve ter taxa de 25% para rendimentos prediais habitacionais (Cat. F)', () => {
      expect(TAXAS_RETENCAO['F_PREDIAIS']).toBe(0.25);
    });

    it('deve ter taxa de 28% para capitais (Cat. E)', () => {
      expect(TAXAS_RETENCAO['E_CAPITAIS']).toBe(0.28);
    });
  });

  describe('Formatação', () => {
    it('deve formatar valores em euros', () => {
      const formatted = formatCurrency(1234.56);
      expect(formatted).toContain('1');
      expect(formatted).toContain('234');
      expect(formatted).toContain('€');
    });

    it('deve retornar nome correto para categoria B', () => {
      expect(getCategoriaDisplayName('B_INDEPENDENTES')).toBe('B. Trabalho Independente');
    });

    it('deve retornar nome correto para categoria F', () => {
      expect(getCategoriaDisplayName('F_PREDIAIS')).toBe('F. Rendimentos Prediais');
    });
  });

  describe('Parse de Excel - Formato AT', () => {
    it('deve processar Excel com formato ListaRecibos', async () => {
      // Simula formato do Portal das Finanças
      const mockData = [
        {
          'Referência': '278137784',
          'Nº de Contrato': '448126',
          'Nº do Recibo': '137',
          'Locador': 'VASCO ANTONIO SEVERINO CARVALHO',
          'Locatário': 'YOUR AV SUPPLIER LDA',
          'Data de Início': '2025-01-01',
          'Data de Fim': '2025-01-31',
          'Valor': '450.00',
        },
        {
          'Referência': '278137784',
          'Nº de Contrato': '448126',
          'Nº do Recibo': '136',
          'Locador': 'VASCO ANTONIO SEVERINO CARVALHO',
          'Locatário': 'YOUR AV SUPPLIER LDA',
          'Data de Início': '2025-02-01',
          'Data de Fim': '2025-02-28',
          'Valor': '450.00',
        },
        {
          'Referência': '123456780',
          'Nº de Contrato': '123456',
          'Nº do Recibo': '001',
          'Locador': 'OUTRO PRESTADOR',
          'Locatário': 'CLIENTE XYZ',
          'Data de Início': '2025-03-01',
          'Data de Fim': '2025-03-31',
          'Valor': '1000.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'ListaRecibos.xlsx');
      const result = await parseATExcel(file, { categoria: 'B_INDEPENDENTES' });

      expect(result.success).toBe(true);
      expect(result.records.length).toBe(3);
      expect(result.summary.totalRecords).toBe(3);
    });

    it('deve agrupar por NIF corretamente', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Nº do Recibo': '1',
          'Locador': 'PRESTADOR A',
          'Data de Início': '2025-01-01',
          'Valor': '100.00',
        },
        {
          'Referência': '278137784',
          'Nº do Recibo': '2',
          'Locador': 'PRESTADOR A',
          'Data de Início': '2025-02-01',
          'Valor': '200.00',
        },
        {
          'Referência': '123456780',
          'Nº do Recibo': '1',
          'Locador': 'PRESTADOR B',
          'Data de Início': '2025-01-01',
          'Valor': '500.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file, { categoria: 'B_INDEPENDENTES' });

      expect(result.success).toBe(true);

      // Deve ter 2 NIFs únicos
      expect(result.summary.byNIF.size).toBe(2);

      // Verificar totais por NIF
      const nif278 = result.summary.byNIF.get('278137784');
      expect(nif278).toBeDefined();
      expect(nif278?.totalBruto).toBe(300); // 100 + 200
      expect(nif278?.numRecibos).toBe(2);

      const nif123 = result.summary.byNIF.get('123456780');
      expect(nif123).toBeDefined();
      expect(nif123?.totalBruto).toBe(500);
      expect(nif123?.numRecibos).toBe(1);
    });

    it('deve calcular retenção de 25% automaticamente', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Nº do Recibo': '1',
          'Locador': 'PRESTADOR',
          'Data de Início': '2025-01-01',
          'Valor': '1000.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file, {
        categoria: 'B_INDEPENDENTES',
        taxaRetencao: 0.25
      });

      expect(result.success).toBe(true);
      expect(result.records[0].valorBruto).toBe(1000);
      expect(result.records[0].retencao).toBe(250); // 25% de 1000
      expect(result.records[0].valorLiquido).toBe(750); // 1000 - 250
    });

    it('deve detectar tipo de ficheiro Rendas', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Nº do Recibo': '1',
          'Locador': 'SENHORIO',
          'Locatário': 'INQUILINO',
          'Data de Início': '2025-01-01',
          'Valor': '1000.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'ListaRecibos-Renda.xlsx');
      const result = await parseATExcel(file);

      expect(result.fileType).toBe('rendas');
    });

    it('deve detectar tipo de ficheiro Recibos Verdes', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Nº do Recibo': '1',
          'Emitente': 'PRESTADOR',
          'Data de Início': '2025-01-01',
          'Valor': '1000.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'ListaRecibos.xlsx');
      const result = await parseATExcel(file);

      expect(result.fileType).toBe('recibos_verdes');
    });
  });

  describe('Conversão para Modelo 10', () => {
    it('deve converter para formato Modelo 10 corretamente', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Nº do Recibo': '1',
          'Locador': 'VASCO CARVALHO',
          'Data de Início': '2025-01-01',
          'Valor': '450.00',
        },
        {
          'Referência': '278137784',
          'Nº do Recibo': '2',
          'Locador': 'VASCO CARVALHO',
          'Data de Início': '2025-02-01',
          'Valor': '450.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file, { categoria: 'B_INDEPENDENTES' });

      const modelo10Data = convertToModelo10Format(result.summary, 2025);

      expect(modelo10Data.length).toBe(1); // 1 NIF único
      expect(modelo10Data[0].beneficiary_nif).toBe('278137784');
      expect(modelo10Data[0].beneficiary_name).toBe('VASCO CARVALHO');
      expect(modelo10Data[0].income_category).toBe('B');
      expect(modelo10Data[0].gross_amount).toBe(900); // 450 + 450
      expect(modelo10Data[0].withholding_amount).toBe(207); // 23% de 900 (OE2026)
      expect(modelo10Data[0].fiscal_region).toBe('C'); // Continental
    });
  });

  describe('Validação de NIF', () => {
    it('deve extrair NIF de 9 dígitos', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].nif).toBe('278137784');
    });

    it('deve lidar com formato de referência XXXX-X', async () => {
      const mockData = [
        {
          'Referência': '1633-8',
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      // Deve gerar warning sobre NIF incompleto
      expect(result.records[0].warnings.length).toBeGreaterThan(0);
    });

    it('deve ignorar linhas sem dados válidos', async () => {
      const mockData = [
        {
          'Referência': '',
          'Valor': '',
        },
        {
          'Referência': '278137784',
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records.length).toBe(1);
    });
  });

  describe('Parse de Datas', () => {
    it('deve processar data ISO (YYYY-MM-DD)', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Data de Início': '2025-06-15',
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].dataInicio.getFullYear()).toBe(2025);
      expect(result.records[0].dataInicio.getMonth()).toBe(5); // Junho (0-indexed)
      expect(result.records[0].dataInicio.getDate()).toBe(15);
    });

    it('deve processar data portuguesa (DD-MM-YYYY)', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Data de Início': '15-06-2025',
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].dataInicio.getFullYear()).toBe(2025);
      expect(result.records[0].dataInicio.getMonth()).toBe(5);
    });
  });

  describe('Parse de Valores', () => {
    it('deve processar valores com vírgula decimal', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Valor': '1.234,56',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].valorBruto).toBe(1234.56);
    });

    it('deve processar valores com ponto decimal', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Valor': '1234.56',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].valorBruto).toBe(1234.56);
    });

    it('deve processar valores com símbolo de euro', async () => {
      const mockData = [
        {
          'Referência': '278137784',
          'Valor': '€ 1234,56',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      expect(result.records[0].valorBruto).toBe(1234.56);
    });
  });

  describe('Erros e Warnings', () => {
    it('deve retornar erro para ficheiro vazio', async () => {
      const mockData: Record<string, any>[] = [];
      const file = createMockExcelFile(mockData, 'empty.xlsx');
      const result = await parseATExcel(file);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('deve gerar warning para NIF inválido', async () => {
      const mockData = [
        {
          'Referência': '000000000', // NIF inválido (só zeros)
          'Valor': '100.00',
        },
      ];

      const file = createMockExcelFile(mockData, 'test.xlsx');
      const result = await parseATExcel(file);

      // Deve ter warnings sobre NIF inválido
      expect(result.warnings.some(w => w.toLowerCase().includes('nif'))).toBe(true);
    });
  });
});

/**
 * Teste com ficheiro real (descomentado quando tiver o ficheiro)
 *
 * Para usar:
 * 1. Crie pasta: mkdir -p src/lib/__tests__/fixtures
 * 2. Coloque o ListaRecibos.xls nessa pasta
 * 3. Descomente o teste abaixo
 * 4. Execute: npx vitest src/lib/__tests__/atRecibosParser.test.ts
 */
/*
describe('Teste com ficheiro real da Adélia', () => {
  it('deve processar ListaRecibos.xls real', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const fixturePath = path.join(__dirname, 'fixtures', 'ListaRecibos.xls');

    if (!fs.existsSync(fixturePath)) {
      console.log('⚠️ Ficheiro de teste não encontrado:', fixturePath);
      console.log('   Coloque o ListaRecibos.xls em src/lib/__tests__/fixtures/');
      return;
    }

    const buffer = fs.readFileSync(fixturePath);
    const file = new File([buffer], 'ListaRecibos.xls', {
      type: 'application/vnd.ms-excel'
    });

    const result = await parseATExcel(file, { categoria: 'B_INDEPENDENTES' });

    console.log('\n=== RESULTADO DO PARSE ===');
    console.log('Sucesso:', result.success);
    console.log('Total registos:', result.records.length);
    console.log('Tipo ficheiro:', result.fileType);
    console.log('Erros:', result.errors);
    console.log('Warnings:', result.warnings.slice(0, 5));

    console.log('\n=== RESUMO POR NIF ===');
    for (const [nif, data] of result.summary.byNIF) {
      console.log(`NIF ${nif}: ${data.nome}`);
      console.log(`  - Recibos: ${data.numRecibos}`);
      console.log(`  - Bruto: ${formatCurrency(data.totalBruto)}`);
      console.log(`  - Retenção: ${formatCurrency(data.totalRetencao)}`);
    }

    expect(result.success).toBe(true);
  });
});
*/

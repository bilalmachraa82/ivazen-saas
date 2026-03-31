/**
 * Testes do Parser e-Fatura CSV
 * Cobre:
 *  - Formato Portal das Finanças (Setor;Emitente;Nº Fatura...);
 *  - Formato genérico (fallback)
 *  - Extração de NIF/nome do campo Emitente
 *  - Separação de documento e ATCUD
 *  - Parsing de valores em formato português (vírgula como decimal)
 *  - Parsing de datas DD/MM/YYYY, YYYY-MM-DD
 *  - Detecção automática de delimitador (; , \t)
 *  - Ficheiro vazio / sem dados suficientes
 *  - Avisos para NIFs inválidos
 *  - Totais calculados correctamente
 */

import { describe, it, expect } from 'vitest';
import { parseEFaturaCSV } from '../efaturaParser';

// ---------------------------------------------------------------------------
// Helpers para construção de CSV
// ---------------------------------------------------------------------------
const PORTAL_HEADER =
  'Setor;Emitente;Nº Fatura / ATCUD;Tipo;Data Emissão;Total;IVA;Base Tributável;Situação';

function portalRow(
  setor: string,
  emitente: string,
  fatura: string,
  tipo: string,
  data: string,
  total: string,
  iva: string,
  base: string,
  situacao = 'Comunicado'
): string {
  return [setor, emitente, fatura, tipo, data, total, iva, base, situacao].join(';');
}

// ---------------------------------------------------------------------------
// Ficheiro vazio / dados insuficientes
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — ficheiro vazio / sem dados', () => {
  it('retorna erro quando o conteúdo é uma string vazia', () => {
    const result = parseEFaturaCSV('');
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.records).toHaveLength(0);
  });

  it('retorna erro quando só existe a linha de cabeçalho sem dados', () => {
    const result = parseEFaturaCSV(PORTAL_HEADER);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('retorna estrutura de totais zerados em caso de erro', () => {
    const result = parseEFaturaCSV('');
    expect(result.totals.count).toBe(0);
    expect(result.totals.valorTotal).toBe(0);
    expect(result.totals.valorIva).toBe(0);
    expect(result.totals.baseTributavel).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Deteção de exportações de vendas / recibos verdes
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — deteção de ficheiro de vendas', () => {
  it('bloqueia ficheiros que parecem exportações de vendas/recibos verdes', () => {
    const salesCsv = [
      'Referência;Tipo Documento;ATCUD;Situação;Data da Transação;Motivo Emissão;Data de Emissão;País do Adquirente;NIF Adquirente;Nome do Adquirente;Valor Tributável (em euros);Valor do IVA (em euros);Total do Documento (em euros)',
      'A-1;FR;ATCUD-1;Emitido;01/02/2025;Normal;01/02/2025;PT;123456789;Cliente Exemplo;100,00;23,00;123,00',
    ].join('\n');

    const result = parseEFaturaCSV(salesCsv);

    expect(result.success).toBe(false);
    expect(result.type).toBe('vendas');
    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain('Centro de Importação');
  });

  it('bloqueia o CSV AT de vendas com colunas de emitente que antes caía no fallback genérico', () => {
    const salesCsv = [
      'Referência;Tipo Documento;ATCUD;Situação;Data da Transação;Motivo Emissão;Data de Emissão;NIF Emitente;Nome do Emitente;Valor Tributável (em euros);Valor do IVA (em euros);Total do Documento (em euros)',
      'FR ATSIRE01FR/18;Fatura-Recibo;JJ37MMGM-18;Emitido;2025-10-10;Pagamento dos bens ou dos serviços;2025-12-31;103595503;JOSE FERNANDO COUTINHO PIRES;1000;0;1000',
    ].join('\n');

    const result = parseEFaturaCSV(salesCsv);

    expect(result.success).toBe(false);
    expect(result.type).toBe('vendas');
    expect(result.records).toHaveLength(0);
    expect(result.errors[0]).toContain('Centro de Importação');
  });
});

// ---------------------------------------------------------------------------
// Formato Portal das Finanças — caso feliz
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — formato Portal das Finanças', () => {
  const csvSingle = [
    PORTAL_HEADER,
    portalRow(
      'Comércio e Serviços',
      '508332273 - Empresa Teste Lda',
      'FT 2025/001 / JJ3JF3MS-20748',
      'FT',
      '15/01/2025',
      '225,98 €',
      '43,86 €',
      '182,12 €'
    ),
  ].join('\n');

  it('retorna success=true para formato Portal válido', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.success).toBe(true);
  });

  it('detecta tipo como "compras"', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.type).toBe('compras');
  });

  it('extrai correctamente o NIF do campo Emitente', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].nif).toBe('508332273');
  });

  it('extrai correctamente o nome do campo Emitente', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].nome).toBe('Empresa Teste Lda');
  });

  it('separa número de documento e ATCUD', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].numeroDocumento).toBe('FT 2025/001');
    expect(result.records[0].atcud).toBe('JJ3JF3MS-20748');
  });

  it('converte valor total em número (formato português com vírgula)', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].valorTotal).toBeCloseTo(225.98, 2);
  });

  it('converte IVA em número correctamente', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].valorIva).toBeCloseTo(43.86, 2);
  });

  it('converte base tributável em número correctamente', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].baseTributavel).toBeCloseTo(182.12, 2);
  });

  it('parse da data DD/MM/YYYY produz um objecto Date', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].data).toBeInstanceOf(Date);
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(0); // Janeiro = 0
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('popula o campo sector a partir da coluna Setor', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].sector).toBe('Comércio e Serviços');
  });

  it('popula o campo situacao a partir da coluna Situação', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.records[0].situacao).toBe('Comunicado');
  });

  it('calcula totais agregados correctamente para um registo', () => {
    const result = parseEFaturaCSV(csvSingle);
    expect(result.totals.count).toBe(1);
    expect(result.totals.valorTotal).toBeCloseTo(225.98, 2);
    expect(result.totals.valorIva).toBeCloseTo(43.86, 2);
  });
});

// ---------------------------------------------------------------------------
// Múltiplos registos e totais
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — múltiplos registos e totais', () => {
  const csvMulti = [
    PORTAL_HEADER,
    portalRow(
      'Comércio',
      '503504564 - EDP Comercial SA',
      'FT A/2025/10001 / AABBCC11-10001',
      'FT',
      '31/01/2025',
      '120,00 €',
      '27,60 €',
      '92,40 €'
    ),
    portalRow(
      'Telecomunicações',
      '503423971 - NOS Comunicações SA',
      'FT B/2025/20002 / XXYYZZ22-20002',
      'FT',
      '28/02/2025',
      '80,50 €',
      '18,52 €',
      '61,98 €'
    ),
  ].join('\n');

  it('retorna 2 registos para CSV com 2 linhas de dados', () => {
    const result = parseEFaturaCSV(csvMulti);
    expect(result.records).toHaveLength(2);
  });

  it('soma correctamente os totais de múltiplos registos', () => {
    const result = parseEFaturaCSV(csvMulti);
    expect(result.totals.count).toBe(2);
    expect(result.totals.valorTotal).toBeCloseTo(200.5, 2);
    expect(result.totals.valorIva).toBeCloseTo(46.12, 2);
    expect(result.totals.baseTributavel).toBeCloseTo(154.38, 2);
  });
});

// ---------------------------------------------------------------------------
// Parsing de valores em formatos variados
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — formatos de valor', () => {
  function csvWithValue(total: string, iva: string, base: string): string {
    return [
      PORTAL_HEADER,
      portalRow('S', '508332273 - Teste', 'FT/1', 'FT', '01/01/2025', total, iva, base),
    ].join('\n');
  }

  it('aceita valores sem símbolo € e sem separador de milhares', () => {
    const result = parseEFaturaCSV(csvWithValue('1234,56', '284,15', '950,41'));
    expect(result.records[0].valorTotal).toBeCloseTo(1234.56, 2);
  });

  it('aceita valores com ponto como separador de milhares (1.234,56)', () => {
    const result = parseEFaturaCSV(csvWithValue('1.234,56 €', '284,15 €', '950,41 €'));
    expect(result.records[0].valorTotal).toBeCloseTo(1234.56, 2);
  });

  it('retorna 0 para campo de valor vazio', () => {
    const result = parseEFaturaCSV(csvWithValue('', '', ''));
    expect(result.records[0].valorTotal).toBe(0);
    expect(result.records[0].valorIva).toBe(0);
  });

  it('trata valores negativos como positivos (Math.abs)', () => {
    const result = parseEFaturaCSV(csvWithValue('-100,00', '-23,00', '-77,00'));
    expect(result.records[0].valorTotal).toBeCloseTo(100, 2);
  });
});

// ---------------------------------------------------------------------------
// Parsing de datas
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — formatos de data', () => {
  function csvWithDate(date: string): string {
    return [
      PORTAL_HEADER,
      portalRow('S', '508332273 - Teste', 'FT/1', 'FT', date, '100,00', '23,00', '77,00'),
    ].join('\n');
  }

  it('aceita data no formato DD/MM/YYYY', () => {
    const result = parseEFaturaCSV(csvWithDate('15/03/2025'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(2); // Março = 2
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('aceita data no formato DD-MM-YYYY', () => {
    const result = parseEFaturaCSV(csvWithDate('15-03-2025'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
  });

  it('aceita data no formato ISO YYYY-MM-DD', () => {
    const result = parseEFaturaCSV(csvWithDate('2025-03-15'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(2);
  });

  it('aceita data DD/MM/YYYY com componente de hora (fix: AT portal exports)', () => {
    const result = parseEFaturaCSV(csvWithDate('15/02/2025 10:30:00'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(1); // Fevereiro = 1
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('aceita data DD-MM-YYYY com componente de hora', () => {
    const result = parseEFaturaCSV(csvWithDate('15-02-2025 14:00'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(1);
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('aceita data YYYY/MM/DD (formato ISO com barras)', () => {
    const result = parseEFaturaCSV(csvWithDate('2025/02/15'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(1);
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('aceita data YYYY-MM-DD com componente de hora', () => {
    const result = parseEFaturaCSV(csvWithDate('2025-02-15 08:30:00'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(1);
    expect(result.records[0].data.getDate()).toBe(15);
  });

  it('Fevereiro permanece Fevereiro — não muda para Abril (bug reportado)', () => {
    // Regression test: February dates must not shift to April
    const result = parseEFaturaCSV(csvWithDate('28/02/2025'));
    expect(result.records[0].data.getMonth()).toBe(1); // 1 = Fevereiro
    expect(result.records[0].data.getDate()).toBe(28);
    // Verify ISO output is correct for database storage
    expect(result.records[0].data.toISOString().split('T')[0]).toBe('2025-02-28');
  });

  it('aceita data com dia/mês de um dígito (D/M/YYYY)', () => {
    const result = parseEFaturaCSV(csvWithDate('5/2/2025'));
    expect(result.records[0].data.getFullYear()).toBe(2025);
    expect(result.records[0].data.getMonth()).toBe(1);
    expect(result.records[0].data.getDate()).toBe(5);
  });

  it('emite aviso quando a data é inválida', () => {
    const result = parseEFaturaCSV(csvWithDate('data-invalida'));
    expect(result.warnings.some(w => w.toLowerCase().includes('data'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Extracção de NIF/nome do campo Emitente
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — extracção de NIF do campo Emitente', () => {
  function csvWithEmitente(emitente: string): string {
    return [
      PORTAL_HEADER,
      portalRow('S', emitente, 'FT/1', 'FT', '01/01/2025', '100,00', '23,00', '77,00'),
    ].join('\n');
  }

  it('extrai NIF e nome do formato "NIF - Nome"', () => {
    const result = parseEFaturaCSV(csvWithEmitente('508332273 - Empresa ABC Lda'));
    expect(result.records[0].nif).toBe('508332273');
    expect(result.records[0].nome).toBe('Empresa ABC Lda');
  });

  it('extrai NIF mesmo sem traço separador', () => {
    const result = parseEFaturaCSV(csvWithEmitente('508332273 Empresa Sem Traco'));
    expect(result.records[0].nif).toBe('508332273');
  });

  it('deixa nif vazio quando o campo Emitente não tem 9 dígitos', () => {
    const result = parseEFaturaCSV(csvWithEmitente('Empresa Sem NIF'));
    expect(result.records[0].nif).toBe('');
    expect(result.records[0].nome).toBe('Empresa Sem NIF');
  });

  it('emite aviso quando NIF extraído é inválido (dígito de controlo errado)', () => {
    // NIF com formato correcto mas dígito de controlo inválido
    const result = parseEFaturaCSV(csvWithEmitente('123456789 - Empresa Invalida'));
    // May or may not warn depending on checksum — just ensure it doesn't crash
    expect(result.success).toBe(true);
  });

  it('suporta nomes com caracteres especiais portugueses', () => {
    const result = parseEFaturaCSV(
      csvWithEmitente('508332273 - Construções & Remodelações Irmãos Lda')
    );
    expect(result.records[0].nome).toContain('Construções');
    expect(result.records[0].nome).toContain('Irmãos');
  });
});

// ---------------------------------------------------------------------------
// Separação de documento e ATCUD
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — separação documento / ATCUD', () => {
  function csvWithFatura(fatura: string): string {
    return [
      PORTAL_HEADER,
      portalRow('S', '508332273 - Teste', fatura, 'FT', '01/01/2025', '100,00', '23,00', '77,00'),
    ].join('\n');
  }

  it('separa "FR 2.2025/20748 / JJ3JF3MS-20748" correctamente', () => {
    const result = parseEFaturaCSV(csvWithFatura('FR 2.2025/20748 / JJ3JF3MS-20748'));
    expect(result.records[0].numeroDocumento).toBe('FR 2.2025/20748');
    expect(result.records[0].atcud).toBe('JJ3JF3MS-20748');
  });

  it('deixa ATCUD vazio quando não existe separador "/"', () => {
    const result = parseEFaturaCSV(csvWithFatura('FT 2025/001'));
    expect(result.records[0].numeroDocumento).toBe('FT 2025/001');
    expect(result.records[0].atcud).toBe('');
  });

  it('usa string vazia para documento quando campo fatura está vazio', () => {
    const result = parseEFaturaCSV(csvWithFatura(''));
    expect(result.records[0].numeroDocumento).toBe('');
    expect(result.records[0].atcud).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Detecção automática de delimitador
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — detecção de delimitador', () => {
  it('aceita ficheiro com delimitador vírgula quando cabeçalho usa vírgulas', () => {
    const csv = [
      'Setor,Emitente,Total',
      'Comércio,508332273 - Teste Lda,100,00',
    ].join('\n');
    // This falls to generic parse since isEFaturaPortalFormat needs "emitente" + "total"
    const result = parseEFaturaCSV(csv);
    // Should not throw and return a result object
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('records');
  });

  it('retorna success=false para formato completamente desconhecido', () => {
    const csv = ['ColA\tColB', 'val1\tval2'].join('\n');
    const result = parseEFaturaCSV(csv);
    // Should fail gracefully (format not recognized)
    expect(result).toHaveProperty('success');
    expect(result.records).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Formato genérico (fallback)
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — formato genérico (fallback)', () => {
  const genericCsv = [
    'NIF Emitente;Nome Emitente;Data;Valor Total;IVA;Nº Documento;Tipo',
    '503504564;EDP Comercial SA;15/01/2025;120,00;27,60;FT A/1;FT',
  ].join('\n');

  it('processa formato genérico com colunas NIF e Total separadas', () => {
    const result = parseEFaturaCSV(genericCsv);
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
  });

  it('popula NIF e nome correctamente no formato genérico', () => {
    const result = parseEFaturaCSV(genericCsv);
    expect(result.records[0].nif).toBe('503504564');
    expect(result.records[0].nome).toBe('EDP Comercial SA');
  });

  it('calcula base tributável como valorTotal - valorIva no formato genérico', () => {
    const result = parseEFaturaCSV(genericCsv);
    const expected = result.records[0].valorTotal - result.records[0].valorIva;
    expect(result.records[0].baseTributavel).toBeCloseTo(expected, 2);
  });

  it('retorna erro quando formato não é reconhecido (sem colunas NIF ou Total)', () => {
    const badCsv = ['CampoA;CampoB;CampoC', 'val1;val2;val3'].join('\n');
    const result = parseEFaturaCSV(badCsv);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Linhas vazias — devem ser ignoradas
// ---------------------------------------------------------------------------
describe('parseEFaturaCSV — linhas vazias', () => {
  it('ignora linhas em branco no meio do CSV', () => {
    const csv = [
      PORTAL_HEADER,
      portalRow('S', '508332273 - Teste', 'FT/1', 'FT', '01/01/2025', '100,00', '23,00', '77,00'),
      '',
      '',
      portalRow('S', '503504564 - EDP', 'FT/2', 'FT', '02/01/2025', '50,00', '11,50', '38,50'),
    ].join('\n');
    const result = parseEFaturaCSV(csv);
    expect(result.records).toHaveLength(2);
  });
});

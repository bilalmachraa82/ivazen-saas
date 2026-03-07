import { describe, expect, it } from 'vitest';
import { parseInvoiceFile } from '../csvParser';

describe('AT SIRE CSV import', () => {
  it('parses emitted FT/FR documents and skips RG/cancelled rows', () => {
    const content = [
      '\uFEFFReferência;Tipo Documento;ATCUD;Situação;Data da Transação;Motivo Emissão;Data de Emissão;País do Adquirente;NIF Adquirente;Nome do Adquirente;Valor Tributável (em euros);Valor do IVA (em euros);Imposto do Selo como Retenção na Fonte;Valor do Imposto do Selo (em euros);Valor do IRS (em euros);Total de Impostos (em euros);Total com Impostos (em euros);Total de Retenções na Fonte (em euros);Contribuição Cultura (em euros);Total do Documento (em euros)',
      'FR ATSIRE01FR/17;Fatura-Recibo;JJ37MMGM-17;Emitido;2025-10-10;Pagamento dos bens ou dos serviços;2025-12-31;PORTUGAL;518326390;BRILHANTENTUSIASMO UNIPESSOAL LDA;500;0;;0;0;;500;0;0;500',
      'RG ATSIRE01RG/4;Recibo;JJ34MM39-4;Emitido;2025-09-26;Pagamento dos bens ou dos serviços;2025-10-22;PORTUGAL;503763004;1996 PONTO INFINITO, LDA;783;0;;0;0;;783;0;0;783',
      'FR ATSIRE01FR/12;Fatura-Recibo;JJ37MMGM-12;Anulado;2025-10-08;Pagamento dos bens ou dos serviços;2025-10-08;PORTUGAL;;;943,5;0;Não;0;0;;943,5;0;0;943,5',
      'FT ATSIRE01FT/11;Fatura;JJ3TVYDZ-11;Emitido;2025-02-03;Pagamento dos bens ou dos serviços;2025-02-03;PORTUGAL;503998680;GOODBARBER LTD;675;155,25;;0;0;155,25;830,25;0;0;830,25',
    ].join('\n');

    const result = parseInvoiceFile(content, 'ListaRecibos_Bilal_2025.csv');

    expect(result.errors).toEqual([]);
    expect(result.invoices).toHaveLength(2);
    expect(result.warnings).toContain('1 documento(s) anulados ignorados');
    expect(result.warnings).toContain('1 recibo(s) RG/RC ignorados para evitar dupla contagem');

    expect(result.invoices[0]).toMatchObject({
      documentNumber: 'FR ATSIRE01FR/17',
      documentType: 'FR',
      customerNif: '518326390',
      baseValue: 500,
      vatValue: 0,
      totalValue: 500,
      withholdingAmount: 0,
      atcud: 'JJ37MMGM-17',
      sourceSystem: 'at_sire',
    });

    expect(result.invoices[1]).toMatchObject({
      documentNumber: 'FT ATSIRE01FT/11',
      documentType: 'FT',
      customerNif: '503998680',
      baseValue: 675,
      vatValue: 155.25,
      totalValue: 830.25,
      withholdingAmount: 0,
      atcud: 'JJ3TVYDZ-11',
      sourceSystem: 'at_sire',
    });
  });
});

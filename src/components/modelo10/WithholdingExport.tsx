import { useState } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import { ZenCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, FileSpreadsheet, FileText, Loader2, AlertCircle, FileDown, Users, Archive, Mail } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TaxWithholding, WithholdingSummary } from '@/hooks/useWithholdings';
import { useProfile } from '@/hooks/useProfile';
import { toast } from 'sonner';
import { getCountryName } from '@/lib/countries';
import { generateModelo10PDF, generateIndividualBeneficiaryPDFs } from '@/lib/modelo10PdfGenerator';
import { EmailExportButton } from '@/components/ui/email-export-button';

interface WithholdingExportProps {
  withholdings: TaxWithholding[];
  summary: WithholdingSummary[];
  totals: {
    gross: number;
    withholding: number;
    count: number;
  };
  selectedYear: number;
  // Client data for accountants managing clients
  clientProfile?: {
    id?: string;
    nif?: string | null;
    email?: string | null;
    full_name?: string | null;
    company_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  clientName?: string | null;
}

export function WithholdingExport({ withholdings, summary, totals, selectedYear, clientProfile, clientName }: WithholdingExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { profile } = useProfile();

  // Use client profile if provided (for accountants), otherwise use logged-in user's profile
  // IMPORTANT: Include address/phone/email from clientProfile for PDF generation + email drafting
  const effectiveProfile = clientProfile ? {
    ...profile,
    nif: clientProfile.nif ?? profile?.nif,
    full_name: clientProfile.full_name ?? profile?.full_name,
    company_name: clientProfile.company_name ?? profile?.company_name,
    address: clientProfile.address ?? profile?.address,
    phone: clientProfile.phone ?? profile?.phone,
    email: clientProfile.email ?? (profile as any)?.email,
  } : profile;

  const effectiveClientName = clientName || clientProfile?.company_name || clientProfile?.full_name || null;
  const recipientEmail = clientProfile?.email || '';

  const getLocationLabel = (code: string) => {
    switch (code) {
      case 'C': return 'Continente';
      case 'RA': return 'Açores';
      case 'RM': return 'Madeira';
      default: return code;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'A': return 'Categoria A - Trabalho Dependente';
      case 'B': return 'Categoria B - Empresarial/Profissional';
      case 'E': return 'Categoria E - Rendimentos de Capitais';
      case 'F': return 'Categoria F - Rendimentos Prediais';
      case 'G': return 'Categoria G - Incrementos Patrimoniais';
      case 'H': return 'Categoria H - Pensões';
      case 'R': return 'Categoria R - Retenções IRC';
      default: return category;
    }
  };

  const getLegalReference = (category: string) => {
    switch (category) {
      case 'A': return 'Art. 99º CIRS';
      case 'B': return 'Art. 101º CIRS';
      case 'E': return 'Art. 71º CIRS';
      case 'F': return 'Art. 101º CIRS';
      case 'G': return 'Art. 72º CIRS';
      case 'H': return 'Art. 99º-A CIRS';
      case 'R': return 'Art. 94º CIRC';
      default: return 'Art. 119º CIRS';
    }
  };

  const exportToExcel = async () => {
    if (withholdings.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 0: Entidade Pagadora (Payer Entity - Portaria 4/2024)
      const payerData = [
        ['MODELO 10 - DECLARAÇÃO DE RENDIMENTOS E RETENÇÕES'],
        ['Ano Fiscal:', selectedYear],
        [''],
        ['ENTIDADE PAGADORA (Art. 119º CIRS / Art. 128º CIRC)'],
        ['NIF:', effectiveProfile?.nif || 'Não configurado'],
        ['Nome/Firma:', effectiveClientName || effectiveProfile?.company_name || effectiveProfile?.full_name || 'Não configurado'],
        ['CAE:', effectiveProfile?.cae || '-'],
        ['Actividade:', effectiveProfile?.activity_description || '-'],
        [''],
        ['Data de Geração:', new Date().toLocaleDateString('pt-PT')],
        [''],
        ['Referência Legal: Portaria n.º 4/2024, de 4 de janeiro'],
      ];
      const payerSheet = XLSX.utils.aoa_to_sheet(payerData);
      payerSheet['!cols'] = [{ wch: 20 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, payerSheet, 'Entidade Pagadora');

      // Sheet 1: Quadro 5 - Summary by beneficiary (full AT format)
      const quadro5Data = summary.map(s => ({
        'NIF Beneficiário': s.beneficiary_nif,
        'Nome': s.beneficiary_name || '',
        'Categoria': s.income_category,
        'Descrição Categoria': getCategoryLabel(s.income_category),
        'Referência Legal': getLegalReference(s.income_category),
        'Localização': s.location_code,
        'Descrição Local': getLocationLabel(s.location_code),
        'Rendimento Bruto (€)': Number(s.total_gross).toFixed(2),
        'Rendimentos Isentos (€)': Number(s.total_exempt || 0).toFixed(2),
        'Dispensados Retenção (€)': Number(s.total_dispensed || 0).toFixed(2),
        'Rendimento Líquido (€)': (Number(s.total_gross) - Number(s.total_withholding)).toFixed(2),
        'Retenção (€)': Number(s.total_withholding).toFixed(2),
        'Nº Documentos': s.count,
      }));

      // Add totals row separately as a plain object (avoiding type issues)
      const totalExempt = summary.reduce((sum, s) => sum + Number(s.total_exempt || 0), 0);
      const totalDispensed = summary.reduce((sum, s) => sum + Number(s.total_dispensed || 0), 0);
      const totalNet = totals.gross - totals.withholding;

      const quadro5Sheet = XLSX.utils.json_to_sheet(quadro5Data);
      
      // Append totals row
      XLSX.utils.sheet_add_aoa(quadro5Sheet, [[
        'TOTAL', '', '', '', '', '', '', 
        totals.gross.toFixed(2), 
        totalExempt.toFixed(2), 
        totalDispensed.toFixed(2), 
        totalNet.toFixed(2),
        totals.withholding.toFixed(2), 
        totals.count
      ]], { origin: -1 });
      
      XLSX.utils.book_append_sheet(workbook, quadro5Sheet, 'Quadro 5');

      // Sheet 2: All withholdings detail (complete AT format with non-resident support)
      const detailData = withholdings.map(w => ({
        'Ano Fiscal': w.fiscal_year,
        'Data Pagamento': w.payment_date,
        'NIF Beneficiário': w.beneficiary_nif,
        'Nome Beneficiário': w.beneficiary_name || '',
        'Morada Beneficiário': w.beneficiary_address || '',
        'Não Residente': w.is_non_resident ? 'Sim' : 'Não',
        'Código País': w.country_code || '',
        'País': getCountryName(w.country_code),
        'Categoria': w.income_category,
        'Descrição Categoria': getCategoryLabel(w.income_category),
        'Referência Legal': getLegalReference(w.income_category),
        'Localização': w.location_code,
        'Descrição Local': getLocationLabel(w.location_code),
        'Rendimento Bruto (€)': Number(w.gross_amount).toFixed(2),
        'Rendimentos Isentos (€)': Number(w.exempt_amount || 0).toFixed(2),
        'Dispensados Retenção (€)': Number(w.dispensed_amount || 0).toFixed(2),
        'Rendimento Líquido (€)': (Number(w.gross_amount) - Number(w.withholding_amount)).toFixed(2),
        'Taxa Retenção (%)': w.withholding_rate || 0,
        'Valor Retido (€)': Number(w.withholding_amount).toFixed(2),
        'Referência Documento': w.document_reference || '',
        'Notas': w.notes || '',
        'Status': w.status,
      }));

      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalhe Retenções');

      // Set column widths
      const quadro5ColWidths = [
        { wch: 15 }, { wch: 30 }, { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 10 }, { wch: 15 },
        { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 12 },
      ];
      quadro5Sheet['!cols'] = quadro5ColWidths;

      const detailColWidths = [
        { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 40 },
        { wch: 8 }, { wch: 35 }, { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 18 },
        { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 15 }, { wch: 15 },
        { wch: 20 }, { wch: 30 }, { wch: 12 },
      ];
      detailSheet['!cols'] = detailColWidths;

      // Download
      const fileName = `Modelo10_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success('Ficheiro Excel exportado com sucesso');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar ficheiro');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = async () => {
    if (withholdings.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const result = generateModelo10PDF({
        withholdings,
        summary,
        totals,
        selectedYear,
        payerProfile: effectiveProfile,
        clientName: effectiveClientName,
      });

      if (result.success) {
        toast.success(`PDF gerado: ${result.filename}`);
      } else {
        toast.error(`Erro ao gerar PDF: ${result.error}`);
      }
    } catch (error) {
      console.error('PDF export error:', error);
      toast.error('Erro ao exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Export individual PDF declarations per beneficiary
   * According to Portuguese law (Art. 119º CIRS), each prestador/beneficiary
   * must receive their own individual declaration.
   */
  const exportIndividualPDFs = async () => {
    if (withholdings.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const result = generateIndividualBeneficiaryPDFs({
        withholdings,
        summary,
        totals,
        selectedYear,
        payerProfile: effectiveProfile,
        clientName: effectiveClientName,
      });

      if (!result.success || !result.pdfs) {
        toast.error(`Erro ao gerar PDFs: ${result.error}`);
        return;
      }

      const beneficiaryCount = result.pdfs.length;

      if (beneficiaryCount === 1) {
        // Single beneficiary - download directly
        const pdf = result.pdfs[0];
        const url = URL.createObjectURL(pdf.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = pdf.filename;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`PDF gerado: ${pdf.filename}`);
      } else {
        // Multiple beneficiaries - create ZIP
        const zip = new JSZip();

        for (const pdf of result.pdfs) {
          zip.file(pdf.filename, pdf.blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Modelo10_${selectedYear}_Declaracoes_Individuais.zip`;
        link.click();
        URL.revokeObjectURL(url);

        toast.success(`${beneficiaryCount} declarações individuais geradas em ZIP`);
      }
    } catch (error) {
      console.error('Individual PDFs export error:', error);
      toast.error('Erro ao exportar PDFs individuais');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    if (summary.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      // AT-compatible CSV format (Portaria n.º 4/2024)
      // Version header for AT import - includes non-resident support
      const versionLine = `#VERSAO;1.1;MODELO10;${selectedYear}`;
      
      // Payer entity header (Entidade Pagadora)
      const payerNif = effectiveProfile?.nif || '';
      const payerName = (effectiveClientName || effectiveProfile?.company_name || effectiveProfile?.full_name || '').replace(/;/g, ',');
      const payerLine = `#ENTIDADE_PAGADORA;${payerNif};${payerName}`;
      
      // Non-resident count for validation
      const nonResidentCount = withholdings.filter(w => w.is_non_resident).length;
      const nonResidentLine = `#NAO_RESIDENTES;${nonResidentCount}`;
      
      // Data headers - Extended for non-resident support (Portaria 4/2024 Anexo II)
      const headers = [
        'NIF_BENEFICIARIO',
        'NOME_BENEFICIARIO', 
        'ANO_FISCAL',
        'CATEGORIA_RENDIMENTO',
        'REFERENCIA_LEGAL',
        'CODIGO_LOCALIZACAO',
        'NAO_RESIDENTE',
        'CODIGO_PAIS',
        'RENDIMENTO_BRUTO',
        'RENDIMENTOS_ISENTOS',
        'DISPENSADOS_RETENCAO',
        'RENDIMENTO_LIQUIDO',
        'TAXA_RETENCAO',
        'IMPOSTO_RETIDO'
      ];
      
      // Generate rows from individual withholdings for better AT compatibility
      const rows = withholdings.map(w => [
        w.beneficiary_nif,
        (w.beneficiary_name || '').replace(/;/g, ','), // Escape semicolons
        selectedYear.toString(),
        w.income_category,
        getLegalReference(w.income_category),
        w.location_code,
        w.is_non_resident ? 'S' : 'N', // S/N format for AT
        w.country_code || '',
        Number(w.gross_amount).toFixed(2).replace('.', ','), // Portuguese decimal format
        Number(w.exempt_amount || 0).toFixed(2).replace('.', ','),
        Number(w.dispensed_amount || 0).toFixed(2).replace('.', ','),
        (Number(w.gross_amount) - Number(w.withholding_amount)).toFixed(2).replace('.', ','),
        (w.withholding_rate || 0).toString().replace('.', ','),
        Number(w.withholding_amount).toFixed(2).replace('.', ','),
      ]);

      // Add BOM for UTF-8 encoding
      const BOM = '\uFEFF';
      const csvContent = BOM + [
        versionLine,
        payerLine,
        nonResidentLine,
        headers.join(';'), 
        ...rows.map(r => r.join(';'))
      ].join('\r\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Modelo10_AT_${selectedYear}.csv`;
      link.click();

      toast.success('CSV exportado (formato AT - Portaria 4/2024)');
    } catch (error) {
      console.error('CSV export error:', error);
      toast.error('Erro ao exportar CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const deadline = new Date(selectedYear + 1, 1, 28); // 28 February of next year
  const today = new Date();
  const daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDeadline < 0;
  const isUrgent = daysUntilDeadline <= 30 && daysUntilDeadline > 0;

  return (
    <div className="space-y-6">
      {/* Deadline Alert */}
      {(isOverdue || isUrgent) && (
        <Alert variant={isOverdue ? 'destructive' : 'default'} className={isUrgent ? 'border-amber-500' : ''}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {isOverdue 
              ? `O prazo de entrega do Modelo 10 de ${selectedYear} expirou em 28/02/${selectedYear + 1}.`
              : `Faltam ${daysUntilDeadline} dias para o prazo de entrega do Modelo 10 (28/02/${selectedYear + 1}).`
            }
          </AlertDescription>
        </Alert>
      )}

      <ZenCard>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar Modelo 10
          </CardTitle>
          <CardDescription>
            Exporte os dados das retenções para submissão no Portal das Finanças
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Individual PDFs - Main Option */}
          <div className="p-4 border-2 rounded-lg space-y-3 border-green-500 bg-green-50/50 mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <h4 className="font-medium">Declarações Individuais por Prestador</h4>
              <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">LEGAL</span>
            </div>
            <p className="text-sm text-muted-foreground">
              <strong>Obrigatório por lei:</strong> Gera uma declaração PDF individual para cada
              beneficiário/prestador conforme Art. 119º CIRS. Cada prestador deve receber a sua própria declaração.
            </p>
            <Button
              onClick={exportIndividualPDFs}
              disabled={isExporting || withholdings.length === 0}
              className="w-full bg-green-600 hover:bg-green-700"
              variant="default"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Archive className="h-4 w-4 mr-2" />
              )}
              Gerar {summary.length} PDF{summary.length !== 1 ? 's' : ''} Individuais
            </Button>
            <p className="text-xs text-muted-foreground">
              {summary.length > 1 ? `Será criado um ficheiro ZIP com ${summary.length} declarações` : 'Será criado 1 ficheiro PDF'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PDF Export - Summary */}
            <div className="p-4 border rounded-lg space-y-3 border-gray-200 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <FileDown className="h-5 w-5 text-gray-600" />
                <h4 className="font-medium">PDF Resumo (Interno)</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Gera um único PDF com todos os beneficiários listados.
                <strong> Apenas para uso interno.</strong>
              </p>
              <Button
                onClick={exportToPDF}
                disabled={isExporting || withholdings.length === 0}
                className="w-full"
                variant="outline"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Gerar PDF Resumo
              </Button>
            </div>

            {/* Excel Export */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                <h4 className="font-medium">Ficheiro Excel</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Exporta ficheiro XLSX com duas folhas: Quadro 5 (resumo por NIF) e
                detalhe de todas as retenções.
              </p>
              <Button
                onClick={exportToExcel}
                disabled={isExporting || withholdings.length === 0}
                className="w-full"
                variant="outline"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                )}
                Exportar Excel
              </Button>
            </div>

            {/* CSV Export */}
            <div className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h4 className="font-medium">CSV para AT</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Exporta ficheiro CSV no formato compatível com o Portal das Finanças
                para importação directa.
              </p>
              <Button
                onClick={exportToCSV}
                disabled={isExporting || summary.length === 0}
                className="w-full"
                variant="outline"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Exportar CSV (AT)
              </Button>
            </div>
          </div>

          {/* Email Export Section - PDF Individual */}
          <div className="p-4 border rounded-lg space-y-3 bg-primary/5 border-primary/20">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <h4 className="font-medium">Enviar PDF por Email</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              Gera os PDFs individuais e abre o seu cliente de email (Outlook) com o corpo pré-preenchido.
              Só precisa de anexar o ficheiro e enviar.
            </p>
            <EmailExportButton
              recipientEmail={recipientEmail}
              recipientName={effectiveClientName || 'Cliente'}
              declarationType="modelo10"
              year={selectedYear}
              onGenerateFile={exportIndividualPDFs}
              fileName={`Modelo10_${selectedYear}_Declaracoes.pdf`}
              senderName={profile?.full_name || profile?.company_name || undefined}
              variant="outline"
              className="w-full"
            >
              Enviar PDF por Email
            </EmailExportButton>
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">📋 Instruções de Submissão</h4>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Aceda ao Portal das Finanças em <span className="font-mono">portaldasfinancas.gov.pt</span></li>
              <li>Navegue para Serviços → Entregar → IRS → Modelo 10</li>
              <li>Seleccione o ano fiscal {selectedYear}</li>
              <li>Importe o ficheiro CSV ou preencha manualmente com os dados do Excel</li>
              <li>Verifique os dados no Quadro 5 e submeta a declaração</li>
            </ol>
          </div>
        </CardContent>
      </ZenCard>
    </div>
  );
}

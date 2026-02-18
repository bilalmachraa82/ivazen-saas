import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { ZenCard } from '@/components/zen';
import { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, FileSpreadsheet, Loader2, Users, Check, Mail } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { AccountantClient } from '@/hooks/useClientManagement';
import { TaxWithholding } from '@/hooks/useWithholdings';
import { toast } from 'sonner';
import { getCountryName } from '@/lib/countries';
import { EmailExportButton } from '@/components/ui/email-export-button';

interface MultiClientExportProps {
  clients: AccountantClient[];
  selectedYear: number;
}

export function MultiClientExport({ clients, selectedYear }: MultiClientExportProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const { profile } = useProfile();

  // Fetch withholdings for all selected clients
  const { data: allWithholdings, isLoading: isLoadingWithholdings } = useQuery({
    queryKey: ['multi-client-withholdings', selectedClientIds, selectedYear],
    queryFn: async () => {
      if (selectedClientIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('tax_withholdings')
        .select('*')
        .in('client_id', selectedClientIds)
        .eq('fiscal_year', selectedYear)
        .order('payment_date', { ascending: false });
      
      if (error) throw error;
      return data as TaxWithholding[];
    },
    enabled: selectedClientIds.length > 0,
  });

  const toggleClient = (clientId: string) => {
    setSelectedClientIds(prev => 
      prev.includes(clientId) 
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const selectAll = () => {
    if (selectedClientIds.length === clients.length) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map(c => c.id));
    }
  };

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
      case 'R': return 'Categoria R - Outros Rendimentos';
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
      case 'R': return 'Art. 71º CIRS';
      default: return 'Art. 119º CIRS';
    }
  };

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.company_name || client?.full_name || 'Cliente';
  };

  const getClientNif = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.nif || '';
  };

  const exportMultiClientExcel = async () => {
    if (!allWithholdings || allWithholdings.length === 0) {
      toast.error('Sem dados para exportar');
      return;
    }

    setIsExporting(true);
    try {
      const workbook = XLSX.utils.book_new();

      // Sheet 0: Contabilista Info
      const accountantData = [
        ['MODELO 10 - EXPORTAÇÃO MULTI-CLIENTE'],
        ['Ano Fiscal:', selectedYear],
        [''],
        ['CONTABILISTA RESPONSÁVEL'],
        ['NIF:', profile?.nif || 'Não configurado'],
        ['Nome/Firma:', profile?.company_name || profile?.full_name || 'Não configurado'],
        [''],
        ['CLIENTES INCLUÍDOS:', selectedClientIds.length],
        ...selectedClientIds.map((id, idx) => [
          `Cliente ${idx + 1}:`, 
          `${getClientName(id)} (NIF: ${getClientNif(id)})`
        ]),
        [''],
        ['Data de Geração:', new Date().toLocaleDateString('pt-PT')],
      ];
      const accountantSheet = XLSX.utils.aoa_to_sheet(accountantData);
      accountantSheet['!cols'] = [{ wch: 25 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(workbook, accountantSheet, 'Resumo');

      // Sheet 1: Summary by client
      const clientSummary = selectedClientIds.map(clientId => {
        const clientWithholdings = allWithholdings.filter(w => w.client_id === clientId);
        const totalGross = clientWithholdings.reduce((sum, w) => sum + Number(w.gross_amount), 0);
        const totalWithholding = clientWithholdings.reduce((sum, w) => sum + Number(w.withholding_amount), 0);
        
        return {
          'Cliente': getClientName(clientId),
          'NIF Cliente': getClientNif(clientId),
          'Nº Retenções': clientWithholdings.length,
          'Rendimento Bruto Total (€)': totalGross.toFixed(2),
          'Total Retido (€)': totalWithholding.toFixed(2),
        };
      });

      const totalGrossAll = allWithholdings.reduce((sum, w) => sum + Number(w.gross_amount), 0);
      const totalWithholdingAll = allWithholdings.reduce((sum, w) => sum + Number(w.withholding_amount), 0);

      const summarySheet = XLSX.utils.json_to_sheet(clientSummary);
      XLSX.utils.sheet_add_aoa(summarySheet, [[
        'TOTAL GERAL', '', allWithholdings.length.toString(), 
        totalGrossAll.toFixed(2), totalWithholdingAll.toFixed(2)
      ]], { origin: -1 });
      summarySheet['!cols'] = [{ wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo Clientes');

      // Sheet 2: Summary by beneficiary (NIF + Category)
      const beneficiaryMap = new Map<string, {
        nif: string;
        name: string;
        category: string;
        clientIds: Set<string>;
        docCount: number;
        totalGross: number;
        totalWithholding: number;
      }>();

      // Aggregate by beneficiary_nif + income_category
      allWithholdings.forEach(w => {
        const key = `${w.beneficiary_nif}_${w.income_category}`;
        
        if (!beneficiaryMap.has(key)) {
          beneficiaryMap.set(key, {
            nif: w.beneficiary_nif,
            name: w.beneficiary_name || '',
            category: w.income_category,
            clientIds: new Set(),
            docCount: 0,
            totalGross: 0,
            totalWithholding: 0,
          });
        }
        
        const entry = beneficiaryMap.get(key)!;
        entry.clientIds.add(w.client_id);
        entry.docCount += 1;
        entry.totalGross += Number(w.gross_amount);
        entry.totalWithholding += Number(w.withholding_amount);
      });

      // Convert to array and sort by NIF
      const beneficiarySummary = Array.from(beneficiaryMap.values())
        .sort((a, b) => a.nif.localeCompare(b.nif))
        .map(b => ({
          'NIF Beneficiário': b.nif,
          'Nome': b.name,
          'Categoria': b.category,
          'Descrição': getCategoryLabel(b.category),
          'Nº Documentos': b.docCount,
          'Nº Clientes': b.clientIds.size,
          'NIFs Clientes': Array.from(b.clientIds)
            .map(id => getClientNif(id))
            .filter(Boolean)
            .join(', '),
          'Rendimento Bruto (€)': b.totalGross.toFixed(2),
          'Retenção (€)': b.totalWithholding.toFixed(2),
        }));

      const beneficiarySheet = XLSX.utils.json_to_sheet(beneficiarySummary);

      // Add totals row
      const totalBeneficiaryDocs = beneficiarySummary.reduce((s, b) => s + b['Nº Documentos'], 0);
      const uniqueBeneficiaryClients = new Set(allWithholdings.map(w => w.client_id)).size;
      XLSX.utils.sheet_add_aoa(beneficiarySheet, [[
        'TOTAL', '', '', '', totalBeneficiaryDocs, uniqueBeneficiaryClients, '',
        totalGrossAll.toFixed(2), totalWithholdingAll.toFixed(2)
      ]], { origin: -1 });

      beneficiarySheet['!cols'] = [
        { wch: 15 }, { wch: 30 }, { wch: 8 }, { wch: 35 }, 
        { wch: 12 }, { wch: 12 }, { wch: 40 }, 
        { wch: 18 }, { wch: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, beneficiarySheet, 'Resumo Beneficiários');

      // Sheet 3: All withholdings detail
      const detailData = allWithholdings.map(w => ({
        'Cliente': getClientName(w.client_id),
        'NIF Cliente': getClientNif(w.client_id),
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
        'Taxa Retenção (%)': w.withholding_rate || 0,
        'Valor Retido (€)': Number(w.withholding_amount).toFixed(2),
        'Referência Documento': w.document_reference || '',
        'Status': w.status,
      }));

      const detailSheet = XLSX.utils.json_to_sheet(detailData);
      detailSheet['!cols'] = [
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 25 },
        { wch: 35 }, { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 35 },
        { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 20 },
        { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 12 },
      ];
      XLSX.utils.book_append_sheet(workbook, detailSheet, 'Todas Retenções');

      // Create separate sheets per client
      for (const clientId of selectedClientIds) {
        const clientWithholdings = allWithholdings.filter(w => w.client_id === clientId);
        if (clientWithholdings.length === 0) continue;

        const clientDetailData = clientWithholdings.map(w => ({
          'Data Pagamento': w.payment_date,
          'NIF Beneficiário': w.beneficiary_nif,
          'Nome Beneficiário': w.beneficiary_name || '',
          'Categoria': w.income_category,
          'Localização': w.location_code,
          'Rendimento Bruto (€)': Number(w.gross_amount).toFixed(2),
          'Valor Retido (€)': Number(w.withholding_amount).toFixed(2),
        }));

        const sheetName = (getClientNif(clientId) || getClientName(clientId)).substring(0, 31);
        const clientSheet = XLSX.utils.json_to_sheet(clientDetailData);
        XLSX.utils.book_append_sheet(workbook, clientSheet, sheetName);
      }

      // Download
      const fileName = `Modelo10_MultiCliente_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success(`Exportado com ${selectedClientIds.length} clientes e ${allWithholdings.length} retenções`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Erro ao exportar ficheiro');
    } finally {
      setIsExporting(false);
    }
  };

  if (clients.length === 0) {
    return (
      <ZenCard>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Não tem clientes associados.</p>
          <p className="text-sm">Associe clientes nas Definições para usar a exportação multi-cliente.</p>
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <ZenCard>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Exportar Multi-Cliente
        </CardTitle>
        <CardDescription>
          Seleccione os clientes cujas retenções pretende exportar num único ficheiro Excel
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Client Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Clientes</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-8"
            >
              {selectedClientIds.length === clients.length ? 'Desmarcar Todos' : 'Seleccionar Todos'}
            </Button>
          </div>

          <ScrollArea className="h-[200px] border rounded-lg p-3">
            <div className="space-y-2">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer"
                  onClick={() => toggleClient(client.id)}
                >
                  <Checkbox
                    checked={selectedClientIds.includes(client.id)}
                    onCheckedChange={() => toggleClient(client.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {client.company_name || client.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      NIF: {client.nif || 'N/A'}
                    </p>
                  </div>
                  {selectedClientIds.includes(client.id) && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedClientIds.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Seleccionados:</span>
              <Badge variant="secondary">
                {selectedClientIds.length} cliente{selectedClientIds.length !== 1 ? 's' : ''}
              </Badge>
              {allWithholdings && allWithholdings.length > 0 && (
                <Badge variant="outline">
                  {allWithholdings.length} retenção{allWithholdings.length !== 1 ? 'ões' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={exportMultiClientExcel}
            disabled={isExporting || selectedClientIds.length === 0 || isLoadingWithholdings || !allWithholdings?.length}
            className="flex-1"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 mr-2" />
            )}
            {isLoadingWithholdings 
              ? 'A carregar dados...' 
              : `Exportar Excel`
            }
          </Button>
          
          <EmailExportButton
            recipientEmail=""
            recipientName={`${selectedClientIds.length} clientes`}
            declarationType="modelo10"
            year={selectedYear}
            onGenerateFile={exportMultiClientExcel}
            fileName={`Modelo10_MultiCliente_${selectedYear}.xlsx`}
            senderName={profile?.full_name || profile?.company_name || undefined}
            variant="outline"
            disabled={selectedClientIds.length === 0 || isLoadingWithholdings || !allWithholdings?.length}
            className="flex-1"
          >
            Enviar por Email
          </EmailExportButton>
        </div>

        {/* Info */}
        <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium mb-1">📊 O ficheiro inclui:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Resumo geral com informações do contabilista</li>
            <li>Resumo por cliente com totais</li>
            <li>Detalhe de todas as retenções</li>
            <li>Folha separada para cada cliente</li>
          </ul>
        </div>
      </CardContent>
    </ZenCard>
  );
}

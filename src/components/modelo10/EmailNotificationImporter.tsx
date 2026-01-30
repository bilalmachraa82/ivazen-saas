/**
 * Email Notification Importer Component
 * Parses AT email notifications for tax document extraction
 * Uses keyword-based filtering and priority detection
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle2,
  Mail,
  Loader2,
  X,
  Users,
  Download,
  Filter,
  Eye,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  parseEmailNotification,
  parseEmailBatch,
  shouldProcessEmail,
  EmailNotification,
  EmailParseResult,
  ParsedEmailData,
  EmailType,
  EMAIL_MONITOR_KEYWORDS,
  getEmailTypeDisplayName,
} from '@/lib/emailNotificationParser';

interface EmailNotificationImporterProps {
  selectedClientId?: string | null;
  selectedYear: number;
  clientName?: string | null;
  onImportComplete?: (count: number) => void;
  isAccountantOwnAccount?: boolean;
}

type ImportStep = 'instructions' | 'input' | 'processing' | 'preview' | 'importing' | 'complete';

interface EmailSelection {
  email: EmailNotification;
  parseResult: EmailParseResult;
  selected: boolean;
  priority: 'high' | 'medium' | 'low' | 'none';
}

export function EmailNotificationImporter({
  selectedClientId,
  selectedYear,
  clientName,
  onImportComplete,
  isAccountantOwnAccount,
}: EmailNotificationImporterProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<ImportStep>('instructions');
  const [rawEmailText, setRawEmailText] = useState('');
  const [parsedEmails, setParsedEmails] = useState<EmailSelection[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedEmail, setSelectedEmail] = useState<EmailSelection | null>(null);

  const effectiveClientId = selectedClientId || user?.id;

  /**
   * Extract subject from email text
   */
  function extractSubject(text: string): string {
    const match = text.match(/(?:Assunto|Subject):\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : 'Email AT';
  }

  /**
   * Extract sender from email text
   */
  function extractFrom(text: string): string {
    const match = text.match(/(?:De|From):\s*(.+?)(?:\n|$)/i);
    return match ? match[1].trim() : 'at@at.gov.pt';
  }

  /**
   * Parse raw email text (multiple emails separated by markers)
   */
  const parseEmails = useCallback(() => {
    if (!rawEmailText.trim()) {
      toast.error('Cole o conteúdo dos emails');
      return;
    }

    setIsProcessing(true);
    setStep('processing');

    try {
      // Split emails by common separators
      const emailTexts = rawEmailText
        .split(/(?:^|\n)(?:---+|===+|From:|De:|Assunto:|Subject:)/im)
        .filter(text => text.trim().length > 50);

      let emailNotifications: EmailNotification[];

      if (emailTexts.length === 0) {
        // Try parsing as single email
        emailNotifications = [{
          id: `email-${Date.now()}`,
          subject: extractSubject(rawEmailText),
          from: extractFrom(rawEmailText),
          date: new Date(),
          body: rawEmailText,
          attachments: [],
        }];
      } else {
        // Parse multiple emails
        emailNotifications = emailTexts.map((text, i) => ({
          id: `email-${Date.now()}-${i}`,
          subject: extractSubject(text),
          from: extractFrom(text),
          date: new Date(),
          body: text,
          attachments: [],
        }));
      }

      const { results } = parseEmailBatch(emailNotifications);

      const selections: EmailSelection[] = emailNotifications.map((email, index) => {
        const parseResult = results[index];
        const priorityInfo = shouldProcessEmail(email.subject);

        return {
          email,
          parseResult,
          selected: parseResult.success,
          priority: priorityInfo.priority,
        };
      });

      setParsedEmails(selections);
      setStep('preview');
      toast.success('Emails processados');
    } catch (error: any) {
      console.error('Parse error:', error);
      toast.error('Erro ao processar emails');
      setStep('input');
    } finally {
      setIsProcessing(false);
    }
  }, [rawEmailText]);

  const toggleEmailSelection = (emailId: string) => {
    setParsedEmails(prev =>
      prev.map(item =>
        item.email.id === emailId ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const allSelected = parsedEmails.every(e => e.selected);
    setParsedEmails(prev =>
      prev.map(item => ({ ...item, selected: !allSelected && item.parseResult.success }))
    );
  };

  const handleImport = async () => {
    if (!effectiveClientId) {
      toast.error('Cliente não definido');
      return;
    }

    const selectedItems = parsedEmails.filter(e => e.selected && e.parseResult.success && e.parseResult.data);
    if (selectedItems.length === 0) {
      toast.error('Selecione pelo menos um email válido');
      return;
    }

    setIsProcessing(true);
    setStep('importing');
    setImportProgress(0);

    let imported = 0;

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const emailData = item.parseResult.data;
        if (!emailData) continue;

        // Insert into tax_withholdings
        const { error } = await supabase.from('tax_withholdings').insert({
          client_id: effectiveClientId,
          beneficiary_nif: emailData.nifBeneficiario || emailData.nifEmitente || '',
          beneficiary_name: emailData.nomeBeneficiario || emailData.nomeEmitente || 'Desconhecido',
          income_category: mapCategoriaToCode(emailData.categoria),
          gross_amount: emailData.valorBruto,
          withholding_amount: emailData.retencao || 0,
          withholding_rate: emailData.taxaRetencao || 0.23,
          fiscal_region: 'C',
          payment_date: emailData.dataDocumento?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
          fiscal_year: selectedYear,
          is_non_resident: false,
          status: 'pending',
          notes: `Importado de email: ${getEmailTypeDisplayName(item.parseResult.emailType)}`,
        });

        if (!error) {
          imported++;
        }

        setImportProgress(Math.round(((i + 1) / selectedItems.length) * 100));
      }

      setImportedCount(imported);
      setStep('complete');

      if (imported > 0) {
        toast.success(`${imported} registo(s) importado(s)`);
        onImportComplete?.(imported);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error('Erro na importação');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  function mapCategoriaToCode(categoria?: string): string {
    if (!categoria) return 'B';
    if (categoria.includes('B')) return 'B';
    if (categoria.includes('F')) return 'F';
    if (categoria.includes('E')) return 'E';
    if (categoria.includes('H')) return 'H';
    return 'B';
  }

  const resetImport = () => {
    setStep('instructions');
    setRawEmailText('');
    setParsedEmails([]);
    setImportProgress(0);
    setImportedCount(0);
    setSelectedEmail(null);
  };

  const selectedCount = parsedEmails.filter(e => e.selected).length;
  const successCount = parsedEmails.filter(e => e.parseResult.success).length;

  // Get priority badge color
  function getPriorityColor(priority: 'high' | 'medium' | 'low' | 'none'): string {
    switch (priority) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/30';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  function getPriorityLabel(priority: 'high' | 'medium' | 'low' | 'none'): string {
    switch (priority) {
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return '-';
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Importar de Emails AT</h2>
        <p className="text-muted-foreground mt-1">
          Cole notificações de email da AT para extrair dados de retenção
        </p>
      </div>

      {/* Client Info */}
      {selectedClientId && clientName && !isAccountantOwnAccount && (
        <Alert className="border-primary/20 bg-primary/5">
          <Users className="h-4 w-4 text-primary" />
          <AlertDescription>
            A importar para: <strong className="text-primary">{clientName}</strong> | Ano: <strong>{selectedYear}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning: Accountant's own account */}
      {isAccountantOwnAccount && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importação bloqueada:</strong> Não é possível importar documentos para a sua própria conta de contabilista.
            Seleccione um cliente para continuar.
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions Step */}
      {step === 'instructions' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Monitorização de Emails AT
            </CardTitle>
            <CardDescription>
              Extraia dados de retenção de notificações por email da Autoridade Tributária
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Keyword Categories */}
            <div className="space-y-4">
              <h3 className="font-medium">Palavras-chave monitorizadas:</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="font-medium text-destructive mb-2">Alta Prioridade</p>
                  <div className="flex flex-wrap gap-1">
                    {EMAIL_MONITOR_KEYWORDS.HIGH.slice(0, 5).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-background">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                  <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">Média Prioridade</p>
                  <div className="flex flex-wrap gap-1">
                    {EMAIL_MONITOR_KEYWORDS.MEDIUM.slice(0, 5).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-background">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
                  <p className="font-medium text-blue-700 dark:text-blue-400 mb-2">Baixa Prioridade</p>
                  <div className="flex flex-wrap gap-1">
                    {EMAIL_MONITOR_KEYWORDS.LOW.slice(0, 5).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-xs bg-background">
                        {kw}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <p className="font-medium">Aceda ao seu email</p>
                  <p className="text-sm text-muted-foreground">
                    Abra as notificações recebidas de at@at.gov.pt ou noreply@portaldasfinancas.gov.pt
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <p className="font-medium">Copie o conteúdo</p>
                  <p className="text-sm text-muted-foreground">
                    Selecione e copie o texto completo do email (Ctrl+A, Ctrl+C)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <p className="font-medium">Cole aqui</p>
                  <p className="text-sm text-muted-foreground">
                    Pode colar múltiplos emails de uma vez
                  </p>
                </div>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={() => setStep('input')}
              disabled={isAccountantOwnAccount || selectedClientId === null}
            >
              <Mail className="h-4 w-4" />
              {isAccountantOwnAccount ? 'Seleccione um cliente' : 'Continuar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Input Step */}
      {step === 'input' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Colar Emails AT
            </CardTitle>
            <CardDescription>
              Cole o conteúdo completo dos emails de notificação da AT
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-content">Conteúdo do Email</Label>
              <Textarea
                id="email-content"
                placeholder="Cole aqui o conteúdo do email...

De: at@at.gov.pt
Assunto: Recibo Verde - Emissão

Caro contribuinte,
Foi emitido um recibo verde...
NIF: 123456789
Valor: 1.000,00 €
..."
                value={rawEmailText}
                onChange={(e) => setRawEmailText(e.target.value)}
                className="min-h-[300px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Pode colar múltiplos emails separados por linhas "---" ou "==="
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('instructions')}>
                Voltar
              </Button>
              <Button
                onClick={parseEmails}
                disabled={!rawEmailText.trim()}
                className="flex-1 gap-2"
              >
                <Filter className="h-4 w-4" />
                Processar Emails
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Step */}
      {step === 'processing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">A processar emails...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Step */}
      {step === 'preview' && parsedEmails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Emails Processados
              </span>
              <div className="flex gap-2">
                <Badge variant="secondary">{parsedEmails.length} email(s)</Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {successCount} válido(s)
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Revise os dados extraídos dos emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{parsedEmails.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                <p className="text-sm text-muted-foreground">Válidos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{successCount}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Selecionados</p>
                <p className="text-2xl font-bold">{selectedCount}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Retido</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {parsedEmails
                    .filter(e => e.selected && e.parseResult.data?.retencao)
                    .reduce((sum, e) => sum + (e.parseResult.data?.retencao || 0), 0)
                    .toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
            </div>

            {/* Email Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={parsedEmails.every(e => e.selected)}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>NIF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="text-right">Valor Bruto</TableHead>
                    <TableHead className="text-right">Retenção</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedEmails.map((item) => {
                    const data = item.parseResult.data;

                    return (
                      <TableRow
                        key={item.email.id}
                        className={!item.parseResult.success ? 'opacity-50 bg-destructive/5' : item.selected ? '' : 'opacity-60'}
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            disabled={!item.parseResult.success}
                            onCheckedChange={() => toggleEmailSelection(item.email.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getEmailTypeDisplayName(item.parseResult.emailType)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getPriorityColor(item.priority)}>
                            {getPriorityLabel(item.priority)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono">
                          {data?.nifBeneficiario || data?.nifEmitente || '-'}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {data?.nomeBeneficiario || data?.nomeEmitente || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {data?.valorBruto
                            ? data.valorBruto.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium">
                          {data?.retencao
                            ? data.retencao.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEmail(item)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Email Detail View */}
            {selectedEmail && (
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <strong>{getEmailTypeDisplayName(selectedEmail.parseResult.emailType)}</strong>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {selectedEmail.parseResult.data && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>NIF: <span className="font-mono">{selectedEmail.parseResult.data.nifBeneficiario || selectedEmail.parseResult.data.nifEmitente}</span></div>
                        <div>Nome: {selectedEmail.parseResult.data.nomeBeneficiario || selectedEmail.parseResult.data.nomeEmitente}</div>
                        <div>Categoria: {selectedEmail.parseResult.data.categoria}</div>
                        <div>Taxa: {((selectedEmail.parseResult.data.taxaRetencao || 0) * 100).toFixed(0)}%</div>
                      </div>
                    )}
                    {selectedEmail.parseResult.data?.keywordsEncontradas && selectedEmail.parseResult.data.keywordsEncontradas.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {selectedEmail.parseResult.data.keywordsEncontradas.map((kw, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                        ))}
                      </div>
                    )}
                    {selectedEmail.parseResult.errors.length > 0 && (
                      <div className="text-destructive text-sm">
                        Erros: {selectedEmail.parseResult.errors.join(', ')}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={resetImport} className="gap-2">
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || !effectiveClientId}
                className="flex-1 gap-2"
              >
                <Download className="h-4 w-4" />
                Importar {selectedCount} para Modelo 10
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing Step */}
      {step === 'importing' && (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg font-medium">A importar...</p>
              <Progress value={importProgress} className="w-64" />
              <p className="text-sm text-muted-foreground">{importProgress}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-full bg-green-500/20">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <p className="text-lg font-medium">Importação Concluída</p>
              <p className="text-muted-foreground">
                <strong className="text-green-600 dark:text-green-400">{importedCount}</strong> registo(s) importado(s)
              </p>
              <Button onClick={resetImport} variant="outline">
                Importar Mais
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

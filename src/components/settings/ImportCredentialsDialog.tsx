/**
 * Import Credentials Dialog
 * Bulk import of Portal das Finanças credentials from Excel/CSV/PDF
 */

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useImportCredentials } from '@/hooks/useATCredentials';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

interface ParsedCredential {
  nif: string;
  password: string;
  name?: string;
  valid: boolean;
  error?: string;
}

interface ImportResult {
  nif: string;
  status: 'imported' | 'updated' | 'created' | 'associated' | 'not_found' | 'error';
  clientName?: string;
  error?: string;
}

interface ImportCredentialsDialogProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function ImportCredentialsDialog({ trigger, onSuccess }: ImportCredentialsDialogProps) {
  const [open, setOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [parsedCredentials, setParsedCredentials] = useState<ParsedCredential[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [step, setStep] = useState<'upload' | 'parsing' | 'preview' | 'importing' | 'results'>('upload');
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);
  
  const importMutation = useImportCredentials();

  const resetState = () => {
    setParsedCredentials([]);
    setResults([]);
    setStep('upload');
    setIsPdfProcessing(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const parsePdfFile = async (file: File) => {
    setStep('parsing');
    setIsPdfProcessing(true);

    try {
      const base64 = await fileToBase64(file);

      toast.info('A processar PDF com IA...', {
        description: 'Este processo pode demorar alguns segundos',
      });

      const { data, error } = await supabase.functions.invoke('parse-credentials-pdf', {
        body: { pdfBase64: base64 },
      });

      if (error) throw error;

      if (!data?.credentials || data.credentials.length === 0) {
        toast.error('Não foram encontradas credenciais no PDF', {
          description: 'Verifique se o documento contém NIFs e passwords',
        });
        setStep('upload');
        return;
      }

      // Convert to ParsedCredential format
      const credentials: ParsedCredential[] = data.credentials.map((c: any) => ({
        nif: c.nif,
        password: c.password,
        name: c.name,
        valid: c.nif?.length === 9 && c.password?.length > 0,
        error: c.nif?.length !== 9 ? 'NIF inválido' : (!c.password ? 'Password em falta' : undefined),
      }));

      setParsedCredentials(credentials);
      setStep('preview');
      
      toast.success(`${credentials.length} credenciais extraídas do PDF`, {
        description: 'Revise os dados antes de importar',
      });

    } catch (error: any) {
      console.error('PDF parse error:', error);
      toast.error('Erro ao processar PDF', {
        description: error.message || 'Verifique o formato do ficheiro',
      });
      setStep('upload');
    } finally {
      setIsPdfProcessing(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const parseFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);

      const credentials: ParsedCredential[] = [];

      for (const row of rows as Record<string, unknown>[]) {
        // Try to find NIF column (case-insensitive)
        const nifKey = Object.keys(row).find(k => 
          k.toLowerCase().includes('nif') || k.toLowerCase() === 'contribuinte'
        );
        // Try to find password column
        const passKey = Object.keys(row).find(k => 
          k.toLowerCase().includes('senha') || 
          k.toLowerCase().includes('password') ||
          k.toLowerCase().includes('pass')
        );
        // Try to find name column
        const nameKey = Object.keys(row).find(k => 
          k.toLowerCase().includes('nome') || k.toLowerCase() === 'name'
        );

        const nif = nifKey ? String(row[nifKey] || '').replace(/\D/g, '') : '';
        const password = passKey ? String(row[passKey] || '').trim() : '';
        const name = nameKey ? String(row[nameKey] || '').trim() : undefined;

        // Validate
        let valid = true;
        let error: string | undefined;

        if (!nif || nif.length !== 9) {
          valid = false;
          error = 'NIF inválido (deve ter 9 dígitos)';
        } else if (!password) {
          valid = false;
          error = 'Password em falta';
        }

        if (nif || password) {
          credentials.push({ nif, password, name, valid, error });
        }
      }

      if (credentials.length === 0) {
        toast.error('Ficheiro vazio ou formato não reconhecido', {
          description: 'O ficheiro deve ter colunas "NIF" e "Senha/Password"',
        });
        return;
      }

      setParsedCredentials(credentials);
      setStep('preview');
    } catch (error: any) {
      toast.error('Erro ao ler ficheiro', {
        description: error.message,
      });
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    const supportedFile = files.find(f => 
      f.name.endsWith('.xlsx') || 
      f.name.endsWith('.xls') || 
      f.name.endsWith('.csv') ||
      f.name.endsWith('.pdf')
    );

    if (supportedFile) {
      if (supportedFile.name.endsWith('.pdf')) {
        parsePdfFile(supportedFile);
      } else {
        parseFile(supportedFile);
      }
    } else {
      toast.error('Tipo de ficheiro não suportado', {
        description: 'Use ficheiros Excel (.xlsx, .xls), CSV ou PDF',
      });
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.pdf')) {
        parsePdfFile(file);
      } else {
        parseFile(file);
      }
    }
  };

  const handleImport = async () => {
    const validCredentials = parsedCredentials.filter(c => c.valid);
    
    if (validCredentials.length === 0) {
      toast.error('Não há credenciais válidas para importar');
      return;
    }

    setStep('importing');

    try {
      const result = await importMutation.mutateAsync(
        validCredentials.map(c => ({
          nif: c.nif,
          portal_password: c.password,
          full_name: c.name,
        }))
      );

      setResults(result.results || []);
      setStep('results');
      onSuccess?.();
    } catch (error) {
      setStep('preview');
    }
  };

  const downloadTemplate = () => {
    const template = [
      { NIF: '123456789', Senha: 'PASSWORD123', Nome: 'Exemplo Cliente' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credenciais');
    XLSX.writeFile(wb, 'template_credenciais.xlsx');
    toast.success('Template transferido');
  };

  const validCount = parsedCredentials.filter(c => c.valid).length;
  const invalidCount = parsedCredentials.filter(c => !c.valid).length;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetState(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Importar Credenciais
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Credenciais do Portal das Finanças
          </DialogTitle>
          <DialogDescription>
            Carregue um ficheiro Excel, CSV ou PDF com NIFs e passwords dos seus clientes
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="flex justify-center gap-4 mb-4">
                  <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
                  <FileText className="h-10 w-10 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">
                  Arraste um ficheiro Excel, CSV ou <strong>PDF</strong> aqui, ou
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,.pdf"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Button variant="outline" asChild>
                    <span>Seleccionar Ficheiro</span>
                  </Button>
                </label>
              </div>

              <Alert className="border-primary/30 bg-primary/5">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertDescription className="text-sm">
                  <p className="font-medium mb-1">Suporta PDF!</p>
                  <p className="text-muted-foreground">
                    Pode carregar directamente o PDF com as credenciais. A IA extrai automaticamente os NIFs e passwords.
                  </p>
                </AlertDescription>
              </Alert>

              <Alert>
                <AlertDescription className="text-sm">
                  <p className="font-medium mb-2">Formato Excel/CSV:</p>
                  <p className="text-muted-foreground">
                    O ficheiro deve ter colunas "NIF" (ou "Contribuinte") e "Senha" (ou "Password").
                  </p>
                </AlertDescription>
              </Alert>

              <Button variant="link" className="p-0 h-auto" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-1" />
                Transferir template Excel
              </Button>
            </div>
          )}

          {/* Step 1.5: Parsing PDF */}
          {step === 'parsing' && (
            <div className="py-12 text-center space-y-4">
              <div className="relative mx-auto w-fit">
                <FileText className="h-12 w-12 text-primary animate-pulse" />
                <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-bounce" />
              </div>
              <p className="font-medium">A extrair credenciais do PDF...</p>
              <p className="text-sm text-muted-foreground">A IA está a processar o documento</p>
              <Progress value={undefined} className="max-w-xs mx-auto" />
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="default" className="bg-green-600">
                  {validCount} válidos
                </Badge>
                {invalidCount > 0 && (
                  <Badge variant="destructive">
                    {invalidCount} inválidos
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Password</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedCredentials.map((cred, i) => (
                      <TableRow key={i} className={cred.valid ? '' : 'bg-red-50/50'}>
                        <TableCell>
                          {cred.valid ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{cred.nif || '—'}</TableCell>
                        <TableCell>{cred.name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {cred.password ? '••••••••' : '—'}
                        </TableCell>
                        <TableCell>
                          {cred.valid ? (
                            <span className="text-green-600 text-sm">OK</span>
                          ) : (
                            <span className="text-red-600 text-sm">{cred.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {invalidCount} registo(s) inválido(s) serão ignorados.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
              <p className="text-muted-foreground">A importar {validCount} credenciais...</p>
              <Progress value={50} className="max-w-xs mx-auto" />
            </div>
          )}

          {/* Step 4: Results */}
          {step === 'results' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                {results.filter(r => r.status === 'created').length > 0 && (
                  <Badge variant="default" className="bg-emerald-600">
                    {results.filter(r => r.status === 'created').length} criados
                  </Badge>
                )}
                {results.filter(r => r.status === 'associated').length > 0 && (
                  <Badge variant="default" className="bg-blue-600">
                    {results.filter(r => r.status === 'associated').length} associados
                  </Badge>
                )}
                {results.filter(r => r.status === 'imported').length > 0 && (
                  <Badge variant="default" className="bg-green-600">
                    {results.filter(r => r.status === 'imported').length} importados
                  </Badge>
                )}
                {results.filter(r => r.status === 'updated').length > 0 && (
                  <Badge variant="secondary">
                    {results.filter(r => r.status === 'updated').length} actualizados
                  </Badge>
                )}
                {results.filter(r => r.status === 'error').length > 0 && (
                  <Badge variant="destructive">
                    {results.filter(r => r.status === 'error').length} erros
                  </Badge>
                )}
              </div>

              {results.filter(r => r.status === 'created').length > 0 && (
                <Alert className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-sm">
                    <strong>{results.filter(r => r.status === 'created').length} novos clientes</strong> foram criados automaticamente e associados à sua conta.
                  </AlertDescription>
                </Alert>
              )}

              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>NIF</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {result.status === 'created' && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                          {result.status === 'associated' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                          {result.status === 'imported' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {result.status === 'updated' && <CheckCircle2 className="h-4 w-4 text-sky-600" />}
                          {result.status === 'not_found' && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          {result.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{result.nif}</TableCell>
                        <TableCell className="text-sm truncate max-w-[150px]">
                          {result.clientName || '—'}
                        </TableCell>
                        <TableCell>
                          {result.status === 'created' && <span className="text-emerald-600 text-sm">Criado + Credenciais</span>}
                          {result.status === 'associated' && <span className="text-blue-600 text-sm">Associado + Credenciais</span>}
                          {result.status === 'imported' && <span className="text-green-600 text-sm">Importado</span>}
                          {result.status === 'updated' && <span className="text-sky-600 text-sm">Actualizado</span>}
                          {result.status === 'not_found' && (
                            <span className="text-amber-600 text-sm">Não encontrado</span>
                          )}
                          {result.status === 'error' && (
                            <span className="text-red-600 text-sm">{result.error}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={validCount === 0}>
                Importar {validCount} Credenciais
              </Button>
            </>
          )}

          {step === 'results' && (
            <Button onClick={() => setOpen(false)}>
              Fechar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

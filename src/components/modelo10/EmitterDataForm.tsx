/**
 * Emitter Data Form Component
 * Allows user to enter/edit company information for Modelo 10 declarations
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  Save,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  EmitterData,
  DEFAULT_EMITTER,
  saveEmitterData,
  loadEmitterData,
  clearEmitterData,
  hasEmitterData,
} from '@/lib/emitterStorage';
import { validatePortugueseNIF } from '@/lib/nifValidator';

interface EmitterDataFormProps {
  onSave?: (data: EmitterData) => void;
  compact?: boolean;
}

export function EmitterDataForm({ onSave, compact = false }: EmitterDataFormProps) {
  const [formData, setFormData] = useState<EmitterData>(DEFAULT_EMITTER);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [nifError, setNifError] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    const stored = loadEmitterData();
    setFormData(stored);
    setIsSaved(hasEmitterData());
  }, []);

  const handleChange = (field: keyof EmitterData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    setIsSaved(false);

    // Validate NIF on change
    if (field === 'companyNIF') {
      const cleanNIF = value.replace(/\s/g, '');
      if (cleanNIF.length === 9) {
        const validation = validatePortugueseNIF(cleanNIF);
        setNifError(validation.valid ? null : validation.error || 'NIF inválido');
      } else if (cleanNIF.length > 0) {
        setNifError('NIF deve ter 9 dígitos');
      } else {
        setNifError(null);
      }
    }
  };

  const handleSave = () => {
    // Validate required fields
    if (!formData.companyName.trim()) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    if (!formData.companyNIF.trim()) {
      toast.error('NIF da empresa é obrigatório');
      return;
    }

    const cleanNIF = formData.companyNIF.replace(/\s/g, '');
    const nifValidation = validatePortugueseNIF(cleanNIF);
    if (!nifValidation.valid) {
      toast.error(`NIF inválido: ${nifValidation.error || 'Verifique o NIF'}`);
      return;
    }

    // Save to localStorage
    const dataToSave = { ...formData, companyNIF: cleanNIF };
    saveEmitterData(dataToSave);

    setIsDirty(false);
    setIsSaved(true);
    toast.success('Dados do emitente guardados');

    onSave?.(dataToSave);
  };

  const handleClear = () => {
    clearEmitterData();
    setFormData(DEFAULT_EMITTER);
    setIsDirty(false);
    setIsSaved(false);
    setNifError(null);
    toast.info('Dados do emitente removidos');
  };

  if (compact) {
    return (
      <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Dados do Emitente</span>
          </div>
          {isSaved ? (
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700">
              <CheckCircle2 className="h-3 w-3" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
              <AlertCircle className="h-3 w-3" />
              Não configurado
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Empresa</Label>
            <Input
              value={formData.companyName}
              onChange={(e) => handleChange('companyName', e.target.value)}
              placeholder="Nome da empresa"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">NIF</Label>
            <Input
              value={formData.companyNIF}
              onChange={(e) => handleChange('companyNIF', e.target.value)}
              placeholder="123456789"
              maxLength={9}
              className={`h-8 text-sm font-mono ${nifError ? 'border-red-500' : ''}`}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Responsável</Label>
            <Input
              value={formData.responsibleName}
              onChange={(e) => handleChange('responsibleName', e.target.value)}
              placeholder="Nome do TOC"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="email@empresa.pt"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {isDirty && (
          <Button onClick={handleSave} size="sm" className="w-full gap-2">
            <Save className="h-3 w-3" />
            Guardar
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Dados do Emitente
          {isSaved && (
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 ml-2">
              <CheckCircle2 className="h-3 w-3" />
              Guardado
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Informação da empresa/contabilista que emite as declarações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Empresa
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome da Empresa *</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Ex: Accounting Advantage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyNIF">NIF da Empresa *</Label>
              <Input
                id="companyNIF"
                value={formData.companyNIF}
                onChange={(e) => handleChange('companyNIF', e.target.value)}
                placeholder="123456789"
                maxLength={9}
                className={`font-mono ${nifError ? 'border-red-500' : ''}`}
              />
              {nifError && (
                <p className="text-xs text-red-500">{nifError}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="companyAddress">Morada</Label>
              <Input
                id="companyAddress"
                value={formData.companyAddress}
                onChange={(e) => handleChange('companyAddress', e.target.value)}
                placeholder="Rua, número, andar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyPostalCode">Código Postal</Label>
              <Input
                id="companyPostalCode"
                value={formData.companyPostalCode}
                onChange={(e) => handleChange('companyPostalCode', e.target.value)}
                placeholder="1234-567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyCity">Cidade</Label>
            <Input
              id="companyCity"
              value={formData.companyCity}
              onChange={(e) => handleChange('companyCity', e.target.value)}
              placeholder="Lisboa"
            />
          </div>
        </div>

        {/* Contact Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Mail className="h-4 w-4" />
            Contactos
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="contabilidade@empresa.pt"
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+351 21 123 4567"
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Responsible Person Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            Responsável
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="responsibleName">Nome do Responsável</Label>
              <Input
                id="responsibleName"
                value={formData.responsibleName}
                onChange={(e) => handleChange('responsibleName', e.target.value)}
                placeholder="Ex: Adélia Gaspar"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="responsibleRole">Cargo</Label>
              <Input
                id="responsibleRole"
                value={formData.responsibleRole}
                onChange={(e) => handleChange('responsibleRole', e.target.value)}
                placeholder="Ex: Técnica Oficial de Contas"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="crcNumber">Nº Ordem Contabilistas (opcional)</Label>
            <Input
              id="crcNumber"
              value={formData.crcNumber || ''}
              onChange={(e) => handleChange('crcNumber', e.target.value)}
              placeholder="Ex: 12345"
            />
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="border-primary/20 bg-primary/5">
          <Building2 className="h-4 w-4 text-primary" />
          <AlertDescription>
            Estes dados serão usados no cabeçalho das declarações PDF e Excel exportadas.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleClear}
            className="gap-2 text-red-600 hover:bg-red-50"
            disabled={!isSaved && !isDirty}
          >
            <Trash2 className="h-4 w-4" />
            Limpar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 gap-2"
            disabled={!isDirty}
          >
            <Save className="h-4 w-4" />
            Guardar Dados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WithholdingCandidate } from '@/hooks/useWithholdingCandidates';

interface EditWithholdingCandidateDialogProps {
  candidate: WithholdingCandidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: {
    candidateId: string;
    updates: {
      beneficiary_name?: string | null;
      beneficiary_nif?: string;
      document_reference?: string;
      payment_date?: string;
      income_category?: string;
      gross_amount?: number;
      withholding_rate?: number | null;
      withholding_amount?: number;
      notes?: string | null;
    };
  }) => Promise<void>;
  isSaving?: boolean;
}

const INCOME_CATEGORY_OPTIONS = [
  { value: 'A', label: 'A - Trabalho dependente' },
  { value: 'B', label: 'B - Independente' },
  { value: 'D', label: 'D - Transparência fiscal' },
  { value: 'E', label: 'E - Capitais' },
  { value: 'F', label: 'F - Prediais' },
  { value: 'G', label: 'G - Mais-valias' },
  { value: 'H', label: 'H - Pensões' },
  { value: 'R', label: 'R - Não residente' },
];

export function EditWithholdingCandidateDialog({
  candidate,
  open,
  onOpenChange,
  onSave,
  isSaving = false,
}: EditWithholdingCandidateDialogProps) {
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryNif, setBeneficiaryNif] = useState('');
  const [documentReference, setDocumentReference] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [incomeCategory, setIncomeCategory] = useState('B');
  const [grossAmount, setGrossAmount] = useState('');
  const [withholdingAmount, setWithholdingAmount] = useState('');
  const [withholdingRate, setWithholdingRate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!candidate) return;

    setBeneficiaryName(candidate.beneficiary_name || '');
    setBeneficiaryNif(candidate.beneficiary_nif || '');
    setDocumentReference(candidate.document_reference || '');
    setPaymentDate(candidate.payment_date || '');
    setIncomeCategory(candidate.income_category || 'B');
    setGrossAmount(String(candidate.gross_amount ?? ''));
    setWithholdingAmount(String(candidate.withholding_amount ?? ''));
    setWithholdingRate(candidate.withholding_rate == null ? '' : String(candidate.withholding_rate));
    setNotes('');
  }, [candidate]);

  const handleSave = async () => {
    if (!candidate) return;

    await onSave({
      candidateId: candidate.id,
      updates: {
        beneficiary_name: beneficiaryName.trim() || null,
        beneficiary_nif: beneficiaryNif.trim(),
        document_reference: documentReference.trim(),
        payment_date: paymentDate,
        income_category: incomeCategory,
        gross_amount: Number(grossAmount),
        withholding_amount: Number(withholdingAmount),
        withholding_rate: withholdingRate.trim() ? Number(withholdingRate) : null,
        notes: notes.trim() || null,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar candidato de retenção</DialogTitle>
          <DialogDescription>
            Ajuste os campos antes de promover para o Modelo 10. A edição fica registada no candidato.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="candidate-beneficiary-name">Beneficiário</Label>
              <Input
                id="candidate-beneficiary-name"
                value={beneficiaryName}
                onChange={(event) => setBeneficiaryName(event.target.value)}
                placeholder="Nome do beneficiário"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-beneficiary-nif">NIF</Label>
              <Input
                id="candidate-beneficiary-nif"
                value={beneficiaryNif}
                onChange={(event) => setBeneficiaryNif(event.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="candidate-document-reference">Referência</Label>
              <Input
                id="candidate-document-reference"
                value={documentReference}
                onChange={(event) => setDocumentReference(event.target.value)}
                placeholder="FR ATSIRE..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-payment-date">Data de pagamento</Label>
              <Input
                id="candidate-payment-date"
                type="date"
                value={paymentDate}
                onChange={(event) => setPaymentDate(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2 md:col-span-1">
              <Label>Categoria</Label>
              <Select value={incomeCategory} onValueChange={setIncomeCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INCOME_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-gross">Bruto</Label>
              <Input
                id="candidate-gross"
                type="number"
                step="0.01"
                value={grossAmount}
                onChange={(event) => setGrossAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-withholding">Retenção</Label>
              <Input
                id="candidate-withholding"
                type="number"
                step="0.01"
                value={withholdingAmount}
                onChange={(event) => setWithholdingAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="candidate-rate">Taxa</Label>
              <Input
                id="candidate-rate"
                type="number"
                step="0.01"
                value={withholdingRate}
                onChange={(event) => setWithholdingRate(event.target.value)}
                placeholder="23"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate-notes">Notas da revisão</Label>
            <Textarea
              id="candidate-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Explique a correção efetuada para auditoria."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !candidate}>
            Guardar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

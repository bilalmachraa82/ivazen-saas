import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle, Loader2, Tag, Sparkles } from 'lucide-react';

const REVENUE_CATEGORIES = [
  { value: 'prestacao_servicos', label: 'Prestação de Serviços', coefficient: 0.70 },
  { value: 'vendas', label: 'Venda de Produtos', coefficient: 0.20 },
  { value: 'outros_rendimentos', label: 'Outros Rendimentos', coefficient: 0.70 },
];

interface SalesClassificationEditorProps {
  invoice: {
    id: string;
    revenue_category: string | null;
    ai_category_confidence: number | null;
    status: string | null;
  };
  onValidate: (invoiceId: string, category: string, notes?: string) => Promise<boolean>;
  isValidating: boolean;
}

export function SalesClassificationEditor({
  invoice,
  onValidate,
  isValidating,
}: SalesClassificationEditorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(
    invoice.revenue_category || 'prestacao_servicos'
  );
  
  const isAlreadyValidated = invoice.status === 'validated';
  const hasAIConfidence = invoice.ai_category_confidence !== null && invoice.ai_category_confidence > 0;

  const handleValidate = async () => {
    await onValidate(invoice.id, selectedCategory);
  };

  const getCategoryLabel = (value: string) => {
    return REVENUE_CATEGORIES.find(c => c.value === value)?.label || value;
  };

  const getCategoryCoefficient = (value: string) => {
    return REVENUE_CATEGORIES.find(c => c.value === value)?.coefficient || 0.70;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <h4 className="font-medium">Categoria de Receita</h4>
      </div>

      {/* AI Suggestion Badge */}
      {hasAIConfidence && invoice.revenue_category && (
        <div className="flex items-center gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Sugestão IA</p>
            <p className="text-xs text-muted-foreground">
              {getCategoryLabel(invoice.revenue_category)} ({invoice.ai_category_confidence}% confiança)
            </p>
          </div>
        </div>
      )}

      {/* Category Selector */}
      <div className="space-y-2">
        <Label>Categoria para Segurança Social</Label>
        <Select
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          disabled={isAlreadyValidated}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REVENUE_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                <div className="flex items-center justify-between w-full gap-4">
                  <span>{cat.label}</span>
                  <Badge variant="outline" className="text-[10px]">
                    coef. {(cat.coefficient * 100).toFixed(0)}%
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Coeficiente aplicado: {(getCategoryCoefficient(selectedCategory) * 100).toFixed(0)}% 
          (base de incidência para SS)
        </p>
      </div>

      {/* Validate Button */}
      {isAlreadyValidated ? (
        <div className="flex items-center gap-2 p-4 bg-success/10 rounded-lg text-success">
          <CheckCircle className="h-5 w-5" />
          <div>
            <span className="font-medium">Factura validada</span>
            <p className="text-xs opacity-80">
              Categoria: {getCategoryLabel(selectedCategory)}
            </p>
          </div>
        </div>
      ) : (
        <Button
          onClick={handleValidate}
          disabled={isValidating}
          className="w-full gap-2"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              A validar...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Validar com Categoria
            </>
          )}
        </Button>
      )}
    </div>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface SubmissionGuideProps {
  quarter: string;
  quarterLabel: string;
  totalRevenue: number;
  contributionBase: number;
  contributionAmount: number;
  contributionRate: number;
  hasAccountantSS?: boolean;
  isSubmitted?: boolean;
}

export function SubmissionGuide({
  quarter,
  quarterLabel,
  totalRevenue,
  contributionBase,
  contributionAmount,
  contributionRate,
  hasAccountantSS,
  isSubmitted,
}: SubmissionGuideProps) {
  const copyDataForSS = () => {
    const text = `Período: ${quarterLabel}
Total de Rendimentos: ${totalRevenue.toFixed(2)}€
Base de Incidência (70%): ${contributionBase.toFixed(2)}€
Taxa Contributiva: ${contributionRate}%
Contribuição a Pagar: ${contributionAmount.toFixed(2)}€`;

    navigator.clipboard.writeText(text);
    toast.success('Dados copiados para colar na SS Directa');
  };

  const copyValue = (value: number, label: string) => {
    navigator.clipboard.writeText(value.toFixed(2));
    toast.success(`${label} copiado`);
  };

  if (hasAccountantSS) {
    return (
      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-blue-500/20">
              <CheckCircle2 className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Contabilista Responsável</h3>
              <p className="text-muted-foreground mt-1">
                A sua declaração trimestral será submetida pelo seu contabilista.
                Os dados estão disponíveis para consulta e partilha.
              </p>
              <Button 
                variant="outline" 
                className="mt-4 gap-2"
                onClick={copyDataForSS}
              >
                <Copy className="h-4 w-4" />
                Copiar Dados para Enviar ao Contabilista
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isSubmitted) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-green-500/20">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Declaração Submetida</h3>
              <p className="text-muted-foreground mt-1">
                A declaração para {quarterLabel} foi marcada como submetida.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Submeter na SS Directa
          <Badge variant="outline">Passo a Passo</Badge>
        </CardTitle>
        <CardDescription>
          Siga os passos abaixo para submeter a sua declaração trimestral
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Copy Values */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg">
          <button 
            onClick={() => copyValue(totalRevenue, 'Total Rendimentos')}
            className="text-left p-3 rounded-lg hover:bg-background transition-colors"
          >
            <p className="text-xs text-muted-foreground">Total Rendimentos</p>
            <p className="font-semibold">{totalRevenue.toFixed(2)}€</p>
            <Copy className="h-3 w-3 mt-1 text-muted-foreground" />
          </button>
          <button 
            onClick={() => copyValue(contributionBase, 'Base Incidência')}
            className="text-left p-3 rounded-lg hover:bg-background transition-colors"
          >
            <p className="text-xs text-muted-foreground">Base Incidência</p>
            <p className="font-semibold">{contributionBase.toFixed(2)}€</p>
            <Copy className="h-3 w-3 mt-1 text-muted-foreground" />
          </button>
          <button 
            onClick={() => copyValue(contributionRate, 'Taxa')}
            className="text-left p-3 rounded-lg hover:bg-background transition-colors"
          >
            <p className="text-xs text-muted-foreground">Taxa</p>
            <p className="font-semibold">{contributionRate}%</p>
            <Copy className="h-3 w-3 mt-1 text-muted-foreground" />
          </button>
          <button 
            onClick={() => copyValue(contributionAmount, 'A Pagar')}
            className="text-left p-3 rounded-lg hover:bg-background transition-colors border-2 border-primary/30"
          >
            <p className="text-xs text-muted-foreground">A Pagar</p>
            <p className="font-semibold text-primary">{contributionAmount.toFixed(2)}€</p>
            <Copy className="h-3 w-3 mt-1 text-muted-foreground" />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium">Aceder à SS Directa</p>
              <p className="text-sm text-muted-foreground">
                Faça login com Chave Móvel Digital ou senha de acesso
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 gap-2"
                onClick={() => window.open('https://app.seg-social.pt/sso/login', '_blank')}
              >
                Abrir SS Directa
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              2
            </div>
            <div>
              <p className="font-medium">Navegar para Declaração Trimestral</p>
              <p className="text-sm text-muted-foreground">
                Menu: Emprego → Trabalhador Independente → Declaração Trimestral
              </p>
            </div>
          </div>

          <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium">Preencher os Valores</p>
              <p className="text-sm text-muted-foreground mb-3">
                Clique nos valores acima para copiar e colar no formulário
              </p>
              <Button 
                variant="secondary"
                size="sm" 
                className="gap-2"
                onClick={copyDataForSS}
              >
                <Copy className="h-4 w-4" />
                Copiar Todos os Dados
              </Button>
            </div>
          </div>

          <div className="ml-4 border-l-2 border-dashed border-muted-foreground/30 h-4" />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
              4
            </div>
            <div>
              <p className="font-medium">Submeter e Guardar Comprovativo</p>
              <p className="text-sm text-muted-foreground">
                Após submeter, guarde o PDF do comprovativo
              </p>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">Prazo de Entrega</p>
            <p className="text-muted-foreground">
              A declaração deve ser entregue até ao dia 15 do mês seguinte ao trimestre
              (Janeiro, Abril, Julho, Outubro).
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

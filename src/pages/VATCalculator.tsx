import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { VATExemptionChecker, VATValueCalculator, VATPaymentCalculator } from '@/components/vat';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, CheckCircle2, ArrowRightLeft, Receipt } from 'lucide-react';

export default function VATCalculator() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg">
            <Calculator className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Calculadora de IVA</h1>
            <p className="text-muted-foreground mt-1">
              Ferramentas para trabalhadores independentes - Regime 2025
            </p>
          </div>
        </div>

        {/* Tabs para os diferentes calculadores */}
        <Tabs defaultValue="exemption" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
            <TabsTrigger value="exemption" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Verificar Isenção</span>
              <span className="sm:hidden">Isenção</span>
            </TabsTrigger>
            <TabsTrigger value="calculate" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Calcular Valores</span>
              <span className="sm:hidden">Valores</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">IVA a Entregar</span>
              <span className="sm:hidden">Entregar</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exemption" className="mt-6">
            <VATExemptionChecker />
          </TabsContent>

          <TabsContent value="calculate" className="mt-6">
            <VATValueCalculator />
          </TabsContent>

          <TabsContent value="payment" className="mt-6">
            <VATPaymentCalculator />
          </TabsContent>
        </Tabs>

        {/* Informação adicional */}
        <div className="bg-muted/30 rounded-lg p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Legislação de Referência (2025)</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Art. 53º CIVA</strong> - Regime de isenção para pequenos contribuintes (limiar €15.000)</li>
            <li><strong>Art. 53º nº2</strong> - Regra da tolerância de 25% (limiar €18.750)</li>
            <li><strong>Art. 41º CIVA</strong> - Entrega trimestral do IVA (até dia 20 do 2º mês seguinte)</li>
            <li><strong>Taxas</strong> - Continente 23%/13%/6% | Açores 16%/9%/4% | Madeira 22%/12%/5%</li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}

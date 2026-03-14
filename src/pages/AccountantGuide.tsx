/**
 * Accountant Guide — In-app reference for the accounting team.
 * Content drawn from docs/SOP_EQUIPE_CONTABILIDADE and docs/IVAzen_Guia_Adopcao_Contabilista.
 */

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ZenHeader, ZenCard, ZenDecorations } from '@/components/zen';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  PieChart,
  Upload,
  CheckCircle,
  TrendingUp,
  Shield,
  Receipt,
  ArrowLeftRight,
  FileOutput,
  Layers,
  AlertTriangle,
  Lightbulb,
  Keyboard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

interface GuideSection {
  id: string;
  title: string;
  icon: typeof BookOpen;
  badge?: string;
  items: { text: string; link?: string; highlight?: boolean }[];
}

const sections: GuideSection[] = [
  {
    id: 'fluxo',
    title: 'Fluxo padrão por cliente',
    icon: PieChart,
    badge: 'Essencial',
    items: [
      { text: '1. Escolher cliente no Dashboard', link: '/dashboard' },
      { text: '2. Abrir Centro Fiscal — hub do cliente', link: '/centro-fiscal' },
      { text: '3. Se faltarem dados → Centro de Importação ou AT Control Center', link: '/centro-importacao' },
      { text: '4. Compras → validar classificação IA', link: '/validation' },
      { text: '5. Vendas → confirmar receitas / recibos verdes', link: '/sales' },
      { text: '6. Segurança Social → quando aplicável (ENI)', link: '/seguranca-social' },
      { text: '7. Modelo 10 → retenções na fonte', link: '/modelo-10' },
      { text: '8. Reconciliação → cruzar dados AT vs app', link: '/reconciliation' },
      { text: '9. Apuramento / Exportação → gerar ficheiros', link: '/export' },
    ],
  },
  {
    id: 'iva',
    title: 'Como trabalhar IVA (Declaração Periódica)',
    icon: CheckCircle,
    items: [
      { text: '1. Importar compras → Centro de Importação (SIRE CSV ou upload manual)', link: '/centro-importacao' },
      { text: '2. Validar classificações → Compras — IA classifica automaticamente, filtrar por "Pendente"', link: '/validation' },
      { text: '3. Verificar vendas → confirmar recibos verdes importados', link: '/sales' },
      { text: '4. Gerar apuramento → totais por taxa IVA (6%, 13%, 23%), exportar Excel/PDF', link: '/export' },
    ],
  },
  {
    id: 'ss',
    title: 'Como trabalhar Segurança Social',
    icon: Shield,
    items: [
      { text: '1. Importar recibos verdes → carregar Excel do portal AT', link: '/centro-importacao' },
      { text: '2. Abrir Segurança Social', link: '/seguranca-social' },
      { text: '3. Selecionar trimestre → cálculos automáticos: rendimento bruto, coeficiente, base tributável' },
      { text: '4. Taxa 21,4% independente. Trimestre N determina contribuições de N+1' },
      { text: 'Nota: aplica-se a ENI / trabalhadores independentes', highlight: true },
    ],
  },
  {
    id: 'modelo10',
    title: 'Como trabalhar Modelo 10 (Retenções)',
    icon: Receipt,
    items: [
      { text: '1. Importar SIRE → Centro de Importação → ficheiro CSV do AT', link: '/centro-importacao' },
      { text: '2. Abrir Modelo 10', link: '/modelo-10' },
      { text: '3. Verificar retenções → lista por beneficiário, NIF, categoria, montante' },
      { text: '4. Reconciliar → cruzar dados AT vs manual' },
      { text: '5. Exportar → PDF por beneficiário ou ficheiro completo' },
    ],
  },
  {
    id: 'importacao',
    title: 'Métodos de importação',
    icon: Layers,
    items: [
      { text: 'SIRE CSV (AT) — importar compras e retenções directamente', link: '/centro-importacao' },
      { text: 'Recibos Verdes Excel (AT) — para vendas / Segurança Social', link: '/centro-importacao' },
      { text: 'Upload manual (PDF/imagem) — documentos avulsos com OCR + IA', link: '/upload' },
      { text: 'SAFT-PT (XML) — importar de software de facturação', link: '/upload?mode=saft' },
      { text: 'Upload em Bulk — até 3.000 ficheiros por envio', link: '/upload?mode=bulk' },
    ],
  },
  {
    id: 'vazio',
    title: 'Cliente sem dados — o que fazer',
    icon: AlertTriangle,
    items: [
      { text: 'Sem facturas importadas → Importar via Centro de Importação (SIRE ou upload)', link: '/centro-importacao' },
      { text: 'Sem recibos verdes → Pedir ao cliente o Excel do portal AT' },
      { text: 'Sem credenciais AT → Pedir NIF + password do portal AT ao cliente' },
      { text: 'Sem retenções → Normal se o cliente não tem rendimentos sujeitos a retenção' },
      { text: 'Dados desactualizados → Re-importar o ficheiro SIRE mais recente' },
      { text: 'Não assumir bug — confirmar: há credenciais? dados importados? período correcto?', highlight: true },
    ],
  },
];

const shortcuts = [
  { keys: 'Cmd+K', desc: 'Pesquisa rápida / paleta de comandos' },
  { keys: 'g → d', desc: 'Dashboard' },
  { keys: 'g → u', desc: 'Upload' },
  { keys: 'g → v', desc: 'Compras' },
  { keys: 'g → s', desc: 'Vendas' },
  { keys: 'g → e', desc: 'Definições' },
  { keys: 'Shift+?', desc: 'Ver todos os atalhos' },
];

export default function AccountantGuide() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['fluxo']));

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 relative animate-fade-in">
        <ZenDecorations />

        <ZenHeader
          icon={BookOpen}
          title="Guia do Contabilista"
          description="Referência rápida para o dia-a-dia — fluxos de trabalho, importação e resolução de problemas."
        />

        {/* Regra de Ouro */}
        <ZenCard gradient="primary" className="shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-primary/20 shrink-0">
                <Lightbulb className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-lg text-foreground mb-1">Regra de Ouro</p>
                <p className="text-muted-foreground">
                  Se há dados, trabalha-se a partir do <Link to="/centro-fiscal" className="text-primary font-medium hover:underline">Centro Fiscal</Link>.
                  Se não há dados, o próximo passo é <Link to="/centro-importacao" className="text-primary font-medium hover:underline">Importação</Link> ou{' '}
                  <Link to="/at-control-center" className="text-primary font-medium hover:underline">AT Control Center</Link>.
                </p>
              </div>
            </div>
          </CardContent>
        </ZenCard>

        {/* Workflow Sections */}
        <div className="space-y-3">
          {sections.map((section) => (
            <Collapsible
              key={section.id}
              open={openSections.has(section.id)}
              onOpenChange={() => toggleSection(section.id)}
            >
              <ZenCard className="shadow-sm">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="py-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-xl">
                    <CardTitle className="text-base font-semibold flex items-center gap-3">
                      <section.icon className="h-5 w-5 text-primary shrink-0" />
                      <span className="flex-1 text-left">{section.title}</span>
                      {section.badge && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                          {section.badge}
                        </Badge>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${openSections.has(section.id) ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 pb-4">
                    <ul className="space-y-2">
                      {section.items.map((item, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-2 text-sm ${
                            item.highlight
                              ? 'text-amber-700 dark:text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20'
                              : 'text-muted-foreground'
                          }`}
                        >
                          <span className="shrink-0 mt-0.5">
                            {item.highlight ? '⚠' : '→'}
                          </span>
                          {item.link ? (
                            <Link to={item.link} className="hover:text-primary hover:underline transition-colors">
                              {item.text}
                            </Link>
                          ) : (
                            <span>{item.text}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </CollapsibleContent>
              </ZenCard>
            </Collapsible>
          ))}
        </div>

        {/* Keyboard Shortcuts */}
        <ZenCard className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              <Keyboard className="h-5 w-5 text-primary" />
              Atalhos de Teclado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {shortcuts.map((s, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono border border-border min-w-[80px] text-center">
                    {s.keys}
                  </kbd>
                  <span className="text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </ZenCard>

        {/* Reference clients */}
        <ZenCard className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-3">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              Clientes de Referência para Formação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium text-sm">Bilal Machraa</p>
                <p className="text-xs text-muted-foreground">Centro Fiscal + Compras + Vendas + SS</p>
                <Badge variant="outline" className="text-xs">ENI</Badge>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium text-sm">CAAD</p>
                <p className="text-xs text-muted-foreground">Modelo 10 + Reconciliação</p>
                <Badge variant="outline" className="text-xs">Empresa</Badge>
              </div>
              <div className="rounded-lg border p-3 space-y-1">
                <p className="font-medium text-sm">Justyna Rogers</p>
                <p className="text-xs text-muted-foreground">IVA com período correcto</p>
                <Badge variant="outline" className="text-xs">ENI</Badge>
              </div>
            </div>
          </CardContent>
        </ZenCard>
      </div>
    </DashboardLayout>
  );
}

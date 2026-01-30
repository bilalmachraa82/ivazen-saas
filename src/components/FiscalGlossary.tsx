'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Receipt,
  Shield,
  Building2,
  Calculator,
  Percent,
  FileText,
  Globe,
  ExternalLink,
  Info,
  ChevronRight
} from 'lucide-react';
import { ZenCard, ZenCardHeader, ZenCardContent } from '@/components/zen/ZenCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Categorias dos termos fiscais
type TermCategory = 'iva' | 'ss' | 'modelo10' | 'geral';

interface FiscalTerm {
  id: string;
  term: string;
  abbreviation?: string;
  definition: string;
  category: TermCategory;
  icon: typeof BookOpen;
  examples?: string[];
  officialLink?: string;
  relatedTerms?: string[];
}

// Definicao das categorias
const categories: Record<TermCategory, { label: string; icon: typeof BookOpen; color: string }> = {
  iva: {
    label: 'IVA',
    icon: Receipt,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  },
  ss: {
    label: 'Seguranca Social',
    icon: Shield,
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
  },
  modelo10: {
    label: 'Modelo 10',
    icon: FileText,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  },
  geral: {
    label: 'Geral',
    icon: Building2,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
  },
};

// Lista completa de termos fiscais
const fiscalTerms: FiscalTerm[] = [
  // Termos de IVA
  {
    id: 'iva',
    term: 'Imposto sobre o Valor Acrescentado',
    abbreviation: 'IVA',
    definition: 'Imposto indireto sobre o consumo que incide sobre a generalidade das transmissoes de bens e prestacoes de servicos. E cobrado em cada fase da cadeia de producao e distribuicao, sendo o consumidor final quem suporta o imposto.',
    category: 'iva',
    icon: Receipt,
    examples: [
      'Compra de material de escritorio: IVA a 23%',
      'Servicos de restauracao: IVA a 13%',
      'Produtos alimentares basicos: IVA a 6%'
    ],
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/codigo-do-iva-indice.aspx',
    relatedTerms: ['CIVA', 'Base Tributavel', 'Taxa Normal']
  },
  {
    id: 'civa',
    term: 'Codigo do IVA',
    abbreviation: 'CIVA',
    definition: 'Diploma legal que regulamenta o Imposto sobre o Valor Acrescentado em Portugal. Estabelece as regras de incidencia, isencoes, taxas aplicaveis e obrigacoes dos sujeitos passivos.',
    category: 'iva',
    icon: BookOpen,
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/codigo-do-iva-indice.aspx',
    relatedTerms: ['IVA', 'Art. 53', 'Isencao']
  },
  {
    id: 'taxa-reduzida',
    term: 'Taxa Reduzida',
    abbreviation: '6%',
    definition: 'Taxa de IVA mais baixa, aplicada a bens e servicos considerados essenciais, como produtos alimentares basicos, livros, jornais, medicamentos e transportes de passageiros.',
    category: 'iva',
    icon: Percent,
    examples: [
      'Pao, leite e outros produtos alimentares basicos',
      'Livros, jornais e outras publicacoes periodicas',
      'Medicamentos comparticipados',
      'Transportes publicos de passageiros'
    ],
    relatedTerms: ['IVA', 'Taxa Intermedia', 'Taxa Normal']
  },
  {
    id: 'taxa-intermedia',
    term: 'Taxa Intermedia',
    abbreviation: '13%',
    definition: 'Taxa de IVA aplicada a um conjunto especifico de bens e servicos, principalmente no setor da restauracao, hotelaria e alguns produtos alimentares.',
    category: 'iva',
    icon: Percent,
    examples: [
      'Refeicoes em restaurantes e cafes',
      'Alojamento em hoteis',
      'Conservas de peixe e marisco',
      'Vinhos comuns'
    ],
    relatedTerms: ['IVA', 'Taxa Reduzida', 'Taxa Normal']
  },
  {
    id: 'taxa-normal',
    term: 'Taxa Normal',
    abbreviation: '23%',
    definition: 'Taxa padrao de IVA aplicada a generalidade dos bens e servicos que nao beneficiam de taxa reduzida ou intermedia. E a taxa residual quando nenhuma outra se aplica.',
    category: 'iva',
    icon: Percent,
    examples: [
      'Eletrodomesticos e equipamentos eletronicos',
      'Vestuario e calcado',
      'Servicos de consultoria',
      'Combustiveis'
    ],
    relatedTerms: ['IVA', 'Taxa Reduzida', 'Taxa Intermedia']
  },
  {
    id: 'campo-dp',
    term: 'Campo da Declaracao Periodica',
    abbreviation: 'Campo DP',
    definition: 'Campos especificos da declaracao periodica de IVA onde sao registadas as operacoes realizadas. Cada campo corresponde a um tipo especifico de operacao (vendas, compras, regularizacoes).',
    category: 'iva',
    icon: FileText,
    examples: [
      'Campo 1: Transmissoes de bens e servicos a taxa normal',
      'Campo 3: Aquisicoes intracomunitarias',
      'Campo 24: IVA dedutivel em existencias'
    ],
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/iva/Pages/default.aspx'
  },
  {
    id: 'dedutibilidade',
    term: 'Dedutibilidade',
    definition: 'Percentagem do IVA suportado nas aquisicoes que o sujeito passivo pode deduzir. Varia conforme o tipo de despesa e a sua relacao com a atividade tributada. Algumas despesas tem dedutibilidade limitada (ex: viaturas, combustivel).',
    category: 'iva',
    icon: Calculator,
    examples: [
      'Despesas de representacao: 50% dedutivel',
      'Combustivel de viaturas ligeiras: 50% dedutivel',
      'Material de escritorio: 100% dedutivel'
    ],
    relatedTerms: ['IVA', 'Base Tributavel']
  },
  {
    id: 'base-tributavel',
    term: 'Base Tributavel',
    definition: 'Valor sobre o qual incide a taxa de imposto. No caso do IVA, corresponde ao preco de venda sem imposto, sobre o qual se aplica a taxa respetiva.',
    category: 'iva',
    icon: Calculator,
    examples: [
      'Servico prestado: 100EUR (base) + 23EUR (IVA 23%) = 123EUR total'
    ],
    relatedTerms: ['IVA', 'Taxa Normal']
  },
  {
    id: 'art-53',
    term: 'Regime de Isencao do Art. 53',
    abbreviation: 'Art. 53',
    definition: 'Regime de isencao de IVA aplicavel a sujeitos passivos com volume de negocios inferior a 14.500EUR anuais. Estes contribuintes nao liquidam IVA nas suas vendas, mas tambem nao podem deduzir o IVA das suas compras.',
    category: 'iva',
    icon: FileText,
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/iva53.aspx',
    relatedTerms: ['IVA', 'CIVA', 'Isencao']
  },

  // Termos Gerais
  {
    id: 'nif',
    term: 'Numero de Identificacao Fiscal',
    abbreviation: 'NIF',
    definition: 'Numero de nove digitos que identifica cada contribuinte perante a Autoridade Tributaria. E obrigatorio para pessoas singulares e coletivas que realizem operacoes sujeitas a tributacao em Portugal.',
    category: 'geral',
    icon: Building2,
    examples: [
      'Pessoas singulares: comeca por 1, 2 ou 3',
      'Empresas: comeca por 5',
      'Entidades publicas: comeca por 6',
      'Herancas indivisas: comeca por 7'
    ],
    officialLink: 'https://www.portaldasfinancas.gov.pt/at/html/index.html',
    relatedTerms: ['AT', 'Contribuinte']
  },
  {
    id: 'cae',
    term: 'Classificacao das Actividades Economicas',
    abbreviation: 'CAE',
    definition: 'Sistema de classificacao que agrupa as atividades economicas em categorias. Cada empresa ou trabalhador independente deve ter um ou mais CAE que descrevem as suas atividades. E fundamental para efeitos fiscais e estatisticos.',
    category: 'geral',
    icon: Building2,
    examples: [
      '62010 - Atividades de programacao informatica',
      '69200 - Atividades de contabilidade e auditoria',
      '56101 - Restaurantes tipo tradicional'
    ],
    officialLink: 'https://www.ine.pt/xportal/xmain?xpid=INE&xpgid=ine_inst_cae',
    relatedTerms: ['NIF', 'Atividade Economica']
  },
  {
    id: 'nao-residente',
    term: 'Nao-Residente',
    definition: 'Contribuinte cuja residencia fiscal se situa fora de Portugal. Tem regras fiscais especificas, nomeadamente no que respeita a retencao na fonte e aplicacao de convencoes para evitar a dupla tributacao.',
    category: 'geral',
    icon: Globe,
    relatedTerms: ['CDT', 'Retencao na Fonte']
  },
  {
    id: 'cdt',
    term: 'Convencao para evitar Dupla Tributacao',
    abbreviation: 'CDT',
    definition: 'Acordo bilateral entre dois paises que estabelece regras para evitar que o mesmo rendimento seja tributado em ambos os paises. Define qual o pais com direito a tributar e em que medida.',
    category: 'geral',
    icon: Globe,
    examples: [
      'CDT Portugal-Espanha',
      'CDT Portugal-Alemanha',
      'CDT Portugal-Brasil'
    ],
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/convencoes_evitar_dupla_tributacao/Pages/convencoes-tabelas-702702702.aspx',
    relatedTerms: ['Nao-Residente', 'Retencao na Fonte']
  },

  // Termos de Modelo 10
  {
    id: 'modelo-10',
    term: 'Modelo 10',
    definition: 'Declaracao anual de rendimentos e retencoes na fonte. Serve para comunicar a AT os rendimentos pagos a terceiros e respetivas retencoes efetuadas durante o ano.',
    category: 'modelo10',
    icon: FileText,
    officialLink: 'https://info.portaldasfinancas.gov.pt/pt/apoio_contribuinte/modelos_formularios/irs_irc/Pages/mod10.aspx',
    relatedTerms: ['Retencao na Fonte', 'AT']
  },
  {
    id: 'retencao-fonte',
    term: 'Retencao na Fonte',
    definition: 'Mecanismo pelo qual o imposto e retido (descontado) no momento do pagamento do rendimento, sendo posteriormente entregue ao Estado. Aplica-se a diversos tipos de rendimentos como trabalho independente, rendas e dividendos.',
    category: 'modelo10',
    icon: Receipt,
    examples: [
      'Prestacao de servicos (cat. B): 25% ou 11,5%',
      'Rendas (cat. F): 25%',
      'Dividendos (cat. E): 28%'
    ],
    relatedTerms: ['Modelo 10', 'IRS', 'IRC']
  },

  // Termos de Seguranca Social
  {
    id: 'seguranca-social',
    term: 'Seguranca Social',
    definition: 'Sistema publico de protecao social que garante o direito a pensoes, subsidios de doenca, desemprego, maternidade/paternidade e outras prestacoes sociais. Financiado pelas contribuicoes de trabalhadores e entidades empregadoras.',
    category: 'ss',
    icon: Shield,
    officialLink: 'https://www.seg-social.pt/',
    relatedTerms: ['TSU', 'Contribuicoes']
  },
  {
    id: 'tsu',
    term: 'Taxa Social Unica',
    abbreviation: 'TSU',
    definition: 'Contribuicao obrigatoria para a Seguranca Social calculada sobre as remuneracoes. Para trabalhadores por conta de outrem, a taxa e de 34,75% (23,75% paga pela entidade empregadora e 11% pelo trabalhador).',
    category: 'ss',
    icon: Percent,
    examples: [
      'Trabalhador por conta de outrem: 11%',
      'Entidade empregadora: 23,75%',
      'Trabalhador independente: 21,4%'
    ],
    relatedTerms: ['Seguranca Social', 'Contribuicoes']
  },
  {
    id: 'escalao-ss',
    term: 'Escalao de Contribuicoes',
    definition: 'Sistema de escaloes baseado no rendimento relevante dos trabalhadores independentes. O escalao determina a base de incidencia das contribuicoes para a Seguranca Social, atualizado trimestralmente.',
    category: 'ss',
    icon: Calculator,
    officialLink: 'https://www.seg-social.pt/trabalhadores-independentes',
    relatedTerms: ['Seguranca Social', 'TSU']
  },
];

export function FiscalGlossary() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TermCategory | 'all'>('all');
  const [expandedTerms, setExpandedTerms] = useState<string[]>([]);

  // Filtrar termos baseado na pesquisa e categoria
  const filteredTerms = useMemo(() => {
    return fiscalTerms.filter((term) => {
      const matchesSearch =
        searchQuery === '' ||
        term.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.abbreviation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        term.definition.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedCategory === 'all' ||
        term.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  // Agrupar termos por categoria
  const groupedTerms = useMemo(() => {
    const groups: Record<TermCategory, FiscalTerm[]> = {
      iva: [],
      ss: [],
      modelo10: [],
      geral: [],
    };

    filteredTerms.forEach((term) => {
      groups[term.category].push(term);
    });

    return groups;
  }, [filteredTerms]);

  // Contar termos por categoria
  const termCounts = useMemo(() => {
    const counts: Record<TermCategory | 'all', number> = {
      all: fiscalTerms.length,
      iva: 0,
      ss: 0,
      modelo10: 0,
      geral: 0,
    };

    fiscalTerms.forEach((term) => {
      counts[term.category]++;
    });

    return counts;
  }, []);

  return (
    <div className="space-y-6">
      {/* Cabecalho */}
      <ZenCard gradient="primary" withLine>
        <ZenCardHeader title="Glossario Fiscal" icon={BookOpen} />
        <ZenCardContent>
          <p className="text-muted-foreground mb-6">
            Consulte os principais termos fiscais portugueses. Aprenda sobre IVA,
            Seguranca Social, Modelo 10 e conceitos gerais de fiscalidade.
          </p>

          {/* Barra de pesquisa */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Pesquisar termos (ex: IVA, NIF, retencao...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros por categoria */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="gap-2"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Todos
              <Badge variant="secondary" className="ml-1 text-xs">
                {termCounts.all}
              </Badge>
            </Button>

            {(Object.entries(categories) as [TermCategory, typeof categories[TermCategory]][]).map(([key, cat]) => {
              const Icon = cat.icon;
              return (
                <Button
                  key={key}
                  variant={selectedCategory === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(key)}
                  className="gap-2"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cat.label}
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {termCounts[key]}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </ZenCardContent>
      </ZenCard>

      {/* Resultados */}
      {filteredTerms.length === 0 ? (
        <ZenCard gradient="muted">
          <ZenCardContent className="py-12 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-medium mb-2">Nenhum termo encontrado</h3>
            <p className="text-muted-foreground">
              Tente pesquisar por outro termo ou selecione uma categoria diferente.
            </p>
          </ZenCardContent>
        </ZenCard>
      ) : (
        /* Lista agrupada por categoria */
        (Object.entries(groupedTerms) as [TermCategory, FiscalTerm[]][])
          .filter(([_, terms]) => terms.length > 0)
          .map(([categoryKey, terms]) => {
            const category = categories[categoryKey];
            const CategoryIcon = category.icon;

            return (
              <ZenCard key={categoryKey} gradient="default" className="overflow-visible">
                {/* Cabecalho da categoria */}
                <div className="px-6 pt-6 pb-2 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg border",
                      category.color
                    )}>
                      <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{category.label}</h3>
                      <p className="text-xs text-muted-foreground">
                        {terms.length} termo{terms.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Accordion com termos */}
                <Accordion
                  type="multiple"
                  value={expandedTerms}
                  onValueChange={setExpandedTerms}
                  className="px-4"
                >
                  {terms.map((term) => {
                    const TermIcon = term.icon;

                    return (
                      <AccordionItem
                        key={term.id}
                        value={term.id}
                        className="border-b border-border/30 last:border-0"
                      >
                        <AccordionTrigger className="hover:no-underline py-4 gap-3">
                          <div className="flex items-center gap-3 flex-1 text-left">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "p-1.5 rounded-md border shrink-0",
                                  category.color
                                )}>
                                  <TermIcon className="h-3.5 w-3.5" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{category.label}</p>
                              </TooltipContent>
                            </Tooltip>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">
                                  {term.abbreviation || term.term}
                                </span>
                                {term.abbreviation && (
                                  <span className="text-sm text-muted-foreground truncate">
                                    - {term.term}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent className="pb-4">
                          <div className="pl-10 space-y-4">
                            {/* Definicao */}
                            <p className="text-muted-foreground leading-relaxed">
                              {term.definition}
                            </p>

                            {/* Exemplos */}
                            {term.examples && term.examples.length > 0 && (
                              <div className="bg-muted/30 rounded-lg p-4">
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Info className="h-3.5 w-3.5" />
                                  Exemplos
                                </h4>
                                <ul className="space-y-1.5">
                                  {term.examples.map((example, idx) => (
                                    <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                                      {example}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Links e termos relacionados */}
                            <div className="flex flex-wrap items-center gap-3">
                              {/* Link oficial */}
                              {term.officialLink && (
                                <a
                                  href={term.officialLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  Documentacao oficial
                                </a>
                              )}

                              {/* Termos relacionados */}
                              {term.relatedTerms && term.relatedTerms.length > 0 && (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs text-muted-foreground">Relacionados:</span>
                                  {term.relatedTerms.map((related) => (
                                    <Badge
                                      key={related}
                                      variant="outline"
                                      className="text-xs cursor-pointer hover:bg-accent"
                                      onClick={() => setSearchQuery(related)}
                                    >
                                      {related}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </ZenCard>
            );
          })
      )}

      {/* Footer com informacao adicional */}
      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>
          Este glossario destina-se a fins educativos. Para duvidas especificas,
          consulte um contabilista certificado ou a{' '}
          <a
            href="https://www.portaldasfinancas.gov.pt"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Autoridade Tributaria
          </a>.
        </p>
      </div>
    </div>
  );
}

export default FiscalGlossary;

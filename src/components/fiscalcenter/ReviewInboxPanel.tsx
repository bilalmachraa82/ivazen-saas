import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ZenCard } from '@/components/zen';
import {
  ChevronDown,
  ChevronRight,
  FileCheck,
  AlertTriangle,
  Receipt,
  ShieldCheck,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import type { ReviewInboxData, ReviewCategory } from '@/hooks/useReviewInbox';

const CATEGORY_META: Record<ReviewCategory['type'], { icon: LucideIcon; color: string }> = {
  pending_purchases: { icon: FileCheck, color: 'text-amber-600 dark:text-amber-400' },
  low_confidence: { icon: AlertTriangle, color: 'text-orange-600 dark:text-orange-400' },
  ambiguous_sales: { icon: Receipt, color: 'text-blue-600 dark:text-blue-400' },
  withholding_candidates: { icon: ShieldCheck, color: 'text-purple-600 dark:text-purple-400' },
  reconciliation_divergences: { icon: ArrowLeftRight, color: 'text-red-600 dark:text-red-400' },
};

interface ReviewInboxPanelProps {
  data: ReviewInboxData;
  periodLabel: string;
}

export function ReviewInboxPanel({ data, periodLabel }: ReviewInboxPanelProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  const toggleExpand = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (data.totalPending === 0) {
    return (
      <ZenCard gradient="muted" withLine className="shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Revisão pendente
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs">
              0
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Sem itens pendentes de revisão para {periodLabel}.
          </div>
        </CardContent>
      </ZenCard>
    );
  }

  return (
    <ZenCard gradient="muted" withLine className="shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          Revisão pendente
          <Badge variant="warning" className="text-xs">
            {data.totalPending}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.categories.map(category => {
          const meta = CATEGORY_META[category.type];
          const Icon = meta.icon;
          const isExpanded = expandedTypes.has(category.type);
          const hasMore = category.items.length < category.count;
          const countLabel = String(category.count);

          return (
            <div key={category.type} className="rounded-2xl border border-border/60 bg-background/70 overflow-hidden">
              {/* Category header — always visible */}
              <button
                type="button"
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpand(category.type)}
              >
                <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
                <span className="flex-1 text-sm font-medium">{category.label}</span>
                <Badge variant="secondary" className="text-xs font-mono">
                  {countLabel}
                </Badge>
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                }
              </button>

              {/* Expanded items */}
              {isExpanded && (
                <div className="border-t border-border/40 divide-y divide-border/30">
                  {category.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5 pl-11">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{item.label}</div>
                        {item.sublabel && (
                          <div className="text-xs text-muted-foreground truncate">{item.sublabel}</div>
                        )}
                      </div>
                      {item.route && (
                        <Button asChild size="sm" variant="ghost" className="shrink-0 h-7 px-2 text-xs">
                          <Link to={item.route}>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  ))}

                  {/* Bulk action link — always shown if route exists, highlights when truncated */}
                  {category.bulkRoute && (
                    <div className="px-4 py-2 bg-muted/30">
                      <Button asChild size="sm" variant="ghost" className="w-full justify-center text-xs h-7 text-muted-foreground hover:text-foreground">
                        <Link to={category.bulkRoute}>
                          {hasMore
                            ? `Ver todos (${category.count}) · ${category.label}`
                            : `Ver todos · ${category.label}`
                          }
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </ZenCard>
  );
}

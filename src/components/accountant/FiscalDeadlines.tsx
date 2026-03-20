import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Calendar, 
  AlertTriangle, 
  Clock, 
  CheckCircle2,
  ExternalLink,
  Bell,
  Zap
} from 'lucide-react';

interface Deadline {
  id: string;
  type: 'iva' | 'ss' | 'modelo10' | 'irs' | 'saft';
  title: string;
  dueDate: Date;
  description: string;
  status: 'overdue' | 'urgent' | 'upcoming' | 'done';
  link?: string;
  priority: number;
}

interface FiscalDeadlinesProps {
  ssDeclarationsPending: number;
  pendingValidation: number;
  ivaCadence?: 'monthly' | 'quarterly' | 'both';
  vatRegime?: string | null;
}

export function FiscalDeadlines({
  ssDeclarationsPending,
  pendingValidation,
  ivaCadence = 'quarterly',
  vatRegime = null,
}: FiscalDeadlinesProps) {
  const deadlines = useMemo((): Deadline[] => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentQuarter = Math.ceil((currentMonth + 1) / 3);
    const skipIvaDeadlines = vatRegime === 'exempt';
    
    const allDeadlines: Deadline[] = [];
    
    // IVA Monthly - Day 20 of following month (regime mensal: volume negócios > 650.000€)
    const ivaMonthlyDue = new Date(currentYear, currentMonth, 20);
    if (now.getDate() > 20) {
      ivaMonthlyDue.setMonth(ivaMonthlyDue.getMonth() + 1);
    }

    if (!skipIvaDeadlines && ivaCadence !== 'quarterly') {
      const ivaMonthlyStatus = getDeadlineStatus(ivaMonthlyDue, pendingValidation > 5);
      allDeadlines.push({
        id: 'iva-monthly',
        type: 'iva',
        title: 'IVA Mensal',
        dueDate: ivaMonthlyDue,
        description: `Regime mensal${pendingValidation > 0 ? ` • ${pendingValidation} pendentes` : ''}`,
        status: ivaMonthlyStatus,
        link: 'https://www.acesso.gov.pt/v2/loginForm?partID=PFAP&path=/geral/dashboard',
        priority: ivaMonthlyStatus === 'overdue' ? 1 : ivaMonthlyStatus === 'urgent' ? 2 : 3,
      });
    }

    // IVA Quarterly - Day 20 of 2nd month after quarter end (regime trimestral: vol. negócios <= 650.000€)
    // Q1 (Jan-Mar) → May 20, Q2 (Apr-Jun) → Aug 20, Q3 (Jul-Sep) → Nov 20, Q4 (Oct-Dec) → Feb 20 next year
    const quarterEndMonths = [2, 5, 8, 11]; // March, June, September, December (0-indexed)
    let ivaQuarterlyDue: Date;

    // Find the next quarterly deadline
    const nextQuarterlyDeadlines = [
      new Date(currentYear, 4, 20),   // Q1: May 20
      new Date(currentYear, 7, 20),   // Q2: Aug 20
      new Date(currentYear, 10, 20),  // Q3: Nov 20
      new Date(currentYear + 1, 1, 20), // Q4: Feb 20 next year
    ];

    ivaQuarterlyDue = nextQuarterlyDeadlines.find(d => d >= now) || nextQuarterlyDeadlines[0];
    // If all deadlines this cycle have passed, use Q1 of next year
    if (ivaQuarterlyDue < now) {
      ivaQuarterlyDue = new Date(currentYear + 1, 4, 20);
    }

    const quarterLabels: Record<string, string> = {
      '4': 'T1 (Jan-Mar)',
      '7': 'T2 (Abr-Jun)',
      '10': 'T3 (Jul-Set)',
      '1': 'T4 (Out-Dez)',
    };
    const quarterLabel = quarterLabels[String(ivaQuarterlyDue.getMonth())] || '';

    if (!skipIvaDeadlines && ivaCadence !== 'monthly') {
      const ivaQuarterlyStatus = getDeadlineStatus(ivaQuarterlyDue, pendingValidation > 5);
      allDeadlines.push({
        id: 'iva-quarterly',
        type: 'iva',
        title: 'IVA Trimestral',
        dueDate: ivaQuarterlyDue,
        description: `Regime trimestral ${quarterLabel}${pendingValidation > 0 ? ` • ${pendingValidation} pendentes` : ''}`,
        status: ivaQuarterlyStatus,
        link: 'https://www.acesso.gov.pt/v2/loginForm?partID=PFAP&path=/geral/dashboard',
        priority: ivaQuarterlyStatus === 'overdue' ? 1 : ivaQuarterlyStatus === 'urgent' ? 2 : 3,
      });
    }
    
    // SAF-T Communication - Day 5 of following month
    const saftDue = new Date(currentYear, currentMonth + 1, 5);
    if (now.getDate() > 5) {
      saftDue.setMonth(saftDue.getMonth() + 1);
    }
    const saftStatus = getDeadlineStatus(saftDue, false);
    allDeadlines.push({
      id: 'saft',
      type: 'saft',
      title: 'SAF-T Faturação',
      dueDate: saftDue,
      description: 'Comunicação mensal do ficheiro SAF-T à AT',
      status: saftStatus,
      link: 'https://faturas.portaldasfinancas.gov.pt/',
      priority: saftStatus === 'overdue' ? 1 : saftStatus === 'urgent' ? 2 : 3,
    });

    // SS Quarterly - Last day of the deadline month (Jan 31, Apr 30, Jul 31, Oct 31)
    const ssQuarterMonth = [0, 3, 6, 9][currentQuarter - 1] + 3; // month after quarter
    const ssQuarterDue = new Date(currentYear, (ssQuarterMonth % 12) + 1, 0); // last day of month
    if (ssQuarterMonth >= 12) ssQuarterDue.setFullYear(currentYear + 1);
    if (now > ssQuarterDue) {
      ssQuarterDue.setMonth(ssQuarterDue.getMonth() + 3);
    }
    
    const ssStatus = getDeadlineStatus(ssQuarterDue, ssDeclarationsPending > 0);
    allDeadlines.push({
      id: 'ss-quarterly',
      type: 'ss',
      title: 'Segurança Social',
      dueDate: ssQuarterDue,
      description: `Declaração trimestral T${currentQuarter}${ssDeclarationsPending > 0 ? ` (${ssDeclarationsPending} por submeter)` : ''}`,
      status: ssStatus,
      link: 'https://app.seg-social.pt/',
      priority: ssStatus === 'overdue' ? 1 : ssStatus === 'urgent' ? 2 : 3,
    });
    
    // Modelo 10 - February of following year
    const modelo10Due = new Date(currentYear + 1, 1, 28); // February 28
    if (now.getMonth() >= 2) {
      modelo10Due.setFullYear(modelo10Due.getFullYear() + 1);
    }
    
    const modelo10Status = getDeadlineStatus(modelo10Due, false);
    allDeadlines.push({
      id: 'modelo10',
      type: 'modelo10',
      title: 'Modelo 10',
      dueDate: modelo10Due,
      description: 'Retenções na fonte anuais',
      status: modelo10Status,
      link: 'https://www.acesso.gov.pt/v2/loginForm?partID=PFAP&path=/geral/dashboard',
      priority: modelo10Status === 'overdue' ? 1 : modelo10Status === 'urgent' ? 2 : 3,
    });
    
    // IRS - April to June
    const irsDue = new Date(currentYear, 5, 30); // June 30
    if (now > irsDue) {
      irsDue.setFullYear(irsDue.getFullYear() + 1);
    }
    
    const irsStatus = getDeadlineStatus(irsDue, false);
    allDeadlines.push({
      id: 'irs',
      type: 'irs',
      title: 'IRS',
      dueDate: irsDue,
      description: 'Declaração anual de IRS',
      status: irsStatus,
      link: 'https://www.acesso.gov.pt/v2/loginForm?partID=PFAP&path=/geral/dashboard',
      priority: irsStatus === 'overdue' ? 1 : irsStatus === 'urgent' ? 2 : 3,
    });
    
    // Sort by priority first, then by due date
    return allDeadlines.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.dueDate.getTime() - b.dueDate.getTime();
    });
  }, [ssDeclarationsPending, pendingValidation, ivaCadence, vatRegime]);

  // Count urgent items
  const urgentCount = deadlines.filter(d => d.status === 'overdue' || d.status === 'urgent').length;

  function getDeadlineStatus(dueDate: Date, hasWork: boolean): Deadline['status'] {
    const now = new Date();
    const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil <= 7 && hasWork) return 'urgent';
    if (daysUntil <= 14) return 'upcoming';
    return 'done';
  }

  const getStatusBadge = (status: Deadline['status']) => {
    switch (status) {
      case 'overdue':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" /> Atrasado</Badge>;
      case 'urgent':
        return <Badge variant="warning" className="gap-1 bg-orange-500 text-white"><Clock className="h-3 w-3" /> Urgente</Badge>;
      case 'upcoming':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Próximo</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
    }
  };

  const getTypeColor = (type: Deadline['type']) => {
    switch (type) {
      case 'iva': return 'bg-success/10 text-success';
      case 'ss': return 'bg-primary/10 text-primary';
      case 'modelo10': return 'bg-purple-500/10 text-purple-600';
      case 'saft': return 'bg-cyan-500/10 text-cyan-600';
      case 'irs': return 'bg-warning/10 text-warning';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getDaysUntil = (date: Date) => {
    const days = Math.ceil((date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} dias atrasado`;
    if (days === 0) return 'Hoje';
    if (days === 1) return 'Amanhã';
    return `${days} dias`;
  };

  return (
    <Card className={cn(
      urgentCount > 0 && 'border-warning/50 shadow-[0_0_15px_rgba(251,191,36,0.15)]'
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Prazos Fiscais
          </div>
          {urgentCount > 0 && (
            <Badge variant="warning" className="gap-1 bg-warning text-warning-foreground animate-pulse">
              <Bell className="h-3 w-3" />
              {urgentCount} urgente{urgentCount > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {deadlines.map((deadline) => (
          <div 
            key={deadline.id}
            className={cn(
              "flex items-center justify-between p-3 rounded-lg transition-all duration-300 hover:scale-[1.01]",
              deadline.status === 'overdue' && 'bg-destructive/10 border border-destructive/20',
              deadline.status === 'urgent' && 'bg-warning/10 border border-warning/20',
              deadline.status === 'upcoming' && 'bg-muted/50 hover:bg-muted',
              deadline.status === 'done' && 'bg-muted/30 hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-md transition-transform",
                getTypeColor(deadline.type),
                (deadline.status === 'overdue' || deadline.status === 'urgent') && 'animate-pulse'
              )}>
                {deadline.status === 'overdue' ? (
                  <Zap className="h-4 w-4" />
                ) : (
                  <Calendar className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{deadline.title}</span>
                  {getStatusBadge(deadline.status)}
                </div>
                <p className="text-xs text-muted-foreground">{deadline.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className={cn(
                  "text-sm font-medium",
                  deadline.status === 'overdue' && 'text-destructive'
                )}>
                  {formatDate(deadline.dueDate)}
                </p>
                <p className={cn(
                  "text-xs",
                  deadline.status === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {getDaysUntil(deadline.dueDate)}
                </p>
              </div>
              {deadline.link && (
                <Button
                  size="icon"
                  variant={deadline.status === 'overdue' || deadline.status === 'urgent' ? 'default' : 'ghost'}
                  className="h-8 w-8"
                  onClick={() => window.open(deadline.link, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

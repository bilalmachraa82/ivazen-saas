/**
 * InfoTooltip Component
 *
 * Wraps any technical term with a helpful tooltip that shows
 * the definition from the glossary.
 */

import { HelpCircle, ExternalLink } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getGlossaryTerm } from '@/lib/glossary';
import { cn } from '@/lib/utils';

interface InfoTooltipProps {
  term: string;
  children?: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export function InfoTooltip({
  term,
  children,
  className,
  showIcon = true,
}: InfoTooltipProps) {
  const glossaryTerm = getGlossaryTerm(term);

  if (!glossaryTerm) {
    // If term not found in glossary, render children without tooltip
    return <>{children}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 cursor-help border-b border-dashed border-muted-foreground/40',
              className
            )}
          >
            {children || glossaryTerm.term}
            {showIcon && (
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs space-y-2 p-3"
          sideOffset={5}
        >
          <div>
            <p className="font-semibold text-sm mb-1">{glossaryTerm.term}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {glossaryTerm.definition}
            </p>
          </div>

          {glossaryTerm.example && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Exemplo: </span>
                {glossaryTerm.example}
              </p>
            </div>
          )}

          {glossaryTerm.link && (
            <a
              href={glossaryTerm.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              Saber mais
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Shorthand component for just the icon tooltip (without wrapping text)
 */
export function InfoIcon({ term, className }: { term: string; className?: string }) {
  const glossaryTerm = getGlossaryTerm(term);

  if (!glossaryTerm) return null;

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn('inline-flex cursor-help', className)}
            onClick={(e) => e.preventDefault()}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground transition-colors" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs space-y-2 p-3"
          sideOffset={5}
        >
          <div>
            <p className="font-semibold text-sm mb-1">{glossaryTerm.term}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {glossaryTerm.definition}
            </p>
          </div>

          {glossaryTerm.example && (
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium">Exemplo: </span>
                {glossaryTerm.example}
              </p>
            </div>
          )}

          {glossaryTerm.link && (
            <a
              href={glossaryTerm.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              Saber mais
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

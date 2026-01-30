import { QrCode, Sparkles, BarChart3, FileCode, Globe, CheckCircle, Camera, Wand2 } from "lucide-react";
import stepScanIllustration from "@/assets/step-scan-v2.png";
import stepClassifyIllustration from "@/assets/step-classify-v4.png";
import stepExportIllustration from "@/assets/step-export-v2.png";

// Unified icon style for consistency
const ICON_STYLE = { strokeWidth: 1.5 };

type StepType = 'scan' | 'classify' | 'export';

interface StepVisualProps {
  type: StepType;
}

export const StepVisual = ({ type }: StepVisualProps) => {
  switch (type) {
    case 'scan':
      return <ScanVisual />;
    case 'classify':
      return <ClassifyVisual />;
    case 'export':
      return <ExportVisual />;
    default:
      return null;
  }
};

const ScanVisual = () => (
  <div className="relative h-64 w-full overflow-hidden rounded-2xl group">
    {/* Custom illustration background */}
    <img 
      src={stepScanIllustration} 
      alt="Digitalização de facturas com QR code"
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
    />
    
    {/* Subtle gradient overlay for readability */}
    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
    
    {/* Floating UI elements */}
    <div className="absolute inset-0 p-4 flex flex-col justify-between">
      {/* Top badge */}
      <div className="flex justify-end">
        <div className="glass-card rounded-lg px-3 py-1.5 backdrop-blur-md bg-background/70 border border-primary/20 animate-premium-float shadow-lg">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" style={ICON_STYLE} />
            <span className="text-xs font-semibold text-foreground">Scan Rápido</span>
          </div>
        </div>
      </div>
      
      {/* Bottom content */}
      <div className="space-y-2">
        {/* QR Scanner indicator */}
        <div className="glass-card rounded-xl p-3 backdrop-blur-md bg-background/70 border border-primary/20 max-w-[180px] shadow-lg">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-lg border-2 border-primary/40 flex items-center justify-center bg-background/50">
              <QrCode className="h-6 w-6 text-primary" style={ICON_STYLE} />
              <div className="absolute inset-0 border-2 border-primary animate-pulse rounded-lg" />
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">QR Detectado</div>
              <div className="text-[10px] text-muted-foreground">PT • Válido</div>
            </div>
          </div>
        </div>
        
        {/* Status pills */}
        <div className="flex gap-2">
          <div className="glass-card rounded-full px-2 py-1 backdrop-blur-md bg-green-500/20 border border-green-400/30 shadow-sm">
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-medium text-foreground">Offline Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ClassifyVisual = () => (
  <div className="relative h-64 w-full overflow-hidden rounded-2xl group">
    {/* Custom illustration background */}
    <img 
      src={stepClassifyIllustration} 
      alt="Classificação inteligente com IA"
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
    />
    
    {/* Subtle gradient overlay for readability */}
    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-r from-accent/10 via-transparent to-primary/10" />
    
    {/* Floating UI elements */}
    <div className="absolute inset-0 p-4 flex flex-col justify-between">
      {/* AI processing indicator */}
      <div className="flex justify-between items-start">
        <div className="glass-card rounded-lg px-3 py-1.5 backdrop-blur-md bg-background/70 border border-primary/20 animate-premium-float shadow-lg">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary animate-pulse" style={ICON_STYLE} />
            <span className="text-xs font-semibold text-foreground">IA Activa</span>
          </div>
        </div>
        
        <div className="glass-card rounded-full px-2 py-1 backdrop-blur-md bg-primary/20 border border-primary/20 shadow-sm">
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" style={ICON_STYLE} />
            <span className="text-[10px] font-medium text-foreground">98% Precisão</span>
          </div>
        </div>
      </div>
      
      {/* Classification result */}
      <div className="space-y-2">
        <div className="glass-card rounded-xl p-3 backdrop-blur-md bg-background/70 border border-primary/20 max-w-[200px] shadow-lg">
          <div className="text-[10px] text-muted-foreground mb-2">Classificação Sugerida</div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-xs font-medium text-foreground">Alimentação</span>
              </div>
              <span className="text-[10px] text-muted-foreground">23%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/30 overflow-hidden">
              <div className="h-full w-[98%] rounded-full bg-gradient-to-r from-green-400 to-emerald-500" />
            </div>
          </div>
        </div>
        
        {/* Processing dots */}
        <div className="flex items-center gap-2 ml-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  </div>
);

const ExportVisual = () => (
  <div className="relative h-64 w-full overflow-hidden rounded-2xl group">
    {/* Custom illustration background */}
    <img 
      src={stepExportIllustration} 
      alt="Dashboard e exportação de dados"
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
    />
    
    {/* Subtle gradient overlay for readability */}
    <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-primary/10" />
    
    {/* Floating UI elements */}
    <div className="absolute inset-0 p-4 flex flex-col justify-between">
      {/* Top badges */}
      <div className="flex justify-between items-start">
        <div className="glass-card rounded-lg px-3 py-1.5 backdrop-blur-md bg-background/70 border border-primary/20 animate-premium-float shadow-lg">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" style={ICON_STYLE} />
            <span className="text-xs font-semibold text-foreground">Dashboard</span>
          </div>
        </div>
        
        <div className="glass-card rounded-full px-2 py-1 backdrop-blur-md bg-green-500/20 border border-green-400/30 animate-bounce shadow-sm">
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3 w-3 text-green-500" style={ICON_STYLE} />
            <span className="text-[10px] font-medium text-foreground">Pronto</span>
          </div>
        </div>
      </div>
      
      {/* Export options */}
      <div className="space-y-2">
        <div className="glass-card rounded-xl p-3 backdrop-blur-md bg-background/70 border border-primary/20 max-w-[220px] shadow-lg">
          <div className="text-[10px] text-muted-foreground mb-2">Exportar Para</div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg bg-primary/10 p-2 border border-primary/20 text-center hover:bg-primary/20 transition-colors cursor-pointer">
              <FileCode className="h-4 w-4 text-primary mx-auto mb-1" style={ICON_STYLE} />
              <span className="text-[9px] text-foreground font-medium">SAFT-PT</span>
            </div>
            <div className="flex-1 rounded-lg bg-primary/10 p-2 border border-primary/20 text-center hover:bg-primary/20 transition-colors cursor-pointer">
              <BarChart3 className="h-4 w-4 text-primary mx-auto mb-1" style={ICON_STYLE} />
              <span className="text-[9px] text-foreground font-medium">Excel</span>
            </div>
            <div className="flex-1 rounded-lg bg-primary/10 p-2 border border-primary/20 text-center hover:bg-primary/20 transition-colors cursor-pointer">
              <Globe className="h-4 w-4 text-primary mx-auto mb-1" style={ICON_STYLE} />
              <span className="text-[9px] text-foreground font-medium">API</span>
            </div>
          </div>
        </div>
        
        {/* Stats preview */}
        <div className="flex gap-2">
          <div className="glass-card rounded-lg px-2 py-1 backdrop-blur-md bg-background/70 border border-primary/20 shadow-sm">
            <span className="text-[10px] text-muted-foreground">Total IVA</span>
            <span className="text-xs font-bold text-foreground ml-2">€2,450</span>
          </div>
          <div className="glass-card rounded-lg px-2 py-1 backdrop-blur-md bg-background/70 border border-primary/20 shadow-sm">
            <span className="text-[10px] text-muted-foreground">Facturas</span>
            <span className="text-xs font-bold text-foreground ml-2">127</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default StepVisual;

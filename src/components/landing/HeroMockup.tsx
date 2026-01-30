import { Heart, FileText, CheckCircle, TrendingUp, Zap, Shield, Sparkles, Leaf } from "lucide-react";
import heroIllustration from "@/assets/hero-illustration-v2.png";

// Unified icon style for consistency
const ICON_STYLE = { strokeWidth: 1.5 };

export const HeroMockup = () => {
  return (
    <div className="relative mx-auto max-w-lg lg:max-w-none">
      {/* Background glow effects */}
      <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/20 via-pink-400/15 to-accent/20 opacity-60 blur-3xl" />
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl animate-premium-pulse" />
      <div className="absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-accent/15 blur-2xl animate-premium-float" />
      
      {/* Main hero image container */}
      <div className="glass-card rounded-2xl border border-primary/20 overflow-hidden shadow-2xl group">
        {/* Illustration with subtle overlay */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {/* Custom illustration */}
          <img 
            src={heroIllustration} 
            alt="Profissional a gerir facturas com IVAzen"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          
          {/* Subtle gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/10" />
          
          {/* Floating UI elements overlay */}
          <div className="absolute inset-0 p-4 md:p-6 flex flex-col justify-between">
            {/* Top stats row */}
            <div className="flex justify-end gap-2">
              <FloatingCard 
                icon={FileText}
                value="24"
                label="Facturas"
                delay={0}
              />
              <FloatingCard 
                icon={CheckCircle}
                value="98%"
                label="Precisão"
                delay={150}
              />
            </div>
            
            {/* Bottom content */}
            <div className="space-y-3">
              {/* Mini chart */}
              <div className="glass-card rounded-xl p-3 backdrop-blur-md bg-background/60 border border-primary/20 max-w-[200px] shadow-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3 w-3 text-primary" style={ICON_STYLE} />
                  <span className="text-[10px] font-medium text-foreground">IVA Q4 2024</span>
                </div>
                <div className="flex h-10 items-end gap-0.5">
                  {[40, 65, 45, 80, 55, 90, 75, 95].map((height, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary transition-all duration-500"
                      style={{ 
                        height: `${height}%`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
              </div>
              
              {/* Activity notification */}
              <div className="glass-card rounded-xl p-3 backdrop-blur-md bg-background/60 border border-primary/20 max-w-[220px] flex items-center gap-3 shadow-lg">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg">
                  <Zap className="h-4 w-4 text-white" style={ICON_STYLE} />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">Factura classificada</div>
                  <div className="text-[10px] text-muted-foreground">Worten • €89.99 • Agora</div>
                </div>
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Floating badges around the image */}
      <FloatingBadge 
        className="absolute -left-4 top-1/4 md:-left-8"
        icon={Shield}
        text="RGPD ✓"
        delay={0}
      />
      <FloatingBadge 
        className="absolute -right-4 top-1/2 md:-right-8"
        icon={Sparkles}
        text="IA Activa"
        delay={300}
      />
      <FloatingBadge 
        className="absolute -bottom-4 left-1/4 md:left-1/3"
        icon={Leaf}
        text="Zen Mode"
        delay={600}
      />
    </div>
  );
};

const FloatingCard = ({ 
  icon: Icon, 
  value, 
  label,
  delay 
}: { 
  icon: React.ElementType; 
  value: string; 
  label: string;
  delay: number;
}) => (
  <div 
    className="glass-card rounded-xl p-2.5 backdrop-blur-md bg-background/60 border border-primary/20 animate-fade-in shadow-lg"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="flex items-center gap-2 mb-1">
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent">
        <Icon className="h-2.5 w-2.5 text-white" strokeWidth={1.5} />
      </div>
      <span className="text-sm font-bold text-foreground">{value}</span>
    </div>
    <div className="text-[9px] text-muted-foreground font-medium">{label}</div>
  </div>
);

const FloatingBadge = ({ 
  className, 
  icon: Icon, 
  text,
  delay 
}: { 
  className: string; 
  icon: React.ElementType; 
  text: string;
  delay: number;
}) => (
  <div 
    className={`${className} glass-card rounded-full px-3 py-1.5 shadow-lg border border-primary/20 animate-premium-float flex items-center gap-1.5 backdrop-blur-md bg-background/70`}
    style={{ animationDelay: `${delay}ms` }}
  >
    <Icon className="h-3 w-3 text-primary" strokeWidth={1.5} />
    <span className="text-xs font-medium text-foreground">{text}</span>
  </div>
);

export default HeroMockup;

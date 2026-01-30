import { useState } from "react";
import { Play, X, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import heroIllustration from "@/assets/hero-illustration-v2.png";

// Unified icon style for consistency
const ICON_STYLE = { strokeWidth: 1.5 };

interface VideoDemoProps {
  /** YouTube video ID (e.g., "dQw4w9WgXcQ") or local video URL */
  videoSource?: string;
  /** Whether the source is a YouTube video */
  isYouTube?: boolean;
  /** Custom thumbnail image URL */
  thumbnailUrl?: string;
}

export const VideoDemo = ({
  videoSource,
  isYouTube = true,
  thumbnailUrl
}: VideoDemoProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const thumbnail = thumbnailUrl || heroIllustration;

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Video Thumbnail with Play Button */}
      <div
        className="relative mx-auto max-w-4xl cursor-pointer group"
        onClick={handleOpen}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleOpen();
          }
        }}
        aria-label="Reproduzir video demo"
      >
        {/* Background glow effects */}
        <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-primary/30 via-pink-400/20 to-accent/30 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100" />
        <div className="absolute -inset-1 -z-10 rounded-2xl bg-gradient-to-br from-primary/20 via-pink-400/10 to-accent/20 opacity-60 blur-xl" />

        {/* Main container */}
        <div className={`
          relative overflow-hidden rounded-2xl
          glass-card border-2 border-primary/20
          shadow-2xl transition-all duration-500
          ${isHovered ? 'shadow-glow-lg border-primary/40 scale-[1.02]' : 'shadow-glow'}
        `}>
          {/* Aspect ratio container 16:9 */}
          <div className="relative aspect-video overflow-hidden">
            {/* Thumbnail Image */}
            <img
              src={thumbnail}
              alt="Video demo do IVAzen - digitalizar facturas"
              className={`
                w-full h-full object-cover
                transition-all duration-700
                ${isHovered ? 'scale-110 blur-[2px]' : 'scale-100'}
              `}
            />

            {/* Dark overlay that intensifies on hover */}
            <div className={`
              absolute inset-0 bg-gradient-to-t from-background/80 via-background/40 to-transparent
              transition-opacity duration-500
              ${isHovered ? 'opacity-90' : 'opacity-70'}
            `} />

            {/* Animated glow ring overlay */}
            <div className={`
              absolute inset-0
              bg-gradient-to-r from-primary/10 via-transparent to-accent/10
              transition-opacity duration-500
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `} />

            {/* Play Button - Centered */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`
                relative flex items-center justify-center
                transition-all duration-500
                ${isHovered ? 'scale-110' : 'scale-100'}
              `}>
                {/* Outer glow ring */}
                <div className={`
                  absolute h-28 w-28 rounded-full
                  bg-primary/30 blur-xl
                  transition-all duration-500
                  ${isHovered ? 'opacity-100 scale-125' : 'opacity-60'}
                `} />

                {/* Pulsing ring */}
                <div className="absolute h-24 w-24 rounded-full border-2 border-white/30 animate-ping"
                  style={{ animationDuration: '2s' }}
                />

                {/* Main play button */}
                <div className={`
                  relative flex h-20 w-20 items-center justify-center
                  rounded-full gradient-rose shadow-glow-lg
                  transition-all duration-300
                  ${isHovered ? 'shadow-glow-lg scale-110' : ''}
                `}>
                  <Play
                    className="h-8 w-8 text-white ml-1"
                    style={ICON_STYLE}
                    fill="white"
                  />
                </div>
              </div>
            </div>

            {/* Demo Duration Badge - Top Right */}
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 rounded-full glass-card px-3 py-1.5 backdrop-blur-md bg-background/70 border border-primary/30 shadow-lg">
                <Clock className="h-3.5 w-3.5 text-primary" style={ICON_STYLE} />
                <span className="text-xs font-semibold text-foreground">Demo 30s</span>
              </div>
            </div>

            {/* Bottom gradient text hint */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className={`
                text-center transition-all duration-500
                ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-70 translate-y-2'}
              `}>
                <p className="text-white/90 font-medium text-sm">
                  Clique para ver a demo
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Decorative floating elements */}
        <div
          className="absolute -left-6 top-1/3 h-3 w-3 rounded-full bg-primary/60 blur-sm animate-premium-float"
          style={{ animationDelay: '0s' }}
        />
        <div
          className="absolute -right-4 top-2/3 h-2 w-2 rounded-full bg-accent/60 blur-sm animate-premium-float"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute left-1/4 -bottom-3 h-2 w-2 rounded-full bg-pink-400/60 blur-sm animate-premium-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Video Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden glass-card border-primary/30 bg-background/95 backdrop-blur-xl">
          <VisuallyHidden>
            <DialogTitle>Video Demo do IVAzen</DialogTitle>
          </VisuallyHidden>

          {/* Close button - custom styled */}
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full glass-card border border-primary/30 text-foreground/70 transition-all duration-300 hover:bg-primary/20 hover:text-primary hover:border-primary/50"
            aria-label="Fechar video"
          >
            <X className="h-5 w-5" style={ICON_STYLE} />
          </button>

          {/* Video Container */}
          <div className="aspect-video w-full bg-black/90">
            {videoSource && isYouTube ? (
              // YouTube Embed
              <iframe
                src={`https://www.youtube.com/embed/${videoSource}?autoplay=1&rel=0&modestbranding=1`}
                title="Demo IVAzen"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            ) : videoSource && !isYouTube ? (
              // Local Video
              <video
                src={videoSource}
                controls
                autoPlay
                className="w-full h-full"
              >
                O seu browser nao suporta video.
              </video>
            ) : (
              // Placeholder when no video source
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-background via-background/95 to-primary/10">
                <div className="relative mb-6">
                  {/* Glow effect */}
                  <div className="absolute inset-0 h-24 w-24 rounded-full bg-primary/30 blur-xl" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full gradient-rose shadow-glow-lg">
                    <Play className="h-10 w-10 text-white ml-1" style={ICON_STYLE} fill="white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Video Demo em Breve</h3>
                <p className="text-muted-foreground text-sm max-w-md text-center px-4">
                  Estamos a preparar uma demonstracao completa do IVAzen.
                  Em breve podera ver como e facil digitalizar e classificar facturas.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default VideoDemo;

import { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, FileText, ExternalLink, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export function ImageZoom({ src, alt, className }: ImageZoomProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPDFLoading, setIsPDFLoading] = useState(true);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect if the source is a PDF
  const isPDF = src?.toLowerCase().includes('.pdf') || 
                src?.includes('application/pdf') ||
                src?.includes('content-type=application%2Fpdf');

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.5, 4));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.5, 1));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (isPDF) return; // Let browser handle PDF zoom
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setScale((s) => Math.max(1, Math.min(s + delta, 4)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPDF) return;
    if (scale > 1) {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPDF) return;
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDoubleClick = () => {
    if (isPDF) return;
    if (scale === 1) {
      setScale(2);
    } else {
      handleReset();
    }
  };

  const toggleFullscreen = () => setIsFullscreen((f) => !f);

  // Reset on image change
  useEffect(() => {
    handleReset();
    setIsPDFLoading(true);
  }, [src]);

  // Handle escape key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleOpenPDF = () => {
    window.open(src, '_blank');
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = alt || 'documento.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab if download fails
      window.open(src, '_blank');
    }
  };

  // PDF Viewer using Google Docs Viewer
  if (isPDF) {
    const googleDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(src)}`;

    return (
      <div
        className={cn(
          'relative overflow-hidden bg-muted rounded-lg',
          isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'aspect-[3/4]',
          className
        )}
      >
        {/* Loading indicator */}
        {isPDFLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
            <FileText className="h-12 w-12 text-muted-foreground animate-pulse mb-3" />
            <p className="text-sm text-muted-foreground">A carregar PDF...</p>
          </div>
        )}

        <iframe
          src={googleDocsUrl}
          title={alt}
          className="w-full h-full border-0"
          onLoad={() => setIsPDFLoading(false)}
          onError={() => setIsPDFLoading(false)}
        />
        
        {/* PDF indicator */}
        <div className="absolute top-4 left-4 flex items-center gap-2 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-medium text-muted-foreground">
          <FileText className="h-4 w-4" />
          PDF
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={handleOpenPDF}
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Abrir</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2"
            onClick={handleDownloadPDF}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descarregar</span>
          </Button>
          <div className="w-px h-4 bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
          >
            {isFullscreen ? <X className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
          </Button>
        </div>

        {/* Fullscreen close button */}
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 h-10 w-10 bg-background/90 backdrop-blur-sm"
            onClick={toggleFullscreen}
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>
    );
  }

  // Image Viewer
  const ImageContent = (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden bg-muted rounded-lg select-none',
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'aspect-[3/4]',
        isDragging ? 'cursor-grabbing' : scale > 1 ? 'cursor-grab' : 'cursor-zoom-in',
        className
      )}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-contain transition-transform duration-100"
        style={{
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
        }}
        draggable={false}
      />

      {/* Controls */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/90 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomOut}
          disabled={scale <= 1}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleZoomIn}
          disabled={scale >= 4}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <div className="w-px h-4 bg-border" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleReset}
          disabled={scale === 1 && position.x === 0 && position.y === 0}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Fullscreen close button */}
      {isFullscreen && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 h-10 w-10 bg-background/90 backdrop-blur-sm"
          onClick={toggleFullscreen}
        >
          <X className="h-5 w-5" />
        </Button>
      )}

      {/* Hint */}
      {scale === 1 && !isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          Duplo clique ou scroll para zoom
        </div>
      )}
    </div>
  );

  return ImageContent;
}

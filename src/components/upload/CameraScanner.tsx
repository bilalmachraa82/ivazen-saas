import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, X, Loader2, ScanLine, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQRScanner } from '@/hooks/useQRScanner';

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onQRDetected?: (qrData: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
  autoScan?: boolean;
}

export function CameraScanner({ 
  onCapture, 
  onQRDetected,
  onClose, 
  isProcessing,
  autoScan = true 
}: CameraScannerProps) {
  const [detectedQR, setDetectedQR] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  
  const handleQRScan = (qrData: string) => {
    setDetectedQR(qrData);
    if (onQRDetected) {
      onQRDetected(qrData);
    }
  };

  const { 
    videoRef, 
    isScanning, 
    hasCamera, 
    qrDetected,
    cameraError,
    startScanning, 
    stopScanning, 
    captureFrame,
    resetLastScan 
  } = useQRScanner({
    onScan: autoScan ? handleQRScan : () => {},
    onError: (err) => console.error('Camera error:', err),
  });

  useEffect(() => {
    // Always try to start scanning - hasCamera may be false before permission
    const initCamera = async () => {
      setIsStarting(true);
      await startScanning();
      setIsStarting(false);
    };
    
    initCamera();
    
    return () => stopScanning();
  }, []);

  const handleRetry = async () => {
    setIsStarting(true);
    stopScanning();
    await new Promise(resolve => setTimeout(resolve, 500));
    await startScanning();
    setIsStarting(false);
  };

  const handleCapture = () => {
    const frame = captureFrame();
    if (frame) {
      onCapture(frame);
    }
  };

  const handleScanAgain = () => {
    setDetectedQR(null);
    resetLastScan();
  };

  // Show error state with retry option
  if (cameraError && !isScanning) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 text-center">
          <Camera className="h-12 w-12 text-destructive mx-auto mb-4 opacity-50" />
          <p className="text-destructive font-medium mb-2">Erro de Câmara</p>
          <p className="text-sm text-muted-foreground mb-4">{cameraError}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button onClick={handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Certifique-se que permitiu o acesso à câmara nas definições do browser.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative bg-black rounded-lg overflow-hidden">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </Button>

      {/* Video feed */}
      <div className="relative aspect-[4/3] bg-muted">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        
        {/* Scanning overlay */}
        {isScanning && !detectedQR && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-64 h-64 border-2 rounded-lg relative transition-colors duration-200 ${
              qrDetected ? 'border-green-500' : 'border-primary'
            }`}>
              <ScanLine className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 animate-pulse ${
                qrDetected ? 'text-green-500' : 'text-primary'
              }`} />
              <div className={`absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 rounded-tl-lg ${
                qrDetected ? 'border-green-500' : 'border-primary'
              }`} />
              <div className={`absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 rounded-tr-lg ${
                qrDetected ? 'border-green-500' : 'border-primary'
              }`} />
              <div className={`absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 rounded-bl-lg ${
                qrDetected ? 'border-green-500' : 'border-primary'
              }`} />
              <div className={`absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 rounded-br-lg ${
                qrDetected ? 'border-green-500' : 'border-primary'
              }`} />
              
              {/* Scanning animation */}
              <div className="absolute inset-0 overflow-hidden rounded-lg">
                <div className="absolute left-0 right-0 h-0.5 bg-primary/60 animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        )}

        {/* QR Detected overlay */}
        {detectedQR && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white p-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">QR Code Detectado!</p>
              <p className="text-sm text-white/70 mb-4">
                {detectedQR.length > 50 ? detectedQR.substring(0, 50) + '...' : detectedQR}
              </p>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {(isStarting || (!isScanning && !cameraError)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">A iniciar câmara...</p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="p-4 bg-background flex flex-col gap-3">
        {detectedQR ? (
          <div className="flex gap-2 justify-center">
            <Button
              variant="outline"
              onClick={handleScanAgain}
              disabled={isProcessing}
            >
              Ler outro QR
            </Button>
            <Button
              onClick={handleCapture}
              disabled={isProcessing}
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  A processar...
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  Capturar imagem
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            size="lg"
            onClick={handleCapture}
            disabled={!isScanning || isProcessing}
            className="gap-2 mx-auto"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                A processar...
              </>
            ) : (
              <>
                <Camera className="h-5 w-5" />
                Capturar manualmente
              </>
            )}
          </Button>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground pb-4">
        {detectedQR 
          ? 'QR detectado automaticamente! Capture a imagem para continuar.' 
          : isScanning 
            ? 'A procurar QR code automaticamente...'
            : 'Aguarde enquanto a câmara inicia...'}
      </p>

      {/* CSS animation for scanning line */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
}

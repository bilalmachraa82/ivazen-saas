import { useState, useRef, useCallback, useEffect } from 'react';
import jsQR from 'jsqr';

interface UseQRScannerOptions {
  onScan: (result: string) => void;
  onError?: (error: Error) => void;
  scanInterval?: number;
}

export function useQRScanner({ onScan, onError, scanInterval = 100 }: UseQRScannerOptions) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(true); // Assume camera exists on mobile
  const [qrDetected, setQrDetected] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const scanningActiveRef = useRef(false);
  const lastScanRef = useRef<string | null>(null);

  // Check camera availability - but don't rely on it for mobile
  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log('MediaDevices API not available');
          setHasCamera(false);
          setCameraError('API de câmara não disponível neste browser');
          return;
        }
        
        // On mobile, enumerateDevices may return empty before permission
        // So we assume camera exists and handle error on getUserMedia
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('Video devices found:', videoDevices.length);
        
        // Only set hasCamera to false if we're sure there's no camera
        // On mobile, labels are empty before permission, so we can't be sure
        if (videoDevices.length === 0 && !navigator.userAgent.match(/Mobile|Android|iPhone|iPad/i)) {
          setHasCamera(false);
          setCameraError('Nenhuma câmara encontrada');
        }
      } catch (err) {
        console.error('Camera check error:', err);
        // Don't set hasCamera to false on error - try anyway
      }
    };
    
    checkCamera();
  }, []);

  // QR scanning loop
  const scanForQR = useCallback(() => {
    if (!scanningActiveRef.current || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanForQR);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(scanForQR);
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        // Avoid duplicate scans
        if (code.data !== lastScanRef.current) {
          lastScanRef.current = code.data;
          setQrDetected(true);
          console.log('QR Code detected:', code.data.substring(0, 50) + '...');
          onScan(code.data);
        }
      } else {
        setQrDetected(false);
      }
    } catch (error) {
      console.error('QR scan error:', error);
    }

    // Continue scanning
    if (scanningActiveRef.current) {
      setTimeout(() => {
        animationRef.current = requestAnimationFrame(scanForQR);
      }, scanInterval);
    }
  }, [onScan, scanInterval]);

  const startScanning = useCallback(async () => {
    console.log('Starting camera scan...');
    setCameraError(null);
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const error = new Error('API de câmara não disponível');
      console.error(error);
      setCameraError(error.message);
      onError?.(error);
      return;
    }

    try {
      // Try rear camera first, fallback to any camera
      let stream: MediaStream | null = null;
      
      try {
        console.log('Requesting rear camera (environment)...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 }
          },
          audio: false
        });
        console.log('Rear camera acquired');
      } catch (rearError) {
        console.log('Rear camera failed, trying any camera...', rearError);
        // Fallback to any camera
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        console.log('Fallback camera acquired');
      }
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          video.onloadedmetadata = () => {
            console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
            resolve();
          };
          
          video.onerror = (e) => {
            console.error('Video error:', e);
            reject(new Error('Erro ao carregar vídeo'));
          };
          
          // Timeout after 5 seconds
          setTimeout(() => reject(new Error('Timeout ao iniciar vídeo')), 5000);
        });
        
        await videoRef.current.play();
        console.log('Video playing');
        setIsScanning(true);
        
        // Create canvas for frame capture
        if (!canvasRef.current) {
          canvasRef.current = document.createElement('canvas');
        }
        
        // Start QR scanning loop
        scanningActiveRef.current = true;
        lastScanRef.current = null;
        animationRef.current = requestAnimationFrame(scanForQR);
      }
    } catch (error) {
      console.error('Camera access error:', error);
      
      let errorMessage = 'Erro ao aceder à câmara';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          errorMessage = 'Permissão de câmara negada. Por favor, permita o acesso nas definições do browser.';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          errorMessage = 'Nenhuma câmara encontrada neste dispositivo.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          errorMessage = 'Câmara está a ser usada por outra aplicação.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Câmara não suporta as definições solicitadas.';
        } else if (error.name === 'SecurityError') {
          errorMessage = 'Acesso à câmara bloqueado. Use HTTPS ou localhost.';
        } else {
          errorMessage = error.message || errorMessage;
        }
      }
      
      setCameraError(errorMessage);
      onError?.(new Error(errorMessage));
    }
  }, [onError, scanForQR]);

  const stopScanning = useCallback(() => {
    console.log('Stopping camera scan...');
    scanningActiveRef.current = false;
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Track stopped:', track.kind);
      });
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
    setQrDetected(false);
    lastScanRef.current = null;
  }, []);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  }, []);

  const resetLastScan = useCallback(() => {
    lastScanRef.current = null;
    setQrDetected(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    videoRef,
    isScanning,
    hasCamera,
    qrDetected,
    cameraError,
    startScanning,
    stopScanning,
    captureFrame,
    resetLastScan,
  };
}

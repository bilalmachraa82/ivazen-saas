import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { useSalesInvoiceUpload } from '@/hooks/useSalesInvoiceUpload';
import { useProfile } from '@/hooks/useProfile';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useClientManagement } from '@/hooks/useClientManagement';
import { useSelectedClient } from '@/hooks/useSelectedClient';
import { DuplicateCheckResult } from '@/hooks/useDuplicateCheck';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CameraScanner } from '@/components/upload/CameraScanner';
import { FileUploader } from '@/components/upload/FileUploader';
import { QRInputDialog } from '@/components/upload/QRInputDialog';
import { OfflineIndicator } from '@/components/upload/OfflineIndicator';
import { ProfileIncompleteWarning } from '@/components/upload/ProfileIncompleteWarning';
import { ClientSelector } from '@/components/upload/ClientSelector';
import { ClientValidationDialog } from '@/components/upload/ClientValidationDialog';
import { TypeMismatchWarning } from '@/components/upload/TypeMismatchWarning';
import { BulkInvoiceUpload } from '@/components/upload/BulkInvoiceUpload';
import { SAFTInvoiceImporter } from '@/components/upload/SAFTInvoiceImporter';
import { ZenCard, ZenCardHeader, ZenHeader, ZenDecorations, ZenFloatingIcon, ZenList, ZenListItem } from '@/components/zen';
import { Camera, CheckCircle2, Sparkles, QrCode, Upload as UploadIcon, Leaf, ShoppingCart, TrendingUp, AlertTriangle, Copy, XCircle, Layers, FileCode } from 'lucide-react';
import { StepNavigator } from '@/components/dashboard/StepNavigator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { detectMimeType } from '@/lib/mime';

type InvoiceType = 'purchase' | 'sales';
type DetectionResult = { type: InvoiceType; confidence: 'high' | 'low'; reason: string } | null;

interface DuplicateState {
  isDuplicate: boolean;
  info: DuplicateCheckResult | null;
  pendingImage: string | Blob | File | null;
  pendingQR: string | null;
  pendingFileName: string | null;
  useAI: boolean;
}

interface MismatchState {
  show: boolean;
  detectedType: InvoiceType | null;
  reason: string;
  pendingQR: string | null;
  pendingImage: string | File | null;
  pendingFileName: string | null;
  useAI: boolean;
}

// Detect potential mismatch by comparing supplier_nif with user.nif
const detectTypeMismatch = (
  supplierNif: string, 
  userNif: string | null, 
  selectedType: InvoiceType
): { hasMismatch: boolean; detectedType: InvoiceType; reason: string } | null => {
  if (!userNif || !supplierNif) {
    return null; // Cannot determine - no mismatch warning
  }
  
  // Normalize NIFs
  const normalizedSupplier = supplierNif.replace(/\s/g, '').replace(/^0+/, '');
  const normalizedUser = userNif.replace(/\s/g, '').replace(/^0+/, '');
  
  const isUserIssuer = normalizedSupplier === normalizedUser;
  
  if (selectedType === 'purchase' && isUserIssuer) {
    // User selected Purchase but they are the issuer → likely a Sale
    return { 
      hasMismatch: true,
      detectedType: 'sales',
      reason: 'O NIF do emissor corresponde ao seu. Parece ser uma factura que você emitiu (venda).'
    };
  }
  
  if (selectedType === 'sales' && !isUserIssuer) {
    // User selected Sales but they are not the issuer → likely a Purchase
    return { 
      hasMismatch: true,
      detectedType: 'purchase',
      reason: 'O NIF do emissor é diferente do seu. Parece ser uma factura que você recebeu (compra).'
    };
  }
  
  return null; // No mismatch
};

// Parse supplier NIF from QR content
const extractSupplierNifFromQR = (qrContent: string): string | null => {
  const match = qrContent.match(/^A:(\d+)/);
  return match ? match[1] : null;
};

export default function Upload() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, isLoading: profileLoading } = useProfile();
  const { isOnline, isSyncing, pendingCount, queueUpload, syncPendingUploads } = useOfflineSync();
  const { isAccountant, clients, isLoadingClients } = useClientManagement();
  const { selectedClientId, setSelectedClientId } = useSelectedClient();
  
  // Pass forClientId to upload hooks for accountants
  const purchaseUpload = useInvoiceUpload({ forClientId: isAccountant ? selectedClientId : null });
  const salesUpload = useSalesInvoiceUpload({ forClientId: isAccountant ? selectedClientId : null });
  
  // Get initial type from URL param (for direct links from SS page)
  const initialType = searchParams.get('type') as InvoiceType | null;
  const initialMode = searchParams.get('mode') as 'single' | 'bulk' | 'saft' | null;

  const [uploadMode, setUploadMode] = useState<'single' | 'bulk' | 'saft'>(initialMode || 'single');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(initialType || 'purchase');
  const [showCamera, setShowCamera] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [detectedQRContent, setDetectedQRContent] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);
  const [useAIExtraction, setUseAIExtraction] = useState(false);
  
  // Type mismatch warning state
  const [mismatchState, setMismatchState] = useState<MismatchState>({
    show: false,
    detectedType: null,
    reason: '',
    pendingQR: null,
    pendingImage: null,
    pendingFileName: null,
    useAI: false,
  });
  
  // Duplicate detection state
  const [duplicateState, setDuplicateState] = useState<DuplicateState>({
    isDuplicate: false,
    info: null,
    pendingImage: null,
    pendingQR: null,
    pendingFileName: null,
    useAI: false,
  });

  // Client validation dialog for accountants
  const [showClientValidation, setShowClientValidation] = useState(false);

  // Get the current upload hook based on invoice type
  const currentUpload = invoiceType === 'purchase' ? purchaseUpload : salesUpload;
  const isProcessing = currentUpload.isProcessing;

  // Validate client selection for accountants before upload
  const validateClientSelection = (): boolean => {
    if (isAccountant && !selectedClientId) {
      setShowClientValidation(true);
      return false;
    }
    return true;
  };

  // For accountants, auto-select first client if none selected
  useEffect(() => {
    if (isAccountant && clients.length > 0 && !selectedClientId) {
      setSelectedClientId(clients[0].id);
    }
  }, [isAccountant, clients, selectedClientId]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Get the effective NIF for mismatch detection
  // For accountants: use selected client's NIF
  // For regular users: use their own profile NIF
  const effectiveNif = isAccountant 
    ? clients.find(c => c.id === selectedClientId)?.nif || null
    : profile?.nif || null;

  const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleQRDetected = (qrData: string) => {
    setDetectedQRContent(qrData);
    toast.success('QR Code detectado automaticamente!');
  };

  const handleCameraCapture = (imageData: string) => {
    // Validate client selection for accountants
    if (!validateClientSelection()) {
      return;
    }

    setCapturedImage(imageData);
    setShowCamera(false);

    if (detectedQRContent) {
      // Check for mismatch before processing
      const supplierNif = extractSupplierNifFromQR(detectedQRContent);
      if (supplierNif) {
        const mismatch = detectTypeMismatch(supplierNif, effectiveNif, invoiceType);
        if (mismatch?.hasMismatch) {
          setMismatchState({
            show: true,
            detectedType: mismatch.detectedType,
            reason: mismatch.reason,
            pendingQR: detectedQRContent,
            pendingImage: imageData,
            pendingFileName: null,
            useAI: false,
          });
          return;
        }
      }
      processWithQR(imageData, detectedQRContent);
    } else {
      setShowQRDialog(true);
    }
  };

  const processWithQR = async (imageData: string, qrContent: string, skipDuplicateCheck: boolean = false) => {
    const fileName = invoiceType === 'purchase' ? 'camera_capture.jpg' : 'sales_camera_capture.jpg';

    if (!isOnline && invoiceType === 'purchase') {
      await queueUpload(imageData, qrContent, fileName);
      resetState();
      return;
    }

    const imageBlob = dataURLtoBlob(imageData);
    
    let result;
    if (invoiceType === 'purchase') {
      result = await purchaseUpload.processInvoice(imageBlob, qrContent, fileName, skipDuplicateCheck);
    } else {
      result = await salesUpload.processSalesInvoice(imageBlob, qrContent, fileName, skipDuplicateCheck);
    }

    // Handle duplicate detection
    if (result.isDuplicate && result.duplicateInfo) {
      setDuplicateState({
        isDuplicate: true,
        info: result.duplicateInfo,
        pendingImage: imageData,
        pendingQR: qrContent,
        pendingFileName: fileName,
        useAI: false,
      });
      setShowQRDialog(false);
      return;
    }

    if (result.success) {
      setLastInvoiceId(result.invoiceId || null);
      resetState();
    }
  };

  const clearDuplicateState = () => {
    setDuplicateState({
      isDuplicate: false,
      info: null,
      pendingImage: null,
      pendingQR: null,
      pendingFileName: null,
      useAI: false,
    });
  };

  const clearMismatchState = () => {
    setMismatchState({
      show: false,
      detectedType: null,
      reason: '',
      pendingQR: null,
      pendingImage: null,
      pendingFileName: null,
      useAI: false,
    });
  };

  const handleFileSelect = async (file: File, skipDuplicateCheck: boolean = false) => {
    // Validate client selection for accountants
    if (!validateClientSelection()) {
      return;
    }

    setSelectedFile(file);

    // Check if it's a PDF or HEIC - these need AI extraction
    const mime = detectMimeType(file);
    const isPDFOrHEIC = mime === 'application/pdf' || mime.includes('heic') || mime.includes('heif');
    
    if (isPDFOrHEIC) {
      // Process directly with AI extraction (no QR dialog)
      setUseAIExtraction(true);
      
      // For sales invoices, first extract data to validate mismatch
      if (invoiceType === 'sales' && effectiveNif) {
        // Extract data first to check for mismatch
        const validationResult = await salesUpload.processSalesInvoiceWithAI(file, file.name, false, true);
        
        if (validationResult.success && validationResult.extractedData) {
          const extractedNif = validationResult.extractedData.supplier_nif;
          const mismatch = detectTypeMismatch(extractedNif, effectiveNif, invoiceType);
          
          if (mismatch?.hasMismatch) {
            setMismatchState({
              show: true,
              detectedType: mismatch.detectedType,
              reason: mismatch.reason,
              pendingQR: null,
              pendingImage: file,
              pendingFileName: file.name,
              useAI: true,
            });
            setUseAIExtraction(false);
            return;
          }
        }
      }
      
      // For purchase invoices, also check for mismatch
      if (invoiceType === 'purchase' && effectiveNif) {
        const validationResult = await purchaseUpload.processInvoiceWithAI(file, file.name, false, true);
        
        if (validationResult.success && validationResult.extractedData) {
          const extractedNif = validationResult.extractedData.supplier_nif;
          const mismatch = detectTypeMismatch(extractedNif, effectiveNif, invoiceType);
          
          if (mismatch?.hasMismatch) {
            setMismatchState({
              show: true,
              detectedType: mismatch.detectedType,
              reason: mismatch.reason,
              pendingQR: null,
              pendingImage: file,
              pendingFileName: file.name,
              useAI: true,
            });
            setUseAIExtraction(false);
            return;
          }
        }
      }
      
      // No mismatch or no profile NIF - proceed with normal processing
      let result;
      if (invoiceType === 'purchase') {
        result = await purchaseUpload.processInvoiceWithAI(file, file.name, skipDuplicateCheck);
      } else {
        result = await salesUpload.processSalesInvoiceWithAI(file, file.name, skipDuplicateCheck);
      }
      
      // Handle duplicate detection
      if (result.isDuplicate && result.duplicateInfo) {
        setDuplicateState({
          isDuplicate: true,
          info: result.duplicateInfo,
          pendingImage: file,
          pendingQR: null,
          pendingFileName: file.name,
          useAI: true,
        });
        setUseAIExtraction(false);
        return;
      }
      
      if (result.success) {
        setLastInvoiceId(result.invoiceId || null);
        setSelectedFile(null);
        setUseAIExtraction(false);
        clearDuplicateState();
      } else {
        setUseAIExtraction(false);
      }
    } else {
      // Regular image - show QR dialog
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
        setShowQRDialog(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQRSubmit = async (qrContent: string) => {
    if (!capturedImage) {
      toast.error('Imagem não encontrada');
      return;
    }

    // Check for mismatch before processing
    const supplierNif = extractSupplierNifFromQR(qrContent);
    if (supplierNif && effectiveNif) {
      const mismatch = detectTypeMismatch(supplierNif, effectiveNif, invoiceType);
      if (mismatch?.hasMismatch) {
        setMismatchState({
          show: true,
          detectedType: mismatch.detectedType,
          reason: mismatch.reason,
          pendingQR: qrContent,
          pendingImage: capturedImage,
          pendingFileName: selectedFile?.name || null,
          useAI: false,
        });
        setShowQRDialog(false);
        return;
      }
    }

    await processQRSubmit(qrContent);
  };

  const processQRSubmit = async (qrContent: string, skipDuplicateCheck: boolean = false) => {
    if (!capturedImage) return;

    const fileName = selectedFile?.name || (invoiceType === 'purchase' ? 'camera_capture.jpg' : 'sales_capture.jpg');

    if (!isOnline && invoiceType === 'purchase') {
      await queueUpload(capturedImage, qrContent, fileName);
      resetState();
      return;
    }

    const imageBlob = selectedFile || dataURLtoBlob(capturedImage);
    
    let result;
    if (invoiceType === 'purchase') {
      result = await purchaseUpload.processInvoice(imageBlob, qrContent, fileName, skipDuplicateCheck);
    } else {
      result = await salesUpload.processSalesInvoice(imageBlob, qrContent, fileName, skipDuplicateCheck);
    }

    // Handle duplicate detection
    if (result.isDuplicate && result.duplicateInfo) {
      setDuplicateState({
        isDuplicate: true,
        info: result.duplicateInfo,
        pendingImage: capturedImage,
        pendingQR: qrContent,
        pendingFileName: fileName,
        useAI: false,
      });
      return;
    }

    if (result.success) {
      setLastInvoiceId(result.invoiceId || null);
      resetState();
      clearDuplicateState();
    }
  };

  // Handle mismatch confirmation - keep selected type
  const handleMismatchConfirm = async () => {
    const { pendingQR, pendingImage, useAI } = mismatchState;
    clearMismatchState();
    
    if (useAI && pendingImage instanceof File) {
      if (invoiceType === 'purchase') {
        const result = await purchaseUpload.processInvoiceWithAI(pendingImage, pendingImage.name);
        if (result.success) {
          setLastInvoiceId(result.invoiceId || null);
          resetState();
        }
      } else {
        const result = await salesUpload.processSalesInvoiceWithAI(pendingImage, pendingImage.name);
        if (result.success) {
          setLastInvoiceId(result.invoiceId || null);
          resetState();
        }
      }
    } else if (pendingQR && typeof pendingImage === 'string') {
      await processWithQR(pendingImage, pendingQR);
    }
  };

  // Handle mismatch - change to detected type
  const handleMismatchChangeType = async () => {
    const { detectedType, pendingQR, pendingImage, useAI } = mismatchState;
    if (!detectedType) return;
    
    setInvoiceType(detectedType);
    clearMismatchState();
    
    // Small delay to ensure state updates
    setTimeout(async () => {
      if (useAI && pendingImage instanceof File) {
        if (detectedType === 'purchase') {
          const result = await purchaseUpload.processInvoiceWithAI(pendingImage, pendingImage.name);
          if (result.success) {
            setLastInvoiceId(result.invoiceId || null);
            resetState();
          }
        } else {
          const result = await salesUpload.processSalesInvoiceWithAI(pendingImage, pendingImage.name);
          if (result.success) {
            setLastInvoiceId(result.invoiceId || null);
            resetState();
          }
        }
      } else if (pendingQR && typeof pendingImage === 'string') {
        const fileName = detectedType === 'purchase' ? 'camera_capture.jpg' : 'sales_capture.jpg';
        const imageBlob = dataURLtoBlob(pendingImage);
        
        let result;
        if (detectedType === 'purchase') {
          result = await purchaseUpload.processInvoice(imageBlob, pendingQR, fileName);
        } else {
          result = await salesUpload.processSalesInvoice(imageBlob, pendingQR, fileName);
        }
        
        if (result.success) {
          setLastInvoiceId(result.invoiceId || null);
          resetState();
        }
      }
    }, 100);
  };

  // Force upload duplicate invoice
  const handleForceUpload = async () => {
    if (!duplicateState.pendingImage) return;

    toast.info('A forçar upload...');

    if (duplicateState.useAI && duplicateState.pendingImage instanceof File) {
      let result;
      if (invoiceType === 'purchase') {
        result = await purchaseUpload.processInvoiceWithAI(
          duplicateState.pendingImage,
          duplicateState.pendingFileName || 'forced_upload.pdf',
          true
        );
      } else {
        result = await salesUpload.processSalesInvoiceWithAI(
          duplicateState.pendingImage,
          duplicateState.pendingFileName || 'forced_upload.pdf',
          true
        );
      }

      if (result.success) {
        setLastInvoiceId(result.invoiceId || null);
        resetState();
        clearDuplicateState();
        toast.success('Factura guardada (duplicado forçado)');
      }
    } else if (duplicateState.pendingQR && typeof duplicateState.pendingImage === 'string') {
      await processWithQR(duplicateState.pendingImage, duplicateState.pendingQR, true);
      toast.success('Factura guardada (duplicado forçado)');
    }
  };

  const resetState = () => {
    setShowQRDialog(false);
    setCapturedImage(null);
    setSelectedFile(null);
    setDetectedQRContent(null);
    clearMismatchState();
    clearDuplicateState();
  };

  const handleNewInvoice = () => {
    setLastInvoiceId(null);
    setCapturedImage(null);
    setSelectedFile(null);
    setDetectedQRContent(null);
    setUseAIExtraction(false);
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
    setDetectedQRContent(null);
  };

  // Check if profile is incomplete (missing NIF) - for regular users only
  // Accountants don't need their own NIF, they use client's NIF
  const isProfileIncomplete = !isAccountant && !profile?.nif;
  
  // Check if accountant has no clients
  const accountantNeedsClients = isAccountant && clients.length === 0 && !isLoadingClients;
  
  // Check if accountant has selected a client without NIF
  const selectedClientMissingNif = isAccountant && selectedClientId && !effectiveNif;

  if (loading || profileLoading || !user) return null;

  // Success state
  if (lastInvoiceId) {
    const isPurchase = invoiceType === 'purchase';
    return (
      <DashboardLayout>
        <div className="space-y-8 animate-fade-in relative">
          <ZenFloatingIcon icon={Leaf} position="top-right" size="lg" />
          
          <ZenCard gradient="success" className="shadow-xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-500/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
            
            <CardContent className="relative p-12 text-center">
              <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-500/30 to-green-600/20 rounded-full flex items-center justify-center mb-6 shadow-lg animate-zen-pulse">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-3">
                {isPurchase ? 'Factura de Compra Processada!' : 'Factura de Venda Processada!'}
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {isPurchase 
                  ? 'A factura foi guardada com harmonia e está pronta para classificação IA.'
                  : 'A factura de venda foi guardada e será contabilizada nas suas receitas.'}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  onClick={handleNewInvoice} 
                  size="lg"
                  className="zen-button gap-2 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <UploadIcon className="h-4 w-4" />
                  Nova Factura
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate(isPurchase ? '/validation' : '/social-security')}
                  className="border-primary/30 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
                >
                  {isPurchase ? 'Ver Validação' : 'Ver Segurança Social'}
                </Button>
              </div>
            </CardContent>
          </ZenCard>
        </div>
      </DashboardLayout>
    );
  }

  // Camera view
  if (showCamera) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-fade-in">
          <ZenHeader
            icon={QrCode}
            title="Scan QR Code"
            description={`O QR code da factura de ${invoiceType === 'purchase' ? 'compra' : 'venda'} será detectado automaticamente`}
          />
          
          <CameraScanner
            onCapture={handleCameraCapture}
            onQRDetected={handleQRDetected}
            onClose={handleCloseCamera}
            isProcessing={isProcessing}
            autoScan={true}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Default upload view
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in relative">
        <ZenDecorations />

        <ZenHeader
          icon={UploadIcon}
          title="Carregar Faturas"
          description="Carregue faturas individualmente, em bulk, ou importe via SAFT-PT"
        />

        {/* Upload Mode Tabs */}
        <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'single' | 'bulk' | 'saft')} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-12">
            <TabsTrigger value="single" className="gap-2 text-sm font-medium">
              <UploadIcon className="h-4 w-4" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2 text-sm font-medium">
              <Layers className="h-4 w-4" />
              Em Bulk
            </TabsTrigger>
            <TabsTrigger value="saft" className="gap-2 text-sm font-medium">
              <FileCode className="h-4 w-4" />
              SAFT-PT
            </TabsTrigger>
          </TabsList>

          {/* Bulk Upload Mode */}
          <TabsContent value="bulk" className="space-y-6">
            <BulkInvoiceUpload
              selectedClientId={isAccountant ? selectedClientId : user?.id}
              clientName={isAccountant ? clients.find(c => c.id === selectedClientId)?.company_name || clients.find(c => c.id === selectedClientId)?.full_name : null}
            />
          </TabsContent>

          {/* SAFT Import Mode */}
          <TabsContent value="saft" className="space-y-6">
            <SAFTInvoiceImporter
              selectedClientId={isAccountant ? selectedClientId : user?.id}
              clientName={isAccountant ? clients.find(c => c.id === selectedClientId)?.company_name || clients.find(c => c.id === selectedClientId)?.full_name : null}
            />
          </TabsContent>

          {/* Single Upload Mode - Original content */}
          <TabsContent value="single" className="space-y-6">

        {/* Profile Incomplete Warning */}
        {isProfileIncomplete && (
          <ProfileIncompleteWarning missingNif={true} />
        )}


        {/* Block upload when accountant has no clients */}
        {accountantNeedsClients && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Sem clientes para carregar facturas</AlertTitle>
            <AlertDescription>
              Antes de carregar facturas, precisa de criar ou associar pelo menos um cliente.
              Vá às Definições → Gestão de Clientes para adicionar clientes à sua carteira.
            </AlertDescription>
          </Alert>
        )}

        {/* Warning when selected client has no NIF */}
        {selectedClientMissingNif && (
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertTitle className="text-amber-600 dark:text-amber-400">Cliente sem NIF</AlertTitle>
            <AlertDescription className="text-amber-600/80 dark:text-amber-400/80">
              O cliente selecionado não tem NIF configurado. A validação automática do tipo de factura (compra/venda) não funcionará correctamente.
            </AlertDescription>
          </Alert>
        )}

        <OfflineIndicator 
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          onSync={syncPendingUploads}
        />

        {/* Type Mismatch Warning */}
        {mismatchState.show && mismatchState.detectedType && (
          <TypeMismatchWarning
            selectedType={invoiceType}
            detectedType={mismatchState.detectedType}
            reason={mismatchState.reason}
            onConfirm={handleMismatchConfirm}
            onChangeType={handleMismatchChangeType}
            isProcessing={isProcessing}
          />
        )}

        {/* Duplicate Invoice Warning */}
        {duplicateState.isDuplicate && duplicateState.info && (
          <ZenCard gradient="primary" className="border-2 border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-amber-500/20">
                  <Copy className="h-6 w-6 text-amber-600" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg text-amber-700 dark:text-amber-400">
                        Factura Duplicada Detectada
                      </h3>
                      <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                        Já existe
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm mt-1">
                      {duplicateState.info.reason}
                    </p>
                  </div>
                  
                  {duplicateState.info.existingInvoice && (
                    <div className="bg-background/60 rounded-lg p-4 border border-border/50 space-y-2">
                      <p className="text-sm font-medium text-foreground">Factura existente:</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">NIF Fornecedor:</span>
                          <span className="ml-2 font-mono">{duplicateState.info.existingInvoice.supplier_nif}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Nº Documento:</span>
                          <span className="ml-2 font-mono">{duplicateState.info.existingInvoice.document_number || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Data:</span>
                          <span className="ml-2">
                            {format(new Date(duplicateState.info.existingInvoice.document_date), 'dd MMM yyyy', { locale: pt })}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Valor:</span>
                          <span className="ml-2 font-semibold">
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(duplicateState.info.existingInvoice.total_amount)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Carregada em {format(new Date(duplicateState.info.existingInvoice.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: pt })}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-3 pt-2">
                    <Button 
                      onClick={handleForceUpload} 
                      variant="outline"
                      className="flex-1 border-amber-500/50 text-amber-700 hover:bg-amber-500/10"
                      disabled={isProcessing}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Forçar Upload
                    </Button>
                    <Button 
                      onClick={clearDuplicateState} 
                      variant="ghost"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    Forçar upload irá criar uma segunda entrada. Use apenas se tiver certeza que são facturas diferentes.
                  </p>
                </div>
              </div>
            </CardContent>
          </ZenCard>
        )}

        {/* Invoice Type Tabs with distinct colors */}
        <Tabs value={invoiceType} onValueChange={(v) => setInvoiceType(v as InvoiceType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-14">
            <TabsTrigger 
              value="purchase" 
              className="gap-2 h-12 text-base font-medium transition-all data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/30"
            >
              <ShoppingCart className="h-5 w-5" />
              Compras (Gastos)
            </TabsTrigger>
            <TabsTrigger 
              value="sales" 
              className="gap-2 h-12 text-base font-medium transition-all data-[state=active]:bg-rose-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-500/30"
            >
              <TrendingUp className="h-5 w-5" />
              Vendas (Receitas)
            </TabsTrigger>
          </TabsList>
          
          {/* Dynamic header showing current type */}
          <div className={`mb-6 p-4 rounded-xl border-2 transition-all ${
            invoiceType === 'purchase' 
              ? 'bg-indigo-500/10 border-indigo-500/30' 
              : 'bg-rose-500/10 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                invoiceType === 'purchase' ? 'bg-indigo-500/20' : 'bg-rose-500/20'
              }`}>
                {invoiceType === 'purchase' 
                  ? <ShoppingCart className="h-5 w-5 text-indigo-600 dark:text-indigo-400" /> 
                  : <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                }
              </div>
              <div>
                <p className={`font-semibold ${
                  invoiceType === 'purchase' 
                    ? 'text-indigo-700 dark:text-indigo-300' 
                    : 'text-rose-700 dark:text-rose-300'
                }`}>
                  {invoiceType === 'purchase' 
                    ? 'A carregar Facturas de COMPRA' 
                    : 'A carregar Facturas de VENDA'
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {invoiceType === 'purchase' 
                    ? 'Facturas que você recebeu (despesas/gastos)' 
                    : 'Facturas que você emitiu (receitas/vendas)'
                  }
                </p>
              </div>
            </div>
          </div>

          <TabsContent value="purchase" className="space-y-6">
            {/* Upload Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Camera Capture */}
              <ZenCard 
                gradient="primary"
                hoverScale
                withCircle
                className="cursor-pointer"
                onClick={() => !accountantNeedsClients && setShowCamera(true)}
              >
                <CardContent className="relative p-10 text-center">
                  <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                    <Camera className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Use a câmara para ler o QR code automaticamente
                  </p>
                  <Button 
                    size="lg" 
                    className="zen-button gap-2 shadow-md hover:shadow-lg transition-all duration-300"
                    disabled={accountantNeedsClients}
                  >
                    <Camera className="h-4 w-4" />
                    Abrir Câmara
                  </Button>
                </CardContent>
              </ZenCard>

              {/* File Upload */}
              <FileUploader
                onFileSelect={handleFileSelect}
                isProcessing={isProcessing || useAIExtraction}
                disabled={accountantNeedsClients}
              />
            </div>

            {/* Tips Card for Purchases */}
            <ZenCard gradient="muted" withLine>
              <ZenCardHeader title="Facturas de Compra (Gastos)" icon={ShoppingCart} />
              <CardContent>
                <ZenList>
                  <ZenListItem variant="success">
                    Gastos dedutíveis para IVA e IRC/IRS
                  </ZenListItem>
                  <ZenListItem variant="success">
                    Classificação automática por IA
                  </ZenListItem>
                  <ZenListItem variant="success">
                    Exportação para declaração periódica de IVA
                  </ZenListItem>
                  <ZenListItem variant="primary" icon="dot">
                    As facturas são classificadas e validadas pelo contabilista
                  </ZenListItem>
                </ZenList>
              </CardContent>
            </ZenCard>
          </TabsContent>

          <TabsContent value="sales" className="space-y-6">
            {/* Upload Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Camera Capture */}
              <ZenCard 
                gradient="success"
                hoverScale
                withCircle
                className="cursor-pointer"
                onClick={() => !accountantNeedsClients && setShowCamera(true)}
              >
                <CardContent className="relative p-10 text-center">
                  <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500/20 to-green-500/10 rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
                    <Camera className="h-10 w-10 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">Scan QR Code</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Digitalize a factura de venda emitida
                  </p>
                  <Button 
                    size="lg" 
                    variant="secondary"
                    className="gap-2 shadow-md hover:shadow-lg transition-all duration-300"
                    disabled={accountantNeedsClients}
                  >
                    <Camera className="h-4 w-4" />
                    Abrir Câmara
                  </Button>
                </CardContent>
              </ZenCard>

              {/* File Upload */}
              <FileUploader
                onFileSelect={handleFileSelect}
                isProcessing={isProcessing || useAIExtraction}
                disabled={accountantNeedsClients}
              />
            </div>

            {/* Tips Card for Sales */}
            <ZenCard gradient="muted" withLine>
              <ZenCardHeader title="Facturas de Venda (Receitas)" icon={TrendingUp} />
              <CardContent>
                <ZenList>
                  <ZenListItem variant="success">
                    Rendimentos para declaração de Segurança Social
                  </ZenListItem>
                  <ZenListItem variant="success">
                    Cálculo automático de contribuições trimestrais
                  </ZenListItem>
                  <ZenListItem variant="success">
                    Pode também importar SAFT-PT em Segurança Social
                  </ZenListItem>
                  <ZenListItem variant="primary" icon="dot">
                    Alternativa ao registo manual de receitas
                  </ZenListItem>
                </ZenList>
              </CardContent>
            </ZenCard>
          </TabsContent>
        </Tabs>

        {/* General Tips */}
        <ZenCard gradient="muted" withLine>
          <ZenCardHeader title="Leitura automática de QR code" icon={Sparkles} />
          <CardContent>
            <ZenList>
              <ZenListItem variant="success">
                O QR code é detectado automaticamente pela câmara
              </ZenListItem>
              <ZenListItem variant="success">
                Certifique-se que o QR code está bem iluminado e sem reflexos
              </ZenListItem>
              <ZenListItem variant="success">
                Após a detecção, capture a imagem para guardar a factura
              </ZenListItem>
              <ZenListItem variant="primary" icon="dot">
                PDFs são processados automaticamente com extracção IA
              </ZenListItem>
            </ZenList>
          </CardContent>
        </ZenCard>
          </TabsContent>
        </Tabs>

        <QRInputDialog
          open={showQRDialog}
          onOpenChange={setShowQRDialog}
          onSubmit={handleQRSubmit}
          isProcessing={isProcessing}
          imagePreview={capturedImage || undefined}
        />

        <ClientValidationDialog
          open={showClientValidation}
          onOpenChange={setShowClientValidation}
          onSelectClient={() => {
            // Scroll to client selector
            document.querySelector('[class*="bg-primary/5"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />

        <div className="pt-2 text-center text-[11px] text-muted-foreground/70 select-text">
          Build {__BUILD_COMMIT__} · {__BUILD_TIME_ISO__}
        </div>

        <StepNavigator currentStep={0} />
      </div>
    </DashboardLayout>
  );
}

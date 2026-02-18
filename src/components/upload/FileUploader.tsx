import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileImage, X, Loader2, FileText, Sparkles } from 'lucide-react';
import { detectMimeType } from '@/lib/mime';

// Accepted file types
const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf'
];

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing?: boolean;
  accept?: string;
  disabled?: boolean;
}

export function FileUploader({ onFileSelect, isProcessing, accept = 'image/*,.pdf,application/pdf', disabled = false }: FileUploaderProps) {
  const [dragActive, setDragActive] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const isAcceptedType = (file: File): boolean => {
    const mime = detectMimeType(file);
    // Check exact match or partial match for image types
    return ACCEPTED_TYPES.some(type => 
      mime === type || 
      (type.startsWith('image/') && mime.startsWith('image/'))
    );
  };

  const isPDF = (file: File): boolean => {
    return detectMimeType(file) === 'application/pdf';
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = useCallback((file: File) => {
    if (!isAcceptedType(file)) {
      return;
    }
    
    setSelectedFile(file);
    
    const mime = detectMimeType(file);
    // Create preview (for images only)
    if (mime.startsWith('image/') && !mime.includes('heic') && !mime.includes('heif')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      // For PDFs and HEIC, set a placeholder
      setPreview('pdf-placeholder');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [processFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  }, [processFile]);

  const handleUpload = () => {
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
  };

  if (preview && selectedFile) {
    const isFilePDF = isPDF(selectedFile);
    
    return (
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-background/80"
              onClick={handleClear}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
            
            {isFilePDF || preview === 'pdf-placeholder' ? (
              <div className="w-full h-64 bg-muted rounded-lg flex flex-col items-center justify-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full">
                  <FileText className="h-12 w-12 text-primary" />
                </div>
                <Badge variant="secondary" className="gap-1">
                  <FileText className="h-3 w-3" />
                  PDF
                </Badge>
              </div>
            ) : (
              <img
                src={preview}
                alt="Preview"
                className="w-full max-h-64 object-contain rounded-lg bg-muted"
              />
            )}
            
            {/* File type badge */}
            <div className="absolute top-2 left-2">
              <Badge variant={isFilePDF ? "secondary" : "outline"} className="gap-1 bg-background/80">
                {isFilePDF ? <FileText className="h-3 w-3" /> : <FileImage className="h-3 w-3" />}
                {isFilePDF ? 'PDF' : 'Imagem'}
              </Badge>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted-foreground truncate">
              {selectedFile.name}
            </p>
            
            {/* AI extraction indicator for PDFs or non-QR images */}
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 p-2 rounded-md">
              <Sparkles className="h-3 w-3" />
              <span>Extracção de dados com IA</span>
            </div>
            
            <Button
              className="w-full gap-2"
              onClick={handleUpload}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  A extrair dados...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Processar Factura
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={`border-2 border-dashed transition-colors ${
        disabled
          ? 'border-muted opacity-50 cursor-not-allowed'
          : dragActive 
            ? 'border-primary bg-primary/5 cursor-pointer' 
            : 'border-muted-foreground/30 hover:border-muted-foreground/50 cursor-pointer'
      }`}
      onDragEnter={disabled ? undefined : handleDrag}
      onDragLeave={disabled ? undefined : handleDrag}
      onDragOver={disabled ? undefined : handleDrag}
      onDrop={disabled ? undefined : handleDrop}
    >
      <CardContent className="p-12 text-center">
        <input
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
          id="file-upload"
          disabled={disabled}
        />
        
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <FileImage className="h-8 w-8 text-muted-foreground" />
          </div>
          
          <h3 className="text-lg font-semibold mb-2">Upload Ficheiro</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Arraste uma imagem ou PDF, ou clique para seleccionar
          </p>
          <div className="flex flex-wrap justify-center gap-1 mb-6">
            <Badge variant="outline" className="text-xs">JPG</Badge>
            <Badge variant="outline" className="text-xs">PNG</Badge>
            <Badge variant="outline" className="text-xs">WEBP</Badge>
            <Badge variant="outline" className="text-xs">HEIC</Badge>
            <Badge variant="secondary" className="text-xs gap-1">
              <FileText className="h-2.5 w-2.5" />
              PDF
            </Badge>
          </div>
          
          <Button variant="outline" size="lg" asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              Seleccionar Ficheiro
            </span>
          </Button>
        </label>
      </CardContent>
    </Card>
  );
}

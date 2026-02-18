/**
 * EmailExportButton - Generates file and opens mailto with pre-filled email
 * Opens the user's default email client (Outlook, etc.) with pre-filled content
 */

import { useState } from 'react';
import { Mail, Loader2, Download } from 'lucide-react';
import { Button, ButtonProps } from '@/components/ui/button';
import { toast } from 'sonner';

type DeclarationType = 'modelo10' | 'ss' | 'vat' | 'export';

interface EmailExportButtonProps extends Omit<ButtonProps, 'onClick'> {
  recipientEmail?: string;
  recipientName: string;
  declarationType: DeclarationType;
  year: number;
  quarter?: number;
  onGenerateFile: () => Promise<void>;
  fileName: string;
  senderName?: string;
}

const declarationNames: Record<DeclarationType, string> = {
  modelo10: 'Modelo 10 - Retenções na Fonte',
  ss: 'Segurança Social - Declaração Trimestral',
  vat: 'IVA - Declaração Trimestral',
  export: 'Exportação de Dados Fiscais',
};

const declarationSubjects: Record<DeclarationType, string> = {
  modelo10: 'Declaração Modelo 10',
  ss: 'Declaração Segurança Social',
  vat: 'Declaração Periódica IVA',
  export: 'Exportação Dados Fiscais',
};

export function EmailExportButton({
  recipientEmail,
  recipientName,
  declarationType,
  year,
  quarter,
  onGenerateFile,
  fileName,
  senderName,
  children,
  ...buttonProps
}: EmailExportButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const getEmailBody = () => {
    const periodText = quarter
      ? `${quarter}º Trimestre de ${year}`
      : `ano fiscal ${year}`;

    const declarationName = declarationNames[declarationType];

    return `Exmo(a). Sr(a). ${recipientName},

Segue em anexo a declaração "${declarationName}" relativa ao ${periodText}.

Por favor, confirme a recepção deste documento.

Com os melhores cumprimentos,
${senderName || '[Contabilista]'}

---
NOTA: Por favor anexe o ficheiro "${fileName}" (foi descarregado para o seu computador).`;
  };

  const openDesktopEmailClient = (to: string, subject: string, body: string) => {
    const subjectEnc = encodeURIComponent(subject);
    const bodyEnc = encodeURIComponent(body);

    const platform = navigator.platform || '';
    const isWindows = /Win/i.test(platform);
    const isMac = /Mac/i.test(platform);

    // Prefer Outlook Desktop deep-links where possible
    // - Windows: ms-outlook://
    // - macOS: microsoft-outlook://
    const outlookUrl = isWindows
      ? `ms-outlook://compose?to=${encodeURIComponent(to)}&subject=${subjectEnc}&body=${bodyEnc}`
      : isMac
        ? `microsoft-outlook://compose?to=${encodeURIComponent(to)}&subject=${subjectEnc}&body=${bodyEnc}`
        : null;

    const url = outlookUrl || `mailto:${encodeURIComponent(to)}?subject=${subjectEnc}&body=${bodyEnc}`;

    const link = document.createElement('a');
    link.href = url;
    link.target = '_self';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClick = async () => {
    if (!recipientEmail) {
      toast.error('Falta o email do destinatário');
      return;
    }

    setIsGenerating(true);

    try {
      // 1) Generate and download the file first
      await onGenerateFile();

      // 2) Brief pause to allow download to complete
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 3) Open the desktop email client
      const subject = `${declarationSubjects[declarationType]} - ${year} - ${recipientName}`;
      const body = getEmailBody();
      openDesktopEmailClient(recipientEmail, subject, body);

      // 4) Show toast with instructions
      toast.info('Email preparado!', {
        description: `O anexo não pode ser inserido automaticamente pelo browser — anexe manualmente o ficheiro "${fileName}" antes de enviar.`,
        duration: 7000,
      });
    } catch (error: any) {
      console.error('Email export error:', error);
      toast.error('Erro ao preparar email', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={isGenerating}
      {...buttonProps}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          A preparar...
        </>
      ) : (
        <>
          <Mail className="h-4 w-4 mr-2" />
          {children || 'Enviar por Email'}
        </>
      )}
    </Button>
  );
}

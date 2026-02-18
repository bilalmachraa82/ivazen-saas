 /**
  * ImportConsolidated Component
  *
  * Consolidates all Modelo 10 import methods into a single tabbed interface:
  * - Portal AT (copy-paste from AT website)
  * - Emails (parse AT notification emails)
  * - Documentos (bulk upload PDFs/images)
  */
 
 import { useState } from 'react';
 import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { FileSpreadsheet, Mail, Upload, Sparkles, Info } from 'lucide-react';
import { ATRecibosImporter } from './ATRecibosImporter';
import { EmailNotificationImporter } from './EmailNotificationImporter';
import { BackgroundUploadTab } from './BackgroundUploadTab';
 import { Alert, AlertDescription } from '@/components/ui/alert';
 
 interface ImportConsolidatedProps {
   selectedClientId: string | null | undefined;
   selectedYear: number;
   clientName?: string | null;
   onImportComplete: () => void;
   isAccountantOwnAccount?: boolean;
 }
 
 export function ImportConsolidated({
   selectedClientId,
   selectedYear,
   clientName,
   onImportComplete,
   isAccountantOwnAccount
 }: ImportConsolidatedProps) {
   const [activeMethod, setActiveMethod] = useState('portal');
 
   const importMethods = [
     {
       id: 'portal',
       label: 'Portal AT',
       icon: FileSpreadsheet,
       description: 'Copiar/colar tabela do Portal das Finanças'
     },
     {
       id: 'emails',
       label: 'Emails',
       icon: Mail,
       description: 'Parse de emails de notificação da AT',
       isNew: true
     },
      {
        id: 'documentos',
        label: 'Documentos',
        icon: Upload,
        description: 'Upload de PDFs ou imagens (até 500) com validação automática'
      }
   ];
 
   return (
     <Card className="border-primary/10">
       <CardHeader className="pb-4">
         <CardTitle className="flex items-center gap-2 text-lg">
           <Upload className="h-5 w-5 text-primary" />
           Importar Retenções
         </CardTitle>
         <CardDescription>
           Escolha o método de importação mais adequado para os seus documentos
         </CardDescription>
       </CardHeader>
       <CardContent>
         <Tabs value={activeMethod} onValueChange={setActiveMethod} className="space-y-4">
           <TabsList className="grid w-full grid-cols-3">
             {importMethods.map((method) => (
               <TabsTrigger
                 key={method.id}
                 value={method.id}
                 className="flex items-center gap-2 relative"
               >
                 <method.icon className="h-4 w-4" />
                 <span className="hidden sm:inline">{method.label}</span>
                 {method.isNew && (
                   <Badge
                     variant="secondary"
                     className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1 py-0 h-4 gap-0.5 absolute -top-2 -right-2 sm:static sm:ml-1"
                   >
                     <Sparkles className="h-2.5 w-2.5" />
                     <span className="hidden sm:inline">NOVO</span>
                   </Badge>
                 )}
               </TabsTrigger>
             ))}
           </TabsList>
 
           {/* Method description */}
           <Alert className="border-muted bg-muted/30">
             <Info className="h-4 w-4" />
             <AlertDescription className="text-xs">
               {importMethods.find(m => m.id === activeMethod)?.description}
             </AlertDescription>
           </Alert>
 
           <TabsContent value="portal" className="mt-4">
             <ATRecibosImporter
               selectedClientId={selectedClientId}
               selectedYear={selectedYear}
               clientName={clientName}
               onImportComplete={onImportComplete}
               isAccountantOwnAccount={isAccountantOwnAccount}
             />
           </TabsContent>
 
           <TabsContent value="emails" className="mt-4">
             <EmailNotificationImporter
               selectedClientId={selectedClientId}
               selectedYear={selectedYear}
               clientName={clientName}
               onImportComplete={onImportComplete}
               isAccountantOwnAccount={isAccountantOwnAccount}
             />
           </TabsContent>
 
            <TabsContent value="documentos" className="mt-4">
              <BackgroundUploadTab
                selectedClientId={selectedClientId}
                selectedYear={selectedYear}
                isAccountantOwnAccount={isAccountantOwnAccount}
              />
            </TabsContent>
         </Tabs>
       </CardContent>
     </Card>
   );
 }
-- Criar bucket para logos de parceiros
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-logos', 'partner-logos', true);

-- RLS para permitir leitura pública
CREATE POLICY "Anyone can view partner logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'partner-logos');

-- RLS para upload apenas para admins
CREATE POLICY "Admins can upload partner logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para atualizar apenas para admins
CREATE POLICY "Admins can update partner logos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- RLS para eliminar apenas para admins
CREATE POLICY "Admins can delete partner logos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'partner-logos' 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
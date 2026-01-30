-- Create partners table for dynamic management
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  initials text NOT NULL,
  logo_url text,
  website_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Public can view active partners
CREATE POLICY "Anyone can view active partners"
  ON public.partners FOR SELECT
  USING (is_active = true);

-- Admins can manage partners
CREATE POLICY "Admins can manage partners"
  ON public.partners FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial partners data
INSERT INTO public.partners (name, initials, display_order) VALUES
  ('Contabilidade Silva & Associados', 'CS', 1),
  ('MS Escritórios', 'MS', 2),
  ('TechStartup Lda', 'TS', 3),
  ('Gabinete Fiscal PT', 'GF', 4),
  ('ENI Consultores', 'EC', 5),
  ('Digital Finance', 'DF', 6),
  ('Porto Accounting', 'PA', 7),
  ('Lisbon Tax Services', 'LT', 8);
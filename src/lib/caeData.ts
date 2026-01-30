// Códigos CAE (Classificação das Actividades Económicas) Portugueses
// Principais códigos usados por trabalhadores independentes e PMEs

export interface CAECode {
  code: string;
  description: string;
  section: string;
  sectionName: string;
  popular?: boolean; // Códigos mais comuns
}

export const CAE_SECTIONS: Record<string, string> = {
  'A': 'Agricultura, produção animal, caça, floresta e pesca',
  'B': 'Indústrias extractivas',
  'C': 'Indústrias transformadoras',
  'D': 'Electricidade, gás, vapor e ar condicionado',
  'E': 'Água, saneamento e resíduos',
  'F': 'Construção',
  'G': 'Comércio por grosso e a retalho',
  'H': 'Transportes e armazenagem',
  'I': 'Alojamento e restauração',
  'J': 'Informação e comunicação',
  'K': 'Actividades financeiras e de seguros',
  'L': 'Actividades imobiliárias',
  'M': 'Actividades de consultoria, científicas e técnicas',
  'N': 'Actividades administrativas e serviços de apoio',
  'O': 'Administração pública e defesa',
  'P': 'Educação',
  'Q': 'Saúde humana e acção social',
  'R': 'Artes, espectáculos e recreação',
  'S': 'Outras actividades de serviços',
};

// Lista de CAEs mais comuns para trabalhadores independentes e PMEs
export const CAE_CODES: CAECode[] = [
  // === Secção A - Agricultura ===
  { code: '01110', description: 'Culturas cerealíferas, leguminosas e oleaginosas', section: 'A', sectionName: 'Agricultura' },
  { code: '01210', description: 'Viticultura', section: 'A', sectionName: 'Agricultura' },
  { code: '01410', description: 'Criação de bovinos para produção de leite', section: 'A', sectionName: 'Agricultura' },
  { code: '01500', description: 'Agricultura e produção animal combinadas', section: 'A', sectionName: 'Agricultura' },
  
  // === Secção C - Indústrias Transformadoras ===
  { code: '10110', description: 'Abate de animais e preparação de carne', section: 'C', sectionName: 'Indústrias Transformadoras' },
  { code: '10712', description: 'Panificação', section: 'C', sectionName: 'Indústrias Transformadoras' },
  { code: '14131', description: 'Confecção de vestuário exterior', section: 'C', sectionName: 'Indústrias Transformadoras' },
  { code: '16101', description: 'Serração de madeira', section: 'C', sectionName: 'Indústrias Transformadoras' },
  { code: '25110', description: 'Fabricação de estruturas metálicas', section: 'C', sectionName: 'Indústrias Transformadoras' },
  
  // === Secção F - Construção ===
  { code: '41100', description: 'Promoção imobiliária', section: 'F', sectionName: 'Construção' },
  { code: '41200', description: 'Construção de edifícios', section: 'F', sectionName: 'Construção', popular: true },
  { code: '42110', description: 'Construção de estradas e auto-estradas', section: 'F', sectionName: 'Construção' },
  { code: '43110', description: 'Demolição', section: 'F', sectionName: 'Construção' },
  { code: '43210', description: 'Instalação eléctrica', section: 'F', sectionName: 'Construção', popular: true },
  { code: '43220', description: 'Instalações de canalização, aquecimento e ar condicionado', section: 'F', sectionName: 'Construção', popular: true },
  { code: '43310', description: 'Estucagem', section: 'F', sectionName: 'Construção' },
  { code: '43320', description: 'Montagem de trabalhos de carpintaria e caixilharia', section: 'F', sectionName: 'Construção' },
  { code: '43340', description: 'Pintura e colocação de vidros', section: 'F', sectionName: 'Construção' },
  { code: '43390', description: 'Outras actividades de acabamento em edifícios', section: 'F', sectionName: 'Construção' },
  
  // === Secção G - Comércio ===
  { code: '45110', description: 'Comércio de veículos automóveis ligeiros', section: 'G', sectionName: 'Comércio', popular: true },
  { code: '45200', description: 'Manutenção e reparação de veículos automóveis', section: 'G', sectionName: 'Comércio', popular: true },
  { code: '46190', description: 'Agentes de comércio por grosso misto', section: 'G', sectionName: 'Comércio' },
  { code: '46900', description: 'Comércio por grosso não especializado', section: 'G', sectionName: 'Comércio' },
  { code: '47111', description: 'Comércio a retalho em supermercados e hipermercados', section: 'G', sectionName: 'Comércio' },
  { code: '47191', description: 'Comércio a retalho não especializado', section: 'G', sectionName: 'Comércio' },
  { code: '47610', description: 'Comércio a retalho de livros', section: 'G', sectionName: 'Comércio' },
  { code: '47781', description: 'Comércio a retalho de combustíveis', section: 'G', sectionName: 'Comércio' },
  { code: '47910', description: 'Comércio a retalho por correspondência ou via Internet', section: 'G', sectionName: 'Comércio', popular: true },
  
  // === Secção H - Transportes ===
  { code: '49320', description: 'Transportes de passageiros em veículos ligeiros (táxis e TVDE)', section: 'H', sectionName: 'Transportes', popular: true },
  { code: '49410', description: 'Transportes rodoviários de mercadorias', section: 'H', sectionName: 'Transportes', popular: true },
  { code: '52290', description: 'Outras actividades auxiliares dos transportes', section: 'H', sectionName: 'Transportes' },
  
  // === Secção I - Alojamento e Restauração ===
  { code: '55111', description: 'Hotéis com restaurante', section: 'I', sectionName: 'Alojamento e Restauração' },
  { code: '55201', description: 'Alojamento mobilado para turistas', section: 'I', sectionName: 'Alojamento e Restauração', popular: true },
  { code: '56101', description: 'Restaurantes tipo tradicional', section: 'I', sectionName: 'Alojamento e Restauração', popular: true },
  { code: '56102', description: 'Restaurantes com serviço de mesa', section: 'I', sectionName: 'Alojamento e Restauração' },
  { code: '56107', description: 'Restaurantes take-away', section: 'I', sectionName: 'Alojamento e Restauração' },
  { code: '56301', description: 'Cafés', section: 'I', sectionName: 'Alojamento e Restauração', popular: true },
  { code: '56302', description: 'Bares', section: 'I', sectionName: 'Alojamento e Restauração' },
  
  // === Secção J - Informação e Comunicação ===
  { code: '58110', description: 'Edição de livros', section: 'J', sectionName: 'Informação e Comunicação' },
  { code: '58290', description: 'Edição de outros programas informáticos', section: 'J', sectionName: 'Informação e Comunicação' },
  { code: '59110', description: 'Produção de filmes e vídeos', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '62010', description: 'Actividades de programação informática', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '62020', description: 'Actividades de consultoria informática', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '62030', description: 'Gestão e exploração de equipamento informático', section: 'J', sectionName: 'Informação e Comunicação' },
  { code: '62090', description: 'Outras actividades relacionadas com as TIC', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '63110', description: 'Actividades de processamento de dados e domiciliação de informação', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '63120', description: 'Portais web', section: 'J', sectionName: 'Informação e Comunicação', popular: true },
  { code: '63910', description: 'Actividades de agências de notícias', section: 'J', sectionName: 'Informação e Comunicação' },
  
  // === Secção K - Actividades Financeiras ===
  { code: '66220', description: 'Actividades de mediadores de seguros', section: 'K', sectionName: 'Actividades Financeiras' },
  { code: '66190', description: 'Outras actividades auxiliares de serviços financeiros', section: 'K', sectionName: 'Actividades Financeiras' },
  
  // === Secção L - Actividades Imobiliárias ===
  { code: '68100', description: 'Compra e venda de bens imobiliários próprios', section: 'L', sectionName: 'Actividades Imobiliárias' },
  { code: '68200', description: 'Arrendamento de bens imobiliários', section: 'L', sectionName: 'Actividades Imobiliárias', popular: true },
  { code: '68311', description: 'Mediação imobiliária', section: 'L', sectionName: 'Actividades Imobiliárias', popular: true },
  { code: '68321', description: 'Administração de imóveis por conta de outrem', section: 'L', sectionName: 'Actividades Imobiliárias' },
  
  // === Secção M - Consultoria, Científicas e Técnicas ===
  { code: '69101', description: 'Actividades jurídicas (advocacia)', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '69102', description: 'Actividades de cartórios notariais', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '69200', description: 'Actividades de contabilidade e auditoria', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '70100', description: 'Actividades das sedes sociais', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '70210', description: 'Actividades de relações públicas e comunicação', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '70220', description: 'Outras actividades de consultoria de gestão', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '71110', description: 'Actividades de arquitectura', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '71120', description: 'Actividades de engenharia e técnicas afins', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '71200', description: 'Actividades de ensaios e análises técnicas', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '72110', description: 'Investigação em biotecnologia', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '72190', description: 'Outras investigações em ciências naturais', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '73110', description: 'Agências de publicidade', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '73120', description: 'Representação nos meios de comunicação', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '73200', description: 'Estudos de mercado e sondagens de opinião', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '74100', description: 'Actividades de design', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '74200', description: 'Actividades fotográficas', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '74300', description: 'Actividades de tradução e interpretação', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  { code: '74900', description: 'Outras actividades de consultoria científica e técnica', section: 'M', sectionName: 'Consultoria e Técnicas' },
  { code: '75000', description: 'Actividades veterinárias', section: 'M', sectionName: 'Consultoria e Técnicas', popular: true },
  
  // === Secção N - Actividades Administrativas ===
  { code: '77110', description: 'Aluguer de veículos automóveis ligeiros', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '78100', description: 'Actividades das empresas de selecção e colocação de pessoal', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '79110', description: 'Actividades das agências de viagem', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '80100', description: 'Actividades de segurança privada', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '81100', description: 'Actividades combinadas de apoio aos edifícios', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '81210', description: 'Limpeza geral de edifícios', section: 'N', sectionName: 'Actividades Administrativas', popular: true },
  { code: '81291', description: 'Desinfecção e desratização', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '81300', description: 'Manutenção de espaços verdes', section: 'N', sectionName: 'Actividades Administrativas', popular: true },
  { code: '82110', description: 'Actividades combinadas de serviços administrativos', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '82190', description: 'Serviços de fotocópias e secretariado', section: 'N', sectionName: 'Actividades Administrativas' },
  { code: '82300', description: 'Organização de feiras, congressos e outros eventos', section: 'N', sectionName: 'Actividades Administrativas', popular: true },
  { code: '82990', description: 'Outras actividades de serviços de apoio às empresas', section: 'N', sectionName: 'Actividades Administrativas' },
  
  // === Secção P - Educação ===
  { code: '85320', description: 'Ensino secundário técnico e profissional', section: 'P', sectionName: 'Educação' },
  { code: '85510', description: 'Ensino de desporto e lazer', section: 'P', sectionName: 'Educação', popular: true },
  { code: '85520', description: 'Ensino de actividades culturais', section: 'P', sectionName: 'Educação', popular: true },
  { code: '85530', description: 'Escolas de condução', section: 'P', sectionName: 'Educação' },
  { code: '85591', description: 'Formação profissional', section: 'P', sectionName: 'Educação', popular: true },
  { code: '85593', description: 'Outras actividades de ensino', section: 'P', sectionName: 'Educação' },
  { code: '85600', description: 'Actividades de apoio à educação', section: 'P', sectionName: 'Educação' },
  
  // === Secção Q - Saúde ===
  { code: '86100', description: 'Actividades dos estabelecimentos de saúde com internamento', section: 'Q', sectionName: 'Saúde' },
  { code: '86210', description: 'Actividades de prática médica de clínica geral', section: 'Q', sectionName: 'Saúde', popular: true },
  { code: '86220', description: 'Actividades de prática médica de clínica especializada', section: 'Q', sectionName: 'Saúde', popular: true },
  { code: '86230', description: 'Actividades de medicina dentária', section: 'Q', sectionName: 'Saúde', popular: true },
  { code: '86901', description: 'Laboratórios de análises clínicas', section: 'Q', sectionName: 'Saúde' },
  { code: '86902', description: 'Actividades de ambulâncias', section: 'Q', sectionName: 'Saúde' },
  { code: '86903', description: 'Actividades de enfermagem', section: 'Q', sectionName: 'Saúde', popular: true },
  { code: '86904', description: 'Centros de recolha de análises', section: 'Q', sectionName: 'Saúde' },
  { code: '86905', description: 'Actividades termais', section: 'Q', sectionName: 'Saúde' },
  { code: '86906', description: 'Outras actividades de saúde humana (fisioterapia, etc.)', section: 'Q', sectionName: 'Saúde', popular: true },
  
  // === Secção R - Artes e Recreação ===
  { code: '90010', description: 'Actividades das artes do espectáculo', section: 'R', sectionName: 'Artes e Recreação', popular: true },
  { code: '90020', description: 'Actividades de apoio às artes do espectáculo', section: 'R', sectionName: 'Artes e Recreação' },
  { code: '90030', description: 'Criação artística e literária', section: 'R', sectionName: 'Artes e Recreação', popular: true },
  { code: '93110', description: 'Gestão de instalações desportivas', section: 'R', sectionName: 'Artes e Recreação' },
  { code: '93130', description: 'Actividades de ginásio (fitness)', section: 'R', sectionName: 'Artes e Recreação', popular: true },
  { code: '93192', description: 'Outras actividades desportivas', section: 'R', sectionName: 'Artes e Recreação' },
  { code: '93210', description: 'Parques de diversão e temáticos', section: 'R', sectionName: 'Artes e Recreação' },
  { code: '93294', description: 'Outras actividades de diversão e recreação', section: 'R', sectionName: 'Artes e Recreação' },
  
  // === Secção S - Outros Serviços ===
  { code: '95110', description: 'Reparação de computadores e equipamento periférico', section: 'S', sectionName: 'Outros Serviços', popular: true },
  { code: '95120', description: 'Reparação de equipamento de comunicação', section: 'S', sectionName: 'Outros Serviços' },
  { code: '95210', description: 'Reparação de televisores e outros equipamentos', section: 'S', sectionName: 'Outros Serviços' },
  { code: '95220', description: 'Reparação de electrodomésticos', section: 'S', sectionName: 'Outros Serviços' },
  { code: '95230', description: 'Reparação de calçado e artigos de couro', section: 'S', sectionName: 'Outros Serviços' },
  { code: '95240', description: 'Reparação de mobiliário', section: 'S', sectionName: 'Outros Serviços' },
  { code: '95290', description: 'Reparação de outros bens pessoais e domésticos', section: 'S', sectionName: 'Outros Serviços' },
  { code: '96021', description: 'Salões de cabeleireiro', section: 'S', sectionName: 'Outros Serviços', popular: true },
  { code: '96022', description: 'Institutos de beleza', section: 'S', sectionName: 'Outros Serviços', popular: true },
  { code: '96040', description: 'Actividades de bem-estar físico (spa, massagens)', section: 'S', sectionName: 'Outros Serviços', popular: true },
  { code: '96091', description: 'Actividades de tatuagem e piercing', section: 'S', sectionName: 'Outros Serviços' },
  { code: '96093', description: 'Outras actividades de serviços pessoais diversas', section: 'S', sectionName: 'Outros Serviços' },
];

// Helper function to search CAE codes
export function searchCAE(query: string): CAECode[] {
  if (!query || query.trim() === '') {
    // Return popular codes when no search query
    return CAE_CODES.filter(cae => cae.popular).slice(0, 10);
  }
  
  const lowerQuery = query.toLowerCase().trim();
  
  // Filter by code or description
  return CAE_CODES.filter(cae => 
    cae.code.includes(query) || 
    cae.description.toLowerCase().includes(lowerQuery) ||
    cae.sectionName.toLowerCase().includes(lowerQuery)
  ).slice(0, 20); // Limit to 20 results
}

// Helper function to get CAE by code
export function getCAEByCode(code: string): CAECode | undefined {
  return CAE_CODES.find(cae => cae.code === code);
}

// Helper function to validate CAE code
export function isValidCAECode(code: string): boolean {
  if (!code || !/^\d{5}$/.test(code)) return false;
  const numValue = parseInt(code, 10);
  return numValue >= 1110 && numValue <= 99000;
}

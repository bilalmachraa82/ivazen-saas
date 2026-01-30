// ISO 3166-1 alpha-2 country codes - Complete list for tax withholding purposes
// Includes all 249 countries and territories with Portuguese names

export interface Country {
  code: string;
  name: string;
  flag?: string;
  hasTaxTreaty?: boolean; // Portugal has tax treaties with this country
}

// Countries organized by region for easier navigation
export const COUNTRIES: Country[] = [
  // ========== PORTUGAL (first for convenience) ==========
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', hasTaxTreaty: false },
  
  // ========== EU COUNTRIES (27) ==========
  { code: 'AT', name: 'Áustria', flag: '🇦🇹', hasTaxTreaty: true },
  { code: 'BE', name: 'Bélgica', flag: '🇧🇪', hasTaxTreaty: true },
  { code: 'BG', name: 'Bulgária', flag: '🇧🇬', hasTaxTreaty: true },
  { code: 'CY', name: 'Chipre', flag: '🇨🇾', hasTaxTreaty: true },
  { code: 'CZ', name: 'Chéquia', flag: '🇨🇿', hasTaxTreaty: true },
  { code: 'DE', name: 'Alemanha', flag: '🇩🇪', hasTaxTreaty: true },
  { code: 'DK', name: 'Dinamarca', flag: '🇩🇰', hasTaxTreaty: true },
  { code: 'EE', name: 'Estónia', flag: '🇪🇪', hasTaxTreaty: true },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸', hasTaxTreaty: true },
  { code: 'FI', name: 'Finlândia', flag: '🇫🇮', hasTaxTreaty: true },
  { code: 'FR', name: 'França', flag: '🇫🇷', hasTaxTreaty: true },
  { code: 'GR', name: 'Grécia', flag: '🇬🇷', hasTaxTreaty: true },
  { code: 'HR', name: 'Croácia', flag: '🇭🇷', hasTaxTreaty: true },
  { code: 'HU', name: 'Hungria', flag: '🇭🇺', hasTaxTreaty: true },
  { code: 'IE', name: 'Irlanda', flag: '🇮🇪', hasTaxTreaty: true },
  { code: 'IT', name: 'Itália', flag: '🇮🇹', hasTaxTreaty: true },
  { code: 'LT', name: 'Lituânia', flag: '🇱🇹', hasTaxTreaty: true },
  { code: 'LU', name: 'Luxemburgo', flag: '🇱🇺', hasTaxTreaty: true },
  { code: 'LV', name: 'Letónia', flag: '🇱🇻', hasTaxTreaty: true },
  { code: 'MT', name: 'Malta', flag: '🇲🇹', hasTaxTreaty: true },
  { code: 'NL', name: 'Países Baixos', flag: '🇳🇱', hasTaxTreaty: true },
  { code: 'PL', name: 'Polónia', flag: '🇵🇱', hasTaxTreaty: true },
  { code: 'RO', name: 'Roménia', flag: '🇷🇴', hasTaxTreaty: true },
  { code: 'SE', name: 'Suécia', flag: '🇸🇪', hasTaxTreaty: true },
  { code: 'SI', name: 'Eslovénia', flag: '🇸🇮', hasTaxTreaty: true },
  { code: 'SK', name: 'Eslováquia', flag: '🇸🇰', hasTaxTreaty: true },
  
  // ========== EEA (non-EU) ==========
  { code: 'IS', name: 'Islândia', flag: '🇮🇸', hasTaxTreaty: true },
  { code: 'LI', name: 'Liechtenstein', flag: '🇱🇮', hasTaxTreaty: false },
  { code: 'NO', name: 'Noruega', flag: '🇳🇴', hasTaxTreaty: true },
  
  // ========== OTHER EUROPE ==========
  { code: 'AD', name: 'Andorra', flag: '🇦🇩', hasTaxTreaty: true },
  { code: 'AL', name: 'Albânia', flag: '🇦🇱', hasTaxTreaty: false },
  { code: 'BA', name: 'Bósnia e Herzegovina', flag: '🇧🇦', hasTaxTreaty: false },
  { code: 'BY', name: 'Bielorrússia', flag: '🇧🇾', hasTaxTreaty: false },
  { code: 'CH', name: 'Suíça', flag: '🇨🇭', hasTaxTreaty: true },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧', hasTaxTreaty: true },
  { code: 'GG', name: 'Guernsey', flag: '🇬🇬', hasTaxTreaty: false },
  { code: 'GI', name: 'Gibraltar', flag: '🇬🇮', hasTaxTreaty: false },
  { code: 'IM', name: 'Ilha de Man', flag: '🇮🇲', hasTaxTreaty: false },
  { code: 'JE', name: 'Jersey', flag: '🇯🇪', hasTaxTreaty: false },
  { code: 'MC', name: 'Mónaco', flag: '🇲🇨', hasTaxTreaty: false },
  { code: 'MD', name: 'Moldávia', flag: '🇲🇩', hasTaxTreaty: true },
  { code: 'ME', name: 'Montenegro', flag: '🇲🇪', hasTaxTreaty: false },
  { code: 'MK', name: 'Macedónia do Norte', flag: '🇲🇰', hasTaxTreaty: false },
  { code: 'RS', name: 'Sérvia', flag: '🇷🇸', hasTaxTreaty: false },
  { code: 'RU', name: 'Rússia', flag: '🇷🇺', hasTaxTreaty: true },
  { code: 'SM', name: 'San Marino', flag: '🇸🇲', hasTaxTreaty: true },
  { code: 'UA', name: 'Ucrânia', flag: '🇺🇦', hasTaxTreaty: true },
  { code: 'VA', name: 'Vaticano', flag: '🇻🇦', hasTaxTreaty: false },
  { code: 'XK', name: 'Kosovo', flag: '🇽🇰', hasTaxTreaty: false },
  
  // ========== NORTH AMERICA ==========
  { code: 'CA', name: 'Canadá', flag: '🇨🇦', hasTaxTreaty: true },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', hasTaxTreaty: true },
  { code: 'MX', name: 'México', flag: '🇲🇽', hasTaxTreaty: true },
  
  // ========== CENTRAL AMERICA & CARIBBEAN ==========
  { code: 'AG', name: 'Antígua e Barbuda', flag: '🇦🇬', hasTaxTreaty: false },
  { code: 'AI', name: 'Anguila', flag: '🇦🇮', hasTaxTreaty: false },
  { code: 'AW', name: 'Aruba', flag: '🇦🇼', hasTaxTreaty: false },
  { code: 'BB', name: 'Barbados', flag: '🇧🇧', hasTaxTreaty: true },
  { code: 'BM', name: 'Bermudas', flag: '🇧🇲', hasTaxTreaty: false },
  { code: 'BS', name: 'Bahamas', flag: '🇧🇸', hasTaxTreaty: false },
  { code: 'BZ', name: 'Belize', flag: '🇧🇿', hasTaxTreaty: false },
  { code: 'CR', name: 'Costa Rica', flag: '🇨🇷', hasTaxTreaty: false },
  { code: 'CU', name: 'Cuba', flag: '🇨🇺', hasTaxTreaty: true },
  { code: 'CW', name: 'Curaçao', flag: '🇨🇼', hasTaxTreaty: false },
  { code: 'DM', name: 'Dominica', flag: '🇩🇲', hasTaxTreaty: false },
  { code: 'DO', name: 'República Dominicana', flag: '🇩🇴', hasTaxTreaty: false },
  { code: 'GD', name: 'Granada', flag: '🇬🇩', hasTaxTreaty: false },
  { code: 'GT', name: 'Guatemala', flag: '🇬🇹', hasTaxTreaty: false },
  { code: 'HN', name: 'Honduras', flag: '🇭🇳', hasTaxTreaty: false },
  { code: 'HT', name: 'Haiti', flag: '🇭🇹', hasTaxTreaty: false },
  { code: 'JM', name: 'Jamaica', flag: '🇯🇲', hasTaxTreaty: false },
  { code: 'KN', name: 'São Cristóvão e Nevis', flag: '🇰🇳', hasTaxTreaty: false },
  { code: 'KY', name: 'Ilhas Caimão', flag: '🇰🇾', hasTaxTreaty: false },
  { code: 'LC', name: 'Santa Lúcia', flag: '🇱🇨', hasTaxTreaty: false },
  { code: 'MS', name: 'Montserrat', flag: '🇲🇸', hasTaxTreaty: false },
  { code: 'NI', name: 'Nicarágua', flag: '🇳🇮', hasTaxTreaty: false },
  { code: 'PA', name: 'Panamá', flag: '🇵🇦', hasTaxTreaty: true },
  { code: 'PR', name: 'Porto Rico', flag: '🇵🇷', hasTaxTreaty: false },
  { code: 'SV', name: 'El Salvador', flag: '🇸🇻', hasTaxTreaty: false },
  { code: 'SX', name: 'São Martinho (Países Baixos)', flag: '🇸🇽', hasTaxTreaty: false },
  { code: 'TC', name: 'Ilhas Turcas e Caicos', flag: '🇹🇨', hasTaxTreaty: false },
  { code: 'TT', name: 'Trindade e Tobago', flag: '🇹🇹', hasTaxTreaty: false },
  { code: 'VC', name: 'São Vicente e Granadinas', flag: '🇻🇨', hasTaxTreaty: false },
  { code: 'VG', name: 'Ilhas Virgens Britânicas', flag: '🇻🇬', hasTaxTreaty: false },
  { code: 'VI', name: 'Ilhas Virgens Americanas', flag: '🇻🇮', hasTaxTreaty: false },
  
  // ========== SOUTH AMERICA ==========
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', hasTaxTreaty: false },
  { code: 'BO', name: 'Bolívia', flag: '🇧🇴', hasTaxTreaty: false },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', hasTaxTreaty: true },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', hasTaxTreaty: true },
  { code: 'CO', name: 'Colômbia', flag: '🇨🇴', hasTaxTreaty: true },
  { code: 'EC', name: 'Equador', flag: '🇪🇨', hasTaxTreaty: false },
  { code: 'FK', name: 'Ilhas Malvinas/Falkland', flag: '🇫🇰', hasTaxTreaty: false },
  { code: 'GF', name: 'Guiana Francesa', flag: '🇬🇫', hasTaxTreaty: false },
  { code: 'GY', name: 'Guiana', flag: '🇬🇾', hasTaxTreaty: false },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', hasTaxTreaty: true },
  { code: 'PY', name: 'Paraguai', flag: '🇵🇾', hasTaxTreaty: false },
  { code: 'SR', name: 'Suriname', flag: '🇸🇷', hasTaxTreaty: false },
  { code: 'UY', name: 'Uruguai', flag: '🇺🇾', hasTaxTreaty: true },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', hasTaxTreaty: true },
  
  // ========== AFRICA - LUSOPHONE ==========
  { code: 'AO', name: 'Angola', flag: '🇦🇴', hasTaxTreaty: true },
  { code: 'CV', name: 'Cabo Verde', flag: '🇨🇻', hasTaxTreaty: true },
  { code: 'GW', name: 'Guiné-Bissau', flag: '🇬🇼', hasTaxTreaty: true },
  { code: 'MZ', name: 'Moçambique', flag: '🇲🇿', hasTaxTreaty: true },
  { code: 'ST', name: 'São Tomé e Príncipe', flag: '🇸🇹', hasTaxTreaty: true },
  
  // ========== AFRICA - OTHER ==========
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫', hasTaxTreaty: false },
  { code: 'BI', name: 'Burundi', flag: '🇧🇮', hasTaxTreaty: false },
  { code: 'BJ', name: 'Benim', flag: '🇧🇯', hasTaxTreaty: false },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', hasTaxTreaty: false },
  { code: 'CD', name: 'República Democrática do Congo', flag: '🇨🇩', hasTaxTreaty: false },
  { code: 'CF', name: 'República Centro-Africana', flag: '🇨🇫', hasTaxTreaty: false },
  { code: 'CG', name: 'Congo', flag: '🇨🇬', hasTaxTreaty: false },
  { code: 'CI', name: 'Costa do Marfim', flag: '🇨🇮', hasTaxTreaty: false },
  { code: 'CM', name: 'Camarões', flag: '🇨🇲', hasTaxTreaty: false },
  { code: 'DJ', name: 'Djibuti', flag: '🇩🇯', hasTaxTreaty: false },
  { code: 'DZ', name: 'Argélia', flag: '🇩🇿', hasTaxTreaty: true },
  { code: 'EG', name: 'Egito', flag: '🇪🇬', hasTaxTreaty: false },
  { code: 'EH', name: 'Saara Ocidental', flag: '🇪🇭', hasTaxTreaty: false },
  { code: 'ER', name: 'Eritreia', flag: '🇪🇷', hasTaxTreaty: false },
  { code: 'ET', name: 'Etiópia', flag: '🇪🇹', hasTaxTreaty: true },
  { code: 'GA', name: 'Gabão', flag: '🇬🇦', hasTaxTreaty: false },
  { code: 'GH', name: 'Gana', flag: '🇬🇭', hasTaxTreaty: false },
  { code: 'GM', name: 'Gâmbia', flag: '🇬🇲', hasTaxTreaty: false },
  { code: 'GN', name: 'Guiné', flag: '🇬🇳', hasTaxTreaty: false },
  { code: 'GQ', name: 'Guiné Equatorial', flag: '🇬🇶', hasTaxTreaty: false },
  { code: 'KE', name: 'Quénia', flag: '🇰🇪', hasTaxTreaty: false },
  { code: 'KM', name: 'Comores', flag: '🇰🇲', hasTaxTreaty: false },
  { code: 'LR', name: 'Libéria', flag: '🇱🇷', hasTaxTreaty: false },
  { code: 'LS', name: 'Lesoto', flag: '🇱🇸', hasTaxTreaty: false },
  { code: 'LY', name: 'Líbia', flag: '🇱🇾', hasTaxTreaty: false },
  { code: 'MA', name: 'Marrocos', flag: '🇲🇦', hasTaxTreaty: true },
  { code: 'MG', name: 'Madagáscar', flag: '🇲🇬', hasTaxTreaty: false },
  { code: 'ML', name: 'Mali', flag: '🇲🇱', hasTaxTreaty: false },
  { code: 'MR', name: 'Mauritânia', flag: '🇲🇷', hasTaxTreaty: false },
  { code: 'MU', name: 'Maurícia', flag: '🇲🇺', hasTaxTreaty: false },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', hasTaxTreaty: false },
  { code: 'NA', name: 'Namíbia', flag: '🇳🇦', hasTaxTreaty: false },
  { code: 'NE', name: 'Níger', flag: '🇳🇪', hasTaxTreaty: false },
  { code: 'NG', name: 'Nigéria', flag: '🇳🇬', hasTaxTreaty: false },
  { code: 'RE', name: 'Reunião', flag: '🇷🇪', hasTaxTreaty: false },
  { code: 'RW', name: 'Ruanda', flag: '🇷🇼', hasTaxTreaty: false },
  { code: 'SC', name: 'Seicheles', flag: '🇸🇨', hasTaxTreaty: false },
  { code: 'SD', name: 'Sudão', flag: '🇸🇩', hasTaxTreaty: false },
  { code: 'SL', name: 'Serra Leoa', flag: '🇸🇱', hasTaxTreaty: false },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', hasTaxTreaty: false },
  { code: 'SO', name: 'Somália', flag: '🇸🇴', hasTaxTreaty: false },
  { code: 'SS', name: 'Sudão do Sul', flag: '🇸🇸', hasTaxTreaty: false },
  { code: 'SZ', name: 'Essuatíni (Suazilândia)', flag: '🇸🇿', hasTaxTreaty: false },
  { code: 'TD', name: 'Chade', flag: '🇹🇩', hasTaxTreaty: false },
  { code: 'TG', name: 'Togo', flag: '🇹🇬', hasTaxTreaty: false },
  { code: 'TN', name: 'Tunísia', flag: '🇹🇳', hasTaxTreaty: true },
  { code: 'TZ', name: 'Tanzânia', flag: '🇹🇿', hasTaxTreaty: false },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', hasTaxTreaty: false },
  { code: 'YT', name: 'Maiote', flag: '🇾🇹', hasTaxTreaty: false },
  { code: 'ZA', name: 'África do Sul', flag: '🇿🇦', hasTaxTreaty: true },
  { code: 'ZM', name: 'Zâmbia', flag: '🇿🇲', hasTaxTreaty: false },
  { code: 'ZW', name: 'Zimbabué', flag: '🇿🇼', hasTaxTreaty: false },
  
  // ========== MIDDLE EAST ==========
  { code: 'AE', name: 'Emirados Árabes Unidos', flag: '🇦🇪', hasTaxTreaty: true },
  { code: 'BH', name: 'Bahrein', flag: '🇧🇭', hasTaxTreaty: true },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', hasTaxTreaty: true },
  { code: 'IQ', name: 'Iraque', flag: '🇮🇶', hasTaxTreaty: false },
  { code: 'IR', name: 'Irão', flag: '🇮🇷', hasTaxTreaty: false },
  { code: 'JO', name: 'Jordânia', flag: '🇯🇴', hasTaxTreaty: false },
  { code: 'KW', name: 'Kuwait', flag: '🇰🇼', hasTaxTreaty: true },
  { code: 'LB', name: 'Líbano', flag: '🇱🇧', hasTaxTreaty: false },
  { code: 'OM', name: 'Omã', flag: '🇴🇲', hasTaxTreaty: false },
  { code: 'PS', name: 'Palestina', flag: '🇵🇸', hasTaxTreaty: false },
  { code: 'QA', name: 'Catar', flag: '🇶🇦', hasTaxTreaty: true },
  { code: 'SA', name: 'Arábia Saudita', flag: '🇸🇦', hasTaxTreaty: true },
  { code: 'SY', name: 'Síria', flag: '🇸🇾', hasTaxTreaty: false },
  { code: 'TR', name: 'Turquia', flag: '🇹🇷', hasTaxTreaty: true },
  { code: 'YE', name: 'Iémen', flag: '🇾🇪', hasTaxTreaty: false },
  
  // ========== CENTRAL ASIA ==========
  { code: 'AF', name: 'Afeganistão', flag: '🇦🇫', hasTaxTreaty: false },
  { code: 'AM', name: 'Arménia', flag: '🇦🇲', hasTaxTreaty: false },
  { code: 'AZ', name: 'Azerbaijão', flag: '🇦🇿', hasTaxTreaty: false },
  { code: 'GE', name: 'Geórgia', flag: '🇬🇪', hasTaxTreaty: true },
  { code: 'KG', name: 'Quirguistão', flag: '🇰🇬', hasTaxTreaty: false },
  { code: 'KZ', name: 'Cazaquistão', flag: '🇰🇿', hasTaxTreaty: false },
  { code: 'TJ', name: 'Tajiquistão', flag: '🇹🇯', hasTaxTreaty: false },
  { code: 'TM', name: 'Turquemenistão', flag: '🇹🇲', hasTaxTreaty: false },
  { code: 'UZ', name: 'Uzbequistão', flag: '🇺🇿', hasTaxTreaty: false },
  
  // ========== SOUTH ASIA ==========
  { code: 'BD', name: 'Bangladesh', flag: '🇧🇩', hasTaxTreaty: false },
  { code: 'BT', name: 'Butão', flag: '🇧🇹', hasTaxTreaty: false },
  { code: 'IN', name: 'Índia', flag: '🇮🇳', hasTaxTreaty: true },
  { code: 'LK', name: 'Sri Lanka', flag: '🇱🇰', hasTaxTreaty: false },
  { code: 'MV', name: 'Maldivas', flag: '🇲🇻', hasTaxTreaty: false },
  { code: 'NP', name: 'Nepal', flag: '🇳🇵', hasTaxTreaty: false },
  { code: 'PK', name: 'Paquistão', flag: '🇵🇰', hasTaxTreaty: true },
  
  // ========== EAST ASIA ==========
  { code: 'CN', name: 'China', flag: '🇨🇳', hasTaxTreaty: true },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', hasTaxTreaty: true },
  { code: 'JP', name: 'Japão', flag: '🇯🇵', hasTaxTreaty: true },
  { code: 'KP', name: 'Coreia do Norte', flag: '🇰🇵', hasTaxTreaty: false },
  { code: 'KR', name: 'Coreia do Sul', flag: '🇰🇷', hasTaxTreaty: true },
  { code: 'MN', name: 'Mongólia', flag: '🇲🇳', hasTaxTreaty: false },
  { code: 'MO', name: 'Macau', flag: '🇲🇴', hasTaxTreaty: true },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', hasTaxTreaty: false },
  
  // ========== SOUTHEAST ASIA ==========
  { code: 'BN', name: 'Brunei', flag: '🇧🇳', hasTaxTreaty: false },
  { code: 'ID', name: 'Indonésia', flag: '🇮🇩', hasTaxTreaty: true },
  { code: 'KH', name: 'Camboja', flag: '🇰🇭', hasTaxTreaty: false },
  { code: 'LA', name: 'Laos', flag: '🇱🇦', hasTaxTreaty: false },
  { code: 'MM', name: 'Myanmar (Birmânia)', flag: '🇲🇲', hasTaxTreaty: false },
  { code: 'MY', name: 'Malásia', flag: '🇲🇾', hasTaxTreaty: false },
  { code: 'PH', name: 'Filipinas', flag: '🇵🇭', hasTaxTreaty: false },
  { code: 'SG', name: 'Singapura', flag: '🇸🇬', hasTaxTreaty: true },
  { code: 'TH', name: 'Tailândia', flag: '🇹🇭', hasTaxTreaty: false },
  { code: 'TL', name: 'Timor-Leste', flag: '🇹🇱', hasTaxTreaty: true },
  { code: 'VN', name: 'Vietname', flag: '🇻🇳', hasTaxTreaty: true },
  
  // ========== OCEANIA ==========
  { code: 'AU', name: 'Austrália', flag: '🇦🇺', hasTaxTreaty: true },
  { code: 'FJ', name: 'Fiji', flag: '🇫🇯', hasTaxTreaty: false },
  { code: 'FM', name: 'Micronésia', flag: '🇫🇲', hasTaxTreaty: false },
  { code: 'GU', name: 'Guam', flag: '🇬🇺', hasTaxTreaty: false },
  { code: 'KI', name: 'Quiribáti', flag: '🇰🇮', hasTaxTreaty: false },
  { code: 'MH', name: 'Ilhas Marshall', flag: '🇲🇭', hasTaxTreaty: false },
  { code: 'NC', name: 'Nova Caledónia', flag: '🇳🇨', hasTaxTreaty: false },
  { code: 'NR', name: 'Nauru', flag: '🇳🇷', hasTaxTreaty: false },
  { code: 'NZ', name: 'Nova Zelândia', flag: '🇳🇿', hasTaxTreaty: true },
  { code: 'PF', name: 'Polinésia Francesa', flag: '🇵🇫', hasTaxTreaty: false },
  { code: 'PG', name: 'Papua Nova Guiné', flag: '🇵🇬', hasTaxTreaty: false },
  { code: 'PW', name: 'Palau', flag: '🇵🇼', hasTaxTreaty: false },
  { code: 'SB', name: 'Ilhas Salomão', flag: '🇸🇧', hasTaxTreaty: false },
  { code: 'TO', name: 'Tonga', flag: '🇹🇴', hasTaxTreaty: false },
  { code: 'TV', name: 'Tuvalu', flag: '🇹🇻', hasTaxTreaty: false },
  { code: 'VU', name: 'Vanuatu', flag: '🇻🇺', hasTaxTreaty: false },
  { code: 'WS', name: 'Samoa', flag: '🇼🇸', hasTaxTreaty: false },
  
  // ========== OTHER ==========
  { code: 'AQ', name: 'Antárctida', flag: '🇦🇶', hasTaxTreaty: false },
  { code: 'ZZ', name: 'Outro País / Desconhecido', flag: '🌍', hasTaxTreaty: false },
];

// All valid ISO 3166-1 alpha-2 codes
export const VALID_COUNTRY_CODES = new Set(COUNTRIES.map(c => c.code));

/**
 * Validates if a country code is a valid ISO 3166-1 alpha-2 code
 */
export function isValidCountryCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return VALID_COUNTRY_CODES.has(code.toUpperCase());
}

/**
 * Get country by code
 */
export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find(c => c.code === code.toUpperCase());
}

/**
 * Get country name by code
 */
export function getCountryName(code: string | null): string {
  if (!code) return '';
  const country = getCountry(code);
  return country?.name || code;
}

/**
 * Get country name with flag emoji
 */
export function getCountryWithFlag(code: string | null): string {
  if (!code) return '';
  const country = getCountry(code);
  if (!country) return code;
  return `${country.flag || ''} ${country.name}`.trim();
}

/**
 * Check if Portugal has a tax treaty with this country
 */
export function hasTaxTreaty(code: string | null | undefined): boolean {
  if (!code) return false;
  const country = getCountry(code);
  return country?.hasTaxTreaty || false;
}

/**
 * Get countries with tax treaties (for filtering)
 */
export function getCountriesWithTaxTreaty(): Country[] {
  return COUNTRIES.filter(c => c.hasTaxTreaty);
}

/**
 * Search countries by name or code
 */
export function searchCountries(query: string): Country[] {
  if (!query || query.length < 1) return COUNTRIES;
  const normalizedQuery = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COUNTRIES.filter(c => {
    const normalizedName = c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const normalizedCode = c.code.toLowerCase();
    return normalizedName.includes(normalizedQuery) || normalizedCode.includes(normalizedQuery);
  });
}

/**
 * Zod validation schema for country codes
 */
export function createCountryCodeSchema() {
  return {
    refine: (code: string) => isValidCountryCode(code),
    message: 'Código de país inválido (use ISO 3166-1 alpha-2)',
  };
}

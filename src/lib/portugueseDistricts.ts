/**
 * Lista oficial de distritos portugueses + regiões autónomas
 * Usado no formulário CSR para o campo ST (stateOrProvince)
 */

export interface PortugueseDistrict {
  code: string;
  name: string;
}

export const PORTUGUESE_DISTRICTS: PortugueseDistrict[] = [
  { code: 'AV', name: 'Aveiro' },
  { code: 'BE', name: 'Beja' },
  { code: 'BR', name: 'Braga' },
  { code: 'BG', name: 'Bragança' },
  { code: 'CB', name: 'Castelo Branco' },
  { code: 'CO', name: 'Coimbra' },
  { code: 'EV', name: 'Évora' },
  { code: 'FA', name: 'Faro' },
  { code: 'GU', name: 'Guarda' },
  { code: 'LE', name: 'Leiria' },
  { code: 'LI', name: 'Lisboa' },
  { code: 'PO', name: 'Portalegre' },
  { code: 'PR', name: 'Porto' },
  { code: 'SA', name: 'Santarém' },
  { code: 'SE', name: 'Setúbal' },
  { code: 'VC', name: 'Viana do Castelo' },
  { code: 'VR', name: 'Vila Real' },
  { code: 'VI', name: 'Viseu' },
  { code: 'AC', name: 'Região Autónoma dos Açores' },
  { code: 'MA', name: 'Região Autónoma da Madeira' },
];

/**
 * Obtém o nome do distrito pelo código
 */
export function getDistrictName(code: string): string {
  const district = PORTUGUESE_DISTRICTS.find(d => d.code === code);
  return district?.name || code;
}

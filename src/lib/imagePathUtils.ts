export const ELECTRONIC_IMPORT_PREFIXES = [
  'at-sync/',
  'at-webservice/',
  'at-webservice-sales/',
  'at-portal-recibos/',
  'efatura-csv/',
  'imported/',
  'saft-',
  'saft_',
] as const;

export function isElectronicImport(imagePath: string | null | undefined): boolean {
  if (!imagePath) return false;
  return ELECTRONIC_IMPORT_PREFIXES.some((prefix) => imagePath.startsWith(prefix));
}

export function getImportSourceLabel(imagePath: string | null | undefined): string {
  if (!imagePath) return 'Importação externa';
  if (imagePath.startsWith('at-sync/') || imagePath.startsWith('at-webservice/')) {
    return 'AT e-Fatura (sync automático)';
  }
  if (imagePath.startsWith('at-webservice-sales/')) {
    return 'AT Vendas (sync automático)';
  }
  if (imagePath.startsWith('at-portal-recibos/')) {
    return 'AT Recibos Verdes (portal)';
  }
  if (imagePath.startsWith('efatura-csv/')) {
    return 'CSV e-Fatura (importação manual)';
  }
  if (
    imagePath.startsWith('imported/')
    || imagePath.startsWith('saft-')
    || imagePath.startsWith('saft_')
  ) {
    return 'Importação SAF-T';
  }
  return 'Importação externa';
}

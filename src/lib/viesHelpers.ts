export function isBusinessNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const prefix = nif[0];
  return ['5', '6', '7'].includes(prefix) && nif !== '999999990';
}

interface ViesApiResponse {
  isValid: boolean;
  name: string;
  address: string;
}

interface ViesResult {
  name: string | null;
  city: string | null;
  valid: boolean;
}

export function parseViesResponse(data: ViesApiResponse): ViesResult {
  if (!data.isValid || data.name === '---' || !data.name) {
    return { name: null, city: null, valid: false };
  }

  let city: string | null = null;
  if (data.address) {
    const lines = data.address.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1];
      const match = lastLine.match(/\d{4}-\d{3}\s+(.+)/);
      city = match ? match[1].trim() : null;
    }
  }

  return { name: data.name, city, valid: true };
}

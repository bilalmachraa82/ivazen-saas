const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function detectMimeType(file: { type?: string; name?: string }): string {
  const rawType = (file.type || '').trim().toLowerCase();
  const name = (file.name || '').trim().toLowerCase();

  // Prefer a real browser-provided type when available.
  // Some environments report PDFs as empty or as application/octet-stream.
  if (rawType && rawType !== 'application/octet-stream') {
    return rawType;
  }

  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  const byExt = EXTENSION_TO_MIME[ext];
  if (byExt) {
    return byExt;
  }

  return rawType || 'application/octet-stream';
}


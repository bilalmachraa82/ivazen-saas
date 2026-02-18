import { describe, it, expect } from 'vitest';
import { detectMimeType } from '../mime';

describe('detectMimeType', () => {
  it('falls back to extension when file.type is empty (pdf)', () => {
    expect(detectMimeType({ type: '', name: 'invoice.pdf' })).toBe('application/pdf');
  });

  it('falls back to extension when file.type is application/octet-stream (pdf)', () => {
    expect(detectMimeType({ type: 'application/octet-stream', name: 'invoice.pdf' })).toBe('application/pdf');
  });

  it('prefers the browser-provided type when available', () => {
    expect(detectMimeType({ type: 'image/png', name: 'whatever.bin' })).toBe('image/png');
  });

  it('returns application/octet-stream when unknown', () => {
    expect(detectMimeType({ type: '', name: 'readme.txt' })).toBe('application/octet-stream');
  });
});


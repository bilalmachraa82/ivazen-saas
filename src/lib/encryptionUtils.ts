/**
 * Encryption Utilities for AT Credentials
 * Uses AES-256-GCM for encrypting sensitive data like passwords
 */

// Generate a random IV for AES-GCM
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12));
}

// Generate a random AES-128 key (for WS-Security Nonce)
export function generateAES128Key(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

// Convert ArrayBuffer to Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Derive encryption key from a secret string using PBKDF2
export async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt data using AES-256-GCM
export async function encryptAES256GCM(
  data: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = generateIV();
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(data)
  );
  
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

// Decrypt data using AES-256-GCM
export async function decryptAES256GCM(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ivBuffer = base64ToArrayBuffer(iv);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertext);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    ciphertextBuffer
  );
  
  return decoder.decode(decrypted);
}

// Simple encryption format: iv:ciphertext (for storage in DB)
export interface EncryptedValue {
  iv: string;
  ciphertext: string;
}

export function packEncrypted(encrypted: EncryptedValue): string {
  return `${encrypted.iv}:${encrypted.ciphertext}`;
}

export function unpackEncrypted(packed: string): EncryptedValue {
  const [iv, ciphertext] = packed.split(':');
  return { iv, ciphertext };
}

// High-level encrypt function that returns a single string
export async function encryptPassword(
  password: string,
  secret: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(secret, salt);
  const encrypted = await encryptAES256GCM(password, key);
  
  // Format: salt:iv:ciphertext (all base64)
  return `${arrayBufferToBase64(salt.buffer as ArrayBuffer)}:${encrypted.iv}:${encrypted.ciphertext}`;
}

// High-level decrypt function
export async function decryptPassword(
  encryptedData: string,
  secret: string
): Promise<string> {
  const [saltB64, ivB64, ciphertextB64] = encryptedData.split(':');
  
  const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
  const key = await deriveKey(secret, salt);
  
  return decryptAES256GCM(ciphertextB64, ivB64, key);
}

// Validate NIF format (Portuguese tax ID)
export function isValidNIF(nif: string): boolean {
  if (!nif || nif.length !== 9) return false;
  if (!/^\d{9}$/.test(nif)) return false;
  
  // Check valid first digit
  const firstDigit = parseInt(nif[0]);
  if (![1, 2, 3, 5, 6, 7, 8, 9].includes(firstDigit)) return false;
  
  // Validate check digit using mod 11
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * (9 - i);
  }
  
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return checkDigit === parseInt(nif[8]);
}

// Parse credential string from Excel/CSV (handles various formats)
export function parseCredentialRow(row: {
  nif?: string;
  NIF?: string;
  password?: string;
  Password?: string;
  senha?: string;
  Senha?: string;
  nome?: string;
  Nome?: string;
  name?: string;
  Name?: string;
}): { nif: string; password: string; name?: string } | null {
  const nif = (row.nif || row.NIF || '').toString().trim().replace(/\D/g, '');
  const password = (row.password || row.Password || row.senha || row.Senha || '').toString().trim();
  const name = (row.nome || row.Nome || row.name || row.Name || '').toString().trim();
  
  if (!nif || nif.length !== 9) return null;
  if (!password) return null;
  
  return { nif, password, name: name || undefined };
}

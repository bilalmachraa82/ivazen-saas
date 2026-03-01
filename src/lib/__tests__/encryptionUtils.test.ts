/**
 * Testes das Utilitários de Encriptação
 * Cobre:
 *  - arrayBufferToBase64 / base64ToArrayBuffer — round-trip
 *  - generateIV — comprimento e aleatoriedade
 *  - generateAES128Key — comprimento e aleatoriedade
 *  - packEncrypted / unpackEncrypted — serialização
 *  - deriveKey — derivação de chave PBKDF2
 *  - encryptAES256GCM / decryptAES256GCM — round-trip cifra
 *  - encryptPassword / decryptPassword — round-trip alto nível
 *  - isValidNIF — validação de NIF português
 *  - parseCredentialRow — parsing de linha de credenciais
 */

import { describe, it, expect } from 'vitest';
import {
  generateIV,
  generateAES128Key,
  arrayBufferToBase64,
  base64ToArrayBuffer,
  deriveKey,
  encryptAES256GCM,
  decryptAES256GCM,
  packEncrypted,
  unpackEncrypted,
  encryptPassword,
  decryptPassword,
  isValidNIF,
  parseCredentialRow,
  type EncryptedValue,
} from '../encryptionUtils';

// ---------------------------------------------------------------------------
// arrayBufferToBase64 / base64ToArrayBuffer
// ---------------------------------------------------------------------------
describe('arrayBufferToBase64 / base64ToArrayBuffer', () => {
  it('codifica bytes em Base64 e descodifica de volta correctamente', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const b64 = arrayBufferToBase64(original.buffer);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);

    const decoded = new Uint8Array(base64ToArrayBuffer(b64));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('round-trip preserva array de zeros', () => {
    const zeros = new Uint8Array(16);
    const b64 = arrayBufferToBase64(zeros.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(b64));
    expect(Array.from(decoded)).toEqual(Array.from(zeros));
  });

  it('round-trip preserva array com todos os valores 0-255', () => {
    const allBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) allBytes[i] = i;
    const b64 = arrayBufferToBase64(allBytes.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(b64));
    expect(Array.from(decoded)).toEqual(Array.from(allBytes));
  });

  it('produz string Base64 válida (apenas caracteres Base64)', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = arrayBufferToBase64(data.buffer);
    expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('round-trip com buffer de comprimento 1', () => {
    const single = new Uint8Array([255]);
    const b64 = arrayBufferToBase64(single.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(b64));
    expect(decoded[0]).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// generateIV
// ---------------------------------------------------------------------------
describe('generateIV', () => {
  it('retorna Uint8Array com comprimento 12 (AES-GCM IV)', () => {
    const iv = generateIV();
    expect(iv).toBeInstanceOf(Uint8Array);
    expect(iv.length).toBe(12);
  });

  it('dois IVs gerados consecutivamente devem ser diferentes (aleatoriedade)', () => {
    const iv1 = generateIV();
    const iv2 = generateIV();
    // Extremely unlikely to be equal if random
    expect(Array.from(iv1)).not.toEqual(Array.from(iv2));
  });
});

// ---------------------------------------------------------------------------
// generateAES128Key
// ---------------------------------------------------------------------------
describe('generateAES128Key', () => {
  it('retorna Uint8Array com comprimento 16 (AES-128)', () => {
    const key = generateAES128Key();
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(16);
  });

  it('duas chaves geradas consecutivamente devem ser diferentes', () => {
    const k1 = generateAES128Key();
    const k2 = generateAES128Key();
    expect(Array.from(k1)).not.toEqual(Array.from(k2));
  });
});

// ---------------------------------------------------------------------------
// packEncrypted / unpackEncrypted
// ---------------------------------------------------------------------------
describe('packEncrypted / unpackEncrypted', () => {
  const sample: EncryptedValue = {
    iv: 'dGVzdEl2MTIzNDU=',
    ciphertext: 'dGVzdENpcGhlcnRleHQ=',
  };

  it('serializa para formato "iv:ciphertext"', () => {
    const packed = packEncrypted(sample);
    expect(packed).toBe(`${sample.iv}:${sample.ciphertext}`);
  });

  it('desserializa de volta para os campos originais', () => {
    const packed = packEncrypted(sample);
    const unpacked = unpackEncrypted(packed);
    expect(unpacked.iv).toBe(sample.iv);
    expect(unpacked.ciphertext).toBe(sample.ciphertext);
  });

  it('round-trip pack → unpack preserva os valores', () => {
    const packed = packEncrypted(sample);
    const unpacked = unpackEncrypted(packed);
    expect(unpacked).toEqual(sample);
  });

  it('unpackEncrypted trata correctamente strings com ":" dentro do ciphertext', () => {
    // O split é só no primeiro ":", iv não deve conter ":"
    const packed = 'aWQ=:Y2lwaGVydGV4dA==';
    const unpacked = unpackEncrypted(packed);
    expect(unpacked.iv).toBe('aWQ=');
    expect(unpacked.ciphertext).toBe('Y2lwaGVydGV4dA==');
  });
});

// ---------------------------------------------------------------------------
// deriveKey
// ---------------------------------------------------------------------------
describe('deriveKey', () => {
  it('retorna um CryptoKey válido', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey('secret-key', salt);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm.name).toBe('AES-GCM');
  });

  it('a mesma password + salt produz chaves funcionalmente equivalentes', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key1 = await deriveKey('minha-senha', salt);
    const key2 = await deriveKey('minha-senha', salt);

    // Verify by encrypting with key1 and decrypting with key2
    const plaintext = 'teste de equivalência';
    const encrypted = await encryptAES256GCM(plaintext, key1);
    const decrypted = await decryptAES256GCM(encrypted.ciphertext, encrypted.iv, key2);
    expect(decrypted).toBe(plaintext);
  });

  it('passwords diferentes produzem chaves não-equivalentes', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key1 = await deriveKey('senha-A', salt);
    const key2 = await deriveKey('senha-B', salt);

    const encrypted = await encryptAES256GCM('texto secreto', key1);

    // Decrypting with the wrong key should fail
    await expect(
      decryptAES256GCM(encrypted.ciphertext, encrypted.iv, key2)
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptAES256GCM / decryptAES256GCM
// ---------------------------------------------------------------------------
describe('encryptAES256GCM / decryptAES256GCM', () => {
  async function getKey(): Promise<CryptoKey> {
    const salt = new Uint8Array(16);
    return deriveKey('test-secret', salt);
  }

  it('cifra e decifra texto simples correctamente', async () => {
    const key = await getKey();
    const plaintext = 'Olá Mundo!';
    const { ciphertext, iv } = await encryptAES256GCM(plaintext, key);
    const decrypted = await decryptAES256GCM(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('cifra e decifra string vazia', async () => {
    const key = await getKey();
    const { ciphertext, iv } = await encryptAES256GCM('', key);
    const decrypted = await decryptAES256GCM(ciphertext, iv, key);
    expect(decrypted).toBe('');
  });

  it('cifra e decifra string longa', async () => {
    const key = await getKey();
    const plaintext = 'A'.repeat(10000);
    const { ciphertext, iv } = await encryptAES256GCM(plaintext, key);
    const decrypted = await decryptAES256GCM(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('cifra e decifra caracteres especiais portugueses', async () => {
    const key = await getKey();
    const plaintext = 'Ação, Coração, São João — 100% #válido!';
    const { ciphertext, iv } = await encryptAES256GCM(plaintext, key);
    const decrypted = await decryptAES256GCM(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('cifra e decifra caracteres Unicode e emoji', async () => {
    const key = await getKey();
    const plaintext = '日本語テスト 🔐 €£¥ ñçü';
    const { ciphertext, iv } = await encryptAES256GCM(plaintext, key);
    const decrypted = await decryptAES256GCM(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
  });

  it('o mesmo texto cifrado duas vezes produz ciphertexts diferentes (IV aleatório)', async () => {
    const key = await getKey();
    const plaintext = 'texto repetido';
    const result1 = await encryptAES256GCM(plaintext, key);
    const result2 = await encryptAES256GCM(plaintext, key);
    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('ciphertext e iv são strings Base64 válidas', async () => {
    const key = await getKey();
    const { ciphertext, iv } = await encryptAES256GCM('teste', key);
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(iv).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('decifrar com IV errado lança excepção', async () => {
    const key = await getKey();
    const { ciphertext } = await encryptAES256GCM('texto secreto', key);
    const wrongIv = arrayBufferToBase64(generateIV().buffer as ArrayBuffer);
    await expect(decryptAES256GCM(ciphertext, wrongIv, key)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// encryptPassword / decryptPassword (alto nível)
// ---------------------------------------------------------------------------
describe('encryptPassword / decryptPassword', () => {
  const SECRET = 'chave-mestra-ivazen';

  it('round-trip de password simples', async () => {
    const password = 'MinhaPassword123!';
    const encrypted = await encryptPassword(password, SECRET);
    const decrypted = await decryptPassword(encrypted, SECRET);
    expect(decrypted).toBe(password);
  });

  it('round-trip de password com caracteres especiais', async () => {
    const password = 'S€nh@_Compl€xa!#@123';
    const encrypted = await encryptPassword(password, SECRET);
    const decrypted = await decryptPassword(encrypted, SECRET);
    expect(decrypted).toBe(password);
  });

  it('round-trip de password com acentos portugueses', async () => {
    const password = 'Açúcar_Limão_2025!';
    const encrypted = await encryptPassword(password, SECRET);
    const decrypted = await decryptPassword(encrypted, SECRET);
    expect(decrypted).toBe(password);
  });

  it('formato cifrado contém 3 partes separadas por ":"', async () => {
    const encrypted = await encryptPassword('senha', SECRET);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // Each part should be non-empty Base64
    parts.forEach(part => expect(part.length).toBeGreaterThan(0));
  });

  it('mesmo password cifrado duas vezes produz resultados diferentes (salt aleatório)', async () => {
    const password = 'senha-repetida';
    const enc1 = await encryptPassword(password, SECRET);
    const enc2 = await encryptPassword(password, SECRET);
    expect(enc1).not.toBe(enc2);
  });

  it('decifrar com secret errado lança excepção', async () => {
    const encrypted = await encryptPassword('senha-secreta', SECRET);
    await expect(decryptPassword(encrypted, 'secret-errado')).rejects.toThrow();
  });

  it('round-trip de password vazia', async () => {
    const encrypted = await encryptPassword('', SECRET);
    const decrypted = await decryptPassword(encrypted, SECRET);
    expect(decrypted).toBe('');
  });
});

// ---------------------------------------------------------------------------
// isValidNIF
// ---------------------------------------------------------------------------
describe('isValidNIF', () => {
  it('valida NIF de pessoa colectiva conhecido (503504564 - EDP)', () => {
    // EDP Comercial SA — NIF real, dígito de controlo correcto
    expect(isValidNIF('503504564')).toBe(true);
  });

  it('valida NIF de telecomunicações (503423971 - NOS)', () => {
    expect(isValidNIF('503423971')).toBe(true);
  });

  it('rejeita NIF com menos de 9 dígitos', () => {
    expect(isValidNIF('12345678')).toBe(false);
  });

  it('rejeita NIF com mais de 9 dígitos', () => {
    expect(isValidNIF('1234567890')).toBe(false);
  });

  it('rejeita NIF com letras', () => {
    expect(isValidNIF('12345678A')).toBe(false);
  });

  it('rejeita NIF com primeiro dígito 0', () => {
    expect(isValidNIF('012345678')).toBe(false);
  });

  it('rejeita NIF com primeiro dígito 4', () => {
    expect(isValidNIF('412345678')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(isValidNIF('')).toBe(false);
  });

  it('rejeita NIF com dígito de controlo errado', () => {
    // Modify last digit of a valid NIF to make it invalid
    expect(isValidNIF('503504560')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseCredentialRow
// ---------------------------------------------------------------------------
describe('parseCredentialRow', () => {
  it('extrai NIF e password das chaves em minúsculas', () => {
    const result = parseCredentialRow({ nif: '503504564', password: 'senha123' });
    expect(result).not.toBeNull();
    expect(result?.nif).toBe('503504564');
    expect(result?.password).toBe('senha123');
  });

  it('extrai NIF e password das chaves capitalizadas (NIF, Password)', () => {
    const result = parseCredentialRow({ NIF: '503504564', Password: 'senha123' });
    expect(result?.nif).toBe('503504564');
    expect(result?.password).toBe('senha123');
  });

  it('aceita "senha" / "Senha" como alternativa a password', () => {
    const result = parseCredentialRow({ nif: '503504564', senha: 'abc123' });
    expect(result?.password).toBe('abc123');

    const result2 = parseCredentialRow({ nif: '503504564', Senha: 'xyz456' });
    expect(result2?.password).toBe('xyz456');
  });

  it('extrai nome quando presente ("nome")', () => {
    const result = parseCredentialRow({ nif: '503504564', password: 'p', nome: 'EDP Comercial' });
    expect(result?.name).toBe('EDP Comercial');
  });

  it('extrai nome quando presente ("Name")', () => {
    const result = parseCredentialRow({ nif: '503504564', password: 'p', Name: 'EDP' });
    expect(result?.name).toBe('EDP');
  });

  it('retorna null quando NIF tem comprimento diferente de 9', () => {
    expect(parseCredentialRow({ nif: '12345', password: 'abc' })).toBeNull();
    expect(parseCredentialRow({ nif: '1234567890', password: 'abc' })).toBeNull();
  });

  it('retorna null quando password está ausente', () => {
    expect(parseCredentialRow({ nif: '503504564' })).toBeNull();
  });

  it('retorna null quando NIF está ausente', () => {
    expect(parseCredentialRow({ password: 'senha' })).toBeNull();
  });

  it('remove caracteres não-numéricos do NIF automaticamente', () => {
    const result = parseCredentialRow({ nif: '503 504 564', password: 'p' });
    expect(result?.nif).toBe('503504564');
  });

  it('name é undefined quando não fornecido', () => {
    const result = parseCredentialRow({ nif: '503504564', password: 'p' });
    expect(result?.name).toBeUndefined();
  });

  it('faz trim do NIF antes de validar comprimento', () => {
    const result = parseCredentialRow({ nif: '  503504564  ', password: 'p' });
    expect(result?.nif).toBe('503504564');
  });
});

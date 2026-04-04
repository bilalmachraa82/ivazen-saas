/**
 * Shared AES-256-GCM encryption with PBKDF2 key derivation.
 *
 * Used by: import-client-credentials, reencrypt-credentials, upload-at-certificate.
 * Output format: base64(salt):base64(iv):base64(ciphertext)
 */

export async function encryptSecret(
  data: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  // Generate salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Derive key from secret
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(data),
  );

  // Pack as salt:iv:ciphertext (all base64)
  const toBase64 = (arr: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  };

  return `${toBase64(salt)}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

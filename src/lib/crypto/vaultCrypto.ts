"use client";

// Klientkryptering för lösenordsvalvet (AES-GCM, 256-bit).
// Huvudnyckeln matas in av användaren (delas manuellt i ledningsgruppen, t.ex. muntligt
// eller via en separat säker kanal) och lagras ALDRIG i databasen eller på servern.
// Servern/databasen ser bara chiffertext (encrypted_secret + iv).

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 150000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Fast salt (offentlig, ok att vara statisk för detta ändamål) + huvudnyckel = per-org-nyckel.
const STATIC_SALT = new TextEncoder().encode("sabba-vault-v1");

// Konton-sidan är numera helt öppen för alla inloggade i ledningsgruppen —
// ingen mänsklig huvudnyckel matas längre in. Nyckeln nedan är bara till för
// att återanvända samma krypterings-API (databasen ska aldrig innehålla
// klartext), inte som en hemlighet i sig. Skydd mot obehöriga sköts av
// inloggningen (Supabase Auth) och RLS-policyerna, inte av den här strängen.
export const FIXED_VAULT_PASSPHRASE =
  "sabba-fixed-vault-key-7AR860YhdiYJqbu0U1TqU8y9IwX833cvZ8hY9w7eU";

export async function encryptSecret(
  plaintext: string,
  passphrase: string
): Promise<{ encrypted_secret: string; iv: string }> {
  const key = await deriveKey(passphrase, STATIC_SALT);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );

  return {
    encrypted_secret: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
  };
}

export async function decryptSecret(
  encrypted_secret: string,
  iv: string,
  passphrase: string
): Promise<string> {
  const key = await deriveKey(passphrase, STATIC_SALT);
  const ciphertext = base64ToBuffer(encrypted_secret);
  const ivBuffer = base64ToBuffer(iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer as BufferSource },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

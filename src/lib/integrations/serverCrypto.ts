import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// Server-side kryptering (AES-256-GCM) för integrationsnycklar (t.ex. Dropfans API-nyckel)
// som synk-jobbet måste kunna dekryptera automatiskt, utan att en människa matar in en
// huvudnyckel varje gång (till skillnad från lösenordsvalvet i src/lib/crypto/vaultCrypto.ts).
//
// Nyckeln kommer från miljövariabeln INTEGRATION_ENCRYPTION_KEY: 32 bytes, hex-kodad
// (64 tecken). Generera en med: openssl rand -hex 32
//
// VIKTIGT: importera aldrig denna fil i en "use client"-komponent. Den använder Node:s
// crypto-modul och ska bara köras i Server Actions eller Route Handlers.

function getKey(): Buffer {
  const hex = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY saknas eller har fel längd (måste vara 64 hex-tecken / 32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

export function encryptApiKey(plaintext: string): {
  encrypted_api_key: string;
  iv: string;
} {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Chiffertext + authTag tillsammans, så vi bara behöver lagra ett fält.
  const combined = Buffer.concat([encrypted, authTag]);

  return {
    encrypted_api_key: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptApiKey(encrypted_api_key: string, iv: string): string {
  const key = getKey();
  const combined = Buffer.from(encrypted_api_key, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  // Sista 16 bytes är GCM-autentiseringstaggen.
  const authTag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv("aes-256-gcm", key, ivBuffer);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

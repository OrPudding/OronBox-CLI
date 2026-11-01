import { createHash, createPrivateKey, generateKeyPairSync, sign } from "node:crypto";
import { hostname } from "node:os";

export interface CliIdentity {
  displayName: string;
  publicKeyBase64Url: string;
  fingerprint: string;
  privateKeyPem: string;
}

export function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64url").replace(/=+$/, "");
}

export function generateIdentity(displayName?: string): CliIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  // Ed25519 SPKI DER prefix is 12 bytes; the remaining 32 bytes are the raw public key
  const spkiDer = publicKey.export({ type: "spki", format: "der" });
  const rawPublicKey = spkiDer.subarray(12);

  const publicKeyBase64Url = toBase64Url(rawPublicKey);
  const fingerprint = createHash("sha256").update(rawPublicKey).digest("hex").toLowerCase();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const name = displayName?.trim() || `${hostname()} (OronBox-CLI)`;

  return {
    displayName: name,
    publicKeyBase64Url,
    fingerprint,
    privateKeyPem,
  };
}

export function signPayload(payloadBase64Url: string, privateKeyPem: string): string {
  const privateKey = createPrivateKey(privateKeyPem);
  const payloadBuffer = Buffer.from(payloadBase64Url, "base64url");
  const signatureBuffer = sign(null, payloadBuffer, privateKey);
  return toBase64Url(signatureBuffer);
}

export function signNonce(nonce: string, privateKeyPem: string): string {
  return signPayload(nonce, privateKeyPem);
}

import { createHash, createPublicKey, verify } from "node:crypto";
import { describe, expect, it } from "vitest";

import { generateIdentity, signNonce } from "../src/lib/auth";

describe("auth and ed25519 cryptography", () => {
  it("generates valid Ed25519 keypair and SHA-256 fingerprint", () => {
    const identity = generateIdentity("TestComputer");

    expect(identity.displayName).toBe("TestComputer");
    expect(identity.publicKeyBase64Url).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(identity.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(identity.privateKeyPem).toContain("BEGIN PRIVATE KEY");

    // Decode public key and check raw length is 32 bytes
    const rawPublicKey = Buffer.from(identity.publicKeyBase64Url, "base64url");
    expect(rawPublicKey.length).toBe(32);

    // Verify fingerprint calculation matches sha256(rawPublicKey)
    const expectedFingerprint = createHash("sha256").update(rawPublicKey).digest("hex").toLowerCase();
    expect(identity.fingerprint).toBe(expectedFingerprint);
  });

  it("signs a nonce and produces a valid Ed25519 signature", () => {
    const identity = generateIdentity("TestSigner");
    const payloadBytes = Buffer.from("0123456789abcdef0123456789abcdef");
    const payloadBase64Url = payloadBytes.toString("base64url");

    const signatureBase64Url = signNonce(payloadBase64Url, identity.privateKeyPem);
    const signatureBuffer = Buffer.from(signatureBase64Url, "base64url");

    // Standard Ed25519 signature length is 64 bytes
    expect(signatureBuffer.length).toBe(64);

    // Reconstruct SPKI for node:crypto verify
    const rawPublicKey = Buffer.from(identity.publicKeyBase64Url, "base64url");
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const spkiDer = Buffer.concat([spkiPrefix, rawPublicKey]);
    const publicKey = createPublicKey({ key: spkiDer, format: "der", type: "spki" });

    const isValid = verify(null, payloadBytes, publicKey, signatureBuffer);
    expect(isValid).toBe(true);
  });
});

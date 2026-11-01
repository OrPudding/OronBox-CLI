import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

import type { ChallengeResponse, SessionResponse } from "../types/api";
import { signNonce } from "./auth";
import { getOrCreateIdentity, getSession, saveSession } from "./config";
import { DEFAULT_HOST, DEFAULT_PORT } from "./constants";
import { fail } from "./errors";

export interface RequestOptions extends RequestInit {
  host?: string;
  port?: number;
  skipAuth?: boolean;
}

export function getBaseUrl(host = DEFAULT_HOST, port = DEFAULT_PORT): string {
  return `http://${host}:${port}`;
}

async function obtainSession(host: string, port: number): Promise<string> {
  const identity = getOrCreateIdentity();
  const baseUrl = getBaseUrl(host, port);

  // 1. Issue Challenge
  let challengeRes: Response;
  try {
    challengeRes = await fetch(`${baseUrl}/v1/auth/challenges`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: identity.fingerprint }),
    });
  } catch {
    fail(`Could not connect to OronBox at ${baseUrl}. Ensure OronBox is running with Local Server enabled.`);
  }

  if (challengeRes.status === 404 || challengeRes.status === 401 || challengeRes.status === 403) {
    fail(
      `This computer is not paired or authorized with OronBox yet.\nPlease run 'oronbox pair ${host}:${port}' first.`,
    );
  }

  if (!challengeRes.ok) {
    const errorText = await challengeRes.text().catch(() => "");
    fail(`Challenge request failed (${challengeRes.status}): ${errorText}`);
  }

  const challenge = (await challengeRes.json()) as ChallengeResponse;

  // 2. Sign Challenge Payload
  const rawPayload = challenge.signingPayload || challenge.nonce;
  if (!rawPayload) {
    fail("Challenge response missing signing payload from server.");
  }
  const signature = signNonce(rawPayload, identity.privateKeyPem);

  // 3. Create Session
  const sessionRes = await fetch(`${baseUrl}/v1/auth/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature,
    }),
  });

  if (!sessionRes.ok) {
    const errorText = await sessionRes.text().catch(() => "");
    fail(`Session authentication failed (${sessionRes.status}): ${errorText}`);
  }

  const session = (await sessionRes.json()) as SessionResponse;
  saveSession(host, port, session.token, session.expiresAt);
  return session.token;
}

export async function requestLocalServer<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const baseUrl = getBaseUrl(host, port);

  const headers = new Headers(options.headers);

  if (!options.skipAuth) {
    let token = getSession(host, port);
    if (!token) {
      token = await obtainSession(host, port);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    fail(`Could not reach OronBox at ${baseUrl}. Is OronBox running and reachable?`);
  }

  // If unauthorized, token might have expired on server; try refresh once
  if (response.status === 401 && !options.skipAuth) {
    const freshToken = await obtainSession(host, port);
    headers.set("Authorization", `Bearer ${freshToken}`);
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch {
      fail(`Could not reach OronBox at ${baseUrl}.`);
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const extra = body ? ` Response: ${body}` : "";
    fail(`Request failed with status ${response.status} ${response.statusText}.${extra}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as unknown as T;
}

export async function uploadInstallFile<T>(
  filePath: string,
  options: { host?: string; port?: number; type?: string; deviceId?: string } = {},
): Promise<T> {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const baseUrl = getBaseUrl(host, port);

  let token = getSession(host, port);
  if (!token) {
    token = await obtainSession(host, port);
  }

  const stat = statSync(filePath);
  const fileName = basename(filePath);
  const fileBytes = readFileSync(filePath);
  const sha256Hex = createHash("sha256").update(fileBytes).digest("hex");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/octet-stream",
    "X-File-Name": encodeURIComponent(fileName),
    "X-Sha256": sha256Hex,
    "X-Size": stat.size.toString(),
    "X-Type": options.type || "app",
    "Content-Length": stat.size.toString(),
  };

  if (options.deviceId) {
    headers["X-Device-Id"] = options.deviceId;
  }

  const response = await fetch(`${baseUrl}/v1/install`, {
    method: "POST",
    headers,
    body: fileBytes,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    fail(`Upload failed with status ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export async function downloadFile(
  path: string,
  outputPath: string,
  options: RequestOptions = {},
): Promise<number> {
  const host = options.host || DEFAULT_HOST;
  const port = options.port || DEFAULT_PORT;
  const baseUrl = getBaseUrl(host, port);

  const headers = new Headers(options.headers);

  if (!options.skipAuth) {
    let token = getSession(host, port);
    if (!token) {
      token = await obtainSession(host, port);
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    fail(`Could not reach OronBox at ${baseUrl}. Is OronBox running and reachable?`);
  }

  if (response.status === 401 && !options.skipAuth) {
    const freshToken = await obtainSession(host, port);
    headers.set("Authorization", `Bearer ${freshToken}`);
    try {
      response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
      });
    } catch {
      fail(`Could not reach OronBox at ${baseUrl}.`);
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const extra = body ? ` Response: ${body}` : "";
    fail(`Download failed with status ${response.status} ${response.statusText}.${extra}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outputPath, buffer);
  return buffer.length;
}

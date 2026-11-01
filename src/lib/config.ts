import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { generateIdentity, type CliIdentity } from "./auth";
import { CONFIG_DIR_NAME, CONFIG_FILE_NAME, CREDENTIALS_FILE_NAME, DEFAULT_HOST, DEFAULT_PORT } from "./constants";

export interface HostSession {
  token: string;
  expiresAt: string;
}

export interface CliConfig {
  defaultHost?: string;
  defaultPort?: number;
  sessions?: Record<string, HostSession>;
}

export function getConfigDir(): string {
  const dir = join(homedir(), CONFIG_DIR_NAME);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return dir;
}

export function getOrCreateIdentity(): CliIdentity {
  const credentialsPath = join(getConfigDir(), CREDENTIALS_FILE_NAME);
  if (existsSync(credentialsPath)) {
    try {
      const content = readFileSync(credentialsPath, "utf-8");
      return JSON.parse(content) as CliIdentity;
    } catch {
      // If corrupted, regenerate below
    }
  }

  const identity = generateIdentity();
  writeFileSync(credentialsPath, JSON.stringify(identity, null, 2), {
    mode: 0o600,
  });
  return identity;
}

export function loadConfig(): CliConfig {
  const configPath = join(getConfigDir(), CONFIG_FILE_NAME);
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, "utf-8");
      return JSON.parse(content) as CliConfig;
    } catch {
      return {};
    }
  }
  return {};
}

export function saveConfig(config: CliConfig): void {
  const configPath = join(getConfigDir(), CONFIG_FILE_NAME);
  writeFileSync(configPath, JSON.stringify(config, null, 2), {
    mode: 0o600,
  });
}

export function getSession(host = DEFAULT_HOST, port = DEFAULT_PORT): string | null {
  const config = loadConfig();
  const key = `${host}:${port}`;
  const session = config.sessions?.[key];
  if (!session) return null;

  const now = new Date().getTime();
  const expires = new Date(session.expiresAt).getTime();
  if (expires > now) {
    return session.token;
  }
  return null;
}

export function saveSession(host: string, port: number, token: string, expiresAt: string): void {
  const config = loadConfig();
  const key = `${host}:${port}`;
  const sessions = config.sessions || {};
  sessions[key] = { token, expiresAt };
  config.sessions = sessions;
  saveConfig(config);
}

export function resolveTarget(opts: { host?: string; port?: string } = {}): { host: string; port: number } {
  const config = loadConfig();
  const host = opts.host || config.defaultHost || DEFAULT_HOST;
  const port = opts.port ? parseInt(opts.port, 10) : (config.defaultPort || DEFAULT_PORT);
  return { host, port };
}

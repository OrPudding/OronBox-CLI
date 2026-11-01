export interface LocalServerInfo {
  serverId: string;
  displayName: string;
  platform: string;
  port: number;
  protocolVersion: string;
  fingerprint: string;
  publicKey?: string;
  publicKeyHex?: string;
}

export type PairingState = "pending" | "granted" | "rejected" | "expired";

export interface PairingStatusResponse {
  pairingId: string;
  clientName: string;
  fingerprint: string;
  state: PairingState;
  requestedScopes?: string[];
  createdAt?: string;
}

export interface ChallengeResponse {
  challengeId: string;
  signingPayload?: string;
  nonce?: string;
  expiresAt: string;
}

export interface SessionResponse {
  token: string;
  fingerprint: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
}

export interface AuthorizedClient {
  fingerprint: string;
  displayName: string;
  publicKey: string;
  authorizedAt: string;
  lastUsedAt?: string;
  scopes?: string[];
}

export interface BatteryStatus {
  level: number;
  charging?: boolean;
  voltageMv?: number;
}

export interface StorageInfo {
  totalBytes?: number;
  freeBytes?: number;
}

export interface ConnectedDevice {
  name: string;
  addr: string;
  connectType?: string;
  disconnected?: boolean;
  battery?: BatteryStatus;
  storage?: StorageInfo;
  protocolState?: string;
  [key: string]: unknown;
}

export interface AppInfo {
  packageName: string;
  appName: string;
  versionName?: string;
  versionCode?: number;
  type?: string;
}

export interface WatchfaceInfo {
  id: string;
  name: string;
  isCurrent?: boolean;
}

export interface QueueTask {
  taskId: string;
  status: string;
  progress?: number;
  message?: string;
}

export type DeviceLogOperationState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface DeviceLogOperation {
  id: string;
  kind: "device_logs";
  state: DeviceLogOperationState;
  deviceId?: string;
  stage?: string;
  message?: string;
  progress?: number;
  currentPart?: number;
  totalParts?: number;
  channel?: number;
  bytesDone?: number;
  bytesTotal?: number;
  fileName?: string;
  archiveUrl?: string;
  currentLogUrl?: string;
  error?: {
    code?: string;
    message?: string;
    [key: string]: unknown;
  };
}

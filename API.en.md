# OronBox Local API Specification

English | [简体中文](./API.md)

The OronBox client runs a local HTTP and SSE server (Local Server) on the local network
CLI and third-party tools act as the client (Client) to communicate with the OronBox client and control connected wearable devices

---

## Table of Contents

1. [Network Communication and Discovery](#network-communication-and-discovery)
2. [Authentication Flow and Key Architecture](#authentication-flow-and-key-architecture)
3. [Permission Scopes](#permission-scopes)
4. [Public Endpoints](#public-endpoints)
5. [Pairing and Session Endpoints](#pairing-and-session-endpoints)
6. [Computer Credential Management](#computer-credential-management)
7. [Wearable Device Control](#wearable-device-control)
8. [Application Management](#application-management)
9. [Watchface Management](#watchface-management)
10. [Package Installation and Tasks](#package-installation-and-tasks)
11. [Real-time Events (SSE)](#real-time-events-sse)
12. [System Diagnostics Logs](#system-diagnostics-logs)

---

## Network Communication and Discovery

### mDNS Service Broadcast

When Local API Server is enabled, the OronBox client announces itself via Multicast DNS:

- **Service Type**: `_oronbox-api._tcp.local.`
- **Transport**: TCP
- **Port**: Dynamic or default port (typically `10517`)
- **TXT Records**:
  - `serverId`: Server identifier (e.g. `oronbox-10517`)
  - `platform`: Host platform (e.g. `android` / `ios`)
  - `fingerprint`: Hexadecimal SHA-256 fingerprint of server public key
  - `protocolVersion`: Protocol version (currently `1`)

---

## Authentication Flow and Key Architecture

Protected endpoints require challenge-response authentication based on Ed25519:

```text
[CLI Client]                                            [OronBox Client (Local Server)]
     │                                                                 │
     │ 1. Submit pairing request (with Ed25519 public key)             │
     ├────────────────────────────────────────────────────────────────>│
     │    POST /v1/auth/pairing-requests                               │ (Prompt user for approval)
     │                                                                 │
     │ 2. Poll pairing request status until granted                    │
     ├────────────────────────────────────────────────────────────────>│
     │                                                                 │
     │ 3. Request authentication challenge payload                     │
     ├────────────────────────────────────────────────────────────────>│
     │    POST /v1/auth/challenges (with computer fingerprint)         │
     │<────────────────────────────────────────────────────────────────┤
     │    Returns challengeId and 32-byte signingPayload               │
     │                                                                 │
     │ 4. Computer signs signingPayload with Ed25519 private key       │
     │                                                                 │
     │ 5. Submit signature for session token                           │
     ├────────────────────────────────────────────────────────────────>│
     │    POST /v1/auth/sessions (challengeId + signature)             │
     │<────────────────────────────────────────────────────────────────┤
     │    Returns Bearer Token                                         │
     │                                                                 │
     │ 6. Access protected endpoints with Bearer Token                 │
     ├────────────────────────────────────────────────────────────────>│
     │    Header: Authorization: Bearer <token>                        │
```

- **Signature Standard**: PureEdDSA (RFC 8032), sign 32-byte payload directly, output 64-byte signature encoded in Base64URL
- **Computer Fingerprint**: `SHA-256(Ed25519RawPublicKeyBytes).toLowerCase().hex()`, 64 hex characters

---

## Permission Scopes

| Scope | Description | Covered Endpoints |
| :--- | :--- | :--- |
| `device.read` | Read device list, connection state, and hardware details | `GET /v1/devices`, `GET /v1/devices/current`, `GET /v1/devices/info` |
| `device.control` | Connect or disconnect wearable devices | `POST /v1/devices/connect`, `POST /v1/devices/disconnect` |
| `app.list` | Query installed third-party apps | `GET /v1/apps` |
| `app.launch` | Launch app and specified page route | `POST /v1/apps/launch` |
| `app.uninstall` | Uninstall third-party apps | `DELETE /v1/apps/{packageName}` |
| `watchface.list` | List installed watchfaces | `GET /v1/watchfaces` |
| `watchface.set` | Set active watchface | `POST /v1/watchfaces/set` |
| `watchface.remove` | Remove watchface | `DELETE /v1/watchfaces/{id}` |
| `install.local` | Upload and install app or watchface | `POST /v1/install` |
| `queue.read` | Query task execution progress and queue state | `GET /v1/tasks/{taskId}` |
| `queue.control` | Cancel running tasks | `POST /v1/tasks/{taskId}/cancel` |
| `events.subscribe`| Listen to SSE notifications | `GET /v1/events` |
| `diagnostics.read`| Export and download wearable diagnostic logs | `POST /v1/device-logs`, `GET /v1/device-logs/{id}/*` |
| `clients.manage` | Manage authorized computer credentials | `GET /v1/clients`, `DELETE /v1/clients/{fingerprint}` |

---

## Public Endpoints

### Server Info (`GET /v1/info`)

Public endpoint returning server runtime metadata and public key information

- **Method**: `GET`
- **Path**: `/v1/info`
- **Auth**: None

#### Response (`200 OK`)

```json
{
  "serverId": "oronbox-10517",
  "displayName": "OronBox",
  "platform": "android",
  "port": 10517,
  "protocolVersion": "1",
  "fingerprint": "a9bf7f87da6a1478cdbc6572e90c68676d494958f01b97aa2bc6d84411baad77",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...==\n-----END PUBLIC KEY-----\n",
  "publicKeyHex": "136015f3ecfa335c05c04a434b6bdaaeae2f9d65757d5cb1fbf10419d80d2822"
}
```

---

## Pairing and Session Endpoints

### Request Pairing (`POST /v1/auth/pairing-requests`)

Submit computer identification and public key to join the authorized list of the OronBox client

- **Method**: `POST`
- **Path**: `/v1/auth/pairing-requests`
- **Auth**: None

#### Request Body (JSON)

```json
{
  "clientName": "Dev-MacBook-Pro",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA9BqK1e...==\n-----END PUBLIC KEY-----\n",
  "requestedScopes": [
    "device.read",
    "device.control",
    "app.list",
    "app.launch",
    "app.uninstall",
    "watchface.list",
    "watchface.set",
    "watchface.remove",
    "install.local",
    "queue.read",
    "queue.control",
    "events.subscribe",
    "diagnostics.read",
    "clients.manage"
  ],
  "deviceAllowlist": []
}
```

#### Response (`202 Accepted` or `200 OK`)

Returns `200 OK` if the fingerprint is already authorized, or `202 Accepted` for new requests

```json
{
  "pairingId": "pair-req-179348",
  "clientName": "Dev-MacBook-Pro",
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414",
  "state": "pending",
  "requestedScopes": [
    "device.read",
    "device.control",
    "app.list",
    "app.launch",
    "app.uninstall",
    "watchface.list",
    "watchface.set",
    "watchface.remove",
    "install.local",
    "queue.read",
    "queue.control",
    "events.subscribe",
    "diagnostics.read",
    "clients.manage"
  ],
  "createdAt": "2026-11-01T05:20:00.000Z"
}
```

`state` values: `pending`, `granted`, `denied`, `expired`

### Query Pairing Status (`GET /v1/auth/pairing-requests/{pairingId}`)

Poll approval status until resolved on the OronBox client

- **Method**: `GET`
- **Path**: `/v1/auth/pairing-requests/{pairingId}`
- **Auth**: None

#### Response (`200 OK`)

```json
{
  "pairingId": "pair-req-179348",
  "clientName": "Dev-MacBook-Pro",
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414",
  "state": "granted",
  "createdAt": "2026-11-01T05:20:00.000Z"
}
```

### Request Challenge (`POST /v1/auth/challenges`)

Request a one-time random signing payload using an authorized computer fingerprint

- **Method**: `POST`
- **Path**: `/v1/auth/challenges`
- **Auth**: None

#### Request Body (JSON)

```json
{
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414"
}
```

#### Response (`200 OK`)

```json
{
  "challengeId": "chlg-81029384",
  "signingPayload": "ZGYyMzgxMDkwMTIzNDU2Nzg5YWJjZGVmMDEyMzQ1Njc",
  "expiresAt": "2026-11-01T05:25:00.000Z"
}
```

### Verify Signature and Create Session (`POST /v1/auth/sessions`)

Submit signature of `signingPayload` signed with the computer Ed25519 private key

- **Method**: `POST`
- **Path**: `/v1/auth/sessions`
- **Auth**: None

#### Request Body (JSON)

```json
{
  "challengeId": "chlg-81029384",
  "signature": "3F_k0QjP_dG9-gHj8L3vO9...64-bytes-base64url"
}
```

#### Response (`200 OK`)

```json
{
  "token": "sess-tok-99120485a9bc81",
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414",
  "scopes": [
    "device.read",
    "device.control",
    "app.list",
    "app.launch",
    "app.uninstall",
    "watchface.list",
    "watchface.set",
    "watchface.remove",
    "install.local",
    "queue.read",
    "queue.control",
    "events.subscribe",
    "diagnostics.read",
    "clients.manage"
  ],
  "createdAt": "2026-11-01T05:20:10.000Z",
  "expiresAt": "2026-11-01T05:50:10.000Z"
}
```

---

## Computer Credential Management

### List Authorized Computers (`GET /v1/clients`)

- **Method**: `GET`
- **Path**: `/v1/clients`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `clients.manage`

#### Response (`200 OK`)

```json
{
  "items": [
    {
      "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414",
      "clientName": "Dev-MacBook-Pro",
      "createdAt": "2026-11-01T05:20:00.000Z"
    }
  ]
}
```

### Revoke Computer Authorization (`DELETE /v1/clients/{fingerprint}`)

- **Method**: `DELETE`
- **Path**: `/v1/clients/{fingerprint}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `clients.manage`

#### Response (`200 OK`)

```json
{
  "revoked": true,
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414"
}
```

---

## Wearable Device Control

### List Bound Devices (`GET /v1/devices`)

- **Method**: `GET`
- **Path**: `/v1/devices`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### Response (`200 OK`)

```json
{
  "items": [
    {
      "addr": "0C:07:DF:F5:A0:F6",
      "name": "REDMI Watch 5 eSIM",
      "kind": "o65m",
      "connectionState": "connected",
      "connectType": "spp"
    },
    {
      "addr": "74:FB:17:42:27:FB",
      "name": "Xiaomi Smart Band 10 NFC",
      "kind": "o66nfc",
      "connectionState": "disconnected",
      "connectType": "spp"
    }
  ]
}
```

### Get Active Device Summary (`GET /v1/devices/current`)

- **Method**: `GET`
- **Path**: `/v1/devices/current`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### Response (`200 OK`)

```json
{
  "result": {
    "connected": true,
    "protocolState": "ready",
    "device": {
      "name": "Xiaomi Smart Band 10 NFC",
      "address": "74:FB:17:42:27:FB",
      "connectType": "spp",
      "codename": "o66nfc",
      "disconnected": false
    },
    "battery": 92
  }
}
```

### Get Device Hardware Info and Storage (`GET /v1/devices/info`)

- **Method**: `GET`
- **Path**: `/v1/devices/info`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### Response (`200 OK`)

```json
{
  "result": {
    "name": "Xiaomi Smart Band 10 NFC",
    "address": "74:FB:17:42:27:FB",
    "connectType": "spp",
    "protocolState": "ready",
    "battery": 92,
    "firmwareVersion": "3.1.28",
    "model": "M2456B1",
    "storage": {
      "totalBytes": 402030592,
      "freeBytes": 338526208,
      "usedBytes": 63504384
    }
  }
}
```

### Connect to Device (`POST /v1/devices/connect`)

- **Method**: `POST`
- **Path**: `/v1/devices/connect`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.control`

#### Request Body (JSON)

```json
{
  "addr": "74:FB:17:42:27:FB"
}
```

#### Response (`200 OK`)

```json
{
  "addr": "74:FB:17:42:27:FB",
  "connectionState": "connected",
  "result": {
    "name": "Xiaomi Smart Band 10 NFC",
    "address": "74:FB:17:42:27:FB",
    "connectType": "spp",
    "disconnected": false
  }
}
```

### Disconnect Device (`POST /v1/devices/disconnect`)

- **Method**: `POST`
- **Path**: `/v1/devices/disconnect`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.control`

#### Response (`200 OK`)

```json
{
  "disconnected": true
}
```

---

## Application Management

### List Installed Applications (`GET /v1/apps`)

- **Method**: `GET`
- **Path**: `/v1/apps`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.list`

#### Response (`200 OK`)

```json
{
  "items": [
    {
      "packageName": "moe.orpu.neomusic",
      "name": "NeoMusic",
      "versionCode": 261025,
      "canRemove": true
    }
  ]
}
```

### Launch Application (`POST /v1/apps/launch`)

- **Method**: `POST`
- **Path**: `/v1/apps/launch`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.launch`

#### Request Body (JSON)

```json
{
  "packageName": "moe.orpu.neomusic",
  "page": "page/music/index"
}
```

#### Response (`200 OK`)

```json
{
  "result": {
    "launched": true,
    "package": "moe.orpu.neomusic"
  }
}
```

### Uninstall Application (`DELETE /v1/apps/{packageName}`)

- **Method**: `DELETE`
- **Path**: `/v1/apps/{packageName}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.uninstall`

#### Response (`200 OK`)

```json
{
  "result": {
    "uninstalled": true,
    "package": "moe.orpu.neomusic"
  }
}
```

---

## Watchface Management

### List Installed Watchfaces (`GET /v1/watchfaces`)

- **Method**: `GET`
- **Path**: `/v1/watchfaces`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.list`

#### Response (`200 OK`)

```json
{
  "items": [
    {
      "id": "120917345941",
      "name": "Time Weave",
      "isCurrent": true
    },
    {
      "id": "120917345943",
      "name": "Blocks",
      "isCurrent": false
    }
  ]
}
```

### Set Active Watchface (`POST /v1/watchfaces/set`)

- **Method**: `POST`
- **Path**: `/v1/watchfaces/set`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.set`

#### Request Body (JSON)

```json
{
  "id": "120917345943"
}
```

#### Response (`200 OK`)

```json
{
  "result": {
    "set": true,
    "id": "120917345943"
  }
}
```

### Remove Watchface (`DELETE /v1/watchfaces/{id}`)

- **Method**: `DELETE`
- **Path**: `/v1/watchfaces/{id}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.remove`

#### Response (`200 OK`)

```json
{
  "result": {
    "removed": true,
    "id": "120917345943"
  }
}
```

---

## Package Installation and Tasks

### Upload Package and Enqueue (`POST /v1/install`)

Upload binary installation package (`.rpk`, `.bin`, etc.) to temporary storage and submit to task queue

- **Method**: `POST`
- **Path**: `/v1/install`
- **Header**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/octet-stream`
  - `X-File-Name: <url-encoded-filename>`
  - `X-Sha256: <hex-sha256>`
  - `X-Type: app | watchface`
  - `X-Size: <file-bytes-length>`
- **Body**: Binary byte stream
- **Scope**: `install.local`

#### Response (`202 Accepted`)

```json
{
  "taskId": "1793483528217326",
  "status": "queued",
  "fileName": "neomusic.release.rpk",
  "sha256": "4b61ef2f0672e81119b486064fdfc6bc361ca49e6293fe4c3d88ebc58f000b0c"
}
```

### Query Task Progress (`GET /v1/tasks/{taskId}`)

- **Method**: `GET`
- **Path**: `/v1/tasks/{taskId}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `queue.read`

#### Response (Running `200 OK`)

```json
{
  "id": "1793483528217326",
  "method": "install.local",
  "status": "running",
  "progress": 0.75,
  "createdAt": "2026-11-01T05:52:01.000Z"
}
```

#### Response (Completed `200 OK`)

```json
{
  "id": "1793483528217326",
  "method": "install.local",
  "status": "completed",
  "progress": 1.0,
  "createdAt": "2026-11-01T05:52:01.000Z",
  "result": {
    "success": true
  }
}
```

`status` values: `queued`, `running`, `completed`, `failed`, `cancelled`

### Cancel Task (`POST /v1/tasks/{taskId}/cancel`)

- **Method**: `POST`
- **Path**: `/v1/tasks/{taskId}/cancel`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `queue.control`

#### Response (`200 OK`)

```json
{
  "result": {
    "cancelled": true
  }
}
```

---

## Real-time Events (SSE)

### Subscribe to Event Stream (`GET /v1/events`)

Long-lived Server-Sent Events (SSE) stream for connection state and queue updates

- **Method**: `GET`
- **Path**: `/v1/events`
- **Header**:
  - `Authorization: Bearer <token>`
  - `Accept: text/event-stream`
- **Scope**: `events.subscribe`

#### Stream Format

```text
event: ready
data: {"serverId":"oronbox-10517","protocolVersion":"1","connectedAt":"2026-11-01T05:50:00.000Z"}

event: connected
data: {"name":"Xiaomi Smart Band 10 NFC","address":"74:FB:17:42:27:FB","connectType":"spp"}

event: task.progress
data: {"taskId":"1793483528217326","progress":0.5,"status":"running"}

event: task.completed
data: {"taskId":"1793483528217326","status":"completed"}

event: disconnected
data: {"address":"74:FB:17:42:27:FB"}
```

---

## System Diagnostics Logs

Wearable devices stream chunked diagnostic archive data through low-level channels
Lifecycle stages: `preparing` -> `waiting_response` -> `waiting_transfer` -> `transferring` -> `completed`

### Create Log Export Operation (`POST /v1/device-logs`)

- **Method**: `POST`
- **Path**: `/v1/device-logs`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### Request Body (JSON optional)

```json
{
  "deviceId": "74:FB:17:42:27:FB"
}
```

#### Response (`202 Accepted`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "running",
  "stage": "preparing"
}
```

### Query Log Export Progress (`GET /v1/device-logs/{id}`)

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### Response (Transferring `200 OK`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "running",
  "stage": "transferring",
  "progress": 0.42,
  "currentPart": 14,
  "totalParts": 33,
  "channel": 1,
  "bytesDone": 146800,
  "bytesTotal": 349520,
  "fileName": "device-o66nfc-20261101-080030-23034_log.tar.gz"
}
```

#### Response (Completed `200 OK`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "completed",
  "stage": "completed",
  "progress": 1.0,
  "currentPart": 33,
  "totalParts": 33,
  "bytesDone": 4280632,
  "bytesTotal": 4280632,
  "fileName": "device-o66nfc-20261101-080030-23034_log.tar.gz",
  "archiveUrl": "/v1/device-logs/e9bd8201fa8820c7/archive",
  "currentLogUrl": "/v1/device-logs/e9bd8201fa8820c7/current-log"
}
```

### Cancel Log Export Operation (`POST /v1/device-logs/{id}/cancel`)

- **Method**: `POST`
- **Path**: `/v1/device-logs/{id}/cancel`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### Response (`200 OK`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "cancelled",
  "stage": "cancelled",
  "message": "cancelled"
}
```

### Download Log Archive (`GET /v1/device-logs/{id}/archive`)

Download complete compressed archive (`.tar.gz`) exported by the wearable device

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}/archive`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`
- **Response**: Binary stream (`application/gzip` or `application/octet-stream`)

### Download Current Active Log (`GET /v1/device-logs/{id}/current-log`)

Download extracted text of active running diagnostic log

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}/current-log`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`
- **Response**: Text stream (`text/plain; charset=utf-8`)

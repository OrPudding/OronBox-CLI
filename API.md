# OronBox Local API 接口规范

[English](./API.en.md) | 简体中文

OronBox 客户端在局域网中运行 HTTP 与 SSE 本地 API 服务（Local Server）
CLI 及第三方自动化工具作为客户端（Client）可通过此接口与 OronBox 客户端通信，并控制其绑定的穿戴设备

---

## 目录

1. [网络通信与发现机制](#网络通信与发现机制)
2. [认证流程与密钥体系](#认证流程与密钥体系)
3. [权限作用域 (Scopes)](#权限作用域-scopes)
4. [公共基础接口](#公共基础接口)
5. [配对与会话接口](#配对与会话接口)
6. [计算机凭据管理接口](#计算机凭据管理接口)
7. [穿戴设备控制接口](#穿戴设备控制接口)
8. [应用管理接口](#应用管理接口)
9. [表盘接口](#表盘接口)
10. [安装与任务队列接口](#安装与任务队列接口)
11. [实时事件流接口 (SSE)](#实时事件流接口-sse)
12. [系统诊断日志接口](#系统诊断日志接口)

---

## 网络通信与发现机制

### mDNS 局域网服务广播

OronBox 客户端开启本地 API 服务后，在局域网内通过组播 DNS 广播以下规格：

- **Service Type**: `_oronbox-api._tcp.local.`
- **Transport**: TCP
- **Port**: 动态或默认端口（通常为 `10517`）
- **TXT Records**:
  - `serverId`: 服务端标识（如 `oronbox-10517`）
  - `platform`: 宿主平台（如 `android` / `ios`）
  - `fingerprint`: 服务端公钥的 SHA-256 十六进制指纹
  - `protocolVersion`: 本地服务协议主版本号（当前为 `1`）

---

## 认证流程与密钥体系

受保护接口采用基于 Ed25519 的双向质询认证机制：

```text
[CLI 客户端]                                             [OronBox 客户端 (本地服务)]
      │                                                              │
      │ 1. 提交配对申请 (附带计算机 Ed25519 公钥)                     │
      ├─────────────────────────────────────────────────────────────>│
      │    POST /v1/auth/pairing-requests                            │ (OronBox 界面提示审批)
      │                                                              │
      │ 2. 轮询审批状态直至 granted                                  │
      ├─────────────────────────────────────────────────────────────>│
      │                                                              │
      │ 3. 获取认证质询载荷                                          │
      ├─────────────────────────────────────────────────────────────>│
      │    POST /v1/auth/challenges (携带计算机公钥指纹)             │
      │<─────────────────────────────────────────────────────────────┤
      │    返回 challengeId 与 32 字节随机 signingPayload            │
      │                                                              │
      │ 4. 计算机使用 Ed25519 私钥为 signingPayload 签名             │
      │                                                              │
      │ 5. 提交签名换取会话令牌                                      │
      ├─────────────────────────────────────────────────────────────>│
      │    POST /v1/auth/sessions (附 challengeId 与签名)            │
      │<─────────────────────────────────────────────────────────────┤
      │    返回 Bearer Token                                         │
      │                                                              │
      │ 6. 携带 Token 调用受保护业务接口                             │
      ├─────────────────────────────────────────────────────────────>│
      │    Header: Authorization: Bearer <token>                     │
```

- **签名标准**：PureEdDSA（RFC 8032），私钥对 32 字节载荷直接签名，输出 64 字节签名，采用 Base64URL 格式传输
- **计算机指纹**：`SHA-256(Ed25519RawPublicKeyBytes).toLowerCase().hex()`，64 位十六进制字符

---

## 权限作用域 (Scopes)

| 作用域 (Scope) | 描述 | 覆盖接口 |
| :--- | :--- | :--- |
| `device.read` | 读取设备列表、连接状态与硬件指标 | `GET /v1/devices`, `GET /v1/devices/current`, `GET /v1/devices/info` |
| `device.control` | 执行穿戴设备连接与断开动作 | `POST /v1/devices/connect`, `POST /v1/devices/disconnect` |
| `app.list` | 查询穿戴设备上已安装的第三方应用 | `GET /v1/apps` |
| `app.launch` | 在穿戴设备上拉起指定应用及页面 | `POST /v1/apps/launch` |
| `app.uninstall` | 卸载穿戴设备上的第三方应用 | `DELETE /v1/apps/{packageName}` |
| `watchface.list` | 列出已安装的表盘列表 | `GET /v1/watchfaces` |
| `watchface.set` | 将指定表盘设为当前活动表盘 | `POST /v1/watchfaces/set` |
| `watchface.remove` | 从穿戴设备中删除指定表盘 | `DELETE /v1/watchfaces/{id}` |
| `install.local` | 向穿戴设备推送并安装应用或表盘 | `POST /v1/install` |
| `queue.read` | 查询任务执行进度与队列状态 | `GET /v1/tasks/{taskId}` |
| `queue.control` | 取消进行中的队列任务 | `POST /v1/tasks/{taskId}/cancel` |
| `events.subscribe`| 监听服务端 SSE 事件广播 | `GET /v1/events` |
| `diagnostics.read`| 导出并下载穿戴设备系统诊断日志 | `POST /v1/device-logs`, `GET /v1/device-logs/{id}/*` |
| `clients.manage` | 管理已授权的客户端计算机凭据 | `GET /v1/clients`, `DELETE /v1/clients/{fingerprint}` |

---

## 公共基础接口

### 服务端元信息 (`GET /v1/info`)

免认证公开接口，获取服务端基础运行环境与公钥指纹

- **Method**: `GET`
- **Path**: `/v1/info`
- **Auth**: 无需认证

#### 响应示例 (`200 OK`)

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

## 配对与会话接口

### 申请配对 (`POST /v1/auth/pairing-requests`)

向 OronBox 客户端提交计算机身份信息与公钥，申请加入授权信任列表

- **Method**: `POST`
- **Path**: `/v1/auth/pairing-requests`
- **Auth**: 无需认证

#### 请求参数 (JSON)

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

#### 响应示例 (`202 Accepted` 或 `200 OK`)

OronBox 客户端已存在白名单记录时直接返回 `200 OK`，首次发起申请返回 `202 Accepted`

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

`state` 枚举：`pending`、`granted`、`denied`、`expired`

### 查询配对审批状态 (`GET /v1/auth/pairing-requests/{pairingId}`)

轮询审批状态，直至用户在 OronBox 客户端界面完成操作

- **Method**: `GET`
- **Path**: `/v1/auth/pairing-requests/{pairingId}`
- **Auth**: 无需认证

#### 响应示例 (`200 OK`)

```json
{
  "pairingId": "pair-req-179348",
  "clientName": "Dev-MacBook-Pro",
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414",
  "state": "granted",
  "createdAt": "2026-11-01T05:20:00.000Z"
}
```

### 获取认证质询码 (`POST /v1/auth/challenges`)

依据已授权的计算机公钥指纹获取一次性签名载荷

- **Method**: `POST`
- **Path**: `/v1/auth/challenges`
- **Auth**: 无需认证

#### 请求参数 (JSON)

```json
{
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414"
}
```

#### 响应示例 (`200 OK`)

```json
{
  "challengeId": "chlg-81029384",
  "signingPayload": "ZGYyMzgxMDkwMTIzNDU2Nzg5YWJjZGVmMDEyMzQ1Njc",
  "expiresAt": "2026-11-01T05:25:00.000Z"
}
```

### 校验签名并签发令牌 (`POST /v1/auth/sessions`)

提交私钥对 `signingPayload` 生成的 Ed25519 签名，换取访问令牌

- **Method**: `POST`
- **Path**: `/v1/auth/sessions`
- **Auth**: 无需认证

#### 请求参数 (JSON)

```json
{
  "challengeId": "chlg-81029384",
  "signature": "3F_k0QjP_dG9-gHj8L3vO9...64-bytes-base64url"
}
```

#### 响应示例 (`200 OK`)

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

## 计算机凭据管理接口

### 列出已授权计算机 (`GET /v1/clients`)

- **Method**: `GET`
- **Path**: `/v1/clients`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `clients.manage`

#### 响应示例 (`200 OK`)

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

### 吊销计算机授权 (`DELETE /v1/clients/{fingerprint}`)

- **Method**: `DELETE`
- **Path**: `/v1/clients/{fingerprint}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `clients.manage`

#### 响应示例 (`200 OK`)

```json
{
  "revoked": true,
  "fingerprint": "24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414"
}
```

---

## 穿戴设备控制接口

### 列出设备列表 (`GET /v1/devices`)

- **Method**: `GET`
- **Path**: `/v1/devices`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### 响应示例 (`200 OK`)

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

### 获取当前活动设备概况 (`GET /v1/devices/current`)

- **Method**: `GET`
- **Path**: `/v1/devices/current`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### 响应示例 (`200 OK`)

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

### 获取设备软硬件详情与存储容量 (`GET /v1/devices/info`)

- **Method**: `GET`
- **Path**: `/v1/devices/info`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.read`

#### 响应示例 (`200 OK`)

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

### 连接指定穿戴设备 (`POST /v1/devices/connect`)

- **Method**: `POST`
- **Path**: `/v1/devices/connect`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.control`

#### 请求参数 (JSON)

```json
{
  "addr": "74:FB:17:42:27:FB"
}
```

#### 响应示例 (`200 OK`)

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

### 断开当前穿戴设备 (`POST /v1/devices/disconnect`)

- **Method**: `POST`
- **Path**: `/v1/devices/disconnect`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `device.control`

#### 响应示例 (`200 OK`)

```json
{
  "disconnected": true
}
```

---

## 应用管理接口

### 列出已安装应用 (`GET /v1/apps`)

- **Method**: `GET`
- **Path**: `/v1/apps`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.list`

#### 响应示例 (`200 OK`)

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

### 调起应用 (`POST /v1/apps/launch`)

- **Method**: `POST`
- **Path**: `/v1/apps/launch`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.launch`

#### 请求参数 (JSON)

```json
{
  "packageName": "moe.orpu.neomusic",
  "page": "page/music/index"
}
```

#### 响应示例 (`200 OK`)

```json
{
  "result": {
    "launched": true,
    "package": "moe.orpu.neomusic"
  }
}
```

### 卸载应用 (`DELETE /v1/apps/{packageName}`)

- **Method**: `DELETE`
- **Path**: `/v1/apps/{packageName}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `app.uninstall`

#### 响应示例 (`200 OK`)

```json
{
  "result": {
    "uninstalled": true,
    "package": "moe.orpu.neomusic"
  }
}
```

---

## 表盘接口

### 列出已安装表盘 (`GET /v1/watchfaces`)

- **Method**: `GET`
- **Path**: `/v1/watchfaces`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.list`

#### 响应示例 (`200 OK`)

```json
{
  "items": [
    {
      "id": "120917345941",
      "name": "编织时光",
      "isCurrent": true
    },
    {
      "id": "120917345943",
      "name": "方块",
      "isCurrent": false
    }
  ]
}
```

### 切换当前表盘 (`POST /v1/watchfaces/set`)

- **Method**: `POST`
- **Path**: `/v1/watchfaces/set`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.set`

#### 请求参数 (JSON)

```json
{
  "id": "120917345943"
}
```

#### 响应示例 (`200 OK`)

```json
{
  "result": {
    "set": true,
    "id": "120917345943"
  }
}
```

### 删除指定表盘 (`DELETE /v1/watchfaces/{id}`)

- **Method**: `DELETE`
- **Path**: `/v1/watchfaces/{id}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `watchface.remove`

#### 响应示例 (`200 OK`)

```json
{
  "result": {
    "removed": true,
    "id": "120917345943"
  }
}
```

---

## 安装与任务队列接口

### 上传并安装包文件 (`POST /v1/install`)

上传二进制安装包文件（`.rpk`、`.bin` 等），服务端将其置入暂存并提交执行队列

- **Method**: `POST`
- **Path**: `/v1/install`
- **Header**:
  - `Authorization: Bearer <token>`
  - `Content-Type: application/octet-stream`
  - `X-File-Name: <url-encoded-filename>`
  - `X-Sha256: <hex-sha256>`
  - `X-Type: app | watchface`
  - `X-Size: <file-bytes-length>`
- **Body**: 二进制数据流
- **Scope**: `install.local`

#### 响应示例 (`202 Accepted`)

```json
{
  "taskId": "1793483528217326",
  "status": "queued",
  "fileName": "neomusic.release.rpk",
  "sha256": "4b61ef2f0672e81119b486064fdfc6bc361ca49e6293fe4c3d88ebc58f000b0c"
}
```

### 查询任务进度 (`GET /v1/tasks/{taskId}`)

- **Method**: `GET`
- **Path**: `/v1/tasks/{taskId}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `queue.read`

#### 响应示例（进行中 `200 OK`）

```json
{
  "id": "1793483528217326",
  "method": "install.local",
  "status": "running",
  "progress": 0.75,
  "createdAt": "2026-11-01T05:52:01.000Z"
}
```

#### 响应示例（完成 `200 OK`）

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

`status` 枚举：`queued`、`running`、`completed`、`failed`、`cancelled`

### 取消任务 (`POST /v1/tasks/{taskId}/cancel`)

- **Method**: `POST`
- **Path**: `/v1/tasks/{taskId}/cancel`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `queue.control`

#### 响应示例 (`200 OK`)

```json
{
  "result": {
    "cancelled": true
  }
}
```

---

## 实时事件流接口 (SSE)

### 订阅实时事件广播 (`GET /v1/events`)

采用 Server-Sent Events (SSE) 协议保持长连接，实时接收设备连接状态与任务执行进度通知

- **Method**: `GET`
- **Path**: `/v1/events`
- **Header**:
  - `Authorization: Bearer <token>`
  - `Accept: text/event-stream`
- **Scope**: `events.subscribe`

#### 事件流格式

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

## 系统诊断日志接口

穿戴设备通过底层信道以分片方式推送打包日志流
包含阶段：`preparing` -> `waiting_response` -> `waiting_transfer` -> `transferring` -> `completed`

### 创建日志导出任务 (`POST /v1/device-logs`)

- **Method**: `POST`
- **Path**: `/v1/device-logs`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### 请求参数 (JSON 可选)

```json
{
  "deviceId": "74:FB:17:42:27:FB"
}
```

#### 响应示例 (`202 Accepted`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "running",
  "stage": "preparing"
}
```

### 查询日志导出进度 (`GET /v1/device-logs/{id}`)

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### 响应示例（分片传输中 `200 OK`）

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

#### 响应示例（完成 `200 OK`）

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

### 取消日志导出任务 (`POST /v1/device-logs/{id}/cancel`)

- **Method**: `POST`
- **Path**: `/v1/device-logs/{id}/cancel`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`

#### 响应示例 (`200 OK`)

```json
{
  "id": "e9bd8201fa8820c7",
  "kind": "device_logs",
  "state": "cancelled",
  "stage": "cancelled",
  "message": "cancelled"
}
```

### 下载完整日志归档 (`GET /v1/device-logs/{id}/archive`)

下载穿戴设备输出的完整压缩归档文件（`.tar.gz` 格式）

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}/archive`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`
- **Response**: 二进制流（`application/gzip` 或 `application/octet-stream`）

### 下载当前运行日志 (`GET /v1/device-logs/{id}/current-log`)

下载解压提取出的当前运行诊断日志纯文本

- **Method**: `GET`
- **Path**: `/v1/device-logs/{id}/current-log`
- **Header**: `Authorization: Bearer <token>`
- **Scope**: `diagnostics.read`
- **Response**: 纯文本流（`text/plain; charset=utf-8`）

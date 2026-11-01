# OronBox CLI 使用指南

[English](./GUIDE.en.md) | 简体中文

`oronbox-cli` 是 OronBox 的官方命令行客户端工具（CLI）
通过局域网 mDNS 自动发现 OronBox 客户端，基于 Ed25519 签名完成配对认证，并在计算机终端提供穿戴设备管理、应用安装、表盘配置与诊断日志拉取等全套功能

---

## 目录

1. [架构角色说明](#架构角色说明)
2. [安装与构建](#安装与构建)
3. [全局选项说明](#全局选项说明)
4. [服务发现与设备配对](#服务发现与设备配对)
5. [设备连接与状态检查](#设备连接与状态检查)
6. [穿戴设备日志拉取](#穿戴设备日志拉取)
7. [穿戴应用管理](#穿戴应用管理)
8. [表盘管理](#表盘管理)
9. [计算机授权凭据管理](#计算机授权凭据管理)
10. [自动化脚本支持](#自动化脚本支持)
11. [配置与存储机制](#配置与存储机制)
12. [常见问题排查](#常见问题排查)

---

## 架构角色说明

在日常使用与网络协议中，涉及两套角色的对应关系：

- **OronBox 客户端**：运行在移动设备或桌面上的 OronBox 主应用，负责管理底层穿戴设备
  在开启【本地 API 服务】后，OronBox 客户端在局域网中承担**服务端**（Server）职责，监听 HTTP 与 SSE 请求
- **CLI（OronBox-CLI）**：运行在计算机终端的命令行工具，在局域网网络通信中扮演**客户端**（Client）角色，通过 API 向 OronBox 客户端发送各项管理与控制指令

---

## 安装与构建

### 环境要求

- Node.js 18.0.0 及以上版本（支持 ESM、`fetch` 与 `node:crypto` Ed25519 接口）
- pnpm / npm / yarn 包管理器

### 构建与全局注册

```bash
# 克隆仓库
git clone https://github.com/zxor-org/OronBox-CLI.git
cd OronBox-CLI

# 安装依赖并构建
pnpm install
pnpm run build

# 注册全局命令
npm link
```

---

## 全局选项说明

所有子命令均支持以下全局参数：

| 参数 | 短选项 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `--host <host>` | `-H` | `127.0.0.1`（配对后默认使用配对地址） | 显式指定 OronBox 客户端本地服务的 IP 地址 |
| `--port <port>` | `-P` | `10517`（配对后默认使用配对端口） | 显式指定 OronBox 客户端本地服务的监听端口 |
| `--json` | - | `false` | 以结构化 JSON 格式输出数据 |
| `--help` | `-h` | - | 打印帮助信息 |
| `--version` | `-V` | - | 查看版本号 |

---

## 服务发现与设备配对

执行操作前，需在 OronBox 客户端开启【设置】->【高级设置】->【本地 API 服务】，并将当前计算机与 OronBox 客户端完成配对绑定

### 1. 扫描局域网服务

```bash
# 扫描局域网内的 OronBox 客户端
oronbox-cli discover

# 指定扫描超时时间（单位：秒）
oronbox-cli discover -t 5
```

输出示例：

```text
Scanning local network for OronBox instances via mDNS (timeout: 5s)...

Discovered 1 OronBox instance(s):
Host            | Port  | Name         | Platform | Fingerprint     
----------------+-------+--------------+----------+-----------------
192.168.51.206  | 10517 | OronBox      | android  | 414d502f4d703cb5
```

### 2. 配对计算机身份

运行 `pair` 向目标 OronBox 客户端发起配对申请
CLI 本地会生成 Ed25519 密钥对，并将计算机名称与公钥指纹提交至 OronBox 客户端：

```bash
oronbox-cli pair 192.168.51.206:10517
```

输出：

```text
Pairing request sent to OronBox (192.168.51.206:10517)
Pairing ID:       pr-8c775086d70bcbe2
Computer:         MacBook-Pro.local (OronBox-CLI)
Fingerprint:      24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414

Waiting for authorization on device (check your OronBox app screen)...
```

在 OronBox 客户端界面核对指纹后点击【允许】
审批通过后 CLI 将自动记录该目标配置：

```text
Success: Authorization granted! Computer successfully paired
```

配对完成后，后续命令自动沿用记录的地址与端口，无需反复指定 `-H` 与 `-P`

---

## 设备连接与状态检查

### 1. 查看服务与设备整体状态

```bash
oronbox-cli status
```

输出示例：

```text
=== OronBox Server Status (192.168.51.206:10517) ===
Server Name:        OronBox
Platform:           android
Protocol Version:   1
Server Fingerprint: 414d502f4d703cb515c0953f84ae4c5fa931814f39d6636d5fb19e8b0eaf04e1

=== Active Wearable Device ===
Property             | Value                         
---------------------+-------------------------------
Device Name          | Xiaomi Smart Band 10 NFC      
Bluetooth Address    | 74:FB:17:42:27:FB             
Connect Type         | spp                           
Battery              | 92%                           
```

### 2. 列出 OronBox 客户端绑定的穿戴设备

```bash
oronbox-cli device list
```

输出示例：

```text
Name                     | Address / Device ID      | Status         | Transport   
-------------------------+--------------------------+----------------+-------------
Xiaomi Smart Band 10 NFC | 74:FB:17:42:27:FB        | connected      | SPP         
REDMI Watch 5 eSIM       | 0C:07:DF:F5:A0:F6        | disconnected   | SPP         
```

### 3. 查看当前活动设备的软硬件详情

```bash
oronbox-cli device info
```

输出示例：

```text
Property             | Details                            
---------------------+------------------------------------
Name                 | Xiaomi Smart Band 10 NFC           
MAC Address          | 74:FB:17:42:27:FB                  
Connection Type      | spp                                
Protocol State       | ready                              
Battery Level        | 92%                                
Firmware Version     | 3.1.28                             
Model                | M2456B1                            
Storage Total        | 383.4 MB                           
Storage Free         | 322.8 MB                           
```

### 4. 切换与断开穿戴设备

通过蓝牙 MAC 地址切换当前连接的设备：

```bash
oronbox-cli device connect 74:FB:17:42:27:FB
```

断开当前连接的穿戴设备：

```bash
oronbox-cli device disconnect
```

---

## 穿戴设备日志拉取

穿戴设备通过底层信道以分片方式导出压缩日志归档（`.tar.gz` 格式）

### 1. 实时拉取并保存日志

```bash
# 拉取当前活动设备日志并自动保存至当前目录
oronbox-cli device logs pull

# 指定输出文件路径
oronbox-cli device logs pull ./device_logs.tar.gz

# 指定目标穿戴设备地址
oronbox-cli device logs pull -d 74:FB:17:42:27:FB ./logs.tar.gz
```

拉取时终端显示实时进度：

```text
Initiating device log pull operation...
Log operation started: e9bd8201fa8820c7 (Stage: preparing)
[transferring] Part 18/33 (185.0 KB / 349.5 KB) 53%   
Transfer completed. Downloading log archive from OronBox...
Saved log archive to /Users/orpudding/device_logs.tar.gz (4.1 MB)
```

可在终端按下 `Ctrl+C` 发送取消信号并终止传输

### 2. 取消进行中的日志导出任务

```bash
oronbox-cli device logs cancel e9bd8201fa8820c7
```

---

## 穿戴应用管理

### 1. 列出已安装应用

```bash
oronbox-cli apps list
```

输出示例：

```text
App Name               | Package Name                     | Version     
-----------------------+----------------------------------+-------------
QQ音乐                 | com.watch.qq.vela                | 34          
NeoMusic               | moe.orpu.neomusic                | 261025      
```

### 2. 安装应用包 (.rpk / .bin)

```bash
oronbox-cli apps install ./neomusic.release.rpk
```

输出过程：

```text
Uploading ./neomusic.release.rpk to OronBox...
Task created: 1793483528217326 (Status: queued)
Waiting for installation to finish on device...
Progress: completed 100%   
Success: Application installed successfully
```

在后台脚本中无需等待完成时，可追加 `--no-wait`：

```bash
oronbox-cli apps install ./neomusic.release.rpk --no-wait
```

### 3. 调起穿戴应用

在穿戴设备上直接启动指定包名的应用界面：

```bash
oronbox-cli apps launch moe.orpu.neomusic
```

指定页面路由直达特定子页面：

```bash
oronbox-cli apps launch moe.orpu.neomusic page/music/index
```

### 4. 卸载穿戴应用

```bash
oronbox-cli apps uninstall moe.orpu.neomusic
```

---

## 表盘管理

### 1. 查看已安装表盘

```bash
oronbox-cli watchfaces list
```

输出示例：

```text
ID             | Name                     | Current   
---------------+--------------------------+-----------
120917345941   | 编织时光                 |           
120917345943   | 方块                     |           
```

### 2. 安装表盘

```bash
oronbox-cli watchfaces install ./custom_face.bin
```

### 3. 设置活动表盘

将指定表盘 ID 设为穿戴设备当前使用的表盘：

```bash
oronbox-cli watchfaces set 120917345941
```

### 4. 删除表盘

```bash
oronbox-cli watchfaces remove 120917345941
```

---

## 计算机授权凭据管理

### 1. 列出已授权计算机

查看当前 OronBox 客户端记录的所有已授权计算机：

```bash
oronbox-cli clients list
```

### 2. 吊销计算机访问权限

依据 SHA-256 公钥指纹吊销某台计算机的授权记录：

```bash
oronbox-cli clients revoke 24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414
```

---

## 自动化脚本支持

`oronbox-cli` 支持 `--json` 选项，输出标准 JSON 数据
配合 `jq` 即可在流水线中解析字段：

```bash
# 获取当前设备电量
BATTERY=$(oronbox-cli device info --json | jq '.result.battery')
echo "Device battery: $BATTERY"

# 检查应用是否已安装
INSTALLED=$(oronbox-cli apps list --json | jq '.items[] | select(.packageName=="moe.orpu.neomusic")')
if [ -n "$INSTALLED" ]; then
  echo "NeoMusic is already installed"
fi
```

---

## 配置与存储机制

CLI 在用户主目录下存储凭据与连接配置，路径为 `~/.oronbox/`：

1. `~/.oronbox/credentials.json`
   - 保存当前计算机的 Ed25519 私钥（PKCS#8 PEM）、公钥、公钥指纹及计算机名称
   - 文件权限受限保护，防止凭据外泄
2. `~/.oronbox/config.json`
   - 保存最近配对的目标地址参数（`defaultHost`、`defaultPort`）
   - 缓存短期会话令牌及过期时间戳
   - 命令未显式指定 `-H` 与 `-P` 时自动使用此配置

---

## 常见问题排查

### 1. 提示 "This computer is not paired or authorized with OronBox yet"

- 原因：当前计算机的公钥指纹未在 OronBox 客户端的授权白名单中，或已被撤销
- 解决：重新执行 `oronbox-cli pair <host>:<port>` 并在 OronBox 客户端界面点击【允许】

### 2. 为什么 `device info` 显示 `Storage Total: unknown`？

- 原因：穿戴设备的存储容量指标依赖状态同步更新，若设备刚连接或尚未完成同步则处于待刷新状态
- 解决：在 OronBox 客户端界面下拉刷新设备状态或等待状态同步完成后再次查询

### 3. 多网卡或复杂网络环境下连接超时？

- 原因：局域网存在 AP 隔离或组播限制，或者计算机启用了多个虚拟网卡与代理连接
- 解决：确认网络连通性，并在 OronBox 客户端【设置】->【高级设置】->【本地 API 服务】页面查看显示的局域网 IPv4 地址，通过 `-H <ip> -P <port>` 显式连接

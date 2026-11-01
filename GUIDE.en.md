# OronBox CLI User Guide

English | [简体中文](./GUIDE.md)

`oronbox-cli` is the official command-line tool (CLI) for OronBox
It supports automatic mDNS discovery of OronBox client instances, Ed25519 challenge-response pairing, wearable device inspection, application installation, watchface management, and diagnostic log retrieval

---

## Table of Contents

1. [Architecture and Roles](#architecture-and-roles)
2. [Installation and Build](#installation-and-build)
3. [Global Options](#global-options)
4. [Service Discovery and Pairing](#service-discovery-and-pairing)
5. [Device Connection and Status](#device-connection-and-status)
6. [Wearable Device Logs](#wearable-device-logs)
7. [Application Management](#application-management)
8. [Watchface Management](#watchface-management)
9. [Computer Credential Management](#computer-credential-management)
10. [Automation Scripts and CI/CD](#automation-scripts-and-cicd)
11. [Configuration and Storage](#configuration-and-storage)
12. [Troubleshooting](#troubleshooting)

---

## Architecture and Roles

To avoid confusion between application terms and networking roles:

- **OronBox Client**: The main OronBox application running on mobile or desktop devices, directly managing wearable devices. When **Local API Server** is enabled, it acts as the local network **server** (Server), listening for HTTP and SSE requests
- **CLI (OronBox-CLI)**: The command-line tool running in the computer terminal. In network communication, it acts as the **client** (Client), dispatching management and control commands to the OronBox client

---

## Installation and Build

### Prerequisites

- Node.js 18.0.0 or higher (supports pure ESM, native `fetch`, and `node:crypto` Ed25519)
- pnpm, npm, or yarn package manager

### Build and Link

```bash
# Clone the repository
git clone https://github.com/zxor-org/OronBox-CLI.git
cd OronBox-CLI

# Install dependencies and build bundle
pnpm install
pnpm run build

# Register globally
npm link
```

---

## Global Options

All subcommands support the following options:

| Option | Short | Default | Description |
| :--- | :--- | :--- | :--- |
| `--host <host>` | `-H` | `127.0.0.1` (defaults to paired host once paired) | Specify OronBox client IP address |
| `--port <port>` | `-P` | `10517` (defaults to paired port once paired) | Specify OronBox client port |
| `--json` | - | `false` | Output structured JSON data |
| `--help` | `-h` | - | Print help information |
| `--version` | `-V` | - | Print version number |

---

## Service Discovery and Pairing

Before interacting with devices, enable Local API Server in the OronBox client under **Settings** -> **Advanced** -> **Local API Server**, and complete pairing between the computer and the OronBox client

### 1. Scan Local Network

```bash
# Discover OronBox client instances via mDNS
oronbox-cli discover

# Custom discovery timeout (in seconds)
oronbox-cli discover -t 5
```

Sample output:

```text
Scanning local network for OronBox instances via mDNS (timeout: 5s)...

Discovered 1 OronBox instance(s):
Host            | Port  | Name         | Platform | Fingerprint     
----------------+-------+--------------+----------+-----------------
192.168.51.206  | 10517 | OronBox      | android  | 414d502f4d703cb5
```

### 2. Pair Computer Identity

Run `pair` to initiate pairing with the target OronBox client
The CLI generates an Ed25519 keypair and submits its computer name and public key fingerprint to the OronBox client:

```bash
oronbox-cli pair 192.168.51.206:10517
```

Sample output:

```text
Pairing request sent to OronBox (192.168.51.206:10517)
Pairing ID:       pr-8c775086d70bcbe2
Computer:         MacBook-Pro.local (OronBox-CLI)
Fingerprint:      24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414

Waiting for authorization on device (check your OronBox app screen)...
```

Check the fingerprint on the OronBox client screen and tap **Allow**
Once authorized, the CLI automatically saves the target configuration:

```text
Success: Authorization granted! Computer successfully paired
```

Subsequent commands automatically use the paired address and port without repeating `-H` and `-P`

---

## Device Connection and Status

### 1. Check Server and Device Status

```bash
oronbox-cli status
```

Sample output:

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

### 2. List Devices Bound to OronBox Client

```bash
oronbox-cli device list
```

Sample output:

```text
Name                     | Address / Device ID      | Status         | Transport   
-------------------------+--------------------------+----------------+-------------
Xiaomi Smart Band 10 NFC | 74:FB:17:42:27:FB        | connected      | SPP         
REDMI Watch 5 eSIM       | 0C:07:DF:F5:A0:F6        | disconnected   | SPP         
```

### 3. Detailed Active Device Information

```bash
oronbox-cli device info
```

Sample output:

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

### 4. Connect and Disconnect Devices

Connect to a wearable device by Bluetooth MAC address:

```bash
oronbox-cli device connect 74:FB:17:42:27:FB
```

Disconnect current device:

```bash
oronbox-cli device disconnect
```

---

## Wearable Device Logs

Wearable devices transfer compressed diagnostic archives (`.tar.gz`) in chunks over low-level channels

### 1. Pull and Save Diagnostic Logs

```bash
# Pull active device logs and save to current directory
oronbox-cli device logs pull

# Specify output destination
oronbox-cli device logs pull ./device_logs.tar.gz

# Specify target device address
oronbox-cli device logs pull -d 74:FB:17:42:27:FB ./logs.tar.gz
```

Progress updates are displayed in real time:

```text
Initiating device log pull operation...
Log operation started: e9bd8201fa8820c7 (Stage: preparing)
[transferring] Part 18/33 (185.0 KB / 349.5 KB) 53%   
Transfer completed. Downloading log archive from OronBox...
Saved log archive to /Users/orpudding/device_logs.tar.gz (4.1 MB)
```

Press `Ctrl+C` at any time to send a cancel signal and abort transfer

### 2. Cancel Ongoing Log Export

```bash
oronbox-cli device logs cancel e9bd8201fa8820c7
```

---

## Application Management

### 1. List Installed Applications

```bash
oronbox-cli apps list
```

Sample output:

```text
App Name               | Package Name                     | Version     
-----------------------+----------------------------------+-------------
QQ音乐                 | com.watch.qq.vela                | 34          
NeoMusic               | moe.orpu.neomusic                | 261025      
```

### 2. Install Application (.rpk / .bin)

```bash
oronbox-cli apps install ./neomusic.release.rpk
```

Installation output:

```text
Uploading ./neomusic.release.rpk to OronBox...
Task created: 1793483528217326 (Status: queued)
Waiting for installation to finish on device...
Progress: completed 100%   
Success: Application installed successfully
```

Pass `--no-wait` when waiting is not needed in background scripts:

```bash
oronbox-cli apps install ./neomusic.release.rpk --no-wait
```

### 3. Launch Application

Launch an application by its package name:

```bash
oronbox-cli apps launch moe.orpu.neomusic
```

Provide an optional page route to open a specific screen:

```bash
oronbox-cli apps launch moe.orpu.neomusic page/music/index
```

### 4. Uninstall Application

```bash
oronbox-cli apps uninstall moe.orpu.neomusic
```

---

## Watchface Management

### 1. List Installed Watchfaces

```bash
oronbox-cli watchfaces list
```

Sample output:

```text
ID             | Name                     | Current   
---------------+--------------------------+-----------
120917345941   | Time Weave               |           
120917345943   | Blocks                   |           
```

### 2. Install Watchface

```bash
oronbox-cli watchfaces install ./custom_face.bin
```

### 3. Set Active Watchface

Set a watchface by ID as active:

```bash
oronbox-cli watchfaces set 120917345941
```

### 4. Remove Watchface

```bash
oronbox-cli watchfaces remove 120917345941
```

---

## Computer Credential Management

### 1. List Authorized Computers

List all client computers approved in the OronBox client:

```bash
oronbox-cli clients list
```

### 2. Revoke Computer Authorization

Revoke authorization for a computer by its SHA-256 fingerprint:

```bash
oronbox-cli clients revoke 24927ffad13e405775a338605a12ba9be6fa13c3451c0a5dc3d5871209982414
```

---

## Automation Scripts and CI/CD

`oronbox-cli` supports `--json` across all commands to output clean JSON
Combine with `jq` for automation scripts:

```bash
# Get current device battery
BATTERY=$(oronbox-cli device info --json | jq '.result.battery')
echo "Device battery: $BATTERY"

# Check if an app is installed
INSTALLED=$(oronbox-cli apps list --json | jq '.items[] | select(.packageName=="moe.orpu.neomusic")')
if [ -n "$INSTALLED" ]; then
  echo "NeoMusic is already installed"
fi
```

---

## Configuration and Storage

Credentials and target settings are persisted under `~/.oronbox/`:

1. `~/.oronbox/credentials.json`
   - Stores Ed25519 private key (PKCS#8 PEM), public key, public key fingerprint, and computer name
   - Stored with restricted permissions to prevent credential leakage
2. `~/.oronbox/config.json`
   - Stores target host parameters (`defaultHost`, `defaultPort`) from the last successful pairing
   - Caches short-lived session tokens and expiration timestamps
   - Used automatically when `-H` and `-P` are omitted

---

## Troubleshooting

### 1. "This computer is not paired or authorized with OronBox yet"

- Cause: The computer public key fingerprint is not in the OronBox client whitelist or was revoked
- Solution: Run `oronbox-cli pair <host>:<port>` and tap **Allow** on the OronBox client screen

### 2. Why does `device info` show `Storage Total: unknown`？

- Cause: Storage metrics depend on device state synchronization; if the device just connected or has not synced yet, the values remain unpopulated
- Solution: Pull down to refresh device state in the OronBox client interface or wait for state sync to complete

### 3. Connection Timeout in Multi-interface or Complex Networks

- Cause: AP isolation or multicast filtering on the router, or multiple active network interfaces on the computer
- Solution: Verify network reachability, check the displayed IPv4 address under **Settings** -> **Advanced** -> **Local API Server** in the OronBox client, and connect explicitly with `-H <ip> -P <port>`

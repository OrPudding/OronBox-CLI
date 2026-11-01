# OronBox-CLI

English | [简体中文](./README.md)

Official command-line tool (CLI) for OronBox, used to connect to the Local API Server of the OronBox client over the local network to inspect and control connected wearable devices

## Architecture and Roles

- **OronBox Client**: The main OronBox application running on mobile or desktop devices. When **Local API Server** is enabled, it functions as the local network server (Server), managing device connections and dispatching commands
- **CLI (OronBox-CLI)**: The command-line client (Client) running in the computer terminal, communicating with the OronBox client via RESTful and SSE protocols to execute control instructions

## Features

- **Service Discovery**: Automatic mDNS discovery for OronBox client instances on the local network
- **Credential Authentication**: Ed25519 keypair and SHA-256 computer fingerprint authentication with on-screen approval in the OronBox client
- **Device Control**: Inspect connection state, hardware parameters, battery status, and storage capacity
- **Diagnostic Logs**: Pull wearable device system diagnostic log archives (.tar.gz) in real time over low-level channels
- **Apps and Watchfaces**: Install, launch, switch, and uninstall applications and watchfaces
- **Structured Output**: Support ANSI terminal table display and `--json` structured output for automation pipelines

## Installation

Global installation is recommended:

```bash
npm install -g oronbox-cli
# or
pnpm add -g oronbox-cli
```

Once installed, execute `oronbox-cli` directly in your terminal:

```bash
oronbox-cli <command>
```

You can also run commands directly without global installation via npx:

```bash
npx oronbox-cli <command>
```

## Quick Start

### 1. Discovery and Pairing

Ensure Local API Server is enabled in the OronBox client under **Settings** -> **Advanced** -> **Local API Server**

```bash
# Discover and pair automatically
oronbox-cli pair

# Discover available instances only
oronbox-cli discover

# Pair with explicit IP and port
oronbox-cli pair 192.168.1.100:10517
```

After submitting the pairing request from the CLI, tap **Allow** on the OronBox client screen to complete binding

### 2. Check Status

```bash
# Check Local API Server status and active wearable device
oronbox-cli status

# Output as JSON
oronbox-cli status --json
```

### 3. Device Management and Logs

```bash
# List all wearable devices bound to the OronBox client
oronbox-cli device list

# Show detailed metrics and battery of the active device
oronbox-cli device info

# Connect to a specified wearable device
oronbox-cli device connect <device_address>

# Disconnect the current wearable device
oronbox-cli device disconnect

# Pull diagnostic log archive (.tar.gz)
oronbox-cli device logs pull
```

### 4. Application Management

```bash
# List installed third-party applications
oronbox-cli apps list

# Install an application package (.rpk / .bin)
oronbox-cli apps install ./neomusic.release.rpk

# Launch an app on the wearable device (optional page route)
oronbox-cli apps launch moe.orpu.neomusic page/music/index

# Uninstall an application
oronbox-cli apps uninstall moe.orpu.neomusic
```

### 5. Watchface Management

```bash
# List installed watchfaces
oronbox-cli watchfaces list

# Install a watchface package (.bin / .zip)
oronbox-cli watchfaces install ./watchface.bin

# Set active watchface
oronbox-cli watchfaces set 120917345941

# Remove a watchface
oronbox-cli watchfaces remove 120917345941
```

### 6. Client Computer Management

```bash
# List authorized computers in the OronBox client
oronbox-cli clients list

# Revoke authorization for a computer
oronbox-cli clients revoke <fingerprint>
```

## Documentation

- [User Guide](./GUIDE.en.md) ([简体中文](./GUIDE.md)): Complete CLI instructions, architecture roles, commands, and automation guide
- [API Specification](./API.en.md) ([简体中文](./API.md)): Local RESTful / SSE API endpoints and Ed25519 authentication specification

## Global Options

- `-H, --host <host>`: Target host (default: `127.0.0.1`, cached after pairing)
- `-P, --port <port>`: Target port (default: `10517`, cached after pairing)
- `--json`: Output full data in structured JSON
- `-V, --version`: Display version number
- `-h, --help`: Display help information

## License

[Apache-2.0](./LICENSE)

# Agent Instructions

This file provides context for AI assistants working on the OronBox CLI project.

## Project Overview

OronBox CLI is the official command-line interface for OronBox, providing developer control, automation, and local debugging for VelaOS and ZeppOS wearables over the local network.

It communicates with the OronBox client application via its **Local Server HTTP API** (defaulting to port 8080) with ADB-style Ed25519 pairing and challenge-response authentication.

## Architecture

```
src/
├── cli.ts              # Entry point, Commander program setup
├── package-info.ts     # Package metadata helper
├── commands/
│   ├── pair.ts         # Handshake and pair with OronBox Local Server
│   ├── status.ts       # Query /v1/info and active device status
│   ├── device.ts       # Device subcommand group: list / info / connect / disconnect
│   ├── apps.ts         # App subcommand group: list / install (--wait) / uninstall / launch
│   ├── watchfaces.ts   # Watchface subcommand group: list / install / set / remove
│   └── clients.ts      # Authorized client subcommand group: list / revoke
├── lib/
│   ├── api.ts          # Authenticated fetch wrapper for Local Server HTTP API
│   ├── auth.ts         # Ed25519 keypair generation, signing, and SHA-256 fingerprinting
│   ├── config.ts       # ~/.oronbox/credentials.json & config.json persistence
│   ├── constants.ts    # Default ports, URLs, timeouts
│   ├── errors.ts       # fail() helper for consistent error exit
│   └── table.ts        # Pure ANSI/Unicode table rendering
└── types/
    └── api.ts          # Local Server API response and entity types
```

## Tech Stack

- **Runtime:** Node.js >= 20 (ES modules)
- **Bundler:** Rolldown
- **CLI Framework:** Commander.js
- **Package Manager:** pnpm
- **Language:** TypeScript 5.8+

## Coding Conventions

- All source files use **ES modules** (`"type": "module"`)
- Prefer `node:` prefix for built-in imports (e.g., `node:fs`, `node:path`, `node:crypto`, `node:os`)
- Errors should use the `fail()` helper from `lib/errors.ts` for consistent formatting and exit codes
- API requests go through `requestLocalServer<T>()` in `lib/api.ts`
- Cryptographic operations use native `node:crypto` (Ed25519 + SHA-256) without third-party dependencies
- Types live under `src/types/`
- Commands are factory functions returning `Command` instances
- Subcommand groups nest child commands via `.addCommand()`
- Shared logic that needs to be reused across commands goes under `src/lib/`
- Avoid third-party spinner/table dependencies; all rendering is done with clean ANSI escapes and native string formatting

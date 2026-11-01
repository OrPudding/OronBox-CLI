import { Command } from "commander";

import { requestLocalServer } from "../lib/api";
import { getOrCreateIdentity, saveConfig, loadConfig } from "../lib/config";
import { DEFAULT_HOST, DEFAULT_PORT } from "../lib/constants";
import { discoverOronBoxServices } from "../lib/discovery";
import { fail } from "../lib/errors";
import { renderTable } from "../lib/table";
import type { PairingStatusResponse } from "../types/api";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createPairCommand(): Command {
  return new Command("pair")
    .description("Pair this computer with an OronBox mobile client (auto-discovers if target omitted)")
    .argument("[target]", "Target host:port (e.g. 192.168.1.100:8080)")
    .action(async (target: string | undefined, _options: unknown, command: Command) => {
      const globalOpts = command.optsWithGlobals() as { host?: string; port?: string; json?: boolean };

      let host = globalOpts.host;
      let port = globalOpts.port ? parseInt(globalOpts.port, 10) : undefined;

      if (target) {
        if (target.includes(":")) {
          const parts = target.split(":");
          host = parts[0]!.trim();
          port = parseInt(parts[1]!.trim(), 10) || DEFAULT_PORT;
        } else {
          host = target.trim();
          port = port || DEFAULT_PORT;
        }
      }

      // If no host specified, perform auto-discovery via mDNS
      if (!host) {
        console.log("No target specified. Scanning local network for OronBox instances via mDNS...");
        const services = await discoverOronBoxServices(2500);

        if (services.length === 1) {
          const single = services[0]!;
          host = single.host;
          port = single.port;
          console.log(`Auto-discovered: ${single.name} at ${host}:${port} (${single.platform})`);
        } else if (services.length > 1) {
          console.log(`\nMultiple OronBox instances discovered on the local network:\n`);
          console.log(
            renderTable(services, [
              { key: "name", header: "Name", width: 22 },
              { key: (s) => `${s.host}:${s.port}`, header: "Endpoint", width: 22 },
              { key: "platform", header: "Platform", width: 12 },
            ]),
          );
          fail("Please specify which instance to pair with, e.g.:\n  oronbox-cli pair <host:port>");
        } else {
          console.log(`No instances auto-discovered. Falling back to default ${DEFAULT_HOST}:${DEFAULT_PORT}`);
          host = DEFAULT_HOST;
          port = DEFAULT_PORT;
        }
      }

      port = port || DEFAULT_PORT;
      const identity = getOrCreateIdentity();

      console.log(`\nSending pairing request to OronBox at ${host}:${port}...`);
      console.log(`Computer Name:        ${identity.displayName}`);
      console.log(`Computer Fingerprint: ${identity.fingerprint}\n`);

      const initial = await requestLocalServer<PairingStatusResponse>(
        "/v1/auth/pairing-requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: identity.displayName,
            publicKey: identity.publicKeyBase64Url,
          }),
          host,
          port,
          skipAuth: true,
        },
      );

      if (initial.state === "granted") {
        console.log("Already paired and authorized by OronBox.");
        const config = loadConfig();
        config.defaultHost = host;
        config.defaultPort = port;
        saveConfig(config);
        return;
      }

      console.log("Please check your mobile phone and tap [Allow] on the authorization dialog...");

      const pairingId = initial.pairingId;
      const startTime = Date.now();
      const timeoutMs = 60 * 1000;

      while (Date.now() - startTime < timeoutMs) {
        await sleep(1500);

        const status = await requestLocalServer<PairingStatusResponse>(
          `/v1/auth/pairing-requests/${encodeURIComponent(pairingId)}`,
          {
            method: "GET",
            host,
            port,
            skipAuth: true,
          },
        );

        if (status.state === "granted") {
          console.log("\nSuccess: Authorization granted! Computer successfully paired.");
          const config = loadConfig();
          config.defaultHost = host;
          config.defaultPort = port;
          saveConfig(config);
          return;
        }

        if (status.state === "rejected") {
          fail("\nPairing request was rejected on the mobile client.");
        }

        process.stdout.write(".");
      }

      fail("\nPairing request timed out. Please retry.");
    });
}

import { Command } from "commander";

import { discoverOronBoxServices } from "../lib/discovery";
import { renderTable } from "../lib/table";

export function createDiscoverCommand(): Command {
  return new Command("discover")
    .description("Discover OronBox instances on the local network via mDNS")
    .option("-t, --timeout <seconds>", "Discovery scan timeout in seconds", "5")
    .action(async (opts: { timeout: string }, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { json?: boolean };
      const timeoutMs = (parseFloat(opts.timeout) || 5) * 1000;

      if (!globalOpts.json) {
        console.log(`Scanning local network for OronBox services via mDNS (${opts.timeout}s)...`);
      }

      const services = await discoverOronBoxServices(timeoutMs);

      if (globalOpts.json) {
        console.log(JSON.stringify(services, null, 2));
        return;
      }

      if (services.length === 0) {
        console.log("No OronBox instances discovered. Ensure Local Server is running on the same Wi-Fi.");
        return;
      }

      console.log(`\nDiscovered ${services.length} OronBox instance(s):\n`);
      console.log(
        renderTable(services, [
          { key: "name", header: "Device / Instance", width: 22 },
          { key: (s) => `${s.host}:${s.port}`, header: "Endpoint", width: 22 },
          { key: "platform", header: "Platform", width: 12 },
          { key: (s) => (s.fingerprint ? s.fingerprint.slice(0, 16) + "..." : "-"), header: "Fingerprint", width: 20 },
        ]),
      );
      console.log(`\nTo pair with an instance, run:\n  oronbox-cli pair ${services[0]!.host}:${services[0]!.port}`);
    });
}

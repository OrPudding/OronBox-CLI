import { Command } from "commander";

import { requestLocalServer } from "../lib/api";
import { resolveTarget } from "../lib/config";
import { renderTable } from "../lib/table";
import type { AuthorizedClient } from "../types/api";

export function createClientsCommand(): Command {
  const clients = new Command("clients").description("Manage computers authorized to access OronBox");

  // Subcommand: list
  clients
    .command("list")
    .description("List computers currently authorized on OronBox")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      // The server returns authorizedClients inside info or dedicated endpoint
      const res = await requestLocalServer<{ authorizedClients?: AuthorizedClient[] }>("/v1/info", {
        host,
        port,
      });

      const items = res.authorizedClients || [];

      if (globalOpts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        console.log("No authorized computers found.");
        return;
      }

      console.log(
        renderTable(items, [
          { key: "displayName", header: "Computer Name", width: 24 },
          { key: (c) => c.fingerprint.slice(0, 16) + "...", header: "Fingerprint", width: 20 },
          { key: (c) => c.authorizedAt.slice(0, 19).replace("T", " "), header: "Authorized At", width: 20 },
        ]),
      );
    });

  // Subcommand: revoke
  clients
    .command("revoke <fingerprint>")
    .description("Revoke authorization for a computer by fingerprint")
    .action(async (fingerprint: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Revoking authorization for client ${fingerprint}...`);
      await requestLocalServer(`/v1/auth/clients/${encodeURIComponent(fingerprint)}`, {
        method: "DELETE",
        host,
        port,
      });

      console.log(`Successfully revoked authorization for client ${fingerprint}.`);
    });

  return clients;
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Command } from "commander";

import { requestLocalServer, uploadInstallFile } from "../lib/api";
import { resolveTarget } from "../lib/config";
import { fail } from "../lib/errors";
import { renderTable } from "../lib/table";
import type { WatchfaceInfo } from "../types/api";

export function createWatchfacesCommand(): Command {
  const watchfaces = new Command("watchfaces").description("Manage and install wearable watchfaces");

  // Subcommand: list
  watchfaces
    .command("list")
    .description("List installed watchfaces on the active device")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const res = await requestLocalServer<{ items: WatchfaceInfo[] }>(
        "/v1/watchfaces",
        { host, port },
      );

      const items = res.items || [];

      if (globalOpts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        console.log("No watchfaces found on device.");
        return;
      }

      console.log(
        renderTable(items, [
          { key: "id", header: "ID", width: 14 },
          { key: "name", header: "Name", width: 24 },
          { key: (w) => (w.isCurrent ? "✓ Active" : ""), header: "Current", width: 10 },
        ]),
      );
    });

  // Subcommand: install
  watchfaces
    .command("install <filePath>")
    .description("Upload and install a watchface binary (.bin / .zip)")
    .action(async (filePath: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const absPath = resolve(process.cwd(), filePath);
      if (!existsSync(absPath)) {
        fail(`File not found: ${absPath}`);
      }

      console.log(`Uploading watchface ${filePath}...`);
      const task = await uploadInstallFile<{ taskId: string; status: string }>(absPath, {
        host,
        port,
        type: "watchface",
      });

      console.log(`Watchface install task created: ${task.taskId} (${task.status})`);
    });

  // Subcommand: set
  watchfaces
    .command("set <id>")
    .description("Set active watchface by ID")
    .action(async (id: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Setting active watchface to ${id}...`);
      await requestLocalServer(`/v1/watchfaces/${encodeURIComponent(id)}/set`, {
        method: "POST",
        host,
        port,
      });

      console.log(`Watchface ${id} set as active.`);
    });

  // Subcommand: remove
  watchfaces
    .command("remove <id>")
    .description("Remove a watchface by ID")
    .action(async (id: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Removing watchface ${id}...`);
      await requestLocalServer(`/v1/watchfaces/${encodeURIComponent(id)}`, {
        method: "DELETE",
        host,
        port,
      });

      console.log(`Watchface ${id} removed.`);
    });

  return watchfaces;
}

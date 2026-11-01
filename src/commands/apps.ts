import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Command } from "commander";

import { requestLocalServer, uploadInstallFile } from "../lib/api";
import { resolveTarget } from "../lib/config";
import { fail } from "../lib/errors";
import { renderTable } from "../lib/table";
import type { AppInfo, QueueTask } from "../types/api";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createAppsCommand(): Command {
  const apps = new Command("apps").description("Manage and install wearable applications");

  // Subcommand: list
  apps
    .command("list")
    .description("List installed applications on the active device")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const res = await requestLocalServer<{ items: AppInfo[] }>("/v1/apps", {
        host,
        port,
      });

      const items = res.items || [];

      if (globalOpts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        console.log("No applications found on device.");
        return;
      }

      console.log(
        renderTable(items, [
          { key: (a: any) => a.name || a.packageName, header: "App Name", width: 22 },
          { key: "packageName", header: "Package Name", width: 32 },
          { key: (a: any) => a.versionName || "-", header: "Version", width: 12 },
        ]),
      );
    });

  // Subcommand: install
  apps
    .command("install <filePath>")
    .description("Upload and install an application package (e.g. .rpk / .bin)")
    .option("--wait", "Wait for installation to finish with live progress", true)
    .option("--no-wait", "Return immediately after upload without waiting")
    .action(async (filePath: string, opts: { wait?: boolean }, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const absPath = resolve(process.cwd(), filePath);
      if (!existsSync(absPath)) {
        fail(`File not found: ${absPath}`);
      }

      console.log(`Uploading ${filePath} to OronBox...`);
      const task = await uploadInstallFile<{ taskId: string; status: string }>(absPath, {
        host,
        port,
        type: "app",
      });

      console.log(`Task created: ${task.taskId} (Status: ${task.status})`);

      if (!opts.wait) {
        return;
      }

      console.log("Waiting for installation to finish on device...");
      const startTime = Date.now();
      const timeoutMs = 180 * 1000;

      while (Date.now() - startTime < timeoutMs) {
        await sleep(1000);
        const taskStatus = await requestLocalServer<any>(
          `/v1/tasks/${encodeURIComponent(task.taskId)}`,
          { host, port },
        );

        const status = taskStatus.status || "unknown";
        const progressNum =
          typeof taskStatus.progress === "number"
            ? taskStatus.progress <= 1
              ? Math.round(taskStatus.progress * 100)
              : Math.round(taskStatus.progress)
            : undefined;
        const progressStr = progressNum !== undefined ? `${progressNum}%` : "";
        process.stdout.write(`\rProgress: ${status} ${progressStr}   `);

        if (status === "completed" || status === "success") {
          console.log(`\nSuccess: Application installed successfully.`);
          return;
        }

        if (status === "failed" || status === "error" || status === "cancelled") {
          const errMsg =
            taskStatus.result?.error?.message ||
            taskStatus.message ||
            taskStatus.error ||
            "Installation failed";
          fail(`\nInstallation failed: ${errMsg}`);
        }
      }

      fail("\nInstallation timed out.");
    });

  // Subcommand: uninstall
  apps
    .command("uninstall <packageName>")
    .description("Uninstall an application by package name")
    .action(async (packageName: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Uninstalling ${packageName}...`);
      await requestLocalServer(`/v1/apps/${encodeURIComponent(packageName)}`, {
        method: "DELETE",
        host,
        port,
      });

      console.log(`Successfully uninstalled ${packageName}.`);
    });

  // Subcommand: launch
  apps
    .command("launch <packageName> [page]")
    .description("Launch an application on the wearable screen, optionally navigating to a specific page route")
    .action(async (packageName: string, page: string | undefined, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Launching ${packageName}${page ? ` (page: ${page})` : ""}...`);
      await requestLocalServer("/v1/apps/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName, ...(page ? { page } : {}) }),
        host,
        port,
      });

      console.log(`Launched ${packageName}${page ? ` at ${page}` : ""}.`);
    });

  return apps;
}

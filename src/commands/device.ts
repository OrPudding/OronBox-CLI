import { resolve } from "node:path";

import { Command } from "commander";

import { downloadFile, requestLocalServer } from "../lib/api";
import { resolveTarget } from "../lib/config";
import { fail } from "../lib/errors";
import { renderTable } from "../lib/table";
import type { ConnectedDevice, DeviceLogOperation } from "../types/api";

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function createDeviceCommand(): Command {
  const device = new Command("device").description("Manage and inspect wearable devices");

  // Subcommand: list
  device
    .command("list")
    .description("List connected or paired wearable devices")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const res = await requestLocalServer<{ items: ConnectedDevice[] }>("/v1/devices", { host, port });
      const items = res.items || [];

      if (globalOpts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      if (items.length === 0) {
        console.log("No wearable devices found.");
        return;
      }

      console.log(
        renderTable(items, [
          { key: (d: any) => d.name || "Wearable", header: "Name", width: 22 },
          { key: (d: any) => d.deviceId || "-", header: "Address / Device ID", width: 20 },
          {
            key: (d: any) => d.connectionState || "disconnected",
            header: "Status",
            width: 14,
          },
          {
            key: (d: any) => d.kind || "-",
            header: "Codename",
            width: 12,
          },
          {
            key: (d: any) => (d.connectType || "BLE").toUpperCase(),
            header: "Transport",
            width: 12,
          },
        ]),
      );
    });

  // Subcommand: info
  device
    .command("info")
    .description("Show detailed hardware, storage and battery info for active device")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const raw = await requestLocalServer<any>("/v1/devices/info", {
        host,
        port,
      });

      if (globalOpts.json) {
        console.log(JSON.stringify(raw, null, 2));
        return;
      }

      const data = raw?.result ?? raw ?? {};
      const dev = data.device;
      if (!data || (!data.connected && !dev)) {
        fail("No wearable device is currently connected.");
      }

      const rows: { Field: string; Value: string }[] = [
        { Field: "Name", Value: dev?.name || "Wearable" },
        { Field: "MAC Address", Value: dev?.address || "-" },
        { Field: "Connection Type", Value: dev?.connectionType || "BLE" },
      ];

      if (data.system?.model) {
        rows.push({ Field: "Model", Value: String(data.system.model) });
      }
      if (data.system?.firmwareVersion) {
        rows.push({ Field: "Firmware", Value: String(data.system.firmwareVersion) });
      }

      rows.push(
        {
          Field: "Protocol State",
          Value: data.protocolState || (data.connected ? "ready" : "disconnected"),
        },
        {
          Field: "Battery Level",
          Value: typeof data.battery === "number" ? `${data.battery}%` : "unknown",
        },
        {
          Field: "Storage Total",
          Value: formatBytes(data.storage?.totalBytes),
        },
        {
          Field: "Storage Free",
          Value: formatBytes(data.storage?.freeBytes),
        },
      );

      console.log(
        renderTable(rows, [
          { key: "Field", header: "Property", width: 20 },
          { key: "Value", header: "Details", width: 35 },
        ]),
      );
    });

  // Subcommand: connect
  device
    .command("connect <deviceId>")
    .description("Connect to a wearable device by Bluetooth MAC address (or device ID)")
    .action(async (deviceId: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Connecting to device ${deviceId}...`);
      const res = await requestLocalServer<{ deviceId: string; connectionState: string }>(
        "/v1/devices/connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
          host,
          port,
        },
      );

      if (globalOpts.json) {
        console.log(JSON.stringify(res, null, 2));
        return;
      }

      console.log(`Successfully connected to ${res.deviceId}`);
    });

  // Subcommand: disconnect
  device
    .command("disconnect")
    .description("Disconnect current wearable device")
    .action(async (_opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      await requestLocalServer("/v1/devices/disconnect", {
        method: "POST",
        host,
        port,
      });

      console.log("Device disconnected.");
    });

  // Subcommand: logs
  const logs = new Command("logs").description("Export and pull diagnostic log archive from wearable device");

  logs
    .command("pull [outputFile]")
    .description("Pull diagnostic log archive (.tar.gz) from wearable device with live progress")
    .option("-d, --device <addr>", "Target wearable MAC address or device ID")
    .action(
      async (
        outputFile: string | undefined,
        opts: { device?: string },
        cmd: Command,
      ) => {
        const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
        const { host, port } = resolveTarget(globalOpts);

        console.log("Initiating device log pull operation...");
        const initRes = await requestLocalServer<DeviceLogOperation>("/v1/device-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts.device ? { deviceId: opts.device } : {}),
          host,
          port,
        });

        const opId = initRes.id;
        console.log(`Log operation started: ${opId} (Stage: ${initRes.stage || "preparing"})`);

        let cancelled = false;
        const sigintHandler = async () => {
          if (cancelled) return;
          cancelled = true;
          process.stdout.write("\nInterrupt received. Cancelling log export...\n");
          try {
            await requestLocalServer(`/v1/device-logs/${encodeURIComponent(opId)}/cancel`, {
              method: "POST",
              host,
              port,
            });
            console.log("Log operation cancelled.");
          } catch (e: any) {
            console.log(`Failed to cancel operation: ${e?.message || e}`);
          }
          process.exit(130);
        };

        process.on("SIGINT", sigintHandler);

        try {
          const timeoutMs = 600 * 1000;
          const startTime = Date.now();

          while (Date.now() - startTime < timeoutMs) {
            await new Promise((r) => setTimeout(r, 800));

            const op = await requestLocalServer<DeviceLogOperation>(
              `/v1/device-logs/${encodeURIComponent(opId)}`,
              { host, port },
            );

            if (op.state === "completed") {
              process.stdout.write("\nTransfer completed. Downloading log archive from OronBox...\n");
              const outPath = outputFile || op.fileName || `device-logs-${opId}.tar.gz`;
              const targetPath = resolve(process.cwd(), outPath);
              const downloadUrl = op.archiveUrl || `/v1/device-logs/${encodeURIComponent(opId)}/archive`;
              const bytes = await downloadFile(downloadUrl, targetPath, { host, port });
              console.log(`Saved log archive to ${targetPath} (${formatBytes(bytes)})`);
              return;
            }

            if (op.state === "failed") {
              process.stdout.write("\n");
              fail(`Log pull failed: ${op.message || op.error?.message || "unknown error"}`);
            }

            if (op.state === "cancelled") {
              process.stdout.write("\n");
              console.log("Log pull operation was cancelled.");
              return;
            }

            const stage = op.stage || "running";
            const partInfo =
              op.currentPart !== undefined && op.totalParts !== undefined
                ? ` Part ${op.currentPart}/${op.totalParts}`
                : "";
            const byteInfo =
              op.bytesDone !== undefined && op.bytesTotal !== undefined && op.bytesTotal > 0
                ? ` (${formatBytes(op.bytesDone)} / ${formatBytes(op.bytesTotal)})`
                : op.bytesDone !== undefined
                  ? ` (${formatBytes(op.bytesDone)})`
                  : "";
            const pct =
              op.progress !== undefined
                ? ` ${Math.round(op.progress <= 1 ? op.progress * 100 : op.progress)}%`
                : "";

            process.stdout.write(`\r[${stage}]${partInfo}${byteInfo}${pct}   `);
          }

          process.stdout.write("\n");
          fail("Log pull operation timed out.");
        } finally {
          process.removeListener("SIGINT", sigintHandler);
        }
      },
    );

  logs
    .command("cancel <operationId>")
    .description("Cancel an active log export operation")
    .action(async (operationId: string, _opts: unknown, cmd: Command) => {
      const globalOpts = cmd.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      console.log(`Cancelling log export operation ${operationId}...`);
      await requestLocalServer(`/v1/device-logs/${encodeURIComponent(operationId)}/cancel`, {
        method: "POST",
        host,
        port,
      });
      console.log(`Operation ${operationId} cancelled.`);
    });

  device.addCommand(logs);

  return device;
}

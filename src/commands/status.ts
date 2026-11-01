import { Command } from "commander";

import { requestLocalServer } from "../lib/api";
import { resolveTarget } from "../lib/config";
import { renderTable } from "../lib/table";
import type { ConnectedDevice, LocalServerInfo } from "../types/api";

export function createStatusCommand(): Command {
  return new Command("status")
    .description("Query OronBox server status and active device summary")
    .action(async (_options: unknown, command: Command) => {
      const globalOpts = command.optsWithGlobals() as { host?: string; port?: string; json?: boolean };
      const { host, port } = resolveTarget(globalOpts);

      const serverInfo = await requestLocalServer<LocalServerInfo>("/v1/info", {
        host,
        port,
        skipAuth: true,
      });

      let activeDevice: ConnectedDevice | null = null;
      try {
        activeDevice = await requestLocalServer<ConnectedDevice>("/v1/devices/current", {
          host,
          port,
        });
      } catch {
        // May not be connected to any device
      }

      if (globalOpts.json) {
        console.log(
          JSON.stringify(
            {
              server: serverInfo,
              device: activeDevice,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`\n=== OronBox Server Status (${host}:${port}) ===`);
      console.log(`Server Name:        ${serverInfo.displayName}`);
      console.log(`Platform:           ${serverInfo.platform}`);
      console.log(`Protocol Version:   ${serverInfo.protocolVersion}`);
      console.log(`Server Fingerprint: ${serverInfo.fingerprint}\n`);

      const devData = (activeDevice as any)?.result ?? activeDevice ?? {};
      const dev = devData.device;

      if (!devData.connected || !dev) {
        console.log("No wearable device is currently connected.");
        return;
      }

      console.log("=== Active Wearable Device ===");
      const deviceRows = [
        { Field: "Device Name", Value: dev.name || "Wearable" },
        { Field: "Bluetooth Address", Value: dev.address || "-" },
        { Field: "Connect Type", Value: dev.connectionType || dev.connectType || "BLE" },
        {
          Field: "Battery",
          Value:
            typeof devData.battery === "number"
              ? `${devData.battery}%`
              : "unknown",
        },
      ];

      console.log(
        renderTable(deviceRows, [
          { key: "Field", header: "Property", width: 20 },
          { key: "Value", header: "Value", width: 30 },
        ]),
      );
    });
}

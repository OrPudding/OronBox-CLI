import { Command } from "commander";

import { createAppsCommand } from "./commands/apps";
import { createClientsCommand } from "./commands/clients";
import { createDeviceCommand } from "./commands/device";
import { createDiscoverCommand } from "./commands/discover";
import { createPairCommand } from "./commands/pair";
import { createStatusCommand } from "./commands/status";
import { createWatchfacesCommand } from "./commands/watchfaces";
import { fail } from "./lib/errors";
import { getPackageVersion } from "./package-info";

const program = new Command();

program
  .name("oronbox-cli")
  .description("Official command-line tool for OronBox wearable management")
  .version(getPackageVersion(), "-v, --version", "display the current version")
  .option("-H, --host <host>", "OronBox server host address (default: 127.0.0.1)")
  .option("-P, --port <port>", "OronBox server port (default: 10517)")
  .option("--json", "output in structured JSON format")
  .addCommand(createDiscoverCommand())
  .addCommand(createPairCommand())
  .addCommand(createStatusCommand())
  .addCommand(createDeviceCommand())
  .addCommand(createAppsCommand())
  .addCommand(createWatchfacesCommand())
  .addCommand(createClientsCommand());

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});

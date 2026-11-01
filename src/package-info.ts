import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = resolve(__dirname, "../package.json");

export function getPackageVersion(): string {
  try {
    const content = readFileSync(packageJsonPath, "utf-8");
    const json = JSON.parse(content) as { version?: string };
    return json.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}

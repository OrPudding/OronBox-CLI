import { Bonjour, type Service } from "bonjour-service";

export interface DiscoveredService {
  name: string;
  host: string;
  port: number;
  fingerprint: string;
  platform: string;
  serverId?: string;
}

export function discoverOronBoxServices(timeoutMs = 5000): Promise<DiscoveredService[]> {
  return new Promise((resolve) => {
    const bonjour = new Bonjour();
    const discovered: DiscoveredService[] = [];
    const seen = new Set<string>();

    const browser = bonjour.find({ type: "oronbox-api" }, (service: Service) => {
      // Find suitable IPv4 address
      const ipv4 = service.addresses?.find((addr) => /^\d+\.\d+\.\d+\.\d+$/.test(addr));
      const host = ipv4 || service.host || service.referer?.address || "127.0.0.1";
      const port = service.port || 10517;

      const txt = (service.txt || {}) as Record<string, string>;
      const fingerprint = txt.fp || "";
      const platform = txt.platform || "unknown";
      const displayName = txt.name || service.name;
      const serverId = txt.id;

      const key = `${host}:${port}`;
      if (!seen.has(key)) {
        seen.add(key);
        discovered.push({
          name: displayName,
          host,
          port,
          fingerprint,
          platform,
          serverId,
        });
      }
    });

    setTimeout(() => {
      try {
        browser.stop();
        bonjour.destroy();
      } catch {
        // ignore cleanup errors
      }
      resolve(discovered);
    }, timeoutMs);
  });
}

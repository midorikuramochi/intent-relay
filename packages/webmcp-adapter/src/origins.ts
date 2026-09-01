export interface OriginConfig {
  relay: string;
  gather: string;
  orbit: string;
}

const ORIGIN_VARIABLES = [
  ["relay", "Relay", "VITE_RELAY_ORIGIN"],
  ["gather", "Gather", "VITE_GATHER_ORIGIN"],
  ["orbit", "Orbit", "VITE_ORBIT_ORIGIN"],
] as const;

function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function parseExactOrigin(label: string, raw: string | undefined): string {
  const fail = (detail: string): never => {
    throw new Error(`Exact ${label} origin required: ${detail}`);
  };
  if (raw === undefined || raw.trim() === "") {
    return fail("the variable is missing");
  }
  if (raw.includes("*")) {
    return fail("wildcard origins are not allowed");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return fail(`"${raw}" is not a valid URL`);
  }
  if (url.origin !== raw) {
    return fail(`"${raw}" must be exactly an origin with no path, query, or trailing slash`);
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocalhost(url.hostname))) {
    return fail(`"${raw}" must use https, or http only for localhost development`);
  }
  return url.origin;
}

export function readOriginConfig(env: Record<string, string | undefined>): OriginConfig {
  const entries = ORIGIN_VARIABLES.map(
    ([key, label, variable]) => [key, parseExactOrigin(label, env[variable])] as const,
  );
  const origins = entries.map(([, origin]) => origin);
  if (new Set(origins).size !== origins.length) {
    throw new Error("Provider origins must be distinct");
  }
  return Object.fromEntries(entries) as unknown as OriginConfig;
}

/**
 * Production build guard: a build must never ship with the test adapter
 * variable or a partial/invalid origin configuration. A build with NO origin
 * variables at all is permitted (a local or CI artifact); the application
 * startup guard then fails visibly at runtime instead of shipping a
 * misleading partially-working deployment.
 */
export function assertProductionBuildEnv(env: Record<string, string | undefined>): void {
  if (env.VITE_E2E_MODE !== undefined && env.VITE_E2E_MODE !== "") {
    throw new Error("VITE_E2E_MODE must not be set for a production build");
  }
  const anyOriginSet = [env.VITE_RELAY_ORIGIN, env.VITE_GATHER_ORIGIN, env.VITE_ORBIT_ORIGIN].some(
    (value) => value !== undefined && value !== "",
  );
  if (!anyOriginSet) {
    return;
  }
  readOriginConfig(env);
}

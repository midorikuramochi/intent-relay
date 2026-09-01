import { readOriginConfig, type OriginConfig } from "@intent-relay/webmcp";

const DEV_DEFAULTS: Record<string, string> = import.meta.env.DEV
  ? {
      VITE_RELAY_ORIGIN: "http://localhost:4173",
      VITE_GATHER_ORIGIN: "http://localhost:4174",
      VITE_ORBIT_ORIGIN: "http://localhost:4175",
    }
  : {};

export function resolveOrigins(env: ImportMetaEnv): OriginConfig {
  const withDefaults = (name: keyof ImportMetaEnv & string): string | undefined =>
    env[name] ?? (env.DEV ? DEV_DEFAULTS[name] : undefined);
  return readOriginConfig({
    VITE_RELAY_ORIGIN: withDefaults("VITE_RELAY_ORIGIN"),
    VITE_GATHER_ORIGIN: withDefaults("VITE_GATHER_ORIGIN"),
    VITE_ORBIT_ORIGIN: withDefaults("VITE_ORBIT_ORIGIN"),
  });
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAY_ORIGIN?: string;
  readonly VITE_GATHER_ORIGIN?: string;
  readonly VITE_ORBIT_ORIGIN?: string;
  readonly VITE_E2E_MODE?: string;
}

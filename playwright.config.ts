import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4599",
  },
  webServer: {
    // Dedicated E2E port with strictPort and no server reuse, so the suite
    // can never attach to a normal development-mode Relay on 4173.
    command: "npm run dev -w @intent-relay/relay -- --mode test --port 4599 --strictPort",
    url: "http://localhost:4599",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});

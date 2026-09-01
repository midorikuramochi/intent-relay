import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { assertProductionBuildEnv } from "../../packages/webmcp-adapter/src/origins";
import { injectOriginTrialMeta } from "../../packages/webmcp-adapter/src/originTrialMeta";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (command === "build" && mode !== "test") {
    assertProductionBuildEnv(env);
  }
  return {
    plugins: [
      react(),
      {
        name: "webmcp-origin-trial-meta",
        transformIndexHtml: (html: string) =>
          injectOriginTrialMeta(html, env.VITE_WEBMCP_ORIGIN_TRIAL_TOKEN),
      },
    ],
    server: { port: 4175, strictPort: true },
    preview: { port: 4175, strictPort: true },
  };
});

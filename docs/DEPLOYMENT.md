# Intent Relay — Deployment

The prototype deploys as **three static sites on three HTTPS origins**, all built
from this one repository. The hosting provider is not an architectural
dependency; any static host that can set response headers works.

## 1. Create three static-site projects

From the same repository, create one project per application:

| Project | Build command | Output directory |
| --- | --- | --- |
| Relay | `npm ci && npm run build -w @intent-relay/relay` | `apps/relay/dist` |
| Gather | `npm ci && npm run build -w @intent-relay/gather` | `apps/gather/dist` |
| Orbit | `npm ci && npm run build -w @intent-relay/orbit` | `apps/orbit/dist` |

### Challenge deployment (Cloudflare Pages Direct Upload)

The competition deployment uses three Cloudflare Pages projects created with
`npx wrangler@latest pages project create <name>
--production-branch=<production-branch>`:

| Project | Production origin |
| --- | --- |
| `intent-relay-workbench` | `https://intent-relay-workbench.pages.dev` |
| `intent-relay-gather` | `https://intent-relay-gather.pages.dev` |
| `intent-relay-orbit` | `https://intent-relay-orbit.pages.dev` |

Each app is deployed with
`npx wrangler@latest pages deploy apps/<app>/dist --project-name=<project>
--branch=<production-branch>` (the `--branch` value must match the Pages
project's configured production branch) after building with the
environment described below.

## 2. Configure exact origins in every build

Set the same three variables in **all three** projects (see `.env.example`):

```dotenv
VITE_RELAY_ORIGIN=https://relay.example.com
VITE_GATHER_ORIGIN=https://gather.example.com
VITE_ORBIT_ORIGIN=https://orbit.example.com
```

Rules (enforced at build time by `assertProductionBuildEnv` and again at
startup by `readOriginConfig`):

- exact origins only — no path, query, or trailing slash;
- `https:` required (plain `http:` is allowed only for localhost development);
- no wildcard characters anywhere;
- the three origins must be distinct;
- setting **some but not all** of the variables fails the build;
- `VITE_E2E_MODE` must never be set for a production build (the build fails).

A build with **none** of the origin variables set is permitted so the
repository's clean-checkout command gate can run without deployment
configuration; such an artifact refuses to operate at startup with a visible
origin-configuration error instead of shipping a misleading partially-working
deployment.

### WebMCP Origin Trial token (per app)

Until WebMCP ships by default, each deployed origin needs a first-party Chrome
Origin Trial token for the **WebMCP** trial (registered per exact origin — no
subdomain matching, no third-party matching, one token per origin). Provide it
at build time:

```dotenv
VITE_WEBMCP_ORIGIN_TRIAL_TOKEN=<that app's own token>
```

When set, the build injects a single
`<meta http-equiv="origin-trial" content="…">` tag into that app's
`index.html` (`injectOriginTrialMeta` in
`packages/webmcp-adapter/src/originTrialMeta.ts`). When unset (local dev,
tests, the clean-checkout gate) nothing is injected. Token values are
deployment configuration: they live outside the repository and are never
committed; never reuse one origin's token for another origin.

## 3. Deployment order

1. Deploy **Gather** and **Orbit** first to obtain their final origins.
2. Deploy **Relay** with those origins configured.
3. Once all three final URLs are known, set the final values in all three
   projects and **rebuild all three** — every app embeds the exact origin
   allowlist at build time.

## 4. Response headers

Configure the headers described in [SECURITY.md](SECURITY.md) on each host,
including Relay's `frame-src` allowlist for the two provider origins and the
providers' `frame-ancestors` allowlist for the Relay origin.

For the Cloudflare Pages deployment these are committed as
`apps/<app>/public/_headers` with the exact production origins; Vite copies
each file into that app's `dist/`, and Cloudflare Pages applies it to every
response. The files contain origins only — never tokens or credentials.

## 5. Post-deploy verification

Open `https://<relay-origin>/workbench` in a WebMCP-capable browser and complete
the manual record in [REAL_WEBMCP_CHECKLIST.md](REAL_WEBMCP_CHECKLIST.md).
Confirm both provider panels show `Connected` with their exact origins, and that
resetting the demo reloads both frames under a fresh session ID.

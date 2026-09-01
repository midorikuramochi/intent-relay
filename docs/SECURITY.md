# Intent Relay — Security Notes

This is a prototype. The measures below are what the prototype actually
implements or requires from its hosting; **no formal security certification is
claimed**.

## Data handling

- No user accounts, no analytics SDK, no remote database, no uploaded personal
  data, and no secret API keys. All state is sample data in origin-local
  browser storage, namespaced by the Relay-owned `demoSessionId`.
- Cross-origin communication happens only through explicitly permitted WebMCP
  tools. There is no `postMessage` channel, DOM scraping, or cross-origin
  storage access.

## In-application boundaries

- Exact origin allowlists come from environment configuration and are validated
  at build time (`assertProductionBuildEnv`) and at startup
  (`readOriginConfig`): wildcards, paths, duplicates, and non-localhost `http:`
  are rejected.
- Every cross-origin tool result is validated at the trust boundary: JSON
  envelope schema with a closed error-code set, per-tool response schemas, and
  a demo-session identity check on every response that carries one.
- Provider tools are registered with `exposedTo: [RELAY_ORIGIN]` only; Relay
  discovers with `getTools({ fromOrigins })` and defensively re-filters by
  origin. Discovered browser tool objects are sanitized before entering UI
  state; original platform handles are kept separately for execution only.
- All provider and agent strings are rendered as text (React text nodes).
  `dangerouslySetInnerHTML` is not used anywhere.
- No WebMCP tool can publish an event, change pricing, or navigate externally.
  Publication is a human-only control inside Orbit.
- The E2E test adapter is excluded from production bundles (verified by
  inspecting `dist/`), throws if evaluated in a production build, and the build
  fails if `VITE_E2E_MODE` is set.

## Required response headers (hosting configuration)

Configure on each static host:

| Header | Relay | Gather / Orbit |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'; frame-src https://<gather-origin> https://<orbit-origin>; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'` | `default-src 'self'; frame-ancestors https://<relay-origin>; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'` |
| `X-Content-Type-Options` | `nosniff` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` |

Notes:

- Relay's `frame-src` must list **exactly** the two deployed provider origins.
- The providers' `frame-ancestors` must list **exactly** the deployed Relay
  origin, so they cannot be embedded elsewhere.
- Substitute the real deployed origins for the placeholders; wildcard values
  must not be used.

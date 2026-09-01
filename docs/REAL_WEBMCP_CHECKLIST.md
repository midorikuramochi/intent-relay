# Intent Relay — Real WebMCP Verification Checklist

Two very different kinds of evidence exist for this prototype. This document
keeps them separate so neither is mistaken for the other.

## A. What the automated E2E suite does — and does not — prove

`npm run test:e2e` (Playwright) drives the **production Relay orchestrator,
reducer, and five agent tools unchanged**, together with the **real Gather and
Orbit domain modules and provider tool registrations**, over an in-page
`FakeModelContext` transport (`apps/relay/src/testing/createE2EPort.ts`,
active only in `--mode test` behind `?e2e=1`, with a visible
`E2E TEST ADAPTER ACTIVE` banner).

It deterministically proves product behavior: contract validation, human-only
approval, the canonical 5/2/1/1 mapping statuses, Human Queue gating, draft
preparation, review, and reset. It is **not evidence of browser WebMCP
semantics** — no real cross-origin discovery, permission policy, or platform
tool objects are involved.

## B. Real Chrome WebMCP verification (performed, accepted)

Real-browser evidence was obtained in the accepted runtime audit
(2026-08-30, corrective commit `55a221f`; the full audit report lives in local
review evidence outside this repository), driven over CDP against the actual `document.modelContext`.

### Environment

| Item | Value |
| --- | --- |
| Browser | Google Chrome 151.0.7922.175 (macOS 26.5.2) |
| Enablement | `--enable-features=WebMCPTesting --enable-experimental-web-platform-features` (isolated profile; WebMCP is otherwise in origin trial) |
| API | `document.modelContext` with `registerTool` / `getTools` / `executeTool` / `addEventListener` / `removeEventListener` |
| Origins | `http://localhost:4173` (Relay), `:4174` (Gather), `:4175` (Orbit), via `npm run dev` |

### Provider records

```text
Origin: http://localhost:4174 (Gather)
Discovered tool names: read_event_state, read_setup_trace (exactly 2)
Relay exposure confirmed: yes — discovered from the Relay page via
  getTools({ fromOrigins }); exposedTo verified in reverse: the Orbit frame
  requesting Gather's origin sees 0 Gather tools
Unknown-origin access rejected: yes — fromOrigins of an unknown origin yields
  no provider tools
Cancellation checked: yes — pre-aborted executeTool rejects with
  AbortError ("Execution cancelled."), converted to TOOL_CANCELLED
Visible state updated before success: yes — trace/status panels reflect state
  before tool success is returned
Verified by: real-Chrome runtime audit, accepted by independent review
Verified at: 2026-08-30

Origin: http://localhost:4175 (Orbit)
Discovered tool names: describe_event_capabilities, prepare_event_draft,
  read_event_draft (exactly 3)
Relay exposure confirmed: yes (as above)
Unknown-origin access rejected: yes
Cancellation checked: yes (as above)
Visible state updated before success: yes — the Orbit listing draft is visible
  before prepare_target_draft reports success
Verified by: real-Chrome runtime audit, accepted by independent review
Verified at: 2026-08-30
```

### Verified end-to-end in the real browser

- iframe `allow="tools"` embedding, cross-origin discovery, and execution;
- producer callbacks receive **parsed argument objects**; the consumer boundary
  is `executeTool(tool, "<json string>")` returning string envelopes;
- Relay exposes exactly its five agent tools at the appropriate workflow state;
  no publish/activate tool ever appears (final inventory: 5 + 2 + 3);
- the complete golden journey: demonstration → inspection → draft contract →
  human approval → compatibility {direct 5, transformed 2, unsupported 1,
  needs_decision 1} → human decision → Orbit draft → review
  `waiting_for_human` → human-only Publish button in Orbit;
- toolchange rediscovery after a provider frame reload;
- session rotation via Reset demo with clean provider state;
- failure boundaries fail closed (blank provider frame → structured error, no
  false success; recovery after the frame returns);
- zero console errors and zero unhandled promise rejections after corrective
  commit `55a221f`.

### Real-browser divergences from the test transport (documented facts)

1. Real `DiscoveredTool` objects are platform objects carrying extra
   properties, including a **cross-origin `WindowProxy`** (`window`), plus
   `title` and `annotations`. The UI inventory therefore stores sanitized
   metadata only; original handles stay in a separate map because
   `executeTool` requires the original object.
2. Discovered `inputSchema` is a **serialized JSON string** in this Chrome
   build.
3. `getTools({ fromOrigins })` always includes the calling page's own tools;
   Relay's discovery re-filters by origin.
4. A pre-aborted `executeTool` **rejects** with `AbortError` rather than
   returning an envelope.
5. On iframe teardown, `toolchange` does not fire immediately and dead tools
   can remain listed briefly; execution during that window throws a transient
   error, which Relay maps to a structured failure (fail closed).

Screenshots and raw outputs are kept as local review evidence and are not
tracked in this repository.

## C. Post-deployment manual record (to complete per deployment)

After each real deployment, repeat section B's provider records against the
deployed HTTPS origins in a WebMCP-capable browser and record the results here
(origin, discovered tool names, exposure, unknown-origin rejection,
cancellation, visible-state-before-success, verified by / at), together with
screenshots for the five demo fallback stages listed in
`docs/DEMO_SCRIPT.md`.

### Deployment record — 2026-09-01 (visual-refinement build, Cloudflare Pages)

| Item | Value |
| --- | --- |
| Source commit | `1646af3` (accepted visual-refinement build) |
| Browser | Google Chrome 152.0.7977.65 (macOS), **no feature flags** — WebMCP enabled by the first-party Origin Trial tokens alone |
| Origins | unchanged: `https://intent-relay-workbench.pages.dev`, `https://intent-relay-gather.pages.dev`, `https://intent-relay-orbit.pages.dev` |
| Headers | `_headers` re-verified live on all three origins (documented CSP, nosniff, Referrer-Policy; no X-Frame-Options) |
| Tokens | same three per-origin WebMCP tokens as the previous record (re-validated: exact origin, no subdomain/third-party matching, expiry 2026-11-17); deployed meta tags match the local token files by SHA-256 fingerprint |

Provider records re-verified end-to-end on the deployed build (same checks as the
previous record, all passing): Gather exposes exactly `read_event_state` +
`read_setup_trace`; Orbit exactly `describe_event_capabilities` +
`prepare_event_draft` + `read_event_draft`; golden journey {direct 5,
transformed 2, unsupported 1, needs_decision 1} → human decision →
`waiting_for_human`; no publish/activate tool; pre-flight radio state has no
auto-selection; reset rotates the session, reconnects both providers, and keeps
the selected locale; EN and JA locales produce an identical tool inventory;
zero console errors and zero page exceptions. Screenshots from this
verification are published under `docs/assets/` (transfer, contract review,
final review); the full capture set is local review evidence.

### Deployment record — 2026-09-01 (Cloudflare Pages)

| Item | Value |
| --- | --- |
| Browser | Google Chrome 152.0.7977.65 (macOS), **no feature flags** — WebMCP enabled purely by the first-party Origin Trial tokens (feature `WebMCP`, expiry 2026-11-17, one token per exact origin, no subdomain or third-party matching; token values are deployment configuration kept outside the repository) |
| Origins | `https://intent-relay-workbench.pages.dev` (Relay), `https://intent-relay-gather.pages.dev` (Gather), `https://intent-relay-orbit.pages.dev` (Orbit) |
| Headers | `_headers` verified live on all three origins: documented CSP (Relay `frame-src` = the two provider origins; providers `frame-ancestors` = the Relay origin), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` |

```text
Origin: https://intent-relay-gather.pages.dev (Gather)
Discovered tool names: read_event_state, read_setup_trace (exactly 2)
Relay exposure confirmed: yes — discovered from the deployed Relay page via
  getTools({ fromOrigins }); reverse check: the Orbit frame requesting
  Gather's origin sees 0 Gather tools
Unknown-origin access rejected: yes — fromOrigins of https://example.com
  yields 0 tools
Cancellation checked: yes — pre-aborted executeTool rejects with AbortError
Visible state updated before success: yes — trace/status panels reflect state
  before tool success is returned
Verified by: real-Chrome deployed-origin smoke
Verified at: 2026-09-01

Origin: https://intent-relay-orbit.pages.dev (Orbit)
Discovered tool names: describe_event_capabilities, prepare_event_draft,
  read_event_draft (exactly 3)
Relay exposure confirmed: yes (as above)
Unknown-origin access rejected: yes
Cancellation checked: yes (as above)
Visible state updated before success: yes — the Orbit listing draft is visible
  before prepare_target_draft reports success
Verified by: real-Chrome deployed-origin smoke
Verified at: 2026-09-01
```

Verified end-to-end on the deployed origins: both providers `Connected` with
their exact HTTPS origins; the complete golden journey (demonstration in the
real Gather frame → inspect → draft contract → human approval → compatibility
{direct 5, transformed 2, unsupported 1, needs_decision 1} → human decision →
Orbit draft → review `waiting_for_human`); no publish/activate tool anywhere;
Reset demo rotates the session and reconnects both providers; zero console
errors and zero page exceptions. Screenshots for the five demo stages are
kept as local review evidence and are not tracked in this repository.

# Intent Relay — Product Specification

## 1. Product thesis

Intent Relay is a prototype for portable human intent across WebMCP-enabled websites.

> Your workflow should belong to you—not the website.

The product lets a person demonstrate how they configure work in one web service, review the inferred intent as a structured contract, and carry that contract to a different service with different tools and capabilities.

Intent Relay does not replay clicks. It translates goals, constraints, preferences, conditional rules, and approval boundaries. When the destination cannot preserve the source intent, it exposes the mismatch and asks the person to decide.

The event-management domain is the working proof case, not the product category.

## 2. Problem

Users repeatedly express the same intent through provider-specific forms. Conventional form copying, RPA, and browser automation preserve field values or UI actions, but they do not reliably preserve why a choice was made, whether it was a hard constraint, or which actions require human approval.

The result is brittle automation:

- renamed fields break scripts;
- one provider may not support an equivalent capability;
- incidental choices become permanent defaults;
- unsupported rules disappear silently;
- publication or pricing changes may be executed without an explicit boundary.

## 3. Human-agent division of responsibility

### Human

- demonstrates the original workflow;
- confirms which observed choices represent reusable intent;
- approves the Intent Contract;
- resolves semantic gaps;
- approves the destination draft;
- publishes the event.

### Agent

- reads the semantic trace through WebMCP;
- proposes a structured Intent Contract with provenance;
- inspects the destination provider's exposed capabilities;
- prepares a destination draft from supported and human-resolved mappings;
- reports what was preserved, transformed, excluded, or left unresolved.

### Websites

- expose precise, structured capabilities through WebMCP;
- validate all inputs;
- return explicit results and errors;
- update visible state after tool execution.

## 4. Prototype scope

The prototype contains three separately deployed web applications:

1. **Intent Relay Workbench** — the shared human-agent workspace.
2. **Gather** — a fictional source event provider.
3. **Orbit Events** — a fictional destination event provider.

The providers have different interfaces, field names, tool schemas, and feature sets. The Workbench embeds both providers as secure cross-origin iframes, discovers their explicitly exposed WebMCP tools, and provides five stable tools to the external agent.

The prototype does not claim universal compatibility. It proves the concept across two controlled providers and defines adapter boundaries for future domains.

## 5. Core user journey

### Step 1: Demonstrate

The user configures a sample student event in Gather. Gather records semantic domain commands rather than pointer coordinates or CSS selectors.

### Step 2: Verify Contract

The agent reads the event state and semantic trace through Intent Relay. It proposes an Intent Contract. Each inferred rule must cite at least one trace action. The user edits or approves the contract in the Workbench.

An approved contract is immutable during a transfer. Editing it creates a new draft revision.

### Step 3: Transfer

The agent asks Intent Relay to inspect Orbit's capabilities. The deterministic mapping engine classifies every contract entry as:

- `direct`;
- `transformed`;
- `unsupported`; or
- `needs_decision`.

No rule may disappear silently.

### Step 4: Review

The user resolves required decisions. The agent prepares an Orbit draft using the approved contract, the reviewed mapping, and the user's resolutions. The Workbench displays a semantic transfer review. Publishing remains a manual Orbit action.

## 6. Demonstration fixture

The preloaded demonstration is a fictional event named **Student AI Workshop**.

Transferable context and rules:

| Semantic key | Source value | Rule type |
|---|---|---|
| `event.title` | Student AI Workshop | context |
| `event.schedule` | 2026-09-18 18:00–20:00 JST | context |
| `registration.capacity.maximum` | 100 people | constraint |
| `ticketing.mode` | free | constraint |
| `notifications.reminder.offset` | 24 hours | preference |
| `accessibility.attendee_note` | Explain that the venue entrance has steps | conditional rule |
| `registration.overflow.mode` | native waitlist | preference |
| `registration.custom_question.dietary_restrictions` | optional | preference |
| `event.publish` | human confirmation required | approval boundary |

Expected Orbit compatibility:

- direct: title, schedule, capacity, free ticketing, publication boundary;
- transformed: 24 hours to 1 day, event accessibility note to venue note;
- unsupported: dietary-restrictions registration question;
- needs decision: native waitlist is unavailable; choose registration closure or an external overflow form.

The UI must calculate and display actual counts from the mapping result. It must not hard-code a success summary.

## 7. Intent Contract model

The Core owns a domain-neutral contract envelope. A vertical adapter owns semantic vocabulary and value validation.

```ts
type RuleKind =
  | "context"
  | "constraint"
  | "preference"
  | "conditional"
  | "approval_boundary";

type HumanStatus = "proposed" | "approved" | "excluded";

interface IntentRule {
  id: string;
  kind: RuleKind;
  semanticKey: string;
  value: unknown;
  unit?: string;
  enforcement: "must" | "prefer" | "inform" | "human_required";
  rationale?: string;
  provenance: string[];
  humanStatus: HumanStatus;
  condition?: {
    semanticKey: string;
    operator: "equals" | "not_equals" | "exists";
    value?: unknown;
  };
}

interface IntentContract {
  version: "0.1";
  id: string;
  revision: number;
  domain: "event";
  status: "draft" | "approved";
  source: {
    provider: "gather";
    traceId: string;
    capturedAt: string;
  };
  rules: IntentRule[];
  approvedAt?: string;
}
```

Contract invariants:

- every proposed or approved rule has at least one valid provenance action;
- only a human UI action may change `status` to `approved`;
- only approved rules enter compatibility mapping;
- an approved contract cannot be mutated in place;
- an approval boundary cannot be downgraded by a destination adapter;
- the client displays sample data as sample data.

## 8. Compatibility result

```ts
type MappingStatus =
  | "direct"
  | "transformed"
  | "unsupported"
  | "needs_decision";

interface MappingEntry {
  ruleId: string;
  status: MappingStatus;
  targetCapability?: string;
  proposedValue?: unknown;
  transformation?: {
    id: string;
    explanation: string;
  };
  reason?: string;
  alternatives?: Array<{
    id: string;
    label: string;
    consequence: string;
  }>;
}

interface CompatibilityPreview {
  contractId: string;
  contractRevision: number;
  targetProvider: "orbit";
  targetCapabilityVersion: string;
  mappings: MappingEntry[];
  previewHash: string;
  createdAt: string;
}
```

The mapping engine is deterministic. It does not generate or display model confidence scores.

## 9. Workbench interface

Routes:

- `/` — concise product explanation and sample CTA;
- `/workbench` — four-step working application.

Desktop layout:

```text
┌──────────────┬────────────────────┬──────────────┐
│ Gather       │ Intent Relay       │ Orbit Events │
│ Source       │ Contract / Mapping │ Target       │
└──────────────┴────────────────────┴──────────────┘
```

The Workbench displays:

- current step: Demonstrate, Verify Contract, Transfer, or Review;
- exact provider origin and connection state;
- number and names of discovered provider tools;
- contract status and provenance;
- mapping status for every rule;
- unresolved human decisions;
- current save state;
- a persistent statement that publication requires a human.

The product does not include a fake chat interface and does not embed an LLM. The agent is external — any WebMCP-capable assistant that can call the Workbench's tools; the Workbench is the shared work surface.

## 10. Sample and unsupported-browser behavior

The landing page offers **Load sample demonstration**. The Workbench includes **Reset demo**.

The Workbench owns a random `demoSessionId`. Gather and Orbit namespace their local sample state by that ID. **Reset demo** creates a new ID and reloads both iframe URLs with the new session query parameter. This resets the demonstration without cross-origin storage access, `postMessage`, or a hidden non-WebMCP provider mutation.

If `document.modelContext` is unavailable:

- show a clear unsupported-browser notice;
- keep the sample states readable for product inspection;
- disable WebMCP-dependent actions;
- do not silently substitute `postMessage`, DOM scraping, or mocked successful tool calls.

## 11. Storage and privacy

The prototype uses local browser storage only:

- Gather stores its event draft and trace in its own origin;
- Orbit stores its capability version and draft in its own origin;
- Relay stores contracts, previews, and human resolutions in its own origin.

Provider operations cross origins only through explicitly permitted WebMCP tools. No user account, analytics SDK, remote database, uploaded personal data, or secret API key is required.

Development defaults are:

```text
Relay:  http://localhost:4173
Gather: http://localhost:4174
Orbit:  http://localhost:4175
```

Production and development builds use `VITE_RELAY_ORIGIN`, `VITE_GATHER_ORIGIN`, and `VITE_ORBIT_ORIGIN`. Origin values are validated at application startup.

## 12. Non-goals

- universal compatibility with arbitrary websites;
- production authentication or multi-user collaboration;
- server-side workflow storage;
- autonomous publication;
- inferring intent without human verification;
- an LLM API embedded in the app;
- CSS-selector recording or pointer replay;
- fabricated productivity metrics or confidence scores;
- a second fully implemented vertical.

## 13. Success criteria

The prototype succeeds when:

1. the user can produce a semantic trace through ordinary Gather UI actions;
2. the agent can retrieve that trace through WebMCP;
3. the agent can save a provenance-valid contract draft;
4. only the user can approve the contract;
5. Relay can discover Orbit's tools across origins;
6. every approved rule receives an explicit compatibility status;
7. unresolved semantic gaps block draft preparation;
8. the user can resolve the waitlist mismatch;
9. the agent can prepare, but not publish, an Orbit draft;
10. the UI reports exactly what was preserved, transformed, excluded, and decided;
11. the complete edited demo can be presented clearly in approximately 90 seconds;
12. all builds, static checks, unit tests, integration tests, and the defined end-to-end test pass.

# Intent Relay — WebMCP Tool Contracts

## 1. Tool strategy

The top-level Relay Workbench exposes five stable, non-overlapping tools to an external agent. It uses cross-origin WebMCP internally to discover and execute two Gather tools and three Orbit tools.

Tool registration is page-state aware. A tool is not registered before its prerequisites exist.

All tools return a JSON-serialized envelope:

```ts
type ToolSuccess<T> = { ok: true; data: T };
type ToolFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
    recoverable: boolean;
    details?: unknown;
  };
};
```

Tool execution must update visible UI state before returning success. Cancellation must leave no partial write.

## 2. Cross-origin permissions

The Workbench embeds each provider with explicit tool permission:

```html
<iframe src="${GATHER_ORIGIN}" allow="tools"></iframe>
<iframe src="${ORBIT_ORIGIN}" allow="tools"></iframe>
```

Each provider registers tools with:

```ts
{ exposedTo: [RELAY_ORIGIN] }
```

Relay discovers them with:

```ts
document.modelContext.getTools({
  fromOrigins: [GATHER_ORIGIN, ORBIT_ORIGIN]
});
```

Only exact secure production origins and explicit localhost development origins are allowed. Wildcard origin exposure is prohibited.

## 3. Agent-facing Relay tools

### `inspect_source_demonstration`

**Purpose:** Retrieve the visible Gather event state and its semantic setup trace. Use after the user finishes demonstrating the source workflow.

**Availability:** Demonstrate and Verify Contract steps, while Gather is connected.

**Annotations:** read-only.

**Input:**

```json
{
  "type": "object",
  "properties": {},
  "additionalProperties": false
}
```

**Output data:**

```ts
interface SourceDemonstration {
  provider: "gather";
  eventState: GatherEventState;
  trace: SemanticTrace;
}
```

**Errors:** `WEBMCP_UNAVAILABLE`, `SOURCE_DISCONNECTED`, `TRACE_EMPTY`, `TOOL_CANCELLED`.

### `save_intent_contract_draft`

**Purpose:** Validate and save an agent-proposed Intent Contract draft derived from the current Gather trace.

**Availability:** Verify Contract step after a non-empty source trace exists.

**Input:**

```json
{
  "type": "object",
  "required": ["contract"],
  "properties": {
    "contract": {
      "type": "object",
      "description": "A version 0.1 event Intent Contract. Every rule must cite source action IDs from the current trace."
    }
  },
  "additionalProperties": false
}
```

**Behavior:**

- validate the full schema;
- validate every provenance action against the active trace;
- force contract status to `draft` regardless of input;
- render the proposed contract for human review;
- never approve the contract.

**Errors:** `INVALID_CONTRACT`, `UNKNOWN_PROVENANCE`, `STALE_TRACE`, `TOOL_CANCELLED`.

### `inspect_target_compatibility`

**Purpose:** Discover Orbit capabilities and create a deterministic compatibility preview for an approved contract.

**Availability:** Transfer step after human contract approval and while Orbit is connected.

**Input:**

```json
{
  "type": "object",
  "required": ["contractId"],
  "properties": {
    "contractId": { "type": "string" }
  },
  "additionalProperties": false
}
```

**Behavior:**

- reject draft contracts;
- call Orbit's `describe_event_capabilities` tool;
- map every approved rule;
- create a hash over contract revision, capability version, and mappings;
- display the full preview and Human Queue.

**Errors:** `CONTRACT_NOT_FOUND`, `CONTRACT_NOT_APPROVED`, `TARGET_DISCONNECTED`, `CAPABILITY_VERSION_INVALID`, `TOOL_CANCELLED`.

### `prepare_target_draft`

**Purpose:** Prepare an editable Orbit draft from an approved, current preview after all required decisions are resolved.

**Availability:** Transfer step after compatibility inspection.

**Input:**

```json
{
  "type": "object",
  "required": ["contractId", "previewHash"],
  "properties": {
    "contractId": { "type": "string" },
    "previewHash": { "type": "string" }
  },
  "additionalProperties": false
}
```

**Behavior:**

- validate current contract revision and capability version;
- reject stale preview hashes;
- reject unresolved `needs_decision` entries;
- exclude `unsupported` entries while preserving them in the review;
- execute Orbit's `prepare_event_draft` tool atomically;
- display the destination draft;
- never activate or publish the event.

**Errors:** `PREVIEW_NOT_FOUND`, `STALE_PREVIEW`, `UNRESOLVED_DECISIONS`, `TARGET_REJECTED_DRAFT`, `TOOL_CANCELLED`.

### `get_transfer_review`

**Purpose:** Return the current semantic transfer review after an Orbit draft has been prepared.

**Availability:** Review step.

**Annotations:** read-only.

**Input:** empty object.

**Output data:**

```ts
interface TransferReview {
  contractId: string;
  contractRevision: number;
  targetProvider: "orbit";
  targetDraftId: string;
  mappingCounts: Record<MappingStatus, number>;
  entries: MappingEntry[];
  humanResolutions: HumanResolution[];
  publication: "waiting_for_human";
}
```

**Errors:** `DRAFT_NOT_PREPARED`, `TARGET_DISCONNECTED`, `TOOL_CANCELLED`.

## 4. Gather provider tools

### `read_event_state`

Returns the current visible Gather event draft, its revision, and whether the user has marked the demonstration complete.

### `read_setup_trace`

Returns semantic actions in chronological order.

```ts
interface SemanticAction {
  id: string;
  timestamp: string;
  actor: "human";
  command: string;
  semanticKey: string;
  before: unknown;
  after: unknown;
}

interface SemanticTrace {
  id: string;
  eventRevision: number;
  completed: boolean;
  actions: SemanticAction[];
}
```

UI handlers and tool-backed operations must use the same Gather domain-command module. Pointer coordinates, DOM selectors, and raw click events are not stored.

## 5. Orbit provider tools

### `describe_event_capabilities`

Returns a versioned capability manifest.

```ts
interface ProviderCapability {
  semanticKey: string;
  valueType: "string" | "number" | "boolean" | "enum" | "duration" | "datetime";
  acceptedValues?: unknown[];
  constraints?: Record<string, unknown>;
  supportedTransformations?: Array<{
    id: string;
    from: string;
    to: string;
    explanation: string;
  }>;
}

interface CapabilityManifest {
  provider: "orbit";
  version: string;
  capabilities: ProviderCapability[];
  unsupportedSemanticKeys: string[];
  humanOnlyActions: ["event.publish"];
}
```

### `prepare_event_draft`

Accepts only a validated target draft payload produced from the current compatibility preview. It atomically replaces the editable Orbit draft and returns the new draft ID and revision.

It cannot publish or activate an event.

### `read_event_draft`

Returns the current Orbit draft and publication state.

## 6. Registration lifecycle

- Provider read tools register when the provider application is ready.
- Relay `inspect_source_demonstration` registers when Gather tools are discovered.
- Relay `save_intent_contract_draft` registers after a completed non-empty trace exists.
- Relay `inspect_target_compatibility` registers only for an approved contract and discovered Orbit tools.
- Relay `prepare_target_draft` registers only after a current preview exists.
- Relay `get_transfer_review` registers after draft preparation.
- Tools unregister when prerequisites disappear or the active contract revision changes.

## 7. Security and reliability constraints

- validate inputs in executable code, not only JSON Schema;
- reject unknown object properties at trust boundaries;
- do not execute HTML returned by tools;
- render all provider and agent text as text content;
- use exact origin allowlists;
- expose no tool for publication, pricing changes, or external navigation;
- make draft preparation idempotent for a given preview hash;
- propagate `AbortSignal` to cross-origin tool execution;
- return actionable, structured errors;
- never report success before the visible provider state updates.

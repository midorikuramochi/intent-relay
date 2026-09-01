# Intent Relay — Acceptance and Evaluation Tests

## 1. Required command gate

The implementation is complete only when these commands pass from the repository root:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

The exact scripts must be defined in the root `package.json`. A passing historical run is not evidence of the current state; commands must be rerun after integration.

## 2. Contract unit tests

1. Accept a valid version 0.1 event contract.
2. Reject an unknown contract version.
3. Reject a rule with an unknown semantic key.
4. Reject a rule with no provenance.
5. Reject provenance that does not exist in the active trace.
6. Force agent-supplied contracts to `draft`.
7. Permit only a human UI command to approve a contract.
8. Prevent in-place mutation of an approved contract.
9. Preserve approval boundaries in every revision.

## 3. Mapping-engine unit tests

Using the canonical Student AI Workshop fixture:

1. Map title, schedule, capacity, free ticketing, and publication boundary as `direct`.
2. Transform a 24-hour reminder into a 1-day reminder.
3. Transform an event accessibility note into Orbit's venue note.
4. Classify the dietary-restrictions question as `unsupported`.
5. Classify native waitlist as `needs_decision`.
6. Return exactly one mapping entry per approved contract rule.
7. Never omit an unsupported rule.
8. Never create a confidence score.
9. Produce the same preview and hash for the same inputs.
10. Produce a different hash when the contract revision or capability version changes.

## 4. Tool contract tests

1. Relay discovers only explicitly exposed Gather and Orbit tools.
2. Unknown origins are excluded.
3. `inspect_source_demonstration` fails for an empty trace.
4. `save_intent_contract_draft` rejects unknown provenance.
5. `inspect_target_compatibility` rejects a draft contract.
6. `prepare_target_draft` rejects unresolved decisions.
7. `prepare_target_draft` rejects a stale preview hash.
8. Cancellation leaves Gather, Relay, and Orbit state unchanged.
9. Repeating `prepare_target_draft` with the same preview hash is idempotent.
10. Every successful write updates visible UI before returning.
11. No registered tool can publish an event.

## 5. Human boundary tests

1. The user can approve or reject each proposed rule.
2. The Agent cannot approve the contract through a WebMCP tool.
3. The user must resolve the waitlist mismatch before draft preparation.
4. Unsupported rules remain visible in the final review.
5. The Orbit Publish button is a direct human UI control.
6. Publication is never triggered by draft preparation.

## 6. End-to-end golden path

1. Open the Relay Workbench in a WebMCP-capable browser.
2. Confirm both provider origins and discovered tool counts.
3. Reset and load the Student AI Workshop sample.
4. Perform the source demonstration in Gather.
5. Call `inspect_source_demonstration`.
6. Call `save_intent_contract_draft` with valid provenance.
7. Approve the contract through the human UI.
8. Call `inspect_target_compatibility`.
9. Verify all four mapping statuses are represented as expected.
10. Resolve the waitlist mismatch through the human UI.
11. Call `prepare_target_draft` with the current preview hash.
12. Call `get_transfer_review`.
13. Confirm the Orbit draft matches the review.
14. Confirm the event remains unpublished.
15. Reset the demo and confirm the three applications load clean state under a new session ID.

## 7. Failure-path end-to-end tests

### Provider disconnected

- disconnect Orbit;
- verify Transfer is disabled;
- verify the UI names the disconnected origin and offers retry;
- verify no draft is created.

### Capability changed

- create a compatibility preview;
- change Orbit's capability version;
- attempt draft preparation;
- expect `STALE_PREVIEW` and no partial write.

### Contract revised

- create a compatibility preview;
- revise and reapprove the contract;
- attempt to use the old preview;
- expect `STALE_PREVIEW`.

### WebMCP unavailable

- run without `document.modelContext`;
- verify the product explanation and sample states remain readable;
- verify WebMCP actions are disabled;
- verify no mock success is displayed.

### Demo reset

- create state in all three applications;
- trigger **Reset demo**;
- verify the Relay session ID changes;
- verify both provider iframe URLs use the new session ID;
- verify old provider state does not appear;
- verify reset does not use `postMessage` or cross-origin storage access.

## 8. UI and accessibility checks

- all controls have accessible names;
- iframe titles identify Gather and Orbit;
- tool and mapping states use text and icons, not color alone;
- keyboard users can complete rule approval and Human Queue resolution;
- focus returns to the initiating control after dialog closure;
- error messages are associated with the relevant panel or field;
- desktop layout has no unintended horizontal scroll;
- tablet layout remains operable;
- reduced-motion preference is respected;
- contrast meets WCAG AA for normal text.

## 9. Demo readiness checks

- sample data is labeled `Sample`;
- reset restores the exact golden fixture;
- mapping counts are computed from live results;
- the full edited demo can be shown coherently in approximately 90 seconds;
- every important agent action causes a visible state change;
- a screenshot fallback exists for each demo stage;
- no claim of universal compatibility, measured time savings, success rate, or production security appears without evidence.

## 10. Automated end-to-end execution

`npm run test:e2e` runs the Playwright suites in `e2e/` against the Relay
application started with `--mode test`:

- `golden-path.spec.ts` — section 6 steps 3–14 through the test-only
  `window.__INTENT_RELAY_E2E__` facade plus the visible human Workbench UI;
- `failure-paths.spec.ts` — the unresolved-decision, contract-revised, and
  demo-reset paths from section 7;
- `accessibility.spec.ts` — the section 8 smoke checks (iframe titles,
  accessible names, text-plus-icon states, keyboard operation of rule review
  and the Human Queue, reduced motion).

The facade delegates to the production Relay orchestrator and the real Gather
and Orbit domain modules over an in-page test port. It exists only in
`--mode test` builds behind the `?e2e=1` query and shows a visible
`E2E TEST ADAPTER ACTIVE` banner. It is not evidence of real cross-origin
WebMCP behavior; that is verified manually per section 1 of
`docs/REAL_WEBMCP_CHECKLIST.md`.

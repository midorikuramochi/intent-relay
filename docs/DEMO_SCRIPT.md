# Intent Relay — 90-Second Demo Script

## Demo objective

Show that Intent Relay carries reviewed human intent between two structurally different WebMCP providers. The decisive moment is not form autofill; it is the visible separation between preserved intent, transformed intent, unsupported intent, and decisions that return to the human.

## Pre-demo setup

- use a WebMCP-capable browser;
- open the Relay Workbench;
- confirm Gather and Orbit show `Connected`;
- reset the sample;
- prepare the agent surface: a WebMCP-capable assistant if one is available, otherwise drive the Workbench's agent-facing tools directly and say so on screen — every call is the real WebMCP tool either way;
- record at a resolution where all three Workbench columns remain readable;
- record a clean run, then edit waiting time rather than claiming a fully real-time 90-second execution.

## Timeline

### 0:00–0:10 — Problem

**Voiceover**

> Every website makes us express the same intent again through a different form. Existing automation copies fields or clicks, but our rules and approval boundaries stay trapped inside the original website.

Show the Gather and Orbit interfaces side by side. Briefly highlight their different field names and capabilities.

### 0:10–0:25 — Human demonstration

In Gather, perform or replay the Student AI Workshop demonstration:

- capacity: 100;
- free admission;
- native waitlist enabled;
- reminder: 24 hours;
- accessibility note;
- dietary-restrictions question;
- publication requires review.

**Voiceover**

> In Gather, I configure one event normally. Gather records semantic commands—what changed and what it meant—not coordinates or CSS selectors.

### 0:25–0:40 — Contract proposal and approval

Prompt the agent:

> Inspect my completed Gather demonstration and propose a version 0.1 Intent Contract. Every rule must cite source action IDs. Save it as a draft and do not transfer or approve anything.

Show the proposed Contract and provenance. Approve it manually.

**Voiceover**

> One demonstration cannot prove which choices are permanent rules. The agent proposes a contract with provenance, and I decide what becomes reusable intent.

### 0:40–0:57 — Cross-origin capability mapping

Prompt the agent:

> Inspect Orbit compatibility for my approved contract. Do not prepare the destination draft while a human decision is unresolved.

Show:

- direct mappings;
- 24 hours transformed to 1 day;
- accessibility note transformed to Orbit's venue note;
- dietary question unsupported;
- waitlist requiring a decision.

**Voiceover**

> Orbit exposes a different WebMCP capability set. Intent Relay does not force a field copy. It shows what transfers directly, what must be transformed, what is unsupported, and what still belongs to me.

### 0:57–1:10 — Human Queue

Resolve the missing waitlist capability by selecting **Redirect overflow registrations to an external form**.

**Voiceover**

> Orbit has no native waitlist, so the agent stops at the semantic gap. I choose the acceptable substitute.

### 1:10–1:23 — Prepare destination draft

Prompt the agent:

> Prepare the Orbit draft using the current preview and my recorded resolution, then show the transfer review.

Show the Orbit draft and calculated transfer summary.

### 1:23–1:30 — Thesis

Pause on the manual Publish button and the status `Waiting for human`.

**Voiceover**

> Intent Relay does not replay clicks. It translates human intent across the web. The agent prepares; the human decides and publishes.

End card:

> **Teach the web how you work once. Carry it everywhere.**

## Fallback presentation

If live WebMCP execution fails, show a pre-recorded successful run and static screenshots for:

1. semantic trace;
2. draft contract with provenance;
3. capability map;
4. Human Queue;
5. Orbit draft and transfer review.

Do not substitute a mocked live success without disclosure.

## Local run configuration

- Start all three applications with `npm run dev` (Relay 4173, Gather 4174,
  Orbit 4175) and open `http://localhost:4173/workbench`.
- Use a WebMCP-capable Chrome. For local testing, launch Chrome with
  `--enable-features=WebMCPTesting --enable-experimental-web-platform-features`
  (see `docs/REAL_WEBMCP_CHECKLIST.md`); deployed origins can use the WebMCP
  origin trial instead.
- Confirm both provider panels show `Connected` before recording, and use
  **Reset demo** between takes to restore the exact golden fixture under a
  fresh session ID.
- The five fallback screenshots listed above correspond to: the Gather
  semantic trace, the draft Contract with provenance, the capability map, the
  Human Queue, and the Orbit draft with the transfer review.

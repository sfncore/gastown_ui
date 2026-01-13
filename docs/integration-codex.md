# Gastown Integration (Codex Draft)

> **Status**: Draft
>
> **Primary goal (now)**: single-machine local dev, fastest path to “works on my machine”.
>
> **Extensibility goal (later)**: multi-rig remote usage with a real daemon API, separate origin, CORS + bearer tokens.

---

## 0) Decisions (current)

### D0.1 — Phase 1 backend: **SvelteKit server routes execute `gt`/`bd` (Node as backend/BFF)**
We keep the existing pattern in this repo: `src/routes/api/gastown/**/+server.ts` calls `gt`/`bd` and returns JSON.

- **Why**: minimal change, immediate leverage of CLI output, matches current UI code.
- **Scope**: visualization-first (read-only preferred), with limited “safe writes” later.

### D0.2 — Remote topology: **two origins**
- UI: `https://ui.gastown.com`
- Daemon/API: `https://abcd.gastown.com` (example)

This implies:
- Browser calls daemon over HTTPS + WebSocket with **CORS** configured.
- Auth model (when enabled): **Bearer tokens**.

### D0.3 — Message model: keep UI’s current WS message types for now
We stick with the UI’s existing typed event names:
- `agent_status`
- `log_entry`
- `queue_update`
- `workflow_update`

We do **not** migrate the UI to the architecture doc’s `snapshot/event/topic` model in Phase 1.

---

## 1) Why “CLI bridge first” is sufficient (and its tradeoffs)

### Pros
- **Fastest path**: already implemented across `src/routes/api/gastown/**`.
- **Low coordination cost**: no need to stabilize a daemon API today.
- **Good enough for read-only**: most dashboards are “GET state + poll”.

### Cons / risks
- **Local-only coupling**: UI server must run where `gt`/`bd` and `.beads` exist.
- **Scaling limits**: child-process execution doesn’t scale to many users.
- **Harder streaming**: WS/SSE “truth” is the daemon’s job; Node/CLI bridge will be polling-heavy.
- **Auth/RBAC**: secure multi-user remote access is awkward with CLI + filesystem.

### Practical mitigation (Phase 1)
- Prefer **read-only visualization** until the daemon API exists.
- If we add any writes, keep them minimal and gated (“safe write ops”) and accept that remote mode won’t support them yet.

---

## 2) Remote mode: two-origins tradeoffs (ui.gastown.com + abcd.gastown.com)

### Pros
- **Clean separation**: UI can be static-hosted; daemon can be scaled/secured independently.
- **No cookie/CSRF coupling**: bearer tokens are straightforward cross-origin.
- **Works with mobile + remote access**: no “must be on same machine” assumption.

### Cons
- **CORS + WS auth complexity**: must be configured correctly (and safely).
- **Token storage risk**: browser storage needs discipline (avoid long-lived tokens in localStorage if possible).
- **More moving parts**: TLS certs for both hosts, CORS preflight, WS upgrade behavior through proxies.

### Security posture (recommended)
- For `ui.gastown.com → abcd.gastown.com`:
  - CORS allowlist exact origin (`https://ui.gastown.com`), not `*`.
  - Allow `Authorization` header.
  - For WS: browsers don’t allow custom headers; use one of:
    - `wss://abcd.gastown.com/ws?token=...` (easy, but avoid logging tokens)
    - `Sec-WebSocket-Protocol` to carry a token (better than query strings)
    - Cookies scoped to `.gastown.com` (requires SameSite settings; more complex)

---

## 3) Event model decision: current UI types vs snapshot/event/topic

### Option A — Keep current UI types (`agent_status`, `log_entry`, ...)
**Pros**
- Matches existing client code: `src/lib/stores/websocket.svelte.ts`, `src/lib/api/handlers.ts`.
- Easy to implement incrementally: emit only what UI needs.

**Cons**
- Semantics are ad-hoc per message type.
- Harder to version as the system grows.

### Option B — Adopt `snapshot/event/topic` (architecture doc)
**Pros**
- Clear separation: initial state (`snapshot`) vs incremental changes (`event`).
- `topic` is extensible without baking every category into a union.
- Plays well with multiplexing subscriptions.

**Cons**
- Requires UI refactor now (higher cost, higher risk).
- Requires stricter event schema discipline early.

### Recommendation
- Phase 1: **Option A** (keep current UI message types).
- Phase 2+: introduce a **thin compatibility layer**:
  - daemon emits `snapshot/event/topic`
  - UI server (or client) maps that into current `agent_status`/etc
  - later we can migrate UI to the canonical model without breaking everything.

---

## 4) Backend choice tradeoff: Go API server inside daemon vs keep SvelteKit BFF

### Option A — Go API server inside daemon (HTTP + WS); UI becomes pure frontend
**Pros**
- Correct long-term architecture for remote usage.
- Real-time streaming belongs in daemon.
- Auth/RBAC belongs in daemon.

**Cons**
- Requires backend work now.
- Requires choosing/locking an API contract.

### Option B — Keep SvelteKit BFF executing CLI now; migrate later (chosen)
**Pros**
- Immediate value.
- Lets UI and UX iterate while backend contract stabilizes.

**Cons**
- Remote mode is limited (read-only at best) until daemon API exists.
- Duplication risk: mapping logic may be rewritten when migrating.

---

## 5) “Safe write ops” (extensible, not supported right now)

**Definition (Phase 1)**
- “Safe writes” are operations with:
  - bounded duration,
  - deterministic side-effects,
  - idempotency (or a unique request ID),
  - and a clear audit trail.

**Current posture**
- Local dev can support limited write endpoints via CLI (`bd create`, `gt sling`, `gt convoy create`), but **remote mode should treat writes as disabled** until the daemon API + auth exists.

---

## 6) What we’re aligning to in code (current repo reality)

### Existing server routes (CLI bridge)
Already present:
- `src/routes/api/gastown/status/+server.ts` → `gt status --json`
- `src/routes/api/gastown/rigs/+server.ts` → `gt rigs --json`
- `src/routes/api/gastown/mail/+server.ts` → `bd list --type=message --status=open --json`
- `src/routes/api/gastown/work/issues/+server.ts` → `bd list ...` and `bd create ...`
- `src/routes/api/gastown/convoys/+server.ts` and `src/routes/api/gastown/work/convoys/+server.ts`
- `src/routes/api/gastown/workflows/**` for formulas/molecules/cook/pour

### Existing WS types (client)
See `src/lib/stores/websocket.svelte.ts` and `src/lib/api/handlers.ts`:
- `agent_status`, `log_entry`, `queue_update`, `workflow_update`

---

## 7) Next steps (implementation order)

1. Keep Phase 1 read-only visualization stable on local machine.
2. Normalize payload shapes + types in one place (avoid per-route drift).
3. Add daemon API (HTTP + WS) when remote mode needs to be real.
4. Turn on bearer token auth + CORS for `ui.gastown.com → abcd.gastown.com`.
5. Decide whether to keep UI BFF as a proxy in remote mode (optional) vs direct browser → daemon.

---

## 8) Related docs in this repo

- `integration-architecture.md` (integration strategy + topology questions)
- `integration-chatgpt.md` (current integration surface recap)
- `integration-no-backend-change.md` (strict CLI-only posture)
- `docs/INTEGRATION_PLAN.md` (broader phased plan; includes WS protocol ideas)

External reference:
- `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/gastown-ui-architecture-final.md` (snapshot/event/topic model + bearer token direction)

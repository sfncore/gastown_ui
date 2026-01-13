# INTEGRATION_PLAN_Codex_V1b — Phase 2: Go Daemon API (REST + Streaming)

> Scope: Move from “Node executes `gt`/`bd` locally” to a **real Go daemon HTTP API** (and streaming), enabling remote access, auth, scalability, and long-term robustness.
>
> Tradeoff: More backend work, but it removes the fundamental coupling to local filesystem and process spawning.

---

## Executive Summary

Phase 1 can be hardened, but it fundamentally couples the UI server to:
- local filesystem (`.beads`, `.events.jsonl`)
- local binaries (`gt`, `bd`)
- process spawning (does not scale; failure modes are messy)

Phase 2 makes the daemon the source of truth via:
- **Read-only snapshot endpoints** for the UI
- **Streaming** (WebSocket or SSE) for real-time updates
- **Auth + CORS** for two-origin remote deployments

This document lists 30 pragmatic improvements (Phase 2), then winnows to the best 5.

---

## 30 Pragmatic Improvement Ideas (Phase 2)

### A) API Surface & Contracts (1–10)

1) **Minimal REST endpoints (`/api/v1/status`, `/agents`, `/rigs`, `/convoys`, `/mail`)**
- Users: faster, more reliable UI.
- Impl: Go HTTP handlers calling existing daemon services.

2) **Versioned API (`/api/v1`)**
- Users: upgrades don’t break.
- Impl: additive changes in v1; breaking changes go to v2.

3) **Typed error envelope + stable error codes**
- Users: consistent recovery.
- Impl: `{code, message, details, retryable, requestId}`.

4) **OpenAPI spec (handwritten first, generated later)**
- Users/devs: stable contract.
- Impl: `openapi.yaml` checked in and reviewed.

5) **Canonical snapshot/event model**
- Users: consistent real-time behavior.
- Impl: snapshots for initial state + events for updates.

6) **Pagination + filtering**
- Users: handles large towns.
- Impl: cursor-based pagination.

7) **Capabilities endpoint**
- Users: UI adapts to daemon features.
- Impl: `GET /capabilities` returns feature flags.

8) **Idempotency keys for write operations**
- Users: safe retries.
- Impl: `Idempotency-Key` header stored briefly.

9) **Audit log endpoint**
- Users: accountability.
- Impl: `GET /audit` (or stream topic).

10) **Compatibility adapter (UI can migrate incrementally)**
- Users: migration is invisible.
- Impl: UI maps daemon payloads to existing types first.

### B) Real-time & Streaming (11–20)

11) **WebSocket hub with topic subscriptions**
- Users: truly live dashboard.
- Impl: `subscribe` message → topic set.

12) **SSE fallback**
- Users: works behind restrictive proxies.
- Impl: one-way event stream endpoint.

13) **Event replay/resume cursor**
- Users: seamless reconnect.
- Impl: cursor-based resume token.

14) **Backpressure strategy**
- Users: prevents browser lockups.
- Impl: bounded channels; drop/noise policies.

15) **Heartbeat protocol**
- Users: clear connected/disconnected.
- Impl: ping/pong + last-seen.

16) **Log streaming topics**
- Users: tail logs in UI.
- Impl: topics per rig/agent.

17) **Progress events for long-running ops**
- Users: no frozen UI.
- Impl: operation IDs + progress updates.

18) **Server-side aggregates for dashboards**
- Users: fast initial render.
- Impl: daemon computes derived counts.

19) **Watch endpoints (long-poll) as interim**
- Users: fewer changes to start.
- Impl: `GET /watch?since=` blocks until change.

20) **Event schema versioning**
- Users: stable stream.
- Impl: include `schemaVersion` per message.

### C) Security, Auth, Multi-user (21–30)

21) **Bearer token auth**
- Users: remote safe.
- Impl: token middleware.

22) **RBAC roles (viewer/operator/admin)**
- Users: safe collaboration.
- Impl: role claims in token.

23) **CORS allowlist (two-origin)**
- Users: secure browser access.
- Impl: exact origin allowlist.

24) **WebSocket auth strategy**
- Users: secure streams.
- Impl: `Sec-WebSocket-Protocol` token preferred.

25) **Rate limiting per token/IP**
- Users: stability under load.
- Impl: token bucket.

26) **Metrics (`/metrics`)**
- Users/devs: measurable reliability.
- Impl: Prometheus instrumentation.

27) **Tracing (OpenTelemetry)**
- Users/devs: debug latency.
- Impl: spans around key operations.

28) **Secrets management posture**
- Users: safe deployments.
- Impl: env/file-based secret injection.

29) **Safer write APIs (bounded, audited, idempotent)**
- Users: confident operations.
- Impl: explicit write endpoints with audit.

30) **Optional Effect client usage (TS) for typed retries/resources**
- Users: fewer edge cases.
- Impl: Effect-based API client + WS resource lifecycle.

---

## Top 5 (Phase 2) — Best → Worst

### 1) Minimal daemon REST API + stable contracts (Best)
Why best: removes the core coupling to local CLI and filesystem, enabling remote and multi-user.

- Start read-only: `/status`, `/agents`, `/rigs`, `/convoys`, `/mail`.
- Require consistent envelopes and versioning from day one.

### 2) Streaming (WS primary, SSE fallback) with snapshot/event semantics
Why: real-time makes the product compelling and reduces polling load.

- Protocol: initial snapshot + incremental events by topic.

### 3) Auth + CORS + RBAC early
Why: without auth, remote deployments are a non-starter.

- Bearer tokens; exact CORS allowlist; role gates for writes.

### 4) Long-running operations model (operation IDs + progress)
Why: “rig add / doctor / cook / pour” need progress semantics for good UX.

- Provide `/operations/{id}` and stream progress events.

### 5) Observability (structured errors + metrics + audit)
Why: makes outages and performance issues diagnosable and cheap to operate.

- Metrics, request IDs, audit log entries for writes.

---

## Recommended Implementation Order

1. Implement read-only REST endpoints + error envelope + `/api/v1` routing
2. Add auth middleware + CORS allowlist (still read-only)
3. Add streaming for the highest-value topics (agent status, queue, activity)
4. Migrate UI from CLI bridge to daemon endpoints incrementally (keep compatibility adapter)
5. Add safe write operations with idempotency + audit + progress events

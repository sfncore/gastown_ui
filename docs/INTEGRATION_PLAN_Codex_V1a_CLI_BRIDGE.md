# INTEGRATION_PLAN_Codex_V1a — Phase 1: CLI Bridge Robustness

> **Scope**: Make the existing SvelteKit → Node → `gt`/`bd` CLI integration robust, safe, fast, and portable.
>
> **Non-goal**: No required changes to the Go daemon in this phase.
>
> **Audience**: People shipping `gastown-ui` now (reliability-first).
>
> **Grounding sources**: `docs/INTEGRATION_PLAN.md` (v4.0), current `src/routes/**` usage of `child_process`, and the `../gastown` protocol docs.

---

## Executive Summary

Phase 1 is already the right “first mile” to ship value quickly, but the current implementation is fragile because CLI calls are:

- Duplicated across many routes with `child_process.exec()` and command strings.
- Parsed optimistically (`JSON.parse(stdout)` with weak failure modes).
- Not portable (hard-coded absolute paths and `cwd` assumptions).

**The highest ROI move** is to centralize CLI execution behind a single server-only module and enforce: `execFile`/args (no shell), timeouts, max output limits, concurrency limiting, caching (SWR), and a typed error envelope.

---

## Current Reality Check (Signals from the Codebase)

### What’s working well already
- `docs/INTEGRATION_PLAN.md` v4.0 is a strong north star (Phase 1 → Phase 2/3, SWR, contract testing, streaming activity).
- There’s already a good HTTP client with retries/backoff (`src/lib/api/client.ts`) and a WS store (`src/lib/stores/websocket.svelte.ts`).
- The UI already embraces “loading / error / empty / content” patterns.

### What is brittle today
- Many server routes import and call `exec()` directly.
- Some server loads use `execSync()` (blocks the event loop).
- Multiple routes contain absolute paths like `/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp`.

**Implication**: Without centralization, every new endpoint adds more fragility, more security exposure (shell interpolation), and more inconsistent UX.

---

## Phase 1 Goals (Measurable)

1. **No shell interpolation** for any route that executes commands.
2. **No `execSync`** in request/loader code paths.
3. **Portable configuration**: no hard-coded absolute paths.
4. **Typed boundary**: CLI JSON output validated (Zod) on critical endpoints.
5. **Resilient polling**: concurrency-limited + timeouts + error backoff + SWR cache.
6. **User-visible trust signals**: freshness + degraded mode.

---

## 30 Improvement Ideas (CLI Bridge)

Each idea is framed as: **What** / **User impact** / **Implementation shape**.

### A) Reliability & Safety (1–10)

1) **Central CLI executor (single module)** / fewer random failures / introduce `src/lib/server/cli/exec.ts` and migrate routes.

2) **Use `execFile` (argv arrays), never `exec()` strings** / eliminates quoting bugs + injection / enforce by lint + code review.

3) **Remove `execSync` from loaders** / avoids server stalls / refactor to async executor.

4) **Consistent timeouts per command** / prevents hanging pages / `timeoutsByCommand` table.

5) **Max output limits (`maxBuffer` / stream cap)** / prevents memory blowups / enforce default caps.

6) **Normalized error taxonomy** / clearer UX and consistent retries / `{ code, message, retryable, suggestedAction }`.

7) **Known-bug classifier** / graceful handling of recurring CLI/daemon quirks / regex match stderr + map to actions.

8) **Input validation for POST routes (Zod)** / safer writes / strict schemas for IDs and labels.

9) **Command allowlist + feature flag for writes** / prevents unsafe operations / `GASTOWN_ENABLE_WRITES=true` gate.

10) **Correlation IDs for every request** / faster debugging / include `requestId` in logs + responses.

### B) Performance & Stability (11–20)

11) **Concurrency limiter for CLI calls** / avoids spawn storms / semaphore around executor.

12) **In-flight deduping** / eliminates identical parallel work / key by `(cwd, argv)`.

13) **SWR cache (stale-while-revalidate)** / instant page loads / return cached + refresh in background.

14) **Adaptive polling** / less CPU + fewer errors / visibility-aware + jitter + tiered schedules.

15) **Composite “dashboard snapshot” endpoint** / fewer waterfalls / one route runs minimal set of commands.

16) **Structured “freshness” metadata everywhere** / trust / return `{ fetchedAt, cached, ttlMs }`.

17) **Degraded mode banner** / calm UX / “daemon down; showing cached snapshot”.

18) **Pagination + server-side limits** / stable large towns / avoid reading everything each request.

19) **Virtualize large lists** / smooth UI / only render visible rows.

20) **Local mock mode** / develop UI without a running town / `GASTOWN_MOCK=true` returns fixtures.

### C) Streaming Without Daemon (21–30)

21) **SSE activity stream from `.events.jsonl`** / real-time feel today / `EventSource` + server tail.

22) **Cursor-based activity pagination** / fast logs / `?cursor=` or `?since=` semantics.

23) **Retry policy standardization** / fewer intermittent fails / global retry with jitter and max deadline.

24) **Circuit breaker per command family** / reduces hammering / “open” for N seconds after repeated failures.

25) **Structured server logs** / debuggability / JSON logs with durationMs, exitCode, requestId.

26) **Diagnostics endpoint/page** / self-serve setup issues / check `gt/bd` presence, town root, beads redirect.

27) **Explicit “capabilities” endpoint** / UI adapts / e.g. `supportsEventsFile`, `supportsWrites`.

28) **Security hardening for server routes** / safer deployment / strict headers, CSRF posture, rate limiting.

29) **Effect integration (server-only) for orchestration** / typed failures & schedules / use Effect where it materially reduces complexity (retry/caching/timeout composition).

30) **Contract fixtures (opt-in) + drift detection** / fewer regressions / store sample JSON and validate schemas.

---

## Winnowed Top 5 (CLI Bridge)

These are optimized for: **impact now**, **low risk**, **high leverage across many endpoints**.

### 1) Central CLI executor (no shell) — Best

**Why**: Almost every reliability/security/perf issue flows from duplicated `exec()` usage.

**User perception**: fewer hung pages; errors become actionable; the app feels “industrial”.

**Implementation**:
- `src/lib/server/cli/exec.ts`: `runGt(args: string[], opts)` / `runBd(args: string[], opts)` returning a typed `Result`.
- Enforce `execFile`/argv + timeout + max output + consistent cwd/env.
- Migrate all `src/routes/**/+server.ts` and `+page.server.ts` call sites.

**Acceptance**:
- No direct `child_process.exec()` usage left in routes.
- No shell command string interpolation.

### 2) Portability: remove hard-coded paths + config autodiscovery

**Why**: The app must work on any workstation / CI / teammate clone.

**User perception**: “it just works” without editing code.

**Implementation**:
- `src/lib/server/config.ts` resolves:
  - town root (env + discovery),
  - beads cwd,
  - binaries (`gt`, `bd`).
- Replace absolute `cwd` and `GT_ROOT` usage.

**Acceptance**:
- No `/Users/amrit/...` paths remain in server routes.

### 3) Zod contract validation for critical CLI JSON

**Why**: CLI output will drift over time; runtime validation makes drift obvious and diagnosable.

**User perception**: instead of broken UI, a clear “contract mismatch” with next steps.

**Implementation**:
- Schemas for: `gt status --json`, `bd list --json`, `bd show --json`, `gt convoys --json`.
- Validate immediately after JSON parse in the executor (single choke point).

**Acceptance**:
- Critical endpoints validate and return structured schema errors.

### 4) Concurrency + SWR + backoff (stability under polling)

**Why**: Polling a CLI is expensive; unmanaged concurrency causes CPU spikes and cascading failures.

**User perception**: faster navigation, fewer spinners, fewer failure storms.

**Implementation**:
- semaphore + in-flight dedupe + TTL cache + stale window.
- standard retry/backoff policy for transient failures.

**Acceptance**:
- Under frequent navigation/refresh, process count stays bounded and latency remains stable.

### 5) SSE activity stream from `.events.jsonl`

**Why**: “Real-time” is what makes the UI compelling, and SSE can ship without daemon changes.

**User perception**: live activity feed; less need to manually refresh.

**Implementation**:
- server endpoint tails `.events.jsonl` and emits SSE.
- client `EventSource` with reconnect + cursor.

**Acceptance**:
- Activity page shows live updates within seconds.

---

## Recommended Execution Order

1. Central executor + remove `execSync`
2. Config + path portability
3. Error taxonomy + known-bug matcher
4. Zod schemas for the top endpoints
5. Concurrency + SWR cache + dedupe
6. SSE `.events.jsonl` stream
7. Sweep remaining endpoints and delete duplicated logic

---

## Risks (Phase 1)

- **Risk**: CLI behavior differs across machines.
  - **Mitigation**: diagnostics endpoint + explicit config + schema errors.

- **Risk**: Some commands hang (known `gt mail inbox` hang in Node).
  - **Mitigation**: timeouts + known-bug fallback (`bd list` direct) + circuit breaker.

- **Risk**: SSE tailing is OS/filesystem dependent.
  - **Mitigation**: fallback to polling for activity; feature flag `supportsEventsFile`.

---

## What This Unlocks

Once Phase 1 is solid:
- Phase 2 daemon API can reuse the same error taxonomy + models.
- UI stays stable while backend transport changes (CLI → HTTP).
- You can enable safe writes behind feature gates with confidence.

---

## Appendix: Where to Look in the Repo

- Plan: `docs/INTEGRATION_PLAN.md`
- Existing “strategic codex”: `docs/INTEGRATION_PLAN_Codex_V1.md`
- CLI usage hotspots: `src/routes/api/gastown/**`, `src/routes/**/+page.server.ts`
- WS store: `src/lib/stores/websocket.svelte.ts`

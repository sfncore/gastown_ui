# Gas Town UI - Backend Integration Plan

> **Document Version**: 5.0
> **Created**: 2026-01-11
> **Last Updated**: 2026-01-11
> **Status**: Planning Phase
> **Priority**: Visualization-first (read-only dashboard to replace CLI)
> **Architecture Style**: CLI Bridge (Phase 1) → Go Daemon API (Phase 2+)
> **Deployment Model**: Single-machine local dev → Two-origins remote
> **Previous Version**: [INTEGRATION_PLAN_V4.md](./INTEGRATION_PLAN_V4.md)
> **Grounding Sources**: `../gastown` (CLI behavior), competing architecture plans

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Reality Check](#current-reality-check)
3. [Key Innovations (v5.0)](#key-innovations-v50)
4. [Architecture Overview](#architecture-overview)
5. [Decision Log](#decision-log)
6. [Critical User Journeys (CUJs)](#critical-user-journeys-cujs)
7. [Phase 1: MVP (CLI Bridge)](#phase-1-mvp-cli-bridge)
8. [Phase 2: REST API](#phase-2-rest-api)
9. [Phase 3: Real-Time](#phase-3-real-time)
10. [Process Supervisor (No-Shell Execution)](#process-supervisor-no-shell-execution)
11. [Capabilities Probe & CLI Contracts](#capabilities-probe--cli-contracts)
12. [Effect.ts CLI Execution Layer](#effectts-cli-execution-layer)
13. [Stale-While-Revalidate (SWR) Pattern](#stale-while-revalidate-swr-pattern)
14. [Watch-First Updates](#watch-first-updates)
15. [Contract Testing with Zod](#contract-testing-with-zod)
16. [Real-Time Activity Stream](#real-time-activity-stream)
17. [Power-User Ergonomics](#power-user-ergonomics)
18. [Operation Center UI](#operation-center-ui)
19. [Long-Running Operations](#long-running-operations)
20. [Optimistic UI & State Transitions](#optimistic-ui--state-transitions)
21. [Toast System & User Feedback](#toast-system--user-feedback)
22. [Error Handling Strategy](#error-handling-strategy)
23. [Environment Configuration](#environment-configuration)
24. [CLI Wrapper & Caching](#cli-wrapper--caching)
25. [Data Models](#data-models)
26. [API Specifications](#api-specifications)
27. [Authentication Strategy](#authentication-strategy)
28. [Security Hardening](#security-hardening)
29. [Performance Targets](#performance-targets)
30. [Observability & Metrics](#observability--metrics)
31. [Accessibility (WCAG 2.2)](#accessibility-wcag-22)
32. [Testing Strategy](#testing-strategy)
33. [Deployment Architecture](#deployment-architecture)
34. [Risks & Mitigations](#risks--mitigations)
35. [Implementation Checklist](#implementation-checklist)
36. [Manual Verification Checklists](#manual-verification-checklists)
37. [Integration Gap Analysis](#integration-gap-analysis)
38. [LLM-Friendly Documentation](#llm-friendly-documentation)
39. [What This Unlocks](#what-this-unlocks)

---

## Executive Summary

### Goal
Replace CLI-based monitoring with a web-based visualization dashboard for Gas Town multi-agent orchestration system.

### Constraints
- **Current State**: Backend exposes CLI only (`gt`, `bd` commands)
- **MVP Scope**: Visualization/monitoring (read-only), not control
- **Auth**: Demo mode now, OAuth/SSO extensible
- **Deployment**: Single machine → Docker → Multi-node scalable
- **Users**: Single user now → RBAC multi-user later

### Core Principles

1. **User Journey First**: Design around what users do, not API endpoints
2. **Non-Blocking UI**: Long operations never freeze the interface
3. **Toast-Driven Feedback**: Consistent, machine-readable success/error messaging
4. **Graceful Degradation**: Handle CLI bugs and edge cases elegantly
5. **Test-Friendly**: Every interactive element has a testable selector
6. **Security by Default**: Input sanitization, CSP headers, rate limiting
7. **Accessible**: WCAG 2.2 AA compliance for inclusive access
8. **Type-Safe Errors**: Effect.ts for compile-time error tracking
9. **Instant Performance**: SWR caching for perceived speed
10. **Keyboard-First**: Vim-style navigation for power users
11. **No-Shell Execution**: All CLI invocations use arg-arrays (`spawn`/`execFile`), never shell strings (v5.0)
12. **CLI Drift-Tolerant**: Capabilities probe + contracts prevent breakage when upstream output changes (v5.0)
13. **Watch-First Updates**: Prefer file watchers + push over polling where possible (v5.0)
14. **Observable**: Correlation IDs, structured logs, metrics, audit trails (v5.0)
15. **Portable**: No hard-coded paths; auto-discovery + env config (v5.0)

### Phased Approach

| Phase | Focus | Backend Changes | Deployment |
|-------|-------|-----------------|------------|
| **Phase 1** | CLI Bridge (Visualization) | None | Local single-machine |
| **Phase 2** | REST API + Auth | Go HTTP handlers | Two-origin remote |
| **Phase 3** | Real-Time (WebSocket) | Go WebSocket server | Kubernetes scalable |

---

## Current Reality Check

Before diving into improvements, here's an honest assessment of the current state.

### What's Working Well

- **INTEGRATION_PLAN v4.0** is a strong north star with clear phases
- Existing HTTP client with retries/backoff in `src/lib/api/client.ts`
- WebSocket store in `src/lib/stores/websocket.svelte.ts` handles reconnection
- UI embraces "loading / error / empty / content" patterns
- Zod is already installed for validation
- Design system is solid (Tailwind + tailwind-variants)

### What is Brittle Today

| Area | Problem | Impact |
|------|---------|--------|
| CLI Execution | Many server routes call `exec()` directly with shell strings | Injection risk, quoting bugs |
| Blocking Calls | Some server loads use `execSync()` | Blocks event loop, hangs |
| Hard-coded Paths | Routes contain absolute paths like `/Users/amrit/...` | Not portable |
| No Concurrency Control | Rapid polling can spawn dozens of processes | CPU spikes, cascading failures |
| Weak Error Classification | JSON parse failures not distinguished from CLI errors | Confusing UX |
| No Freshness Metadata | UI doesn't know how stale data is | Trust issues |

### Implication

Without centralization, every new endpoint adds fragility, security exposure (shell interpolation), and inconsistent UX. **Phase 1 must harden the CLI bridge before adding features.**

---

## Key Innovations (v5.0)

This version introduces **ten key innovations** organized into three tiers by impact and urgency.

### Tier 1: Foundation (Ship First)

These must ship before adding features—they eliminate entire classes of bugs.

| # | Innovation | Impact Area | Complexity | ROI |
|---|------------|-------------|------------|-----|
| 1 | **Process Supervisor (No-Shell)** | Security, Reliability | Medium | ★★★★★ |
| 2 | **Capabilities Probe + Contracts** | CLI Drift Tolerance | Low-Medium | ★★★★★ |
| 3 | **Concurrency Limiter + Deduping** | Stability | Low | ★★★★★ |

### Tier 2: Performance & UX (Ship Next)

These make the app feel fast and responsive.

| # | Innovation | Impact Area | Complexity | ROI |
|---|------------|-------------|------------|-----|
| 4 | **SWR Data Pattern** | Performance, UX | Low-Medium | ★★★★★ |
| 5 | **Watch-First Updates** | Real-Time, UX | Medium | ★★★★☆ |
| 6 | **Effect.ts CLI Layer** | Robustness, Reliability | Medium-High | ★★★★☆ |

### Tier 3: Power User & Polish (Ship Soon)

These differentiate the product and win adoption.

| # | Innovation | Impact Area | Complexity | ROI |
|---|------------|-------------|------------|-----|
| 7 | **Power-User Ergonomics** | UX, Adoption | Medium | ★★★★☆ |
| 8 | **Operation Center UI** | UX, Debuggability | Medium | ★★★☆☆ |
| 9 | **Zod Contract Testing** | Reliability, DX | Low | ★★★★☆ |
| 10 | **LLM-Friendly Docs** | DX, Onboarding | Low | ★★★☆☆ |

### Innovation Details

#### 1. Process Supervisor (No-Shell Execution)

**Problem**: Current code uses `exec()` with shell strings, enabling injection and quoting bugs. No concurrency limits means rapid polling can spawn dozens of processes.

**Solution**: Replace shell-string `exec()` with a process supervisor using `spawn`/`execFile` with argv arrays, enforcing concurrency limits, supporting cancellation, and capturing streaming stderr/stdout.

**Benefits**:
- Eliminates shell-injection vulnerability class entirely
- No more "sanitization deletes characters" issues
- Prevents UI from self-DOSing the machine under polling
- Unlocks progress + better error UX for long-running ops

**Acceptance Criteria**:
- [ ] No direct `child_process.exec()` usage in routes
- [ ] No shell command string interpolation
- [ ] Max 4 concurrent CLI processes at any time

#### 2. Capabilities Probe + CLI Contracts

**Problem**: CLI output can change across `gt`/`bd` versions, breaking parsing. The UI has no way to know what features the installed CLI supports.

**Solution**: On boot, probe CLI capabilities (versions, flags, JSON support) and use per-command Zod contracts with fallbacks so UI degrades gracefully on output drift.

**Benefits**:
- "Contract mismatch" error surfaces clear guidance, doesn't crash app
- Feature detection enables graceful degradation
- Supports multiple CLI versions simultaneously

**Acceptance Criteria**:
- [ ] Capabilities endpoint returns CLI versions and feature flags
- [ ] Critical endpoints validate and return structured schema errors
- [ ] UI shows "unsupported feature" instead of crashing on missing capability

#### 3. Concurrency Limiter + In-Flight Deduping

**Problem**: Rapid navigation can trigger identical parallel CLI calls, wasting resources and causing race conditions.

**Solution**: Global semaphore (max 2-4 processes) + request coalescing (same `(cwd, argv)` key joins in-flight promise).

**Benefits**:
- Stable latency under frequent navigation/refresh
- Process count stays bounded
- Identical requests share results

**Acceptance Criteria**:
- [ ] Under rapid refresh, process count never exceeds limit
- [ ] Duplicate requests within 100ms share the same result

#### 4. Stale-While-Revalidate (SWR) Data Pattern

**Problem**: Every navigation triggers fresh API calls, causing loading spinners and perceived slowness.

**Solution**: Implement SWR caching—serve cached data instantly, revalidate in background. Include freshness metadata (`{ fetchedAt, cached, ttlMs }`).

**Benefits**:
- App feels 10x faster (instant page loads)
- Background refresh keeps data fresh
- Works offline (shows last-known state with degraded banner)
- Reduces CLI load (fewer concurrent calls)
- UI shows "Last updated: Xs ago" for trust

**Acceptance Criteria**:
- [ ] Pages render immediately with cached data
- [ ] Freshness indicator visible in UI
- [ ] Degraded mode banner when daemon unreachable

#### 5. Watch-First Updates

**Problem**: Polling is expensive and introduces latency. True real-time requires backend changes.

**Solution**: Prefer file/event watchers + WS push (tail `.events.jsonl`, watch `.beads/`) for responsiveness; keep polling as fallback/SWR refresh.

**Benefits**:
- Near real-time feel without Phase 3
- Activity feed updates within seconds
- Reduced polling frequency (lower CPU)

**Acceptance Criteria**:
- [ ] Activity page shows live updates within 2 seconds
- [ ] `.beads/` changes trigger cache invalidation
- [ ] Falls back to polling if watchers unavailable

#### 6. Effect.ts for CLI Execution Layer

**Problem**: Error handling is imperative and inconsistent—no type-safe tracking, no composable retry policies.

**Solution**: Replace Promise-based CLI execution with Effect.ts for typed errors, built-in retry, circuit breaker, and streaming.

**Benefits**:
- Compile-time error tracking (know what can fail)
- Built-in retry with exponential backoff
- Circuit breaker per command family prevents hammering
- Dependency injection for testability

**Acceptance Criteria**:
- [ ] All CLI errors have typed representations
- [ ] Circuit breaker opens after 5 failures, closes after 30s
- [ ] Retry policy configurable per command type

#### 7. Power-User Ergonomics

**Problem**: Dashboard requires mouse for most interactions, slowing down power users. No way to copy CLI commands to replicate UI actions.

**Solution**: Comprehensive vim-style shortcuts (j/k navigation, g+key routes, / for search) + Command Palette (⌘K) + "Copy CLI equivalent" everywhere + Global Search across all entities.

**Benefits**:
- Matches developer terminal expectations
- Navigate entire app without mouse
- Users can learn CLI through UI (copy and run)
- Global search finds anything instantly
- Differentiator from other dashboards

**Acceptance Criteria**:
- [ ] `?` shows keyboard shortcuts overlay
- [ ] `⌘K` opens command palette
- [ ] Every action shows "Copy CLI" option
- [ ] Global search indexes agents, beads, convoys, mail

#### 8. Operation Center UI

**Problem**: Long-running operations only show toasts. Users can't see all running ops, can't cancel, can't see logs.

**Solution**: Dedicated Operation Center panel/drawer showing:
- Running ops (rig add, doctor, formula run, sling)
- Live streaming logs (stderr/stdout)
- Elapsed time + timeout budget
- Cancel / retry (when safe)
- "Copy debug bundle" for support

**Benefits**:
- Transparency into what's happening
- Faster debugging when ops fail
- Users feel in control

**Acceptance Criteria**:
- [ ] Panel shows all running operations
- [ ] Logs stream in real-time
- [ ] Cancel button kills process gracefully

#### 9. Zod Contract Testing

**Problem**: CLI JSON output schema can drift from TypeScript types, causing runtime errors.

**Solution**: Use Zod schemas to validate CLI output at runtime and test time, with stored golden fixtures for drift detection.

**Benefits**:
- Prevents silent type mismatches
- Schemas serve as living documentation
- Zero new dependencies (Zod already installed)
- Golden fixtures catch drift in CI

**Acceptance Criteria**:
- [ ] Contract tests run against real CLI in CI
- [ ] Golden fixtures checked into repo
- [ ] Schema mismatch produces actionable error message

#### 10. LLM-Friendly Documentation

**Problem**: Contributors (human or AI) need quick context about the system. Scattered docs slow onboarding.

**Solution**: Generate `/llms.txt` (concise index) and `/llms-full.txt` (comprehensive context) as static files, updated in CI.

**Benefits**:
- AI assistants can quickly understand the codebase
- New contributors get up to speed faster
- Single source of truth for architecture

**Acceptance Criteria**:
- [ ] `static/llms.txt` exists and is served
- [ ] CI regenerates on doc changes
- [ ] Contains endpoint index, error codes, known bugs

---

## Architecture Overview

### Current State

```
┌─────────────────────────────────────────────────────────────────┐
│                         CURRENT STATE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Terminal ────► gt/bd CLI ────► File System (.beads/)          │
│                     │                                            │
│                     └────► SQLite (beads.db)                    │
│                                                                  │
│   Dashboard ────► HTTP GET / ────► 30s auto-refresh (HTMX)      │
│   (Built-in)                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Target State (Phase 1 MVP with v4.0 Innovations)

```
┌─────────────────────────────────────────────────────────────────┐
│              PHASE 1: CLI BRIDGE + V4.0 INNOVATIONS              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     HTTP      ┌────────────────────┐          │
│  │              │◄─────────────►│                    │          │
│  │  Browser     │               │  SvelteKit Server  │          │
│  │  (SPA)       │  SWR Cache    │  (Node.js)         │          │
│  │              │               │                    │          │
│  │  ┌────────┐  │               │  ┌──────────────┐  │          │
│  │  │SWR     │  │  SSE Stream   │  │ Effect.ts    │  │          │
│  │  │Cache   │◄─┼───────────────┼──┤ CLI Executor │  │          │
│  │  └────────┘  │               │  └──────┬───────┘  │          │
│  │              │               │         │          │          │
│  │  ┌────────┐  │               │         ▼          │          │
│  │  │Keyboard│  │               │  ┌──────────────┐  │          │
│  │  │Manager │  │               │  │ gt / bd CLI  │  │          │
│  │  └────────┘  │               │  │ + Retry      │  │          │
│  │              │               │  │ + Timeout    │  │          │
│  └──────────────┘               │  │ + Circuit    │  │          │
│                                 │  └──────┬───────┘  │          │
│                                 │         │          │          │
│                                 │         ▼          │          │
│                                 │  ┌──────────────┐  │          │
│                                 │  │ .events.jsonl│──┼─► SSE    │
│                                 │  │ File Watcher │  │          │
│                                 │  └──────────────┘  │          │
│                                 └────────────────────┘          │
│                                          │                      │
│                                          ▼                      │
│                                 ┌────────────────────┐          │
│                                 │  .beads/ + SQLite  │          │
│                                 └────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Target State (Phase 2+)

```
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 2+: REST + WEBSOCKET                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐                 ┌────────────────────┐        │
│  │              │     HTTP/WS     │                    │        │
│  │  Browser     │◄───────────────►│  SvelteKit Server  │        │
│  │  (SPA)       │                 │  (Auth + Proxy)    │        │
│  │              │                 │                    │        │
│  └──────────────┘                 └─────────┬──────────┘        │
│        │                                    │                    │
│        │ Real-time                          │ HTTP/WS            │
│        │ Events                             ▼                    │
│        │                        ┌────────────────────┐          │
│        │                        │                    │          │
│        └───────────────────────►│  Gastown Daemon    │          │
│          (WebSocket)            │  (Go + REST + WS)  │          │
│                                 │                    │          │
│                                 └─────────┬──────────┘          │
│                                           │                      │
│                                           ▼                      │
│                                 ┌────────────────────┐          │
│                                 │  .beads/ + SQLite  │          │
│                                 └────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Decision Log

Explicit architectural decisions with rationale. Format: `D{phase}.{number}`.

### D0.1 — Phase 1 Backend: SvelteKit Server Routes Execute CLI

**Decision**: Keep the existing pattern where `src/routes/api/gastown/**/+server.ts` calls `gt`/`bd` CLI and returns JSON.

**Rationale**:
- Minimal change, immediate leverage of CLI output
- Matches current UI code patterns
- Fastest path to "works on my machine"

**Trade-offs**:
| Pro | Con |
|-----|-----|
| No backend changes required | Local-only coupling |
| Leverage existing CLI | Scaling limits (~10 concurrent users) |
| Good for read-only dashboards | Polling-heavy, no streaming |

**Scope**: Visualization-first (read-only preferred), with limited "safe writes" later.

### D0.2 — Remote Topology: Two Origins

**Decision**: For remote/production mode, use two origins:
- UI: `https://ui.gastown.com`
- Daemon/API: `https://<instance>.gastown.com`

**Implications**:
- Browser calls daemon over HTTPS + WebSocket with CORS configured
- Auth model: Bearer tokens (not cookies for cross-origin)
- CORS allowlist exact origin, not `*`

**WebSocket Auth Options** (in preference order):
1. `Sec-WebSocket-Protocol` header to carry token (recommended)
2. Query param `wss://api.gastown.com/ws?token=...` (avoid logging tokens)
3. Cookies scoped to `.gastown.com` (complex SameSite settings)

### D0.3 — Event Model: Keep Current UI Types (Phase 1)

**Decision**: Stick with the UI's existing typed event names for Phase 1:
- `agent_status`, `log_entry`, `queue_update`, `workflow_update`

**Rationale**: Matches existing client code in `src/lib/stores/websocket.svelte.ts`.

**Migration Path** (Phase 2+):
- Daemon emits `snapshot/event/topic` model
- UI server (or client) maps to current types
- Later migrate UI to canonical model

### D0.4 — Safe Write Operations Definition

**Decision**: "Safe writes" are operations with:
- Bounded duration (< 3 minutes)
- Deterministic side-effects
- Idempotency (or unique request ID)
- Clear audit trail

**Current Posture**: Local dev can support limited writes via CLI. Remote mode treats writes as disabled until daemon API + auth exists.

**Safe Write Examples**:
| Operation | Safe? | Reason |
|-----------|-------|--------|
| `bd create` | Yes | Idempotent, bounded |
| `gt sling` | Yes | Bounded, auditable |
| `gt rig add` | Caution | Long-running but deterministic |
| `gt rig delete` | No | Destructive, needs confirmation |

### D0.5 — Process Supervisor: No Shell, Concurrency Limits, Cancellation (v5.0)

**Decision**: Replace shell-string `exec()` with a process supervisor that runs `gt`/`bd` using `spawn`/`execFile` with arg arrays, enforces global concurrency limits, supports cancellation, and captures streaming stderr/stdout.

**Rationale**:
- Eliminates shell-injection class of bugs and "sanitization deletes characters" issues
- Prevents the UI from self-DOSing the machine under polling
- Unlocks progress + better error UX for long-running ops (rig add, doctor)
- Makes CLI execution auditable and predictable

**Implementation**:
- `src/lib/server/cli/process-supervisor.ts`: Global semaphore (max 2-4 concurrent), in-flight deduping by `(cwd, argv)` key
- `src/lib/server/cli/exec.ts`: `runGt(args: string[], opts)` / `runBd(args: string[], opts)` returning typed `Result`
- Timeout per command (table-driven), cancellation via SIGTERM → SIGKILL escalation
- Streaming logs for long ops forwarded to Operation Center

**Acceptance Criteria**:
- No direct `child_process.exec()` usage in routes
- No shell command string interpolation anywhere
- Process count stays bounded under rapid navigation/refresh

### D0.6 — Capabilities Probe + CLI Contracts (v5.0)

**Decision**: On boot, probe CLI capabilities (versions, flags, JSON support) and use per-command contracts (Zod + fallbacks) so UI degrades gracefully on output drift.

**Rationale**:
- CLI output WILL drift over time; runtime validation makes drift obvious and diagnosable
- Instead of broken UI, users see clear "contract mismatch" with next steps
- Enables feature flags based on daemon version

**Implementation**:
- `GET /api/gastown/capabilities` returns `{ gtVersion, bdVersion, supportsEventsFile, supportsWrites, features: [] }`
- Per-command Zod schemas for: `gt status --json`, `bd list --json`, `bd show --json`, `gt convoys --json`
- Schema validation immediately after JSON parse in executor (single choke point)
- Fallback mode when schema validation fails (show raw data + warning)

**Acceptance Criteria**:
- Capabilities endpoint returns version info on boot
- Critical endpoints validate against Zod schemas
- Schema mismatches surface structured errors (not crashes)

### D0.7 — Watch-First Updates (v5.0)

**Decision**: Prefer file/event watchers + push (tail `.events.jsonl`, watch `.beads/`) for responsiveness; keep polling as fallback/SWR refresh.

**Rationale**:
- "Real-time" is what makes the UI compelling
- File watchers ship without daemon changes
- Polling becomes fallback, not primary mechanism

**Implementation**:
- `src/lib/server/watchers/events-tailer.ts`: Tail `.events.jsonl` → emit SSE
- `src/lib/server/watchers/beads-watcher.ts`: Watch `.beads/` directory → invalidate cache keys
- Client `EventSource` with reconnect + cursor-based resume
- Feature flag `supportsEventsFile` from capabilities probe

**Acceptance Criteria**:
- Activity page shows live updates within seconds
- `.beads/` changes trigger cache invalidation
- Graceful fallback to polling if watchers fail

### D0.8 — Power-User Ergonomics Bundle (v5.0)

**Decision**: Add Command Palette (⌘K), "Copy CLI equivalent" everywhere, and global search across agents/beads/convoys/mail.

**Rationale**:
- Target audience (developers) expects these patterns from VS Code, Raycast, etc.
- "Copy CLI equivalent" builds trust and teaches users the underlying commands
- Global search is table-stakes for productivity tools

**Implementation**:
- `src/lib/components/CommandPalette.svelte`: ⌘K / Ctrl+K triggered, fuzzy search, recent items
- Copy CLI button on every card/action (copies the exact `gt`/`bd` command)
- `src/lib/stores/search-index.ts`: In-memory index built from cached data
- Keyboard shortcuts: `/` for search focus, `gc` for command palette

**Acceptance Criteria**:
- ⌘K opens command palette from any page
- Every action shows its CLI equivalent
- Global search returns results in < 100ms

### D0.9 — LLM-Friendly Docs Surface (v5.0)

**Decision**: Add `/llms.txt` + `/llms-full.txt` for Gas Town UI, generated from docs in CI and served as static files.

**Rationale**:
- LLMs (including Claude Code) work better with structured context
- Accelerates contributor onboarding
- Documents architecture decisions in machine-readable format

**Implementation**:
- `static/llms.txt`: Concise index (~500 lines) - project overview, phase 1 architecture, endpoint index, known bugs
- `static/llms-full.txt`: Full concatenation (~3000 lines) - architecture + API + troubleshooting + all docs
- CI script regenerates on docs changes
- Link from README

**Acceptance Criteria**:
- `/llms.txt` returns valid, current content
- CI regenerates on doc changes
- Content stays under 50KB (fits in context windows)

### D0.10 — Observable Operations (v5.0)

**Decision**: Every CLI execution includes correlation IDs, structured logs, and timing metrics for debugging and operational visibility.

**Rationale**:
- Faster debugging when things go wrong
- Foundation for metrics/alerting in production
- Users can copy "debug bundle" when reporting issues

**Implementation**:
- `requestId` (UUID) attached to every CLI call, included in logs and error responses
- Structured JSON logs: `{ timestamp, requestId, command, durationMs, exitCode, cached }`
- `GET /api/gastown/diagnostics` returns system state (CLI presence, town root, recent errors)
- Error responses include `requestId` for correlation

**Acceptance Criteria**:
- All CLI calls logged with requestId and duration
- Error responses include requestId
- Diagnostics endpoint returns system health

### D4.1 — Effect.ts for CLI Execution (v4.0)

**Decision**: Use Effect.ts to wrap all CLI execution with type-safe error handling, retry, timeout, and circuit breaker.

**Rationale**:
- Errors become first-class citizens tracked at compile time
- Built-in retry and timeout policies eliminate boilerplate
- Circuit breaker prevents cascading failures
- Streaming primitives support file watching

**Trade-offs**:
| Pro | Con |
|-----|-----|
| Type-safe error handling | ~50KB bundle addition |
| Built-in retry/timeout | Learning curve for team |
| Circuit breaker | Requires refactoring existing code |
| Streaming support | Overkill for simple cases |

### D4.2 — SWR Caching Pattern (v4.0)

**Decision**: Implement Stale-While-Revalidate caching for all read endpoints.

**Rationale**:
- Instant perceived performance (serve cached, revalidate in background)
- Reduces CLI load (deduplicated requests)
- Works offline (last-known state)

**Trade-offs**:
| Pro | Con |
|-----|-----|
| Instant page loads | Potentially stale data shown |
| Reduced server load | Cache invalidation complexity |
| Offline support | Memory usage for cache |

### D4.3 — File-Based Activity Streaming (v4.0)

**Decision**: Stream `.events.jsonl` via Node.js file watching + SSE for real-time activity feed.

**Rationale**:
- Provides real-time updates without Go backend changes
- SSE is simpler than WebSocket for one-way push
- Foundation for Phase 3 WebSocket patterns

**Trade-offs**:
| Pro | Con |
|-----|-----|
| No backend changes | File format may change |
| Simpler than WebSocket | Limited to single machine |
| SSE is widely supported | No bidirectional communication |

### D4.4 — Vim-Style Keyboard Navigation (v4.0)

**Decision**: Implement comprehensive vim-style keyboard navigation with g-prefix routes, j/k list navigation, and command palette.

**Rationale**:
- Target audience (developers) expects keyboard-first UX
- Matches terminal tool mental model
- Accessibility benefit (keyboard navigation)

**Trade-offs**:
| Pro | Con |
|-----|-----|
| Power user delight | Learning curve for non-vim users |
| Accessibility bonus | More keybindings to maintain |
| Differentiator | Conflict potential with browser shortcuts |

---

## Critical User Journeys (CUJs)

The UI is designed around **what users actually do**, not API endpoints. Each journey has defined states, transitions, and feedback mechanisms.

### CUJ-1: Rig Management

**Goal**: User adds a repository (rig) to the system for agents to work on.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUJ-1: RIG MANAGEMENT                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER ACTION                    UI STATE                         │
│  ───────────                    ────────                         │
│                                                                  │
│  1. Press "g r"                 → Navigate to /rigs (keyboard)   │
│  2. Press "a" or click "Add"    → Modal opens                    │
│  3. Enter name + URL            → Validation runs                │
│  4. Press Enter or click "Add"  → Modal closes IMMEDIATELY       │
│                                 → Toast: "Adding rig..."         │
│                                 → Rig appears in list: PENDING   │
│                                 → SWR cache updated optimistically│
│                                                                  │
│  [... git clone runs: 30-150 seconds ...]                       │
│                                                                  │
│  5. (Async) Clone completes     → Toast: "zoo-game added"        │
│                                 → Rig status: ACTIVE             │
│                                 → SWR revalidates automatically  │
│                                                                  │
│  ERROR PATH:                                                     │
│  5a. Clone fails                → Toast: "Failed to add rig"     │
│                                 → Rig status: ERROR              │
│                                 → Effect.ts retry exhausted      │
│                                 → Circuit breaker if repeated    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Timing**:
- Modal close: **Immediate** (non-blocking)
- Initial toast: **< 100ms**
- Git clone: **30-150 seconds** (depends on repo size)
- Status update: Via SWR revalidation (5s) or SSE stream

**State Transitions**:
```typescript
type RigState = 'pending' | 'cloning' | 'active' | 'error' | 'parked';

// Transition diagram
// pending → cloning → active
//                  ↘ error
```

### CUJ-2: Work Item Lifecycle (Beads)

**Goal**: User creates a work item (bead) and tracks it through completion.

```
┌─────────────────────────────────────────────────────────────────┐
│                 CUJ-2: WORK ITEM LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  USER ACTION                    UI STATE                         │
│  ───────────                    ────────                         │
│                                                                  │
│  1. Press "g w"                 → Navigate to /work (keyboard)   │
│  2. Press "c" or click "New"    → Form modal opens               │
│  3. Fill form:                                                   │
│     - Title: "Analyze code"                                     │
│     - Priority: "high" (Tab + Enter)                            │
│     - Labels: "analysis"                                        │
│  4. Press Cmd+Enter or click    → Modal closes                   │
│                                 → Toast: "Creating work item..." │
│                                 → Toast: "Work item created:     │
│                                          hq-abc123"              │
│                                 → Item appears at TOP (optimistic)│
│                                 → SWR cache invalidated          │
│                                                                  │
│  KEYBOARD FLOW:                                                  │
│  - "j/k" to navigate items                                      │
│  - "Enter" to view details                                      │
│  - "Escape" to go back                                          │
│  - "/" to search/filter                                         │
│                                                                  │
│  ID EXTRACTION:                                                  │
│  - Toast contains ID in format: ([a-z]+-[a-z0-9]+)              │
│  - Item element has: data-bead-id="hq-abc123"                   │
│  - URL becomes: /work/hq-abc123 (if navigating)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CUJ-3: Orchestration (Slinging)

**Goal**: User assigns a work item to a specific agent/rig combination.

```
┌─────────────────────────────────────────────────────────────────┐
│                  CUJ-3: ORCHESTRATION (SLING)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PREREQUISITE: CUJ-1 (Rig exists) + CUJ-2 (Work item exists)    │
│                                                                  │
│  USER ACTION                    UI STATE                         │
│  ───────────                    ────────                         │
│                                                                  │
│  1. On work item, press "s"     → Sling dialog opens (keyboard)  │
│  2. Type to filter targets      → Fuzzy search filters list      │
│  3. Press j/k + Enter           → Select target                  │
│     OR click target                                              │
│  4. Press Enter to confirm      → Dialog closes                  │
│                                 → Toast: "Slinging to witness..."│
│                                 → Work item: ASSIGNED badge      │
│                                                                  │
│  5. (Async) Agent receives      → Toast: "Work slung to witness" │
│                                 → Status: IN_PROGRESS            │
│                                 → Activity stream shows event    │
│                                                                  │
│  ERROR HANDLING (Effect.ts):                                     │
│  - Retry up to 3 times with backoff                             │
│  - Circuit breaker after 5 failures in 60s                      │
│  - Known bug detection for "daemon not running"                 │
│  - Graceful degradation: "Sling queued (daemon offline)"        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CUJ-4: System Monitoring (Dashboard)

**Goal**: User monitors overall system health and agent activity.

```
┌─────────────────────────────────────────────────────────────────┐
│                  CUJ-4: SYSTEM MONITORING                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DASHBOARD LAYOUT:                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  HEADER: Town Name | Daemon Status | Last Refresh       │    │
│  │          [Press ? for shortcuts]                        │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │                                                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │   AGENTS     │  │    QUEUE     │  │   HEALTH     │  │    │
│  │  │   5 Active   │  │   3 Pending  │  │   Healthy    │  │    │
│  │  │   2 Idle     │  │   1 Running  │  │   2 Warnings │  │    │
│  │  │   1 Stuck    │  │              │  │              │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │  ACTIVITY FEED (Real-time via SSE)              │   │    │
│  │  │  - 10:45 - nux completed task hq-123           │   │    │
│  │  │  - 10:42 - witness started code review         │   │    │
│  │  │  - 10:40 - dag merged PR #45                   │   │    │
│  │  │  [Live updates - no refresh needed]            │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  KEYBOARD SHORTCUTS:                                            │
│  - "r" to refresh all data                                     │
│  - "j/k" to navigate agents                                    │
│  - "Enter" to view agent details                               │
│  - "g a" to go to agents page                                  │
│  - "?" to show all shortcuts                                   │
│                                                                  │
│  SWR BEHAVIOR:                                                  │
│  - Cached data shown INSTANTLY on navigation                   │
│  - Background revalidation every 5 seconds                     │
│  - "Updating..." indicator during revalidation                 │
│  - Stale data acceptable (< 10s old)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### CUJ-5: Mail/Communication View

**Goal**: User views inter-agent messages and escalations.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUJ-5: MAIL VIEW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INBOX LAYOUT:                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  INBOX (12 unread)                    [r] Refresh        │    │
│  │  [/] Search   [j/k] Navigate   [Enter] Open             │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │  * ESCALATION: Agent dag stuck on merge conflict        │    │
│  │    From: witness | 2 min ago | Priority: HIGH           │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  o HANDOFF: Context passed from nux to dag              │    │
│  │    From: nux | 15 min ago | Priority: NORMAL            │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  o DONE: Task hq-abc123 completed                       │    │
│  │    From: dag | 1 hour ago | Priority: NORMAL            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  MESSAGE TYPE BADGES:                                           │
│  - ESCALATION (red)   - Requires attention                     │
│  - HANDOFF (blue)     - Context transfer                       │
│  - DONE (green)       - Work completed                         │
│  - ERROR (orange)     - Something failed                       │
│  - MESSAGE (gray)     - General communication                  │
│                                                                  │
│  NEW MAIL NOTIFICATION:                                         │
│  - SSE stream pushes new mail events                           │
│  - Unread count updates in real-time                           │
│  - Browser notification for ESCALATION type                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP (CLI Bridge)

### Scope
- **Visualization only** (read-only dashboard)
- Replace `gt status`, `gt convoy`, `gt mail inbox` with web UI
- SWR caching with 5-second background revalidation
- Demo authentication (UI-only)
- No backend modifications
- **Non-blocking UI for all operations**
- **Effect.ts for CLI execution** (v4.0)
- **Real-time activity via SSE** (v4.0)
- **Vim-style keyboard navigation** (v4.0)

### Features

| Feature | CLI Equivalent | Priority | Status | CUJ |
|---------|---------------|----------|--------|-----|
| System Status | `gt status --json` | P0 | Partial | CUJ-4 |
| Agent List | `gt status --json` (parse agents) | P0 | Missing | CUJ-4 |
| Agent Details | `gt peek <agent>` | P1 | Missing | CUJ-4 |
| Convoy List | `gt convoy list --json` | P0 | Partial | CUJ-4 |
| Convoy Details | `gt convoy show <id> --json` | P1 | Missing | CUJ-4 |
| Mail Inbox | `bd list --type=message --json` | P0 | Done | CUJ-5 |
| Mail Thread | `gt mail thread <id>` | P2 | Missing | CUJ-5 |
| Merge Queue | `gt mq list --json` | P0 | Missing | CUJ-4 |
| Rig Status | `gt rig list --json` | P1 | Partial | CUJ-1 |
| Activity Feed | `.events.jsonl` stream | P0 | Missing | CUJ-4 |
| Workflow List | `gt formula list` | P2 | Missing | CUJ-4 |
| Health Check | `gt doctor --json` | P2 | Missing | CUJ-4 |
| Work Items | `bd list --type=task --json` | P0 | Missing | CUJ-2 |

### Server Route Implementation

```
src/routes/api/gastown/
├── status/+server.ts          EXISTS - gt status --json
├── agents/
│   ├── +server.ts             NEW - Parse agents from gt status
│   └── [id]/+server.ts        NEW - gt peek <id>
├── convoys/
│   ├── +server.ts             EXISTS - gt convoy list --json
│   └── [id]/+server.ts        NEW - gt convoy show <id> --json
├── mail/
│   ├── +server.ts             EXISTS - bd list --type=message
│   └── [id]/+server.ts        NEW - bd show <id> --json
├── queue/
│   └── +server.ts             NEW - gt mq list --json
├── rigs/
│   ├── +server.ts             EXISTS - gt rig list --json
│   └── [name]/+server.ts      NEW - gt rig show <name>
├── work/
│   ├── issues/+server.ts      EXISTS - bd list
│   └── [id]/+server.ts        NEW - bd show <id> --json
├── feed/
│   ├── +server.ts             NEW - read .events.jsonl (last N)
│   └── stream/+server.ts      NEW - SSE stream of new events
├── workflows/
│   ├── formulas/+server.ts    EXISTS - gt formula list
│   └── molecules/+server.ts   EXISTS - bd list --type=molecule
├── dashboard/
│   └── +server.ts             NEW - composite endpoint
├── snapshot/
│   └── +server.ts             NEW - coherent snapshot (status+queue+mail+convoys)
├── capabilities/
│   └── +server.ts             NEW - CLI capability probe (versions, flags, features)
├── diagnostics/
│   └── +server.ts             NEW - system health (CLI presence, town root, errors)
├── operations/
│   ├── +server.ts             NEW - list running operations
│   └── [id]/+server.ts        NEW - operation status + logs
└── health/
    └── +server.ts             NEW - gt doctor --json
```

### Capabilities Endpoint

Probes CLI on boot and caches the result. Returns version info, supported flags, and feature availability.

```typescript
// src/routes/api/gastown/capabilities/+server.ts

import { json } from '@sveltejs/kit';
import { runGt, runBd } from '$lib/server/cli/exec';
import { z } from 'zod';

const CapabilitiesSchema = z.object({
  gtVersion: z.string(),
  bdVersion: z.string(),
  supportsEventsFile: z.boolean(),
  supportsWrites: z.boolean(),
  supportsJson: z.record(z.boolean()),
  features: z.array(z.string())
});

type Capabilities = z.infer<typeof CapabilitiesSchema>;

let cached: Capabilities | null = null;
let cachedAt = 0;
const CACHE_TTL = 60_000; // 1 minute

async function probeCapabilities(): Promise<Capabilities> {
  const [gtVersion, bdVersion] = await Promise.all([
    runGt<{ version: string }>(['--version']),
    runBd<{ version: string }>(['--version'])
  ]);

  // Probe JSON support for critical commands
  const jsonProbes = await Promise.all([
    runGt(['status', '--json']).then(r => r.success),
    runGt(['convoys', '--json']).then(r => r.success),
    runBd(['list', '--json']).then(r => r.success)
  ]);

  // Check for .events.jsonl
  const fs = await import('fs/promises');
  const config = await import('$lib/config/environment');
  const eventsPath = `${config.default.townRoot}/.events.jsonl`;
  const supportsEventsFile = await fs.access(eventsPath).then(() => true).catch(() => false);

  return {
    gtVersion: gtVersion.data?.version ?? 'unknown',
    bdVersion: bdVersion.data?.version ?? 'unknown',
    supportsEventsFile,
    supportsWrites: config.default.enableWrites,
    supportsJson: {
      'gt status': jsonProbes[0],
      'gt convoys': jsonProbes[1],
      'bd list': jsonProbes[2]
    },
    features: [
      supportsEventsFile && 'events-stream',
      config.default.enableWrites && 'writes'
    ].filter(Boolean) as string[]
  };
}

export async function GET() {
  const now = Date.now();
  if (!cached || now - cachedAt > CACHE_TTL) {
    cached = await probeCapabilities();
    cachedAt = now;
  }

  return json({
    success: true,
    data: cached,
    freshness: { fetchedAt: new Date(cachedAt).toISOString(), ttlMs: CACHE_TTL }
  });
}
```

### Diagnostics Endpoint

Self-service diagnostics for setup issues. Checks CLI presence, town root, and recent errors.

```typescript
// src/routes/api/gastown/diagnostics/+server.ts

import { json } from '@sveltejs/kit';
import { runGt } from '$lib/server/cli/exec';
import { config } from '$lib/config/environment';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface Diagnostic {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: unknown;
}

export async function GET() {
  const diagnostics: Diagnostic[] = [];

  // Check gt binary
  try {
    const { stdout } = await execFileAsync('which', ['gt']);
    diagnostics.push({
      check: 'gt_binary',
      status: 'pass',
      message: 'gt binary found',
      details: { path: stdout.trim() }
    });
  } catch {
    diagnostics.push({
      check: 'gt_binary',
      status: 'fail',
      message: 'gt binary not found in PATH'
    });
  }

  // Check bd binary
  try {
    const { stdout } = await execFileAsync('which', ['bd']);
    diagnostics.push({
      check: 'bd_binary',
      status: 'pass',
      message: 'bd binary found',
      details: { path: stdout.trim() }
    });
  } catch {
    diagnostics.push({
      check: 'bd_binary',
      status: 'fail',
      message: 'bd binary not found in PATH'
    });
  }

  // Check town root
  const fs = await import('fs/promises');
  try {
    await fs.access(config.townRoot);
    diagnostics.push({
      check: 'town_root',
      status: 'pass',
      message: 'Town root directory accessible',
      details: { path: config.townRoot }
    });
  } catch {
    diagnostics.push({
      check: 'town_root',
      status: 'fail',
      message: 'Town root directory not accessible',
      details: { path: config.townRoot }
    });
  }

  // Check daemon status
  const status = await runGt(['status', '--json']);
  if (status.success) {
    diagnostics.push({
      check: 'daemon_status',
      status: 'pass',
      message: 'Daemon is running',
      details: status.data
    });
  } else {
    diagnostics.push({
      check: 'daemon_status',
      status: status.error?.code === 'KNOWN_BUG' ? 'warn' : 'fail',
      message: status.error?.message ?? 'Daemon check failed',
      details: { error: status.error }
    });
  }

  const allPass = diagnostics.every(d => d.status === 'pass');
  const anyFail = diagnostics.some(d => d.status === 'fail');

  return json({
    success: !anyFail,
    status: allPass ? 'healthy' : anyFail ? 'unhealthy' : 'degraded',
    diagnostics,
    timestamp: new Date().toISOString()
  });
}
```

---

## Phase 2: REST API

### Scope
- Add HTTP REST endpoints to Go backend
- Session-based authentication
- RBAC preparation
- OpenAPI specification

### Go Backend Changes

Location: `internal/web/api/`

```go
// internal/web/api/routes.go
func RegisterAPIRoutes(mux *http.ServeMux) {
    // Auth
    mux.HandleFunc("POST /api/v1/auth/login", handleLogin)
    mux.HandleFunc("POST /api/v1/auth/logout", handleLogout)
    mux.HandleFunc("GET /api/v1/auth/me", handleMe)

    // Agents
    mux.HandleFunc("GET /api/v1/agents", handleListAgents)
    mux.HandleFunc("GET /api/v1/agents/{id}", handleGetAgent)

    // Convoys
    mux.HandleFunc("GET /api/v1/convoys", handleListConvoys)
    mux.HandleFunc("GET /api/v1/convoys/{id}", handleGetConvoy)

    // Mail
    mux.HandleFunc("GET /api/v1/mail", handleListMail)
    mux.HandleFunc("GET /api/v1/mail/{id}", handleGetMail)
    mux.HandleFunc("POST /api/v1/mail", handleSendMail)

    // Queue
    mux.HandleFunc("GET /api/v1/queue", handleListQueue)

    // Rigs
    mux.HandleFunc("GET /api/v1/rigs", handleListRigs)
    mux.HandleFunc("GET /api/v1/rigs/{name}", handleGetRig)
    mux.HandleFunc("POST /api/v1/rigs", handleAddRig)

    // Work Items
    mux.HandleFunc("GET /api/v1/work", handleListWork)
    mux.HandleFunc("GET /api/v1/work/{id}", handleGetWork)
    mux.HandleFunc("POST /api/v1/work", handleCreateWork)
    mux.HandleFunc("POST /api/v1/work/{id}/sling", handleSlingWork)

    // Health
    mux.HandleFunc("GET /api/v1/health", handleHealth)
}
```

### Benefits Over CLI Bridge

| Metric | CLI Bridge | REST API |
|--------|------------|----------|
| Latency | 50-200ms | 5-20ms |
| Concurrent Users | ~10 | ~1000 |
| Type Safety | JSON parsing | OpenAPI types |
| Error Handling | String parsing | Structured errors |
| Streaming | Not possible | Chunked responses |

---

## Phase 3: Real-Time

### Scope
- WebSocket server in Go
- Event streaming for agent status, logs, queue
- Live log tailing
- Real-time notifications
- Replace polling with push updates

### WebSocket Protocol

```typescript
type WSMessageType =
  | 'ping' | 'pong'
  | 'subscribe' | 'unsubscribe'
  | 'agent_status'
  | 'log_entry'
  | 'queue_update'
  | 'convoy_update'
  | 'mail_received'
  | 'rig_status'
  | 'work_status';

interface WSSubscribe {
  type: 'subscribe';
  channels: ('agents' | 'logs' | 'queue' | 'convoys' | 'mail' | 'rigs' | 'work')[];
}

interface WSAgentStatus {
  type: 'agent_status';
  agent_id: string;
  status: string;
  current_task?: string;
  timestamp: number;
}
```

---

## Effect.ts CLI Execution Layer

### Overview

Effect.ts replaces imperative Promise-based CLI execution with a functional, type-safe approach that tracks errors, dependencies, and async operations at the type level.

### Installation

```bash
bun add effect @effect/schema
```

### Core Implementation

```typescript
// src/lib/server/effect-cli.ts
import { Effect, pipe, Schedule, Duration } from 'effect';
import { Schema } from '@effect/schema';
import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '$lib/config/environment';

const execAsync = promisify(exec);

// Define error types
export class CLIError {
  readonly _tag = 'CLIError';
  constructor(
    readonly command: string,
    readonly exitCode: number | undefined,
    readonly stderr: string,
    readonly cause: unknown
  ) {}
}

export class ParseError {
  readonly _tag = 'ParseError';
  constructor(
    readonly command: string,
    readonly output: string,
    readonly cause: unknown
  ) {}
}

export class TimeoutError {
  readonly _tag = 'TimeoutError';
  constructor(
    readonly command: string,
    readonly timeout: number
  ) {}
}

export class CircuitOpenError {
  readonly _tag = 'CircuitOpenError';
  constructor(
    readonly command: string,
    readonly message: string
  ) {}
}

// Union of all CLI errors
export type CLIExecutionError = CLIError | ParseError | TimeoutError | CircuitOpenError;

// Circuit breaker state
interface CircuitState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitState: Map<string, CircuitState> = new Map();
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60000;

function checkCircuit(key: string): Effect.Effect<void, CircuitOpenError> {
  const state = circuitState.get(key);
  if (state?.isOpen) {
    const elapsed = Date.now() - state.lastFailure;
    if (elapsed < CIRCUIT_RESET_MS) {
      return Effect.fail(new CircuitOpenError(key, `Circuit open, retry in ${Math.ceil((CIRCUIT_RESET_MS - elapsed) / 1000)}s`));
    }
    // Reset circuit
    circuitState.delete(key);
  }
  return Effect.succeed(undefined);
}

function recordFailure(key: string): void {
  const state = circuitState.get(key) ?? { failures: 0, lastFailure: 0, isOpen: false };
  state.failures++;
  state.lastFailure = Date.now();
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.isOpen = true;
  }
  circuitState.set(key, state);
}

function recordSuccess(key: string): void {
  circuitState.delete(key);
}

// Core execution effect
function execCommand(
  command: string,
  options: { cwd?: string; timeout?: number } = {}
): Effect.Effect<{ stdout: string; stderr: string }, CLIError | TimeoutError> {
  const { cwd = process.cwd(), timeout = config.GASTOWN_CLI_TIMEOUT } = options;

  return Effect.tryPromise({
    try: async () => {
      const result = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      return result;
    },
    catch: (error) => {
      const execError = error as { code?: number; stderr?: string; killed?: boolean };
      if (execError.killed) {
        return new TimeoutError(command, timeout);
      }
      return new CLIError(command, execError.code, execError.stderr ?? '', error);
    },
  });
}

// GT command with retry, timeout, and circuit breaker
export function execGt<T>(
  args: string,
  schema?: Schema.Schema<T>,
  options: {
    timeout?: number;
    retries?: number;
    cache?: boolean;
  } = {}
): Effect.Effect<T, CLIExecutionError> {
  const command = `${config.GASTOWN_GT_BIN} ${args}`;
  const circuitKey = `gt:${args.split(' ')[0]}`;
  const { timeout = config.GASTOWN_CLI_TIMEOUT, retries = 3 } = options;

  const retryPolicy = Schedule.exponential(Duration.millis(500)).pipe(
    Schedule.jittered,
    Schedule.compose(Schedule.recurs(retries))
  );

  return pipe(
    // Check circuit breaker
    checkCircuit(circuitKey),
    // Execute command
    Effect.flatMap(() => execCommand(command, { cwd: config.GASTOWN_TOWN_ROOT, timeout })),
    // Parse output
    Effect.flatMap(({ stdout, stderr }) => {
      if (schema) {
        return pipe(
          Effect.try(() => JSON.parse(stdout)),
          Effect.flatMap((json) => Schema.decode(schema)(json)),
          Effect.mapError((e) => new ParseError(command, stdout, e))
        );
      }
      return Effect.succeed(stdout as T);
    }),
    // Apply retry policy
    Effect.retry(retryPolicy),
    // Record success/failure for circuit breaker
    Effect.tap(() => Effect.sync(() => recordSuccess(circuitKey))),
    Effect.tapError(() => Effect.sync(() => recordFailure(circuitKey)))
  );
}

// BD command (similar pattern)
export function execBd<T>(
  args: string,
  schema?: Schema.Schema<T>,
  options: {
    timeout?: number;
    retries?: number;
  } = {}
): Effect.Effect<T, CLIExecutionError> {
  const command = `${config.GASTOWN_BD_BIN} ${args}`;
  const circuitKey = `bd:${args.split(' ')[0]}`;
  const { timeout = config.GASTOWN_CLI_TIMEOUT, retries = 3 } = options;

  const retryPolicy = Schedule.exponential(Duration.millis(500)).pipe(
    Schedule.jittered,
    Schedule.compose(Schedule.recurs(retries))
  );

  return pipe(
    checkCircuit(circuitKey),
    Effect.flatMap(() => execCommand(command, { cwd: config.GASTOWN_BD_CWD, timeout })),
    Effect.flatMap(({ stdout }) => {
      if (schema) {
        return pipe(
          Effect.try(() => JSON.parse(stdout)),
          Effect.flatMap((json) => Schema.decode(schema)(json)),
          Effect.mapError((e) => new ParseError(command, stdout, e))
        );
      }
      return Effect.succeed(stdout as T);
    }),
    Effect.retry(retryPolicy),
    Effect.tap(() => Effect.sync(() => recordSuccess(circuitKey))),
    Effect.tapError(() => Effect.sync(() => recordFailure(circuitKey)))
  );
}

// Run effect and convert to Promise for SvelteKit
export function runEffect<T, E>(
  effect: Effect.Effect<T, E>
): Promise<{ success: true; data: T } | { success: false; error: E }> {
  return Effect.runPromise(
    pipe(
      effect,
      Effect.map((data) => ({ success: true as const, data })),
      Effect.catchAll((error) => Effect.succeed({ success: false as const, error }))
    )
  );
}
```

### Usage in API Routes

```typescript
// src/routes/api/gastown/status/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execGt, runEffect } from '$lib/server/effect-cli';
import { GtStatusSchema } from '$lib/types/gastown.schema';

export const GET: RequestHandler = async () => {
  const result = await runEffect(
    execGt('status --json', GtStatusSchema, { retries: 3, timeout: 30000 })
  );

  if (!result.success) {
    const error = result.error;

    // Handle specific error types
    if (error._tag === 'CircuitOpenError') {
      return json({ error: 'Service temporarily unavailable', retry_after: 60 }, { status: 503 });
    }
    if (error._tag === 'TimeoutError') {
      return json({ error: 'Request timed out' }, { status: 504 });
    }
    if (error._tag === 'ParseError') {
      return json({ error: 'Invalid response from CLI' }, { status: 502 });
    }

    return json({ error: 'CLI command failed' }, { status: 500 });
  }

  return json(result.data);
};
```

### Known Bug Detection with Effect

```typescript
// src/lib/server/known-bugs.ts
import { Effect, pipe } from 'effect';
import { CLIError } from './effect-cli';

export interface KnownBug {
  pattern: RegExp;
  userMessage: string;
  suggestedAction: string;
  isSoftFail: boolean;
}

export const KNOWN_BUGS: Record<string, KnownBug> = {
  MOL_BOND_DAEMON: {
    pattern: /mol bond.*daemon/i,
    userMessage: 'Command queued (daemon not running)',
    suggestedAction: 'Run "gt up" to start the daemon',
    isSoftFail: true,
  },
  GIT_AUTH_FAILED: {
    pattern: /Permission denied|Authentication failed/i,
    userMessage: 'Git authentication failed',
    suggestedAction: 'Check your SSH keys or credentials',
    isSoftFail: false,
  },
  BEADS_LOCKED: {
    pattern: /database is locked/i,
    userMessage: 'Database temporarily locked',
    suggestedAction: 'Wait a moment and try again',
    isSoftFail: true,
  },
};

export function identifyKnownBug(error: CLIError): KnownBug | null {
  for (const bug of Object.values(KNOWN_BUGS)) {
    if (bug.pattern.test(error.stderr)) {
      return bug;
    }
  }
  return null;
}

// Effect-based error recovery
export function withKnownBugRecovery<T>(
  effect: Effect.Effect<T, CLIError>,
  fallback: T
): Effect.Effect<T, CLIError> {
  return pipe(
    effect,
    Effect.catchTag('CLIError', (error) => {
      const bug = identifyKnownBug(error);
      if (bug?.isSoftFail) {
        console.warn(`Known bug detected: ${bug.userMessage}`);
        return Effect.succeed(fallback);
      }
      return Effect.fail(error);
    })
  );
}
```

---

## Stale-While-Revalidate (SWR) Pattern

### Overview

SWR is a caching strategy that returns cached data immediately while revalidating in the background. This provides instant perceived performance while keeping data fresh.

### Client-Side Implementation

```typescript
// src/lib/stores/swr.svelte.ts
import { browser } from '$app/environment';

interface SWRState<T> {
  data: T | null;
  error: Error | null;
  isValidating: boolean;
  isStale: boolean;
  lastUpdated: number;
}

interface SWROptions<T> {
  /** Initial data (from SSR) */
  fallbackData?: T;
  /** Time in ms before data is considered stale */
  staleTime?: number;
  /** Dedupe interval in ms */
  dedupingInterval?: number;
  /** Revalidate on window focus */
  revalidateOnFocus?: boolean;
  /** Revalidate on network reconnect */
  revalidateOnReconnect?: boolean;
  /** Polling interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Error retry count */
  errorRetryCount?: number;
  /** Persist to localStorage */
  persist?: boolean;
}

const DEFAULT_OPTIONS: Required<SWROptions<unknown>> = {
  fallbackData: undefined,
  staleTime: 5000,
  dedupingInterval: 2000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  refreshInterval: 0,
  errorRetryCount: 3,
  persist: false,
};

// Global cache
const cache = new Map<string, { data: unknown; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export function createSWR<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: SWROptions<T> = {}
) {
  const opts = { ...DEFAULT_OPTIONS, ...options } as Required<SWROptions<T>>;

  // State using Svelte 5 runes
  let state = $state<SWRState<T>>({
    data: opts.fallbackData ?? null,
    error: null,
    isValidating: false,
    isStale: true,
    lastUpdated: 0,
  });

  // Load from cache/localStorage on init
  if (browser) {
    const cached = cache.get(key);
    if (cached) {
      state.data = cached.data as T;
      state.lastUpdated = cached.timestamp;
      state.isStale = Date.now() - cached.timestamp > opts.staleTime;
    } else if (opts.persist) {
      try {
        const stored = localStorage.getItem(`swr:${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          state.data = parsed.data;
          state.lastUpdated = parsed.timestamp;
          state.isStale = true; // Always stale from localStorage
        }
      } catch { /* ignore */ }
    }
  }

  async function revalidate(): Promise<void> {
    // Dedupe concurrent requests
    const existing = inFlightRequests.get(key);
    if (existing) {
      await existing;
      return;
    }

    state.isValidating = true;

    const promise = fetcher();
    inFlightRequests.set(key, promise);

    try {
      const data = await promise;
      const timestamp = Date.now();

      state.data = data;
      state.error = null;
      state.lastUpdated = timestamp;
      state.isStale = false;

      // Update cache
      cache.set(key, { data, timestamp });

      // Persist to localStorage
      if (opts.persist && browser) {
        try {
          localStorage.setItem(`swr:${key}`, JSON.stringify({ data, timestamp }));
        } catch { /* ignore quota errors */ }
      }
    } catch (err) {
      state.error = err as Error;
    } finally {
      state.isValidating = false;
      inFlightRequests.delete(key);
    }
  }

  // Auto-revalidate on mount if stale
  if (browser && state.isStale) {
    revalidate();
  }

  // Focus listener
  if (browser && opts.revalidateOnFocus) {
    const handleFocus = () => {
      if (Date.now() - state.lastUpdated > opts.staleTime) {
        revalidate();
      }
    };
    window.addEventListener('focus', handleFocus);
  }

  // Network reconnect listener
  if (browser && opts.revalidateOnReconnect) {
    const handleOnline = () => revalidate();
    window.addEventListener('online', handleOnline);
  }

  // Polling
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  if (browser && opts.refreshInterval > 0) {
    pollInterval = setInterval(() => {
      if (!document.hidden) {
        revalidate();
      }
    }, opts.refreshInterval);
  }

  return {
    get data() { return state.data; },
    get error() { return state.error; },
    get isValidating() { return state.isValidating; },
    get isStale() { return state.isStale; },
    get lastUpdated() { return state.lastUpdated; },
    revalidate,
    mutate(data: T) {
      state.data = data;
      state.lastUpdated = Date.now();
      state.isStale = false;
      cache.set(key, { data, timestamp: state.lastUpdated });
    },
  };
}

// Convenience function for API endpoints
export function useSWR<T>(endpoint: string, options: SWROptions<T> = {}) {
  return createSWR<T>(
    endpoint,
    async () => {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    options
  );
}
```

### Usage in Components

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { useSWR } from '$lib/stores/swr.svelte';
  import type { GtStatus } from '$lib/types/gastown';

  const status = useSWR<GtStatus>('/api/gastown/status', {
    refreshInterval: 5000,
    staleTime: 3000,
    revalidateOnFocus: true,
  });
</script>

<div class="dashboard">
  {#if status.isValidating && !status.data}
    <LoadingSpinner />
  {:else if status.error}
    <ErrorCard error={status.error} onRetry={() => status.revalidate()} />
  {:else if status.data}
    <DashboardContent data={status.data} />

    {#if status.isValidating}
      <div class="updating-indicator">Updating...</div>
    {/if}

    {#if status.isStale}
      <div class="stale-indicator">
        Last updated: {formatRelativeTime(status.lastUpdated)}
      </div>
    {/if}
  {/if}
</div>
```

### Server-Side Integration

```typescript
// src/routes/+page.server.ts
import type { PageServerLoad } from './$types';
import { execGt, runEffect } from '$lib/server/effect-cli';
import { GtStatusSchema } from '$lib/types/gastown.schema';

export const load: PageServerLoad = async () => {
  const result = await runEffect(
    execGt('status --json', GtStatusSchema)
  );

  return {
    // Pass as fallbackData to SWR
    status: result.success ? result.data : null,
  };
};
```

### Cache Invalidation

```typescript
// src/lib/stores/swr.svelte.ts (additions)

// Invalidate specific key
export function invalidate(key: string): void {
  cache.delete(key);
  if (browser) {
    localStorage.removeItem(`swr:${key}`);
  }
}

// Invalidate keys matching pattern
export function invalidatePattern(pattern: RegExp): void {
  for (const key of cache.keys()) {
    if (pattern.test(key)) {
      invalidate(key);
    }
  }
}

// Mutate cache optimistically
export function mutateCache<T>(key: string, updater: (current: T | undefined) => T): void {
  const cached = cache.get(key);
  const newData = updater(cached?.data as T | undefined);
  cache.set(key, { data: newData, timestamp: Date.now() });
}
```

---

## Contract Testing with Zod

### Overview

Contract tests validate that CLI output matches expected TypeScript schemas, catching drift between the Go backend and TypeScript frontend before it reaches production.

### Schema Definitions

```typescript
// src/lib/types/gastown.schema.ts
import { z } from 'zod';

// Agent status enum
export const AgentStatusSchema = z.enum([
  'idle', 'active', 'busy', 'parked', 'stuck', 'orphaned'
]);

// Agent health enum
export const AgentHealthSchema = z.enum(['healthy', 'warning', 'critical']);

// Individual agent
export const GtAgentSchema = z.object({
  name: z.string(),
  id: z.string(),
  status: AgentStatusSchema,
  session_id: z.string(),
  rig: z.string(),
  worktree: z.string(),
  branch: z.string().optional(),
  last_activity: z.string(),
  last_activity_ago: z.string(),
  current_task: z.string().optional(),
  current_molecule: z.string().optional(),
  health: AgentHealthSchema,
});

// Daemon status
export const GtDaemonStatusSchema = z.object({
  running: z.boolean(),
  pid: z.number().optional(),
  uptime: z.string().optional(),
  version: z.string(),
});

// Rig summary
export const GtRigSummarySchema = z.object({
  name: z.string(),
  path: z.string(),
  agents: z.number(),
  active: z.number(),
  docked: z.boolean(),
});

// Queue summary
export const GtQueueSummarySchema = z.object({
  pending: z.number(),
  in_progress: z.number(),
  total: z.number(),
});

// Full status response
export const GtStatusSchema = z.object({
  town: z.string(),
  daemon: GtDaemonStatusSchema,
  agents: z.array(GtAgentSchema),
  rigs: z.array(GtRigSummarySchema),
  queue: GtQueueSummarySchema,
});

// Bead ID pattern
export const BeadIdSchema = z.string().regex(/^[a-z]+-[a-z0-9]+$/);

// Bead/Work item
export const BdBeadSchema = z.object({
  id: BeadIdSchema,
  title: z.string(),
  description: z.string(),
  status: z.enum(['open', 'in_progress', 'closed']),
  priority: z.number().int().min(0).max(3),
  issue_type: z.string(),
  assignee: z.string().optional(),
  created_at: z.string(),
  created_by: z.string(),
  updated_at: z.string(),
  labels: z.array(z.string()),
  ephemeral: z.boolean(),
  parent_id: z.string().optional(),
  children: z.array(z.string()).optional(),
});

// Mail message
export const GtMailMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  timestamp: z.string(),
  read: z.boolean(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  type: z.enum(['task', 'scavenge', 'notification', 'reply']),
  delivery: z.enum(['queue', 'interrupt']),
  thread_id: z.string().optional(),
  reply_to: z.string().optional(),
  pinned: z.boolean(),
  wisp: z.boolean(),
});

// Convoy
export const GtConvoySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.enum(['open', 'closed']),
  work_status: z.enum(['complete', 'active', 'stale', 'stuck', 'waiting']),
  progress: z.string(),
  completed: z.number(),
  total: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  tracked_issues: z.array(z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    assignee: z.string().optional(),
    priority: z.number(),
  })),
});

// Export types
export type GtAgent = z.infer<typeof GtAgentSchema>;
export type GtStatus = z.infer<typeof GtStatusSchema>;
export type BdBead = z.infer<typeof BdBeadSchema>;
export type GtMailMessage = z.infer<typeof GtMailMessageSchema>;
export type GtConvoy = z.infer<typeof GtConvoySchema>;
```

### Contract Test Suite

```typescript
// src/lib/types/gastown.contract.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  GtStatusSchema,
  GtConvoySchema,
  BdBeadSchema,
  GtMailMessageSchema,
} from './gastown.schema';

const execAsync = promisify(exec);
const CLI_TIMEOUT = 30000;

// Skip tests if CLI not available
const CLI_AVAILABLE = process.env.TEST_CLI === 'true';

describe.skipIf(!CLI_AVAILABLE)('CLI Contract Tests', () => {
  describe('gt status --json', () => {
    it('should match GtStatusSchema', async () => {
      const { stdout } = await execAsync('gt status --json', { timeout: CLI_TIMEOUT });
      const parsed = JSON.parse(stdout);

      const result = GtStatusSchema.safeParse(parsed);

      if (!result.success) {
        console.error('Schema validation errors:', result.error.format());
      }

      expect(result.success).toBe(true);
    });

    it('should have non-empty town name', async () => {
      const { stdout } = await execAsync('gt status --json', { timeout: CLI_TIMEOUT });
      const status = GtStatusSchema.parse(JSON.parse(stdout));

      expect(status.town).toBeTruthy();
      expect(typeof status.town).toBe('string');
    });

    it('should have valid daemon status', async () => {
      const { stdout } = await execAsync('gt status --json', { timeout: CLI_TIMEOUT });
      const status = GtStatusSchema.parse(JSON.parse(stdout));

      expect(typeof status.daemon.running).toBe('boolean');
      expect(typeof status.daemon.version).toBe('string');
    });
  });

  describe('gt convoy list --json', () => {
    it('should return array matching GtConvoySchema', async () => {
      const { stdout } = await execAsync('gt convoy list --json', { timeout: CLI_TIMEOUT });
      const parsed = JSON.parse(stdout);

      expect(Array.isArray(parsed)).toBe(true);

      for (const convoy of parsed) {
        const result = GtConvoySchema.safeParse(convoy);
        if (!result.success) {
          console.error('Convoy validation errors:', result.error.format());
        }
        expect(result.success).toBe(true);
      }
    });
  });

  describe('bd list --type=message --json', () => {
    it('should return array matching GtMailMessageSchema', async () => {
      const { stdout } = await execAsync('bd list --type=message --json', { timeout: CLI_TIMEOUT });
      const parsed = JSON.parse(stdout);

      expect(Array.isArray(parsed)).toBe(true);

      for (const msg of parsed) {
        const result = GtMailMessageSchema.safeParse(msg);
        if (!result.success) {
          console.error('Message validation errors:', result.error.format());
        }
        expect(result.success).toBe(true);
      }
    });
  });

  describe('bd list --type=task --json', () => {
    it('should return array matching BdBeadSchema', async () => {
      const { stdout } = await execAsync('bd list --type=task --json', { timeout: CLI_TIMEOUT });
      const parsed = JSON.parse(stdout);

      expect(Array.isArray(parsed)).toBe(true);

      for (const bead of parsed) {
        const result = BdBeadSchema.safeParse(bead);
        if (!result.success) {
          console.error('Bead validation errors:', result.error.format());
        }
        expect(result.success).toBe(true);
      }
    });
  });
});

// Snapshot tests for schema structure
describe('Schema Snapshots', () => {
  it('GtStatusSchema shape should be stable', () => {
    const shape = GtStatusSchema.shape;
    expect(Object.keys(shape).sort()).toMatchSnapshot();
  });

  it('BdBeadSchema shape should be stable', () => {
    const shape = BdBeadSchema.shape;
    expect(Object.keys(shape).sort()).toMatchSnapshot();
  });
});
```

### CI Integration

```yaml
# .github/workflows/contract-tests.yml
name: Contract Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  contract-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Install gastown CLI
        run: |
          # Install gt and bd binaries
          curl -sSL https://gastown.io/install.sh | sh

      - name: Run contract tests
        run: TEST_CLI=true bun test src/lib/types/*.contract.test.ts
        env:
          GASTOWN_TOWN_ROOT: ${{ github.workspace }}/test-town
```

---

## Real-Time Activity Stream

### Overview

Stream `.events.jsonl` file using Node.js file watching combined with Server-Sent Events (SSE) to provide real-time activity updates without Go backend changes.

### Event File Format

```jsonl
{"type":"agent_status","agent":"nux","status":"working","task":"hq-abc123","timestamp":1705000000}
{"type":"merge","branch":"polecat/nux-12345","rig":"gastown","status":"success","timestamp":1705000060}
{"type":"mail","from":"witness","to":"refinery","subject":"Rebase needed","timestamp":1705000120}
{"type":"convoy","id":"conv-xyz","action":"issue_closed","issue":"hq-abc123","timestamp":1705000180}
```

### Server-Side SSE Endpoint

```typescript
// src/routes/api/gastown/feed/stream/+server.ts
import type { RequestHandler } from './$types';
import { createReadStream, watch, stat } from 'fs';
import { createInterface } from 'readline';
import { config } from '$lib/config/environment';

export const GET: RequestHandler = async ({ request }) => {
  const eventsPath = `${config.GASTOWN_TOWN_ROOT}/.events.jsonl`;

  // Check if file exists
  try {
    await new Promise((resolve, reject) => {
      stat(eventsPath, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });
  } catch {
    return new Response('Events file not found', { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send last 50 events as initial batch
      const lines: string[] = [];
      const rl = createInterface({
        input: createReadStream(eventsPath),
        crlfDelay: Infinity,
      });

      for await (const line of rl) {
        if (line.trim()) {
          lines.push(line);
          if (lines.length > 50) lines.shift();
        }
      }

      // Send initial events
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch { /* skip malformed lines */ }
      }

      // Send heartbeat
      controller.enqueue(encoder.encode(`: heartbeat\n\n`));

      // Watch for new events
      let fileSize = 0;
      try {
        const stats = await new Promise<{ size: number }>((resolve, reject) => {
          stat(eventsPath, (err, s) => err ? reject(err) : resolve(s));
        });
        fileSize = stats.size;
      } catch { /* ignore */ }

      const watcher = watch(eventsPath, async (eventType) => {
        if (eventType !== 'change') return;

        try {
          const stats = await new Promise<{ size: number }>((resolve, reject) => {
            stat(eventsPath, (err, s) => err ? reject(err) : resolve(s));
          });

          if (stats.size > fileSize) {
            // Read new lines
            const newRl = createInterface({
              input: createReadStream(eventsPath, { start: fileSize }),
              crlfDelay: Infinity,
            });

            for await (const line of newRl) {
              if (line.trim()) {
                try {
                  const event = JSON.parse(line);
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                } catch { /* skip malformed */ }
              }
            }

            fileSize = stats.size;
          }
        } catch (err) {
          console.error('File watch error:', err);
        }
      });

      // Heartbeat interval
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        watcher.close();
        clearInterval(heartbeat);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
};
```

### Client-Side EventSource

```typescript
// src/lib/stores/activity-stream.svelte.ts
import { browser } from '$app/environment';

export interface ActivityEvent {
  type: 'agent_status' | 'merge' | 'mail' | 'convoy' | 'error' | 'system';
  timestamp: number;
  [key: string]: unknown;
}

interface ActivityStreamState {
  events: ActivityEvent[];
  connected: boolean;
  error: Error | null;
}

class ActivityStream {
  #state = $state<ActivityStreamState>({
    events: [],
    connected: false,
    error: null,
  });

  #eventSource: EventSource | null = null;
  #maxEvents = 100;
  #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  #reconnectDelay = 1000;

  get events() { return this.#state.events; }
  get connected() { return this.#state.connected; }
  get error() { return this.#state.error; }

  connect() {
    if (!browser) return;
    if (this.#eventSource) return;

    try {
      this.#eventSource = new EventSource('/api/gastown/feed/stream');

      this.#eventSource.onopen = () => {
        this.#state.connected = true;
        this.#state.error = null;
        this.#reconnectDelay = 1000;
      };

      this.#eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ActivityEvent;
          this.#addEvent(data);
        } catch (err) {
          console.error('Failed to parse event:', err);
        }
      };

      this.#eventSource.onerror = () => {
        this.#state.connected = false;
        this.#eventSource?.close();
        this.#eventSource = null;
        this.#scheduleReconnect();
      };
    } catch (err) {
      this.#state.error = err as Error;
      this.#scheduleReconnect();
    }
  }

  disconnect() {
    if (this.#reconnectTimeout) {
      clearTimeout(this.#reconnectTimeout);
      this.#reconnectTimeout = null;
    }
    if (this.#eventSource) {
      this.#eventSource.close();
      this.#eventSource = null;
    }
    this.#state.connected = false;
  }

  #addEvent(event: ActivityEvent) {
    this.#state.events = [event, ...this.#state.events].slice(0, this.#maxEvents);
  }

  #scheduleReconnect() {
    if (this.#reconnectTimeout) return;

    this.#reconnectTimeout = setTimeout(() => {
      this.#reconnectTimeout = null;
      this.#reconnectDelay = Math.min(this.#reconnectDelay * 2, 30000);
      this.connect();
    }, this.#reconnectDelay);
  }

  clear() {
    this.#state.events = [];
  }
}

export const activityStream = new ActivityStream();

// Auto-connect on import in browser
if (browser) {
  activityStream.connect();
}
```

### Activity Feed Component

```svelte
<!-- src/lib/components/ActivityFeed.svelte -->
<script lang="ts">
  import { activityStream, type ActivityEvent } from '$lib/stores/activity-stream.svelte';
  import { formatRelativeTime } from '$lib/utils/date';

  function getEventIcon(type: ActivityEvent['type']): string {
    const icons: Record<string, string> = {
      agent_status: '🤖',
      merge: '🔀',
      mail: '📧',
      convoy: '🚛',
      error: '❌',
      system: '⚙️',
    };
    return icons[type] ?? '📌';
  }

  function getEventMessage(event: ActivityEvent): string {
    switch (event.type) {
      case 'agent_status':
        return `${event.agent} is now ${event.status}`;
      case 'merge':
        return `Branch ${event.branch} ${event.status}`;
      case 'mail':
        return `${event.from} → ${event.to}: ${event.subject}`;
      case 'convoy':
        return `Convoy ${event.id}: ${event.action}`;
      default:
        return JSON.stringify(event);
    }
  }
</script>

<div class="activity-feed">
  <header class="feed-header">
    <h3>Activity</h3>
    <span class="connection-status" class:connected={activityStream.connected}>
      {activityStream.connected ? '● Live' : '○ Connecting...'}
    </span>
  </header>

  <ul class="event-list" role="feed" aria-busy={!activityStream.connected}>
    {#each activityStream.events as event (event.timestamp)}
      <li class="event-item" role="article">
        <span class="event-icon">{getEventIcon(event.type)}</span>
        <span class="event-message">{getEventMessage(event)}</span>
        <time class="event-time" datetime={new Date(event.timestamp * 1000).toISOString()}>
          {formatRelativeTime(event.timestamp * 1000)}
        </time>
      </li>
    {:else}
      <li class="no-events">No recent activity</li>
    {/each}
  </ul>
</div>

<style>
  .activity-feed {
    background: var(--card);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .feed-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border-bottom: 1px solid var(--border);
  }

  .connection-status {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }

  .connection-status.connected {
    color: var(--status-online);
  }

  .event-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 400px;
    overflow-y: auto;
  }

  .event-item {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    border-bottom: 1px solid var(--border);
  }

  .event-item:last-child {
    border-bottom: none;
  }

  .event-time {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }
</style>
```

### Beads Directory Watcher

Watch `.beads/` directory for changes to trigger cache invalidation and background refreshes. This provides near-real-time updates without waiting for polling cycles.

```typescript
// src/lib/server/watchers/beads-watcher.ts
import { watch, type FSWatcher } from 'fs';
import { join } from 'path';
import { config } from '$lib/config/environment';
import { invalidateCache } from '$lib/server/cache';

let watcher: FSWatcher | null = null;
let debounceTimer: NodeJS.Timeout | null = null;

const DEBOUNCE_MS = 100; // Batch rapid changes

interface WatchEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  timestamp: number;
}

const subscribers = new Set<(event: WatchEvent) => void>();

export function subscribe(callback: (event: WatchEvent) => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

function notify(event: WatchEvent) {
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch (err) {
      console.error('[beads-watcher] Subscriber error:', err);
    }
  }
}

export function startBeadsWatcher(): void {
  if (watcher) return;

  const beadsDir = join(config.townRoot, '.beads');

  try {
    watcher = watch(beadsDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      // Debounce rapid changes
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const event: WatchEvent = {
          type: eventType === 'rename' ? 'created' : 'modified',
          path: filename,
          timestamp: Date.now()
        };

        // Invalidate relevant cache keys based on file type
        if (filename.endsWith('.json')) {
          const beadId = filename.replace('.json', '');
          invalidateCache(`bead:${beadId}`);
          invalidateCache('beads:list');
        }

        // Notify subscribers (for WS broadcast)
        notify(event);

        console.log(`[beads-watcher] ${event.type}: ${filename}`);
      }, DEBOUNCE_MS);
    });

    console.log('[beads-watcher] Watching .beads/ directory');

    watcher.on('error', (err) => {
      console.error('[beads-watcher] Watch error:', err);
      stopBeadsWatcher();
      // Retry after delay
      setTimeout(startBeadsWatcher, 5000);
    });
  } catch (err) {
    console.error('[beads-watcher] Failed to start watcher:', err);
  }
}

export function stopBeadsWatcher(): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
```

### WebSocket Broadcast for Watch Events

Broadcast watch events to connected clients via WebSocket for instant UI updates.

```typescript
// src/lib/server/watchers/broadcast.ts
import { subscribe as subscribeBeads } from './beads-watcher';
import { subscribe as subscribeEvents } from './events-tailer';

interface WSClient {
  send: (data: string) => void;
  readyState: number;
}

const clients = new Set<WSClient>();

export function addClient(client: WSClient): void {
  clients.add(client);
}

export function removeClient(client: WSClient): void {
  clients.delete(client);
}

function broadcast(message: object): void {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(data);
      } catch {
        clients.delete(client);
      }
    }
  }
}

// Wire up watchers to broadcast
export function initBroadcast(): void {
  subscribeBeads((event) => {
    broadcast({
      type: 'beads_change',
      payload: event
    });
  });

  // Events tailer already streams via SSE, but can also broadcast to WS
  subscribeEvents?.((event) => {
    broadcast({
      type: 'activity',
      payload: event
    });
  });
}
```

### Degraded Mode Banner

When watchers fail or daemon is unreachable, show a clear banner so users understand the UI is showing cached data.

```svelte
<!-- src/lib/components/DegradedModeBanner.svelte -->
<script lang="ts">
  import { capabilities } from '$lib/stores/capabilities.svelte';
  import { connectionStatus } from '$lib/stores/connection.svelte';

  $: isDegraded = !connectionStatus.daemonReachable || !capabilities.supportsEventsFile;
  $: message = !connectionStatus.daemonReachable
    ? 'Daemon unreachable - showing cached data'
    : !capabilities.supportsEventsFile
    ? 'Live updates unavailable - polling active'
    : '';
</script>

{#if isDegraded}
  <div class="degraded-banner" role="alert">
    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <span>{message}</span>
    <button class="retry-btn" on:click={() => location.reload()}>
      Retry
    </button>
  </div>
{/if}

<style>
  .degraded-banner {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-4);
    background: var(--warning);
    color: var(--warning-foreground);
    font-size: var(--text-sm);
  }

  .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .retry-btn {
    margin-left: auto;
    padding: var(--spacing-1) var(--spacing-2);
    background: transparent;
    border: 1px solid currentColor;
    border-radius: var(--radius);
    cursor: pointer;
  }
</style>
```

---

## Vim-Style Keyboard Navigation

### Overview

Comprehensive vim-style keyboard navigation makes the app feel native to developers, matching their terminal muscle memory.

### Keyboard Manager Implementation

```typescript
// src/lib/utils/keyboard-vim.ts
import { browser } from '$app/environment';
import { goto } from '$app/navigation';

// Shortcut definitions
export const SHORTCUTS = {
  // Global navigation (g prefix)
  'g d': { action: 'navigate', target: '/', description: 'Go to Dashboard' },
  'g a': { action: 'navigate', target: '/agents', description: 'Go to Agents' },
  'g r': { action: 'navigate', target: '/rigs', description: 'Go to Rigs' },
  'g w': { action: 'navigate', target: '/work', description: 'Go to Work' },
  'g m': { action: 'navigate', target: '/mail', description: 'Go to Mail' },
  'g q': { action: 'navigate', target: '/queue', description: 'Go to Queue' },
  'g c': { action: 'navigate', target: '/convoys', description: 'Go to Convoys' },
  'g s': { action: 'navigate', target: '/settings', description: 'Go to Settings' },

  // List navigation
  'j': { action: 'list:next', description: 'Next item' },
  'k': { action: 'list:prev', description: 'Previous item' },
  'Enter': { action: 'list:select', description: 'Open selected item' },
  'Escape': { action: 'list:deselect', description: 'Deselect / Close modal' },
  'x': { action: 'list:toggle', description: 'Toggle selection' },

  // Actions
  'r': { action: 'refresh', description: 'Refresh data' },
  '/': { action: 'search', description: 'Focus search' },
  '?': { action: 'help', description: 'Show keyboard shortcuts' },
  'c': { action: 'create', description: 'Create new item' },
  's': { action: 'sling', description: 'Sling selected item' },

  // Command palette
  'Cmd+k': { action: 'command-palette', description: 'Open command palette' },
  'Ctrl+k': { action: 'command-palette', description: 'Open command palette' },
} as const;

type ShortcutAction = typeof SHORTCUTS[keyof typeof SHORTCUTS]['action'];

// Event handlers by action
type ActionHandler = () => void | Promise<void>;
const actionHandlers = new Map<ShortcutAction, ActionHandler>();

// Multi-key sequence state
let keyBuffer: string[] = [];
let bufferTimeout: ReturnType<typeof setTimeout> | null = null;
const BUFFER_TIMEOUT = 1000;

// List navigation state
interface ListState {
  items: HTMLElement[];
  selectedIndex: number;
}
let listState: ListState | null = null;

function normalizeKey(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.metaKey) parts.push('Cmd');
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');

  // Get the actual key
  let key = event.key;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toLowerCase();

  parts.push(key);
  return parts.join('+');
}

function resetBuffer() {
  keyBuffer = [];
  if (bufferTimeout) {
    clearTimeout(bufferTimeout);
    bufferTimeout = null;
  }
}

function shouldSkipKey(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement;

  // Skip if in input, textarea, or contenteditable
  if (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  ) {
    // Allow Escape to blur
    if (event.key === 'Escape') {
      target.blur();
      return true;
    }
    return true;
  }

  return false;
}

async function executeAction(action: ShortcutAction, shortcut: typeof SHORTCUTS[keyof typeof SHORTCUTS]) {
  // Check for registered handler
  const handler = actionHandlers.get(action);
  if (handler) {
    await handler();
    return;
  }

  // Default handlers
  if (action === 'navigate' && 'target' in shortcut) {
    await goto(shortcut.target);
    return;
  }

  if (action === 'search') {
    const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
    searchInput?.focus();
    return;
  }

  if (action === 'help') {
    const event = new CustomEvent('show-keyboard-help');
    window.dispatchEvent(event);
    return;
  }

  if (action === 'command-palette') {
    const event = new CustomEvent('toggle-command-palette');
    window.dispatchEvent(event);
    return;
  }

  if (action === 'refresh') {
    window.dispatchEvent(new CustomEvent('swr:revalidate-all'));
    return;
  }

  if (action.startsWith('list:')) {
    handleListAction(action as `list:${string}`);
    return;
  }
}

function handleListAction(action: `list:${string}`) {
  if (!listState) {
    // Try to find a list
    const list = document.querySelector<HTMLElement>('[data-keyboard-list]');
    if (!list) return;

    const items = Array.from(list.querySelectorAll<HTMLElement>('[data-keyboard-item]'));
    if (items.length === 0) return;

    listState = { items, selectedIndex: -1 };
  }

  const { items, selectedIndex } = listState;

  switch (action) {
    case 'list:next':
      listState.selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      focusItem(listState.selectedIndex);
      break;

    case 'list:prev':
      listState.selectedIndex = Math.max(selectedIndex - 1, 0);
      focusItem(listState.selectedIndex);
      break;

    case 'list:select':
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].click();
      }
      break;

    case 'list:deselect':
      listState.selectedIndex = -1;
      items.forEach(item => item.classList.remove('keyboard-selected'));
      break;

    case 'list:toggle':
      if (selectedIndex >= 0 && selectedIndex < items.length) {
        items[selectedIndex].dispatchEvent(new CustomEvent('toggle-select'));
      }
      break;
  }
}

function focusItem(index: number) {
  if (!listState) return;

  listState.items.forEach((item, i) => {
    item.classList.toggle('keyboard-selected', i === index);
  });

  listState.items[index]?.scrollIntoView({ block: 'nearest' });
}

function handleKeyDown(event: KeyboardEvent) {
  if (shouldSkipKey(event)) return;

  const key = normalizeKey(event);

  // Add to buffer
  keyBuffer.push(key);
  const sequence = keyBuffer.join(' ');

  // Reset buffer timeout
  if (bufferTimeout) clearTimeout(bufferTimeout);
  bufferTimeout = setTimeout(resetBuffer, BUFFER_TIMEOUT);

  // Check for exact match
  const shortcut = SHORTCUTS[sequence as keyof typeof SHORTCUTS];
  if (shortcut) {
    event.preventDefault();
    resetBuffer();
    executeAction(shortcut.action, shortcut);
    return;
  }

  // Check for partial match
  const hasPartialMatch = Object.keys(SHORTCUTS).some(s => s.startsWith(sequence + ' '));
  if (!hasPartialMatch) {
    // No match possible, reset
    resetBuffer();
  }
}

// Public API
export function registerAction(action: ShortcutAction, handler: ActionHandler) {
  actionHandlers.set(action, handler);
  return () => actionHandlers.delete(action);
}

export function initKeyboard() {
  if (!browser) return () => {};

  document.addEventListener('keydown', handleKeyDown);

  // Reset list state on navigation
  const resetList = () => { listState = null; };
  window.addEventListener('popstate', resetList);

  return () => {
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('popstate', resetList);
    resetBuffer();
  };
}

export function getShortcutsByCategory() {
  const categories: Record<string, Array<{ keys: string; description: string }>> = {
    Navigation: [],
    Lists: [],
    Actions: [],
    Other: [],
  };

  for (const [keys, shortcut] of Object.entries(SHORTCUTS)) {
    const entry = { keys, description: shortcut.description };

    if (keys.startsWith('g ')) {
      categories.Navigation.push(entry);
    } else if (['j', 'k', 'Enter', 'Escape', 'x'].includes(keys)) {
      categories.Lists.push(entry);
    } else if (['r', 'c', 's', '/'].includes(keys)) {
      categories.Actions.push(entry);
    } else {
      categories.Other.push(entry);
    }
  }

  return categories;
}
```

### Keyboard Help Dialog

```svelte
<!-- src/lib/components/KeyboardHelp.svelte -->
<script lang="ts">
  import { getShortcutsByCategory } from '$lib/utils/keyboard-vim';
  import { onMount, onDestroy } from 'svelte';

  let open = $state(false);
  const categories = getShortcutsByCategory();

  function handleKeyboardHelp() {
    open = true;
  }

  function handleClose() {
    open = false;
  }

  onMount(() => {
    window.addEventListener('show-keyboard-help', handleKeyboardHelp);
    return () => window.removeEventListener('show-keyboard-help', handleKeyboardHelp);
  });
</script>

{#if open}
  <div class="overlay" onclick={handleClose} role="presentation">
    <div
      class="dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-help-title"
      onclick={(e) => e.stopPropagation()}
    >
      <header class="dialog-header">
        <h2 id="keyboard-help-title">Keyboard Shortcuts</h2>
        <button class="close-btn" onclick={handleClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div class="dialog-content">
        {#each Object.entries(categories) as [category, shortcuts]}
          {#if shortcuts.length > 0}
            <section class="category">
              <h3 class="category-title">{category}</h3>
              <dl class="shortcut-list">
                {#each shortcuts as { keys, description }}
                  <div class="shortcut-item">
                    <dt class="shortcut-keys">
                      {#each keys.split(' ') as key, i}
                        {#if i > 0}<span class="separator">then</span>{/if}
                        <kbd>{key}</kbd>
                      {/each}
                    </dt>
                    <dd class="shortcut-desc">{description}</dd>
                  </div>
                {/each}
              </dl>
            </section>
          {/if}
        {/each}
      </div>

      <footer class="dialog-footer">
        <p class="hint">Press <kbd>?</kbd> anytime to show this help</p>
      </footer>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    background: var(--card);
    border-radius: var(--radius-lg);
    max-width: 600px;
    max-height: 80vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    border-bottom: 1px solid var(--border);
  }

  .dialog-content {
    padding: var(--spacing-4);
    overflow-y: auto;
  }

  .category {
    margin-bottom: var(--spacing-4);
  }

  .category-title {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--muted-foreground);
    margin-bottom: var(--spacing-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .shortcut-list {
    display: grid;
    gap: var(--spacing-2);
  }

  .shortcut-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .shortcut-keys {
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
  }

  .separator {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .shortcut-desc {
    color: var(--muted-foreground);
    font-size: var(--text-sm);
  }

  .dialog-footer {
    padding: var(--spacing-3);
    border-top: 1px solid var(--border);
    text-align: center;
  }

  .hint {
    font-size: var(--text-sm);
    color: var(--muted-foreground);
  }
</style>
```

### Root Layout Integration

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { initKeyboard } from '$lib/utils/keyboard-vim';
  import KeyboardHelp from '$lib/components/KeyboardHelp.svelte';
  import CommandPalette from '$lib/components/command-palette';

  let { children } = $props();

  onMount(() => {
    return initKeyboard();
  });
</script>

<div class="app">
  {@render children()}
</div>

<KeyboardHelp />
<CommandPalette />
```

---

## Power-User Ergonomics

### Command Palette (⌘K)

A VS Code / Raycast-style command palette for quick access to all actions and navigation.

```svelte
<!-- src/lib/components/CommandPalette.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import Fuse from 'fuse.js';

  let open = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement;

  interface CommandItem {
    id: string;
    type: 'navigation' | 'action' | 'search';
    title: string;
    subtitle?: string;
    icon?: string;
    shortcut?: string;
    action: () => void;
    cli?: string; // CLI equivalent
  }

  // Build command list from routes and actions
  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', type: 'navigation', title: 'Go to Dashboard', icon: '📊', shortcut: 'g d', action: () => goto('/') },
    { id: 'nav-agents', type: 'navigation', title: 'Go to Agents', icon: '🤖', shortcut: 'g a', action: () => goto('/agents') },
    { id: 'nav-rigs', type: 'navigation', title: 'Go to Rigs', icon: '🔧', shortcut: 'g r', action: () => goto('/rigs') },
    { id: 'nav-work', type: 'navigation', title: 'Go to Work', icon: '📋', shortcut: 'g w', action: () => goto('/work') },
    { id: 'nav-mail', type: 'navigation', title: 'Go to Mail', icon: '📧', shortcut: 'g m', action: () => goto('/mail') },
    { id: 'nav-queue', type: 'navigation', title: 'Go to Queue', icon: '📥', shortcut: 'g q', action: () => goto('/queue') },
    { id: 'nav-convoys', type: 'navigation', title: 'Go to Convoys', icon: '🚛', shortcut: 'g c', action: () => goto('/convoys') },
    // Actions
    { id: 'action-refresh', type: 'action', title: 'Refresh Data', icon: '🔄', shortcut: 'r', action: () => dispatchEvent(new CustomEvent('refresh-data')) },
    { id: 'action-create', type: 'action', title: 'Create New Bead', icon: '➕', shortcut: 'c', action: () => dispatchEvent(new CustomEvent('create-bead')), cli: 'bd create' },
    { id: 'action-diagnostics', type: 'action', title: 'View Diagnostics', icon: '🩺', action: () => goto('/diagnostics'), cli: 'gt doctor' },
  ];

  const fuse = new Fuse(commands, {
    keys: ['title', 'subtitle', 'cli'],
    threshold: 0.3,
    includeScore: true,
  });

  $: filteredCommands = query
    ? fuse.search(query).map(r => r.item)
    : commands;

  $: if (filteredCommands.length > 0) {
    selectedIndex = Math.min(selectedIndex, filteredCommands.length - 1);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      open = !open;
      if (open) {
        query = '';
        selectedIndex = 0;
        setTimeout(() => inputRef?.focus(), 0);
      }
    }

    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          open = false;
        }
        break;
      case 'Escape':
        e.preventDefault();
        open = false;
        break;
    }
  }

  onMount(() => {
    if (browser) {
      document.addEventListener('keydown', handleKeydown);
    }
  });

  onDestroy(() => {
    if (browser) {
      document.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

{#if open}
  <div class="palette-overlay" onclick={() => open = false}>
    <div class="palette" onclick={(e) => e.stopPropagation()}>
      <div class="search-input">
        <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          bind:this={inputRef}
          bind:value={query}
          type="text"
          placeholder="Type a command or search..."
          autocomplete="off"
        />
        <kbd>esc</kbd>
      </div>

      <ul class="command-list" role="listbox">
        {#each filteredCommands as cmd, i (cmd.id)}
          <li
            class="command-item"
            class:selected={i === selectedIndex}
            role="option"
            aria-selected={i === selectedIndex}
            onclick={() => { cmd.action(); open = false; }}
          >
            <span class="icon">{cmd.icon}</span>
            <div class="command-content">
              <span class="title">{cmd.title}</span>
              {#if cmd.subtitle}
                <span class="subtitle">{cmd.subtitle}</span>
              {/if}
            </div>
            {#if cmd.shortcut}
              <kbd class="shortcut">{cmd.shortcut}</kbd>
            {/if}
          </li>
        {:else}
          <li class="no-results">No commands found</li>
        {/each}
      </ul>

      <footer class="palette-footer">
        <span><kbd>↑↓</kbd> Navigate</span>
        <span><kbd>↵</kbd> Select</span>
        <span><kbd>esc</kbd> Close</span>
      </footer>
    </div>
  </div>
{/if}

<style>
  .palette-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    padding-top: 20vh;
    z-index: 1000;
  }

  .palette {
    width: 100%;
    max-width: 600px;
    background: var(--card);
    border-radius: var(--radius-lg);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: hidden;
  }

  .search-input {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    border-bottom: 1px solid var(--border);
  }

  .search-input input {
    flex: 1;
    border: none;
    background: transparent;
    font-size: var(--text-lg);
    outline: none;
  }

  .command-list {
    max-height: 400px;
    overflow-y: auto;
    padding: var(--spacing-2);
    margin: 0;
    list-style: none;
  }

  .command-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .command-item:hover, .command-item.selected {
    background: var(--accent);
  }

  .command-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .subtitle {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .palette-footer {
    display: flex;
    gap: var(--spacing-4);
    padding: var(--spacing-2) var(--spacing-4);
    border-top: 1px solid var(--border);
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  kbd {
    padding: 2px 6px;
    background: var(--muted);
    border-radius: var(--radius-sm);
    font-family: inherit;
    font-size: var(--text-xs);
  }
</style>
```

### Copy CLI Equivalent

Every action in the UI shows its CLI equivalent, building user trust and teaching the underlying commands.

```svelte
<!-- src/lib/components/CopyCli.svelte -->
<script lang="ts">
  import { toast } from '$lib/stores/toast.svelte';

  interface Props {
    command: string;
    args?: string[];
  }

  let { command, args = [] }: Props = $props();
  let copied = $state(false);

  const fullCommand = [command, ...args].join(' ');

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(fullCommand);
      copied = true;
      toast.success('Copied to clipboard', { duration: 2000 });
      setTimeout(() => { copied = false; }, 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }
</script>

<button
  class="copy-cli"
  onclick={copyToClipboard}
  title="Copy CLI command"
  aria-label="Copy CLI equivalent: {fullCommand}"
>
  <code class="command">{fullCommand}</code>
  <span class="icon" class:copied>
    {copied ? '✓' : '📋'}
  </span>
</button>

<style>
  .copy-cli {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--text-xs);
    transition: all 0.15s ease;
  }

  .copy-cli:hover {
    background: var(--accent);
    border-color: var(--accent-foreground);
  }

  .command {
    font-family: var(--font-mono);
    color: var(--foreground);
  }

  .icon.copied {
    color: var(--success);
  }
</style>
```

Usage in components:

```svelte
<!-- Example: Agent card with Copy CLI -->
<div class="agent-card">
  <h3>{agent.name}</h3>
  <p>Status: {agent.status}</p>

  <CopyCli command="gt" args={['peek', agent.id]} />
</div>
```

### Global Search

In-memory search index across all entities (agents, beads, convoys, mail) for instant results.

```typescript
// src/lib/stores/search-index.ts
import Fuse from 'fuse.js';

interface SearchableItem {
  id: string;
  type: 'agent' | 'bead' | 'convoy' | 'mail' | 'rig';
  title: string;
  subtitle?: string;
  url: string;
  metadata?: Record<string, unknown>;
}

class SearchIndex {
  #items: SearchableItem[] = [];
  #fuse: Fuse<SearchableItem> | null = null;

  constructor() {
    this.#rebuildIndex();
  }

  #rebuildIndex() {
    this.#fuse = new Fuse(this.#items, {
      keys: [
        { name: 'title', weight: 2 },
        { name: 'subtitle', weight: 1 },
        { name: 'type', weight: 0.5 },
      ],
      threshold: 0.3,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }

  addItems(items: SearchableItem[]) {
    this.#items.push(...items);
    this.#rebuildIndex();
  }

  updateFromCache(cache: {
    agents?: unknown[];
    beads?: unknown[];
    convoys?: unknown[];
    mail?: unknown[];
  }) {
    this.#items = [];

    if (cache.agents) {
      this.#items.push(...cache.agents.map((a: any) => ({
        id: a.id,
        type: 'agent' as const,
        title: a.name,
        subtitle: a.status,
        url: `/agents/${a.id}`,
        metadata: a,
      })));
    }

    if (cache.beads) {
      this.#items.push(...cache.beads.map((b: any) => ({
        id: b.id,
        type: 'bead' as const,
        title: b.title,
        subtitle: b.status,
        url: `/work/${b.id}`,
        metadata: b,
      })));
    }

    if (cache.convoys) {
      this.#items.push(...cache.convoys.map((c: any) => ({
        id: c.id,
        type: 'convoy' as const,
        title: c.title,
        subtitle: c.status,
        url: `/convoys/${c.id}`,
        metadata: c,
      })));
    }

    if (cache.mail) {
      this.#items.push(...cache.mail.map((m: any) => ({
        id: m.id,
        type: 'mail' as const,
        title: m.subject,
        subtitle: `${m.from} → ${m.to}`,
        url: `/mail/${m.id}`,
        metadata: m,
      })));
    }

    this.#rebuildIndex();
  }

  search(query: string, limit = 20): SearchableItem[] {
    if (!this.#fuse || !query.trim()) return [];
    return this.#fuse.search(query, { limit }).map(r => r.item);
  }

  clear() {
    this.#items = [];
    this.#rebuildIndex();
  }
}

export const searchIndex = new SearchIndex();
```

### Global Search Component

```svelte
<!-- src/lib/components/GlobalSearch.svelte -->
<script lang="ts">
  import { searchIndex } from '$lib/stores/search-index';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  let query = $state('');
  let focused = $state(false);
  let selectedIndex = $state(0);
  let inputRef: HTMLInputElement;

  $: results = searchIndex.search(query);
  $: if (results.length > 0) {
    selectedIndex = Math.min(selectedIndex, results.length - 1);
  }

  const typeIcons: Record<string, string> = {
    agent: '🤖',
    bead: '📋',
    convoy: '🚛',
    mail: '📧',
    rig: '🔧',
  };

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === '/' && !focused) {
      e.preventDefault();
      inputRef?.focus();
      return;
    }

    if (!focused) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        if (results[selectedIndex]) {
          e.preventDefault();
          goto(results[selectedIndex].url);
          query = '';
          inputRef?.blur();
        }
        break;
      case 'Escape':
        query = '';
        inputRef?.blur();
        break;
    }
  }

  $effect(() => {
    if (browser) {
      document.addEventListener('keydown', handleKeydown);
      return () => document.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

<div class="global-search" class:focused>
  <div class="search-input-wrapper">
    <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
    <input
      bind:this={inputRef}
      bind:value={query}
      type="text"
      placeholder="Search (press /)"
      onfocus={() => focused = true}
      onblur={() => setTimeout(() => focused = false, 200)}
    />
    <kbd>/</kbd>
  </div>

  {#if focused && query && results.length > 0}
    <ul class="search-results" role="listbox">
      {#each results as result, i (result.id)}
        <li
          class="result-item"
          class:selected={i === selectedIndex}
          role="option"
          aria-selected={i === selectedIndex}
          onclick={() => goto(result.url)}
        >
          <span class="type-icon">{typeIcons[result.type]}</span>
          <div class="result-content">
            <span class="title">{result.title}</span>
            {#if result.subtitle}
              <span class="subtitle">{result.subtitle}</span>
            {/if}
          </div>
          <span class="type-badge">{result.type}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .global-search {
    position: relative;
    width: 300px;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--input);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 0.15s ease;
  }

  .global-search.focused .search-input-wrapper {
    border-color: var(--ring);
  }

  input {
    flex: 1;
    border: none;
    background: transparent;
    outline: none;
  }

  .search-results {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: var(--spacing-1);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    max-height: 400px;
    overflow-y: auto;
    z-index: 100;
    list-style: none;
    padding: var(--spacing-1);
    margin: 0;
  }

  .result-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .result-item:hover, .result-item.selected {
    background: var(--accent);
  }

  .result-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .subtitle {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
  }

  .type-badge {
    font-size: var(--text-xs);
    padding: 2px 6px;
    background: var(--muted);
    border-radius: var(--radius-full);
    text-transform: capitalize;
  }

  kbd {
    padding: 2px 6px;
    background: var(--muted);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }
</style>
```

---

## Long-Running Operations

### The Problem

Some CLI operations take significant time:

| Operation | Typical Duration | Max Duration |
|-----------|-----------------|--------------|
| `gt rig add` (git clone) | 30-60s | **150s+** |
| `gt formula run` | 5-30s | 60s+ |
| `gt doctor` (full check) | 10-30s | 60s |
| `bd create` | 1-3s | 10s |

**Critical**: UI must NEVER freeze during these operations.

### Solution: Non-Blocking Async Pattern

```typescript
// src/lib/services/async-operations.ts

interface AsyncOperation {
  id: string;
  type: 'rig_add' | 'formula_run' | 'work_create' | 'sling';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  result?: unknown;
  error?: string;
}

class AsyncOperationManager {
  #operations = new Map<string, AsyncOperation>();
  #subscribers = new Map<string, ((op: AsyncOperation) => void)[]>();

  async startOperation(
    type: AsyncOperation['type'],
    executor: () => Promise<unknown>,
    options: { timeout?: number } = {}
  ): Promise<string> {
    const id = crypto.randomUUID();
    const operation: AsyncOperation = {
      id,
      type,
      status: 'pending',
      startedAt: Date.now(),
    };

    this.#operations.set(id, operation);
    this.#notify(id, operation);
    this.#executeWithTimeout(id, executor, options.timeout ?? 180000);

    return id;
  }

  subscribe(id: string, callback: (op: AsyncOperation) => void): () => void {
    if (!this.#subscribers.has(id)) {
      this.#subscribers.set(id, []);
    }
    this.#subscribers.get(id)!.push(callback);

    const current = this.#operations.get(id);
    if (current) callback(current);

    return () => {
      const subs = this.#subscribers.get(id);
      if (subs) {
        const idx = subs.indexOf(callback);
        if (idx > -1) subs.splice(idx, 1);
      }
    };
  }
}

export const asyncOps = new AsyncOperationManager();
```

### Timeout Configuration

```typescript
// src/lib/config/timeouts.ts

export const OPERATION_TIMEOUTS = {
  'rig_add': 180_000,      // 3 minutes
  'rig_update': 120_000,   // 2 minutes
  'work_create': 30_000,   // 30 seconds
  'work_sling': 60_000,    // 1 minute
  'formula_run': 120_000,  // 2 minutes
  'molecule_start': 60_000,// 1 minute
  'doctor_full': 90_000,   // 1.5 minutes
  'doctor_quick': 30_000,  // 30 seconds
  'default': 30_000,       // 30 seconds
} as const;
```

---

## Optimistic UI & State Transitions

### Principle

**Optimistic UI**: Update the UI immediately, then reconcile with server state.

```
USER ACTION → IMMEDIATE UI UPDATE → SERVER CALL → RECONCILE
                    ↓                    ↓
              (Toast: "Adding...")  (Toast: "Added!" or "Failed")
```

### State Machine for Entities

```typescript
// src/lib/state/transitions.ts

type RigState = 'pending' | 'cloning' | 'active' | 'error' | 'parked';

const RIG_TRANSITIONS: Record<RigState, RigState[]> = {
  pending: ['cloning', 'error'],
  cloning: ['active', 'error'],
  active: ['parked', 'error'],
  error: ['pending', 'cloning'],
  parked: ['active'],
};

type WorkState = 'draft' | 'open' | 'assigned' | 'in_progress' | 'closed' | 'error';

const WORK_TRANSITIONS: Record<WorkState, WorkState[]> = {
  draft: ['open', 'error'],
  open: ['assigned', 'in_progress', 'closed', 'error'],
  assigned: ['in_progress', 'open', 'error'],
  in_progress: ['closed', 'error'],
  closed: [],
  error: ['open'],
};

type AgentState = 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';

const AGENT_TRANSITIONS: Record<AgentState, AgentState[]> = {
  idle: ['active', 'busy', 'parked'],
  active: ['idle', 'busy', 'stuck'],
  busy: ['active', 'idle', 'stuck'],
  parked: ['idle', 'orphaned'],
  stuck: ['idle', 'orphaned'],
  orphaned: ['idle'],
};
```

---

## Toast System & User Feedback

### Design Principles

1. **Machine-Readable**: Toasts contain parseable IDs and status
2. **Unique Messages**: Each action has a distinct toast message
3. **Two-Phase Feedback**: Immediate "...ing" → Final "...ed"
4. **Error Context**: Failures include actionable information

### Toast Message Format

```typescript
// src/lib/stores/toast.svelte.ts

interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  data?: {
    entityType?: 'rig' | 'work' | 'agent' | 'convoy';
    entityId?: string;
    operation?: string;
  };
}

export const TOAST_PATTERNS = {
  RIG_ADDING: /^Adding rig\.\.\.$/,
  RIG_ADDED: /^Rig (.+) added successfully$/,
  RIG_FAILED: /^Failed to add rig: (.+)$/,
  WORK_CREATING: /^Creating work item\.\.\.$/,
  WORK_CREATED: /^Work item created: ([a-z]+-[a-z0-9]+)$/,
  WORK_FAILED: /^Failed to create work item: (.+)$/,
  SLING_SENDING: /^Slinging to (.+)\.\.\.$/,
  SLING_SENT: /^Work slung to (.+)$/,
  SLING_FAILED: /^Failed to sling: (.+)$/,
  SLING_QUEUED: /^Sling queued \((.+)\)$/,
} as const;

export function extractIdFromToast(message: string): string | null {
  const match = message.match(/([a-z]+-[a-z0-9]+)/);
  return match ? match[1] : null;
}
```

### Standard Toast Messages

| Operation | Immediate Toast | Success Toast | Error Toast |
|-----------|-----------------|---------------|-------------|
| Add Rig | "Adding rig..." | "Rig {name} added successfully" | "Failed to add rig: {error}" |
| Create Work | "Creating work item..." | "Work item created: {id}" | "Failed to create work item: {error}" |
| Sling Work | "Slinging to {target}..." | "Work slung to {target}" | "Failed to sling: {error}" |
| Run Formula | "Running {formula}..." | "Formula {formula} started" | "Failed to run formula: {error}" |
| Send Mail | "Sending message..." | "Message sent" | "Failed to send: {error}" |

---

## Error Handling Strategy

### Error Categories

```typescript
// src/lib/errors/types.ts

export type ErrorCategory =
  | 'CLI_ERROR'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'KNOWN_BUG'
  | 'UNKNOWN';

export interface AppError {
  category: ErrorCategory;
  code: string;
  message: string;
  technicalDetails?: {
    command?: string;
    exitCode?: number;
    stderr?: string;
    stack?: string;
  };
  recoverable: boolean;
  suggestedAction?: string;
}
```

### Known Bug Handling

```typescript
// src/lib/errors/known-bugs.ts

export const KNOWN_BUGS: Record<string, {
  pattern: RegExp;
  category: 'KNOWN_BUG';
  userMessage: string;
  suggestedAction: string;
  isSoftFail: boolean;
}> = {
  'MOL_BOND_DAEMON': {
    pattern: /mol bond.*daemon/i,
    category: 'KNOWN_BUG',
    userMessage: 'Command queued (daemon not running)',
    suggestedAction: 'Run "gt up" to start the daemon',
    isSoftFail: true,
  },
  'GIT_AUTH_FAILED': {
    pattern: /Permission denied|Authentication failed/i,
    category: 'KNOWN_BUG',
    userMessage: 'Git authentication failed',
    suggestedAction: 'Check your SSH keys or credentials',
    isSoftFail: false,
  },
  'BEADS_LOCKED': {
    pattern: /database is locked/i,
    category: 'KNOWN_BUG',
    userMessage: 'Database temporarily locked',
    suggestedAction: 'Wait a moment and try again',
    isSoftFail: true,
  },
};

export function identifyKnownBug(stderr: string): typeof KNOWN_BUGS[string] | null {
  for (const bug of Object.values(KNOWN_BUGS)) {
    if (bug.pattern.test(stderr)) {
      return bug;
    }
  }
  return null;
}
```

---

## Environment Configuration

Remove hardcoded absolute paths. Use environment variables with sensible defaults.

### Required Environment Variables

```typescript
// src/lib/config/environment.ts

export interface GastownConfig {
  // Core paths
  GASTOWN_TOWN_ROOT: string;
  GASTOWN_HOME: string;
  GASTOWN_BD_CWD: string;

  // CLI binaries
  GASTOWN_GT_BIN: string;
  GASTOWN_BD_BIN: string;

  // Timeouts
  GASTOWN_CLI_TIMEOUT: number;
  GASTOWN_CLONE_TIMEOUT: number;

  // Polling
  GASTOWN_POLL_CRITICAL: number;
  GASTOWN_POLL_STANDARD: number;
  GASTOWN_POLL_BACKGROUND: number;

  // Cache
  GASTOWN_CACHE_TTL: number;

  // Feature flags
  GASTOWN_ENABLE_WRITES: boolean;
  GASTOWN_DEMO_MODE: boolean;
}

function loadConfig(): GastownConfig {
  return {
    GASTOWN_TOWN_ROOT: process.env.GASTOWN_TOWN_ROOT ?? process.cwd(),
    GASTOWN_HOME: process.env.GASTOWN_HOME ?? `${process.env.HOME}/.gastown`,
    GASTOWN_BD_CWD: process.env.GASTOWN_BD_CWD ?? process.cwd(),

    GASTOWN_GT_BIN: process.env.GASTOWN_GT_BIN ?? 'gt',
    GASTOWN_BD_BIN: process.env.GASTOWN_BD_BIN ?? 'bd',

    GASTOWN_CLI_TIMEOUT: parseInt(process.env.GASTOWN_CLI_TIMEOUT ?? '30000'),
    GASTOWN_CLONE_TIMEOUT: parseInt(process.env.GASTOWN_CLONE_TIMEOUT ?? '180000'),

    GASTOWN_POLL_CRITICAL: parseInt(process.env.GASTOWN_POLL_CRITICAL ?? '5000'),
    GASTOWN_POLL_STANDARD: parseInt(process.env.GASTOWN_POLL_STANDARD ?? '15000'),
    GASTOWN_POLL_BACKGROUND: parseInt(process.env.GASTOWN_POLL_BACKGROUND ?? '60000'),

    GASTOWN_CACHE_TTL: parseInt(process.env.GASTOWN_CACHE_TTL ?? '2000'),

    GASTOWN_ENABLE_WRITES: process.env.GASTOWN_ENABLE_WRITES === 'true',
    GASTOWN_DEMO_MODE: process.env.GASTOWN_DEMO_MODE !== 'false',
  };
}

export const config = loadConfig();
```

### .env.example

```bash
# Gastown UI Environment Configuration

# Core paths (defaults to process.cwd() and $HOME)
# GASTOWN_TOWN_ROOT=/path/to/town
# GASTOWN_HOME=/home/user/.gastown
# GASTOWN_BD_CWD=/path/to/beads

# CLI binaries (defaults to PATH lookup)
# GASTOWN_GT_BIN=/usr/local/bin/gt
# GASTOWN_BD_BIN=/usr/local/bin/bd

# Timeouts (milliseconds)
GASTOWN_CLI_TIMEOUT=30000
GASTOWN_CLONE_TIMEOUT=180000

# Polling intervals (milliseconds)
GASTOWN_POLL_CRITICAL=5000
GASTOWN_POLL_STANDARD=15000
GASTOWN_POLL_BACKGROUND=60000

# Cache TTL (milliseconds)
GASTOWN_CACHE_TTL=2000

# Feature flags
GASTOWN_ENABLE_WRITES=false
GASTOWN_DEMO_MODE=true
```

### Operational Requirements

| Requirement | Check Command | Error if Missing |
|-------------|---------------|------------------|
| `gt` binary in PATH | `which gt` | "gt command not found" |
| `bd` binary in PATH | `which bd` | "bd command not found" |
| `.beads/` directory exists | `ls $GASTOWN_BD_CWD/.beads` | "Beads directory not found" |
| `beads.db` accessible | `bd list --limit=1` | "Database not accessible" |
| Town initialized | `gt status` exits 0 | "Town not initialized" |

---

## CLI Wrapper & Caching

Centralize all CLI execution with consistent error handling, timeouts, and caching.

> **CRITICAL**: Never run `gt`/`bd` via shell strings. Always use `spawn`/`execFile` with argv arrays.
> This eliminates shell-injection bugs and "sanitization deletes characters" issues.

### Process Supervisor

The Process Supervisor manages all CLI execution with:
- **No shell**: `spawn`/`execFile` with arg arrays only
- **Concurrency limiting**: Global semaphore (max 2-4 concurrent processes)
- **In-flight deduping**: Same `(cwd, argv)` key joins existing promise
- **Cancellation**: SIGTERM → SIGKILL escalation on timeout
- **Streaming**: stderr/stdout forwarded to Operation Center for long ops

```typescript
// src/lib/server/cli/process-supervisor.ts

import { spawn, type ChildProcess } from 'child_process';
import { config } from '$lib/config/environment';

const MAX_CONCURRENT = 4;
const semaphore = { count: 0, queue: [] as (() => void)[] };
const inFlight = new Map<string, Promise<ProcessResult>>();

interface ProcessResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  requestId: string;
}

async function acquire(): Promise<void> {
  if (semaphore.count < MAX_CONCURRENT) {
    semaphore.count++;
    return;
  }
  return new Promise((resolve) => semaphore.queue.push(resolve));
}

function release(): void {
  if (semaphore.queue.length > 0) {
    const next = semaphore.queue.shift()!;
    next();
  } else {
    semaphore.count--;
  }
}

export async function runProcess(
  command: string,
  argv: string[],
  options: {
    cwd?: string;
    timeout?: number;
    requestId?: string;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  } = {}
): Promise<ProcessResult> {
  const { cwd = config.townRoot, timeout = 30000 } = options;
  const requestId = options.requestId ?? crypto.randomUUID();
  const key = `${cwd}:${command} ${argv.join(' ')}`;

  // In-flight deduping (skip for streaming)
  if (!options.onStdout && !options.onStderr) {
    const existing = inFlight.get(key);
    if (existing) return existing;
  }

  const promise = (async () => {
    await acquire();
    const start = Date.now();

    try {
      const child = spawn(command, argv, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, ...config.cliEnv }
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d) => {
        const chunk = String(d);
        stdout += chunk;
        options.onStdout?.(chunk);
      });

      child.stderr.on('data', (d) => {
        const chunk = String(d);
        stderr += chunk;
        options.onStderr?.(chunk);
      });

      // Timeout with escalation
      const killTimer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 2000);
      }, timeout);

      const exitCode: number = await new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? 0));
      });

      clearTimeout(killTimer);

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        exitCode,
        duration: Date.now() - start,
        requestId
      };
    } finally {
      release();
      inFlight.delete(key);
    }
  })();

  if (!options.onStdout && !options.onStderr) {
    inFlight.set(key, promise);
  }
  return promise;
}
```

### Unified CLI Executor (uses Process Supervisor)

```typescript
// src/lib/server/cli/exec.ts

import { runProcess } from './process-supervisor';
import { identifyKnownBug } from '$lib/errors/known-bugs';
import { z } from 'zod';

export interface CLIResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stderr?: string;
    exitCode?: number;
    knownBug?: KnownBugInfo | null;
    requestId: string;
  };
  cached: boolean;
  duration: number;
  requestId: string;
  freshness: {
    fetchedAt: string;
    ttlMs: number;
  };
}

// Command-specific timeouts
const TIMEOUTS: Record<string, number> = {
  'gt status': 5000,
  'gt doctor': 120000,
  'gt rig add': 180000,
  'bd list': 5000,
  'bd show': 5000,
  'gt convoys': 10000,
  'gt mail inbox': 10000,
  default: 30000
};

function getTimeout(command: string, argv: string[]): number {
  const key = `${command} ${argv[0] ?? ''}`.trim();
  return TIMEOUTS[key] ?? TIMEOUTS.default;
}

export async function runGt<T>(
  args: string[],
  options: { schema?: z.ZodType<T>; skipCache?: boolean } = {}
): Promise<CLIResult<T>> {
  const timeout = getTimeout('gt', args);
  const result = await runProcess('gt', args, { timeout });

  return processResult<T>(result, options.schema);
}

export async function runBd<T>(
  args: string[],
  options: { schema?: z.ZodType<T>; skipCache?: boolean } = {}
): Promise<CLIResult<T>> {
  const timeout = getTimeout('bd', args);
  const result = await runProcess('bd', args, { timeout });

  return processResult<T>(result, options.schema);
}

function processResult<T>(
  result: ProcessResult,
  schema?: z.ZodType<T>
): CLIResult<T> {
  if (!result.success) {
    const knownBug = identifyKnownBug(result.stderr);
    return {
      success: false,
      cached: false,
      duration: result.duration,
      requestId: result.requestId,
      freshness: { fetchedAt: new Date().toISOString(), ttlMs: 0 },
      error: {
        code: knownBug ? 'KNOWN_BUG' : 'CLI_ERROR',
        message: knownBug?.userMessage ?? `Command failed (exit ${result.exitCode})`,
        stderr: result.stderr.slice(0, 1000),
        exitCode: result.exitCode,
        knownBug,
        requestId: result.requestId
      }
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const data = schema ? schema.parse(parsed) : (parsed as T);

    return {
      success: true,
      data,
      cached: false,
      duration: result.duration,
      requestId: result.requestId,
      freshness: { fetchedAt: new Date().toISOString(), ttlMs: 2000 }
    };
  } catch (e) {
    return {
      success: false,
      cached: false,
      duration: result.duration,
      requestId: result.requestId,
      freshness: { fetchedAt: new Date().toISOString(), ttlMs: 0 },
      error: {
        code: e instanceof z.ZodError ? 'SCHEMA_MISMATCH' : 'PARSE_ERROR',
        message: e instanceof z.ZodError
          ? `CLI output doesn't match expected schema: ${e.errors.map(e => e.message).join(', ')}`
          : 'Failed to parse CLI output as JSON',
        stderr: result.stdout.slice(0, 500),
        requestId: result.requestId
      }
    };
  }
}
```

### Input Validation (Not Sanitization)

> **Note**: Prefer arg-array execution over "deleting characters" sanitization.
> Validate inputs strictly (Zod) and pass as argv[]. Only sanitize for display/logging.

```typescript
// src/lib/server/cli/validation.ts

import { z } from 'zod';

// Strict validation for CLI arguments
export const BeadIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/, 'Invalid bead ID');
export const AgentNameSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,31}$/, 'Invalid agent name');
export const RigNameSchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/, 'Invalid rig name');

// Only sanitize for display/logging (not security)
export function sanitizeForDisplay(input: string): string {
  return input.replace(/\s+/g, ' ').trim().slice(0, 1000);
}
```

### Caching Strategy by Endpoint

| Endpoint | Cache TTL | Rationale |
|----------|-----------|-----------|
| `/status` | 2s | High-frequency, critical |
| `/agents` | 2s | Derived from status |
| `/queue` | 2s | Changes frequently |
| `/convoys` | 5s | Changes less frequently |
| `/mail` | 5s | Acceptable lag |
| `/rigs` | 30s | Rarely changes |
| `/health` | 60s | Expensive check |
| `/formulas` | 300s | Static definitions |

---

## Data Models

### CLI Output Types

```typescript
// src/lib/types/gastown.ts

export interface GtStatus {
  town: string;
  daemon: GtDaemonStatus;
  agents: GtAgent[];
  rigs: GtRigSummary[];
  queue: GtQueueSummary;
}

export interface GtDaemonStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  version: string;
}

export interface GtAgent {
  name: string;
  id: string;
  status: 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';
  session_id: string;
  rig: string;
  worktree: string;
  branch?: string;
  last_activity: string;
  last_activity_ago: string;
  current_task?: string;
  current_molecule?: string;
  health: 'healthy' | 'warning' | 'critical';
}

export interface GtRigSummary {
  name: string;
  path: string;
  agents: number;
  active: number;
  docked: boolean;
}

export interface GtQueueSummary {
  pending: number;
  in_progress: number;
  total: number;
}

export interface GtConvoy {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'closed';
  work_status: 'complete' | 'active' | 'stale' | 'stuck' | 'waiting';
  progress: string;
  completed: number;
  total: number;
  created_at: string;
  updated_at: string;
  tracked_issues: GtTrackedIssue[];
}

export interface GtTrackedIssue {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  priority: number;
}

export interface BdBead {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: number;
  issue_type: string;
  assignee?: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  labels: string[];
  ephemeral: boolean;
  parent_id?: string;
  children?: string[];
}

export interface GtMailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  timestamp: string;
  read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  type: 'task' | 'scavenge' | 'notification' | 'reply';
  delivery: 'queue' | 'interrupt';
  thread_id?: string;
  reply_to?: string;
  pinned: boolean;
  wisp: boolean;
}

export interface GtMergeQueueItem {
  id: string;
  branch: string;
  repo: string;
  polecat: string;
  rig: string;
  status: 'pending' | 'processing' | 'merged' | 'failed';
  priority: number;
  submitted_at: string;
  ci_status?: 'pass' | 'fail' | 'pending';
  mergeable?: 'ready' | 'conflict' | 'pending';
}

export interface GtFormula {
  name: string;
  description: string;
  category: string;
  steps: GtFormulaStep[];
  parameters?: Record<string, GtFormulaParam>;
}

export interface GtFormulaStep {
  id: string;
  name: string;
  description?: string;
  required: boolean;
}

export interface GtFormulaParam {
  type: 'string' | 'number' | 'boolean';
  required: boolean;
  default?: unknown;
  description?: string;
}

export interface GtMolecule {
  id: string;
  formula: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_step?: string;
  steps: GtMoleculeStep[];
  started_at?: string;
  completed_at?: string;
  error?: string;
  agent?: string;
}

export interface GtMoleculeStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  started_at?: string;
  completed_at?: string;
}

export interface GtDoctorResult {
  overall: 'healthy' | 'warning' | 'critical';
  checks: GtHealthCheck[];
  summary: {
    passed: number;
    warned: number;
    failed: number;
    total: number;
  };
}

export interface GtHealthCheck {
  name: string;
  category: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
}

export interface GtRig {
  name: string;
  path: string;
  worktree_root: string;
  branch: string;
  remote: string;
  agents: GtRigAgent[];
  config: GtRigConfig;
  docked: boolean;
  status: 'pending' | 'cloning' | 'active' | 'parked' | 'error';
}

export interface GtRigAgent {
  name: string;
  role: string;
  status: string;
}

export interface GtRigConfig {
  main_branch: string;
  work_branch_prefix: string;
  auto_merge: boolean;
  require_review: boolean;
}

export interface GtFeedItem {
  id: string;
  type: 'agent_status' | 'merge' | 'mail' | 'convoy' | 'error' | 'system';
  timestamp: string;
  title: string;
  description?: string;
  agent?: string;
  rig?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface SlingTarget {
  rig: string;
  agent: string;
  status: 'idle' | 'busy' | 'parked';
  display: string;
}
```

### Zod Validation Schemas

> **Note**: Comprehensive Zod schemas with contract testing are defined in the
> "Contract Testing with Zod" section above.

---

## API Specifications

### Phase 1: SvelteKit Server Routes

| Route | Method | CLI Command | Response | Timeout |
|-------|--------|-------------|----------|---------|
| `/api/gastown/status` | GET | `gt status --json` | `GtStatus` | 30s |
| `/api/gastown/agents` | GET | Parse from status | `GtAgent[]` | 30s |
| `/api/gastown/agents/[id]` | GET | `gt peek <id>` | `GtAgentDetail` | 30s |
| `/api/gastown/convoys` | GET | `gt convoy list --json` | `GtConvoy[]` | 30s |
| `/api/gastown/convoys/[id]` | GET | `gt convoy show <id>` | `GtConvoy` | 30s |
| `/api/gastown/mail` | GET | `bd list --type=message` | `GtMailMessage[]` | 30s |
| `/api/gastown/mail/[id]` | GET | `bd show <id>` | `GtMailMessage` | 30s |
| `/api/gastown/queue` | GET | `gt mq list --json` | `GtMergeQueueItem[]` | 30s |
| `/api/gastown/rigs` | GET | `gt rig list --json` | `GtRig[]` | 30s |
| `/api/gastown/rigs/[name]` | GET | `gt rig show <name>` | `GtRig` | 30s |
| `/api/gastown/rigs` | POST | `gt rig add ...` | `{ id, status }` | **180s** |
| `/api/gastown/work/issues` | GET | `bd list --type=task` | `BdBead[]` | 30s |
| `/api/gastown/work/issues` | POST | `bd create ...` | `BdBead` | 30s |
| `/api/gastown/work/issues/[id]` | GET | `bd show <id>` | `BdBead` | 30s |
| `/api/gastown/work/sling` | POST | `gt sling ...` | `{ status }` | 60s |
| `/api/gastown/feed` | GET | `.events.jsonl` | `GtFeedItem[]` | 30s |
| `/api/gastown/feed/stream` | GET | SSE | `GtFeedItem` stream | N/A |
| `/api/gastown/health` | GET | `gt doctor --json` | `GtDoctorResult` | 90s |
| `/api/gastown/workflows/formulas` | GET | `gt formula list` | `GtFormula[]` | 30s |
| `/api/gastown/workflows/molecules` | GET | `bd list --type=molecule` | `GtMolecule[]` | 30s |
| `/api/gastown/dashboard` | GET | Composite | `DashboardData` | 30s |

### Error Response Format

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    category: ErrorCategory;
    details?: {
      command?: string;
      stderr?: string;
      exitCode?: number;
      knownBug?: string;
    };
    recoverable: boolean;
    suggestedAction?: string;
  };
  timestamp: string;
}
```

---

## Authentication Strategy

### Phase 1: Demo Auth (UI-Only)

```typescript
const DEMO_USERS = {
  admin: { password: 'demo', roles: ['admin'] },
  viewer: { password: 'demo', roles: ['viewer'] },
};
```

### Phase 2: Session Auth (Go Backend)

```go
type Session struct {
    ID        string    `json:"id"`
    UserID    string    `json:"user_id"`
    Roles     []string  `json:"roles"`
    CreatedAt time.Time `json:"created_at"`
    ExpiresAt time.Time `json:"expires_at"`
}
```

### Phase 3: OAuth/SSO

```typescript
interface OAuthConfig {
  provider: 'github' | 'google' | 'okta' | 'azure';
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string[];
}
```

### RBAC Permission Model

```typescript
type Permission =
  | 'agents:read' | 'agents:write'
  | 'convoys:read' | 'convoys:write'
  | 'mail:read' | 'mail:write'
  | 'queue:read' | 'queue:write'
  | 'rigs:read' | 'rigs:write'
  | 'workflows:read' | 'workflows:write'
  | 'system:admin';

const ROLES: Record<string, { name: string; permissions: Permission[] }> = {
  admin: { name: 'Administrator', permissions: ['system:admin'] },
  operator: {
    name: 'Operator',
    permissions: [
      'agents:read', 'agents:write',
      'convoys:read', 'convoys:write',
      'mail:read', 'mail:write',
      'queue:read',
      'rigs:read', 'rigs:write',
      'workflows:read', 'workflows:write',
    ],
  },
  viewer: {
    name: 'Viewer',
    permissions: [
      'agents:read', 'convoys:read', 'mail:read',
      'queue:read', 'rigs:read', 'workflows:read',
    ],
  },
};
```

---

## Security Hardening

### Content Security Policy (CSP)

```typescript
// src/hooks.server.ts
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'img-src': ["'self'", 'data:', 'blob:'],
  'connect-src': ["'self'", 'wss:', 'https:'],
  'frame-ancestors': ["'none'"],
  'form-action': ["'self'"],
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
};
```

### Input Sanitization

```typescript
// src/lib/server/sanitize.ts
import { z } from 'zod';

export function sanitizeForCLI(input: string): string {
  return input
    .replace(/[;&|`$(){}[\]<>\\'"]/g, '')
    .replace(/\n|\r/g, ' ')
    .trim()
    .slice(0, 1000);
}

export const CreateWorkItemSchema = z.object({
  title: z.string().min(1).max(200).transform(sanitizeForCLI),
  description: z.string().max(5000).optional().transform(s => s ? sanitizeForCLI(s) : undefined),
  priority: z.number().int().min(1).max(3),
  labels: z.array(z.string().max(50).transform(sanitizeForCLI)).max(10).optional(),
});

export const AddRigSchema = z.object({
  name: z.string()
    .min(1).max(100)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i, 'Invalid rig name format')
    .transform(sanitizeForCLI),
  url: z.string()
    .url()
    .refine(url => url.startsWith('https://') || url.startsWith('git@'),
      'URL must use HTTPS or SSH'),
});

export const SlingSchema = z.object({
  beadId: z.string().regex(/^[a-z]+-[a-z0-9]+$/, 'Invalid bead ID format'),
  target: z.string()
    .regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, 'Target must be rig/agent format')
    .transform(sanitizeForCLI),
});
```

### Rate Limiting

```typescript
// src/lib/server/rate-limit.ts
const RATE_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  'GET:/api/gastown/status': { windowMs: 1000, maxRequests: 10 },
  'GET:/api/gastown/*': { windowMs: 1000, maxRequests: 20 },
  'POST:/api/gastown/rigs': { windowMs: 60000, maxRequests: 5 },
  'POST:/api/gastown/work/*': { windowMs: 10000, maxRequests: 10 },
  'POST:/api/gastown/work/sling': { windowMs: 5000, maxRequests: 5 },
  'default': { windowMs: 1000, maxRequests: 50 },
};
```

### Security Checklist

| Category | Control | Status |
|----------|---------|--------|
| XSS Prevention | CSP headers | Phase 1 |
| XSS Prevention | HTML escaping in Svelte | Built-in |
| CSRF | SameSite cookies | Phase 1 |
| CSRF | Origin validation | Phase 1 |
| Injection | CLI input sanitization | Phase 1 |
| Injection | Zod validation | Phase 1 |
| DoS | Rate limiting | Phase 1 |
| DoS | Request timeouts | Phase 1 |
| Auth | Session expiration | Phase 2 |
| Auth | Bearer token rotation | Phase 2 |
| Audit | Request logging | Phase 2 |

---

## Performance Targets

### Core Web Vitals

| Metric | Target | Measurement |
|--------|--------|-------------|
| **LCP** | < 2.5s | Dashboard first meaningful paint |
| **FID** | < 100ms | Button click responsiveness |
| **CLS** | < 0.1 | No layout jumps on data load |
| **TTFB** | < 200ms | Server response time |
| **TTI** | < 3.5s | Full interactivity |

### Bundle Size Budgets

| Chunk | Budget |
|-------|--------|
| Initial JS | < 100KB gzipped |
| Initial CSS | < 30KB gzipped |
| Vendor chunk | < 80KB gzipped |
| Total initial | < 200KB gzipped |
| Lazy chunks | < 50KB each |

### API Response Time Targets

| Endpoint | Target (P95) |
|----------|--------------|
| `/api/gastown/status` | < 500ms |
| `/api/gastown/agents` | < 300ms |
| `/api/gastown/mail` | < 400ms |
| All cached endpoints | < 50ms |

### Rendering Performance

```typescript
export const VIRTUALIZATION_THRESHOLDS = {
  agentList: 50,
  mailInbox: 100,
  workItems: 200,
  activityFeed: 500,
};

export const INTERACTION_TIMINGS = {
  searchDebounce: 300,
  scrollThrottle: 100,
  resizeDebounce: 150,
  pollingJitter: 0.1,
};
```

---

## Accessibility (WCAG 2.2)

### Keyboard Navigation

> **Note**: Complete vim-style keyboard navigation implementation is in the
> "Vim-Style Keyboard Navigation" section above.

```typescript
export const KEYBOARD_SHORTCUTS = {
  global: {
    'g d': 'Navigate to Dashboard',
    'g r': 'Navigate to Rigs',
    'g w': 'Navigate to Work',
    'g m': 'Navigate to Mail',
    'g q': 'Navigate to Queue',
    '?': 'Show keyboard shortcuts',
    '/': 'Focus search',
    'Escape': 'Close modal/dialog',
  },
  dashboard: {
    'r': 'Refresh data',
    'j': 'Next agent',
    'k': 'Previous agent',
    'Enter': 'View agent details',
  },
  lists: {
    'j': 'Next item',
    'k': 'Previous item',
    'Enter': 'Select/Open item',
    'x': 'Toggle selection',
    'a': 'Select all',
  },
};
```

### ARIA Patterns by Component

| Component | ARIA Pattern | Key Attributes |
|-----------|--------------|----------------|
| Agent Card | Card | `role="article"`, `aria-labelledby` |
| Agent List | Feed | `role="feed"`, `aria-busy` |
| Status Badge | Status | `role="status"`, color + text |
| Modal | Dialog | `role="dialog"`, `aria-modal="true"` |
| Dropdown | Listbox | `role="listbox"`, `aria-expanded` |
| Toast | Alert | `role="alert"`, `aria-live="polite"` |
| Loading | Status | `aria-busy="true"` |
| Tabs | Tablist | `role="tablist"`, `aria-selected` |

### Color Contrast Requirements

```css
:root {
  --color-success-text: #166534;  /* 7.1:1 on white */
  --color-warning-text: #854d0e;  /* 5.9:1 on white */
  --color-error-text: #991b1b;    /* 7.8:1 on white */
  --color-info-text: #1e40af;     /* 8.6:1 on white */
}

:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Touch Targets (Mobile)

```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px;
}

.touch-safe-spacing {
  gap: 8px;
}
```

### Accessibility Testing

| Test | Tool | Frequency |
|------|------|-----------|
| Automated a11y audit | axe-core | Every PR |
| Keyboard navigation | Manual | Weekly |
| Screen reader | Manual | Per release |
| Color contrast | axe-core | Every PR |

---

## Testing Strategy

### Testing Philosophy (v5.0)

> **Repo Posture**: No Playwright E2E tests. Focus on component tests, contract tests, and smoke runners.

**Why no Playwright?**
- Reduces CI complexity and flakiness
- Component tests with Vitest + Testing Library provide good coverage
- Contract tests catch CLI output drift without browser overhead
- Smoke runner scripts validate CUJ happy paths in local dev

**Test Pyramid**:
1. **Unit tests** (fastest): Pure functions, utilities, Zod schemas
2. **Component tests**: Vitest + @testing-library/svelte for UI components
3. **Contract tests**: Golden fixtures + Zod validation for CLI output
4. **Smoke tests**: Script that exercises CUJ happy paths via API calls

### Test ID Conventions

```typescript
export const SELECTORS = {
  NAV_RIGS: '[data-testid="nav-rigs"]',
  NAV_WORK: '[data-testid="nav-work"]',
  NAV_MAIL: '[data-testid="nav-mail"]',
  NAV_DASHBOARD: '[data-testid="nav-dashboard"]',

  ADD_RIG_BTN: '[data-testid="add-rig-btn"]',
  RIG_NAME_INPUT: '[data-testid="rig-name-input"]',
  RIG_URL_INPUT: '[data-testid="rig-url-input"]',
  RIG_SUBMIT_BTN: '[data-testid="rig-submit-btn"]',
  RIG_LIST: '[data-testid="rig-list"]',
  RIG_ITEM: '[data-testid="rig-item"]',

  NEW_WORK_BTN: '[data-testid="new-work-btn"]',
  WORK_TITLE_INPUT: '[data-testid="work-title-input"]',
  WORK_PRIORITY_SELECT: '[data-testid="work-priority-select"]',
  WORK_LABELS_INPUT: '[data-testid="work-labels-input"]',
  WORK_SUBMIT_BTN: '[data-testid="work-submit-btn"]',
  WORK_LIST: '[data-testid="work-list"]',
  WORK_ITEM: '[data-testid="work-item"]',

  SLING_BTN: '[data-testid="sling-btn"]',
  SLING_TARGET_SELECT: '[data-testid="sling-target-select"]',
  SLING_CONFIRM_BTN: '[data-testid="sling-confirm-btn"]',

  TOAST: '[data-testid="toast"]',
  TOAST_MESSAGE: '[data-testid="toast-message"]',
  TOAST_ACTION: '[data-testid="toast-action"]',

  BEAD_ID: (id: string) => `[data-bead-id="${id}"]`,
  RIG_NAME: (name: string) => `[data-rig-name="${name}"]`,
  AGENT_NAME: (name: string) => `[data-agent-name="${name}"]`,
} as const;
```

### MSW Handlers

```typescript
// src/lib/test/msw-handlers.ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  http.get('/api/gastown/status', async () => {
    await delay(100);
    return HttpResponse.json(mockStatus);
  }),

  http.post('/api/gastown/rigs', async ({ request }) => {
    const body = await request.json();
    await delay(2000);
    return HttpResponse.json({
      id: `rig-${Date.now()}`,
      name: body.name,
      status: 'active',
    });
  }),

  http.post('/api/gastown/work/issues', async ({ request }) => {
    const body = await request.json();
    const id = `hq-${Math.random().toString(36).slice(2, 8)}`;
    return HttpResponse.json({
      id,
      title: body.title,
      status: 'open',
      priority: body.priority,
      created_at: new Date().toISOString(),
    });
  }),

  http.post('/api/gastown/work/sling', async ({ request }) => {
    const body = await request.json();
    if (Math.random() < 0.2) {
      return HttpResponse.json({
        error: {
          code: 'KNOWN_BUG',
          message: 'Sling queued (daemon not running)',
          category: 'KNOWN_BUG',
          recoverable: true,
        },
      }, { status: 202 });
    }
    return HttpResponse.json({ status: 'slung', target: body.target });
  }),
];
```

---

## Deployment Architecture

### Deployment Topology Phases

```
Phase 1: Single Machine (Local Dev)
┌─────────────────────────────────────────────┐
│                  localhost                   │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Browser │<-->│SvelteKit│<-->│ gt/bd   │ │
│  │         │    │ :3000   │    │ CLI     │ │
│  └─────────┘    └─────────┘    └─────────┘ │
│                       │              │       │
│                       └──────┬───────┘       │
│                              v               │
│                       ┌─────────┐            │
│                       │.beads/  │            │
│                       │ SQLite  │            │
│                       └─────────┘            │
└─────────────────────────────────────────────┘

Phase 2: Two Origins (Remote)
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────────────┐         ┌─────────────────────────┐   │
│  │ ui.gastown.com  │         │ api.gastown.com         │   │
│  │                 │  CORS   │                         │   │
│  │  ┌───────────┐  │<------->│  ┌───────────────────┐  │   │
│  │  │ SvelteKit │  │  HTTPS  │  │  Go Daemon        │  │   │
│  │  │ (Static)  │  │         │  │  - REST API       │  │   │
│  │  └───────────┘  │         │  │  - WebSocket      │  │   │
│  │                 │  WS     │  │  - Auth (Bearer)  │  │   │
│  └─────────────────┘<------->│  └───────────────────┘  │   │
│                              │           │              │   │
│                              │           v              │   │
│                              │  ┌───────────────────┐  │   │
│                              │  │ .beads/ + SQLite  │  │   │
│                              │  └───────────────────┘  │   │
│                              └─────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Development (docker-compose.dev.yml)

```yaml
version: '3.8'
services:
  ui:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - GASTOWN_TOWN_ROOT=/data/town
      - GASTOWN_BD_CWD=/data/town
      - GASTOWN_DEMO_MODE=true
      - GASTOWN_ENABLE_WRITES=true
    volumes:
      - /usr/local/bin/gt:/usr/local/bin/gt:ro
      - /usr/local/bin/bd:/usr/local/bin/bd:ro
      - ~/.beads:/root/.beads
      - ./town:/data/town
```

### Production (docker-compose.prod.yml)

```yaml
version: '3.8'
services:
  ui:
    image: gastown-ui:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - ORIGIN=https://ui.gastown.com
      - PUBLIC_API_URL=https://api.gastown.com
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  api:
    image: gastown-daemon:latest
    ports:
      - "8080:8080"
    environment:
      - GASTOWN_API_PORT=8080
      - GASTOWN_ALLOWED_ORIGINS=https://ui.gastown.com
      - GASTOWN_AUTH_MODE=bearer
    volumes:
      - beads-data:/data/.beads
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '1'
          memory: 512M

volumes:
  beads-data:
    driver: local
```

---

## Implementation Checklist

### Phase 1: MVP (CLI Bridge)

#### Environment & Configuration
- [ ] Create `src/lib/config/environment.ts`
- [ ] Create `.env.example` with all variables
- [ ] Remove hardcoded absolute paths from existing code
- [ ] Add startup validation for required paths/binaries

#### Process Supervisor (v5.0) - **PRIORITY**
- [ ] Create `src/lib/server/cli/process-supervisor.ts`
- [ ] Implement no-shell execution with `spawn`/`execFile`
- [ ] Add concurrency limiter (max 2-4 concurrent processes)
- [ ] Implement in-flight request deduping by `(cwd, argv)` key
- [ ] Add SIGTERM → SIGKILL timeout escalation
- [ ] Implement streaming stdout/stderr for long ops
- [ ] Migrate all routes from `exec()` to new supervisor
- [ ] Remove all `execSync` from request paths

#### Capabilities Probe (v5.0)
- [ ] Create `src/routes/api/gastown/capabilities/+server.ts`
- [ ] Probe `gt --version` and `bd --version` on boot
- [ ] Check JSON support for critical commands
- [ ] Check for `.events.jsonl` presence
- [ ] Cache capabilities with 1-minute TTL
- [ ] Add feature flags to client stores

#### CLI Contracts (v5.0)
- [ ] Create Zod schemas for `gt status`, `bd list`, `gt convoys`
- [ ] Validate JSON output immediately after parse
- [ ] Return `SCHEMA_MISMATCH` error code on drift
- [ ] Show raw data + warning in UI on contract failure

#### Watch-First Updates (v5.0)
- [ ] Create `src/lib/server/watchers/beads-watcher.ts`
- [ ] Watch `.beads/` directory for changes
- [ ] Invalidate cache keys on file changes
- [ ] Create `src/lib/server/watchers/broadcast.ts`
- [ ] Wire watchers to WebSocket broadcast
- [ ] Create `DegradedModeBanner.svelte` component

#### Power-User Ergonomics (v5.0)
- [ ] Create `src/lib/components/CommandPalette.svelte` (full implementation)
- [ ] Create `src/lib/components/CopyCli.svelte`
- [ ] Add Copy CLI buttons to all action cards
- [ ] Create `src/lib/stores/search-index.ts`
- [ ] Create `src/lib/components/GlobalSearch.svelte`
- [ ] Wire global search to header
- [ ] Add `/` keyboard shortcut for search focus

#### Operation Center (v5.0)
- [ ] Create `src/lib/stores/operations.svelte.ts`
- [ ] Create `src/lib/components/OperationCenter.svelte`
- [ ] Wire to Process Supervisor for streaming logs
- [ ] Implement cancel/retry actions
- [ ] Add "Copy debug bundle" feature

#### Diagnostics Endpoint (v5.0)
- [ ] Create `src/routes/api/gastown/diagnostics/+server.ts`
- [ ] Check `gt` and `bd` binary presence
- [ ] Check town root accessibility
- [ ] Check daemon status
- [ ] Return structured health report

#### LLM-Friendly Docs (v5.0)
- [ ] Create `static/llms.txt` with concise index
- [ ] Create `scripts/generate-llms-txt.ts`
- [ ] Add CI workflow to regenerate on docs changes
- [ ] Link from README

#### Effect.ts CLI Infrastructure (v4.0)
- [ ] Install Effect.ts: `bun add effect @effect/schema`
- [ ] Create `src/lib/server/cli-effect.ts` with typed errors
- [ ] Implement `CLIError`, `ParseError`, `TimeoutError`, `CircuitOpenError`
- [ ] Add circuit breaker with `CircuitBreakerState`
- [ ] Implement retry policies with exponential backoff
- [ ] Add caching layer with TTL
- [ ] Create `execGt` and `execBd` Effect wrappers
- [ ] Add execution metrics and logging

#### SWR Data Layer (v4.0)
- [ ] Create `src/lib/stores/swr.svelte.ts`
- [ ] Implement `createSWRStore` with Svelte 5 runes
- [ ] Add request deduplication
- [ ] Add `revalidateOnFocus` support
- [ ] Add `revalidateOnReconnect` support
- [ ] Add localStorage persistence for offline support
- [ ] Create SWR stores for all API endpoints

#### Contract Testing (v4.0)
- [ ] Create `src/lib/types/gastown.schema.ts` with Zod schemas
- [ ] Add contract tests in `src/lib/types/__tests__/`
- [ ] Create `testCLIContract` helper
- [ ] Add schema validation to all API routes
- [ ] Set up CI to run contract tests

#### Real-Time Activity Stream (v4.0)
- [ ] Create `src/routes/api/gastown/feed/stream/+server.ts`
- [ ] Implement SSE endpoint with file watching
- [ ] Create `src/lib/stores/activity.svelte.ts`
- [ ] Add `ActivityFeed.svelte` component
- [ ] Implement reconnection with exponential backoff

#### Vim-Style Keyboard Navigation (v4.0)
- [ ] Create `src/lib/utils/keyboard-vim.ts`
- [ ] Implement multi-key sequence handling (g+key)
- [ ] Create `KeyboardHelp.svelte` component
- [ ] Create `CommandPalette.svelte` component
- [ ] Add keyboard navigation to root layout
- [ ] Implement j/k list navigation
- [ ] Add `/` for search focus
- [ ] Add `?` for help overlay

#### Server Routes
- [ ] `GET /api/gastown/status` - Refactor to use Process Supervisor
- [ ] `GET /api/gastown/agents` - Extract agents from status
- [ ] `GET /api/gastown/agents/[id]` - Agent details via `gt peek`
- [ ] `GET /api/gastown/convoys` - Refactor to use Process Supervisor
- [ ] `GET /api/gastown/convoys/[id]` - Convoy details
- [ ] `GET /api/gastown/mail` - Done (refactor for consistency)
- [ ] `GET /api/gastown/mail/[id]` - Mail message detail
- [ ] `GET /api/gastown/queue` - Merge queue list
- [ ] `GET /api/gastown/rigs` - Rig list
- [ ] `GET /api/gastown/rigs/[name]` - Rig details
- [ ] `POST /api/gastown/rigs` - Add rig (long-running)
- [ ] `GET /api/gastown/work/issues` - Work item list
- [ ] `POST /api/gastown/work/issues` - Create work item
- [ ] `POST /api/gastown/work/sling` - Sling work item
- [ ] `GET /api/gastown/feed` - Activity feed (from .events.jsonl)
- [ ] `GET /api/gastown/feed/stream` - SSE activity stream (v4.0)
- [ ] `GET /api/gastown/health` - Doctor results
- [ ] `GET /api/gastown/dashboard` - Composite endpoint
- [ ] `GET /api/gastown/capabilities` - CLI capability probe (v5.0)
- [ ] `GET /api/gastown/diagnostics` - System health checks (v5.0)
- [ ] `GET /api/gastown/snapshot` - Coherent state snapshot (v5.0)
- [ ] `GET /api/gastown/operations` - Running operations list (v5.0)
- [ ] `GET /api/gastown/operations/[id]` - Operation status + logs (v5.0)

#### Type System
- [ ] Create `src/lib/types/gastown.ts`
- [ ] Create Zod schemas for validation
- [ ] Add CLI output type tests
- [ ] Define state transition types
- [ ] Add contract tests for CLI output schemas

#### Security
- [ ] Add CSP headers in hooks.server.ts
- [ ] Implement input sanitization for CLI commands
- [ ] Add rate limiting middleware
- [ ] Validate all POST request bodies with Zod

#### Polling System (with SWR)
- [ ] Create `src/lib/stores/polling.svelte.ts`
- [ ] Implement multi-tier polling (5s/15s/60s)
- [ ] Add visibility-based pause (tab inactive)
- [ ] Handle network offline gracefully
- [ ] Add jitter to prevent thundering herd

#### Long-Running Operations
- [ ] Create `src/lib/services/async-operations.ts`
- [ ] Implement timeout configuration
- [ ] Add operation status tracking
- [ ] Create pending state UI components

#### Toast System
- [ ] Define machine-readable toast patterns
- [ ] Implement two-phase feedback (ing -> ed)
- [ ] Add data attributes for testing
- [ ] Create ID extraction helpers

#### Error Handling
- [ ] Define error categories and types
- [ ] Implement known bug detection
- [ ] Create error display components
- [ ] Add suggested actions

#### UI Components
- [ ] Dashboard overview page (CUJ-4)
- [ ] Agent list with status indicators
- [ ] Agent detail view
- [ ] Convoy list and detail views
- [ ] Mail inbox (already exists) (CUJ-5)
- [ ] Merge queue visualization
- [ ] Rig list with pending states (CUJ-1)
- [ ] Work item list and detail (CUJ-2)
- [ ] Sling dialog with target dropdown (CUJ-3)
- [ ] Activity feed timeline (with SSE streaming)
- [ ] Health status panel
- [ ] Keyboard shortcut overlay (v4.0)
- [ ] Command palette (v4.0)

#### Accessibility
- [ ] Add ARIA attributes to all interactive components
- [ ] Implement keyboard navigation (vim-style v4.0)
- [ ] Add focus management for modals
- [ ] Create screen reader announcements for state changes
- [ ] Ensure color contrast compliance
- [ ] Add axe-core to CI pipeline

#### Testing Infrastructure
- [ ] Define `data-testid` conventions
- [ ] Create selector constants
- [ ] Set up MSW handlers
- [ ] Create test helpers for long-running ops
- [ ] Add auth injection for tests
- [ ] Create mock server for dev mode

#### Testing
- [ ] MSW handlers for all endpoints
- [ ] Component tests with mock data
- [ ] E2E tests for CUJ-1 (Rig Management)
- [ ] E2E tests for CUJ-2 (Work Lifecycle)
- [ ] E2E tests for CUJ-3 (Orchestration)
- [ ] E2E tests for CUJ-4 (Monitoring)
- [ ] E2E tests for CUJ-5 (Mail)
- [ ] Contract tests for CLI output schemas (v4.0)
- [ ] Accessibility tests with axe-core
- [ ] Performance tests for bundle size
- [ ] Keyboard navigation tests (v4.0)

#### Documentation
- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Document operational requirements
- [ ] Create troubleshooting guide
- [ ] Document keyboard shortcuts (v4.0)

### Phase 2: REST API

#### Go Backend
- [ ] Create `internal/web/api/` package
- [ ] Implement REST handlers
- [ ] Add OpenAPI spec generation
- [ ] Session-based auth
- [ ] RBAC middleware
- [ ] Async job queue for long operations

#### UI Updates
- [ ] Switch from CLI exec to HTTP calls
- [ ] Add auth flow (login/logout)
- [ ] Role-based UI hiding

### Phase 3: Real-Time

#### Go Backend
- [ ] WebSocket hub implementation
- [ ] Event subscription system
- [ ] Log streaming
- [ ] Rig status events
- [ ] Work item status events

#### UI Updates
- [ ] WebSocket client (already exists)
- [ ] Live agent status
- [ ] Real-time log viewer
- [ ] Push notifications
- [ ] Remove polling fallback

---

## Manual Verification Checklists

### Checklist: Rig Management (CUJ-1)

- [ ] Navigate to `/rigs`
- [ ] Click "Add Rig" button
- [ ] Enter rig name: `test-rig`
- [ ] Enter URL: `https://github.com/example/test-repo`
- [ ] Click "Add"
- [ ] **Verify**: Modal closes immediately (non-blocking)
- [ ] **Verify**: Toast "Adding rig..." appears within 100ms
- [ ] **Verify**: Rig appears in list with "pending" or "cloning" status
- [ ] **Wait**: Up to 2 minutes for clone to complete
- [ ] **Verify**: Toast "Rig test-rig added successfully" appears
- [ ] **Verify**: Rig status changes to "active"
- [ ] **Verify**: No manual page refresh required

### Checklist: Work Item Lifecycle (CUJ-2)

- [ ] Navigate to `/work`
- [ ] Click "New Work Item"
- [ ] Fill form:
  - Title: "Test work item"
  - Priority: "high"
  - Labels: "test, automation"
- [ ] Click "Create"
- [ ] **Verify**: Toast "Creating work item..." appears
- [ ] **Verify**: Toast "Work item created: {id}" appears with bead ID
- [ ] **Verify**: ID format matches `[a-z]+-[a-z0-9]+`
- [ ] **Verify**: New item appears at TOP of list
- [ ] **Verify**: Item has correct title, priority, labels
- [ ] Click on item to view details
- [ ] **Verify**: Detail view shows all fields

### Checklist: Slinging (CUJ-3)

**Prerequisite**: Complete CUJ-1 and CUJ-2 first

- [ ] On work item, click "Sling" button
- [ ] **Verify**: Sling dialog opens
- [ ] **Verify**: Target dropdown is populated (not empty)
- [ ] **Verify**: Targets show format "rig/agent (status)"
- [ ] Select a target
- [ ] Click "Sling"
- [ ] **Verify**: Toast "Slinging to {target}..." appears
- [ ] **Verify**: Toast "Work slung to {target}" OR "Sling queued" appears
- [ ] **Verify**: If daemon error, message is user-friendly
- [ ] **Verify**: Work item shows "assigned" badge

### Checklist: Dashboard (CUJ-4)

- [ ] Navigate to `/` (dashboard)
- [ ] **Verify**: Agent count cards show correct numbers
- [ ] **Verify**: Queue summary shows pending/running counts
- [ ] **Verify**: Health indicator shows overall status
- [ ] **Verify**: Activity feed shows recent items
- [ ] **Verify**: Last refresh timestamp visible
- [ ] Wait 5 seconds
- [ ] **Verify**: Data auto-refreshes (timestamp updates)
- [ ] Switch to another tab, wait 30 seconds
- [ ] Return to tab
- [ ] **Verify**: Data refreshes immediately on return

### Checklist: Mail View (CUJ-5)

- [ ] Navigate to `/mail`
- [ ] **Verify**: Inbox loads with message list
- [ ] **Verify**: Unread count shown in header
- [ ] **Verify**: Messages show type badges (ESCALATION, HANDOFF, etc.)
- [ ] **Verify**: Messages sorted by timestamp (newest first)
- [ ] Click on a message
- [ ] **Verify**: Message detail view shows full body
- [ ] **Verify**: Thread navigation works (if applicable)

### Checklist: Keyboard Navigation (CUJ-6) (v4.0)

- [ ] Press `?` anywhere
- [ ] **Verify**: Keyboard help overlay appears
- [ ] Press `Escape`
- [ ] **Verify**: Overlay closes
- [ ] Press `g` then `d`
- [ ] **Verify**: Navigate to dashboard
- [ ] Press `g` then `r`
- [ ] **Verify**: Navigate to rigs
- [ ] Press `g` then `w`
- [ ] **Verify**: Navigate to work
- [ ] Press `g` then `m`
- [ ] **Verify**: Navigate to mail
- [ ] On a list page, press `j`
- [ ] **Verify**: Next item selected
- [ ] Press `k`
- [ ] **Verify**: Previous item selected
- [ ] Press `/`
- [ ] **Verify**: Search input focused
- [ ] Press `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
- [ ] **Verify**: Command palette opens

---

## Integration Gap Analysis

### Gap Analysis Table

| UI Feature | Required Data | CLI Command | Gap | Severity | Resolution |
|------------|---------------|-------------|-----|----------|------------|
| Agent list | All agents with status | `gt status --json` | Available | - | - |
| Agent details | Full agent state | `gt peek <id>` | Partial | Medium | Need JSON output flag |
| Agent logs | Real-time log stream | None | Missing | High | Phase 3: WebSocket |
| Convoy list | All convoys | `gt convoy list --json` | Available | - | - |
| Convoy details | Tracked issues | `gt convoy show <id>` | Partial | Low | Parse existing output |
| Mail inbox | Messages list | `bd list --type=message` | Available | - | - |
| Mail thread | Thread messages | `gt mail thread <id>` | No JSON | Medium | Parse text output |
| Merge queue | Queue items | `gt mq list --json` | Available | - | - |
| Rig list | All rigs | `gt rig list --json` | Available | - | - |
| Rig add | Clone progress | `gt rig add` | No progress | Medium | Poll status during clone |
| Work items | All beads | `bd list --json` | Available | - | - |
| Work create | Create bead | `bd create` | Available | - | - |
| Sling | Assign work | `gt sling` | Daemon bug | Low | Handle as soft fail |
| Activity feed | Recent events | `gt feed --json` | May not exist | High | Read .events.jsonl (SSE v4.0) |
| Health check | Doctor results | `gt doctor --json` | Partial JSON | Medium | Parse mixed output |
| Formulas | Formula list | `gt formula list` | No JSON | Low | Parse text output |
| Molecules | Running molecules | `bd list --type=molecule` | Available | - | - |

### Wiring Steps (Implementation Order)

1. **Environment Setup**
   - Create `src/lib/config/environment.ts`
   - Create `.env.example` with all variables
   - Update `.gitignore` for `.env`

2. **Effect.ts CLI Infrastructure (v4.0)**
   - Install dependencies: `bun add effect @effect/schema`
   - Create `src/lib/server/cli-effect.ts`
   - Implement typed error handling
   - Add circuit breaker and retry policies

3. **SWR Data Layer (v4.0)**
   - Create `src/lib/stores/swr.svelte.ts`
   - Implement stale-while-revalidate pattern
   - Add request deduplication

4. **Type Definitions**
   - Create `src/lib/types/gastown.ts`
   - Create `src/lib/types/gastown.schema.ts` (Zod)
   - Add contract tests

5. **Server Routes (Read)**
   - `/api/gastown/status` - refactor to use Effect.ts
   - `/api/gastown/agents` - new
   - `/api/gastown/convoys` - refactor
   - `/api/gastown/mail` - refactor
   - `/api/gastown/queue` - new
   - `/api/gastown/rigs` - refactor
   - `/api/gastown/feed/stream` - new SSE endpoint (v4.0)

6. **Server Routes (Write)**
   - `/api/gastown/rigs` POST - add rig
   - `/api/gastown/work/issues` POST - create work
   - `/api/gastown/work/sling` POST - sling work

7. **Keyboard Navigation (v4.0)**
   - Create `src/lib/utils/keyboard-vim.ts`
   - Add keyboard shortcuts
   - Create help overlay

8. **UI Components**
   - Dashboard with cards
   - Agent list and detail
   - Work item CRUD
   - Sling dialog
   - Command palette (v4.0)

9. **Testing**
   - MSW handlers for all endpoints
   - Component tests
   - E2E tests for CUJs
   - Accessibility tests
   - Contract tests (v4.0)

---

## Operation Center UI

### Overview

A dedicated panel/drawer for monitoring and controlling long-running operations (rig add, doctor, formula run, create bead, sling). Provides visibility into running processes with live logs, elapsed time, and cancel/retry actions.

### Operation Center Component

```svelte
<!-- src/lib/components/OperationCenter.svelte -->
<script lang="ts">
  import { operationsStore, type Operation } from '$lib/stores/operations.svelte';
  import { formatDuration } from '$lib/utils/time';

  let expanded = $state(false);

  $: runningOps = operationsStore.operations.filter(op => op.status === 'running');
  $: recentOps = operationsStore.operations.slice(0, 10);
  $: hasRunning = runningOps.length > 0;

  function toggleExpand() {
    expanded = !expanded;
  }

  function cancelOperation(id: string) {
    operationsStore.cancel(id);
  }

  function retryOperation(id: string) {
    operationsStore.retry(id);
  }

  function copyDebugBundle(op: Operation) {
    const bundle = {
      operation: op,
      logs: op.logs,
      timestamp: new Date().toISOString(),
      environment: {
        userAgent: navigator.userAgent
      }
    };
    navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
  }
</script>

<div class="operation-center" class:expanded>
  <button class="toggle-btn" onclick={toggleExpand}>
    <span class="icon">{hasRunning ? '⏳' : '✓'}</span>
    <span class="label">
      {#if hasRunning}
        {runningOps.length} running
      {:else}
        Operations
      {/if}
    </span>
    <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="m18 15-6-6-6 6" />
    </svg>
  </button>

  {#if expanded}
    <div class="panel">
      <header class="panel-header">
        <h3>Operation Center</h3>
        <button class="clear-btn" onclick={() => operationsStore.clearCompleted()}>
          Clear completed
        </button>
      </header>

      <ul class="operation-list">
        {#each recentOps as op (op.id)}
          <li class="operation-item" class:running={op.status === 'running'} class:failed={op.status === 'failed'}>
            <div class="operation-header">
              <span class="operation-type">{op.type}</span>
              <span class="operation-status status-{op.status}">{op.status}</span>
            </div>

            {#if op.status === 'running'}
              <div class="progress-bar">
                <div class="progress" style="width: {op.progress ?? 0}%" />
              </div>
              <div class="operation-meta">
                <span class="elapsed">{formatDuration(Date.now() - op.startedAt)}</span>
                <button class="cancel-btn" onclick={() => cancelOperation(op.id)}>
                  Cancel
                </button>
              </div>
            {/if}

            {#if op.logs && op.logs.length > 0}
              <details class="logs-details">
                <summary>Logs ({op.logs.length})</summary>
                <pre class="logs">{op.logs.join('\n')}</pre>
              </details>
            {/if}

            {#if op.status === 'failed'}
              <div class="error-section">
                <p class="error-message">{op.error}</p>
                <div class="error-actions">
                  <button onclick={() => retryOperation(op.id)}>Retry</button>
                  <button onclick={() => copyDebugBundle(op)}>Copy debug bundle</button>
                </div>
              </div>
            {/if}
          </li>
        {:else}
          <li class="no-operations">No recent operations</li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .operation-center {
    position: fixed;
    bottom: var(--spacing-4);
    right: var(--spacing-4);
    z-index: 50;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }

  .panel {
    position: absolute;
    bottom: 100%;
    right: 0;
    width: 400px;
    max-height: 500px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    margin-bottom: var(--spacing-2);
    overflow: hidden;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border-bottom: 1px solid var(--border);
  }

  .operation-list {
    max-height: 400px;
    overflow-y: auto;
    padding: var(--spacing-2);
    margin: 0;
    list-style: none;
  }

  .operation-item {
    padding: var(--spacing-3);
    border-radius: var(--radius);
    margin-bottom: var(--spacing-2);
    background: var(--muted);
  }

  .operation-item.running {
    border-left: 3px solid var(--primary);
  }

  .operation-item.failed {
    border-left: 3px solid var(--destructive);
  }

  .operation-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-2);
  }

  .progress-bar {
    height: 4px;
    background: var(--muted-foreground);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: var(--primary);
    transition: width 0.3s ease;
  }

  .logs {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    background: var(--background);
    padding: var(--spacing-2);
    border-radius: var(--radius-sm);
    overflow-x: auto;
    max-height: 200px;
  }

  .status-running { color: var(--primary); }
  .status-completed { color: var(--success); }
  .status-failed { color: var(--destructive); }
</style>
```

### Operations Store

```typescript
// src/lib/stores/operations.svelte.ts

export interface Operation {
  id: string;
  type: 'rig_add' | 'formula_run' | 'work_create' | 'sling' | 'doctor';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: number;
  completedAt?: number;
  progress?: number;
  logs: string[];
  result?: unknown;
  error?: string;
  requestId: string;
}

class OperationsStore {
  operations = $state<Operation[]>([]);

  add(type: Operation['type']): string {
    const id = crypto.randomUUID();
    const operation: Operation = {
      id,
      type,
      status: 'pending',
      startedAt: Date.now(),
      logs: [],
      requestId: crypto.randomUUID()
    };
    this.operations = [operation, ...this.operations];
    return id;
  }

  updateStatus(id: string, status: Operation['status'], error?: string) {
    this.operations = this.operations.map(op =>
      op.id === id
        ? { ...op, status, error, completedAt: status !== 'running' ? Date.now() : undefined }
        : op
    );
  }

  updateProgress(id: string, progress: number) {
    this.operations = this.operations.map(op =>
      op.id === id ? { ...op, progress } : op
    );
  }

  appendLog(id: string, message: string) {
    this.operations = this.operations.map(op =>
      op.id === id ? { ...op, logs: [...op.logs, message] } : op
    );
  }

  cancel(id: string) {
    // Emit cancel event to process supervisor
    dispatchEvent(new CustomEvent('cancel-operation', { detail: { id } }));
    this.updateStatus(id, 'cancelled');
  }

  retry(id: string) {
    const original = this.operations.find(op => op.id === id);
    if (original) {
      dispatchEvent(new CustomEvent('retry-operation', { detail: { operation: original } }));
    }
  }

  clearCompleted() {
    this.operations = this.operations.filter(op =>
      op.status === 'running' || op.status === 'pending'
    );
  }
}

export const operationsStore = new OperationsStore();
```

---

## Risks & Mitigations

### Phase 1 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CLI behavior differs across machines | Medium | High | Diagnostics endpoint + explicit config + schema validation with clear error messages |
| Some commands hang (known `gt mail inbox` hang in Node) | High | Medium | Timeouts + known-bug fallback (`bd list` direct) + circuit breaker pattern |
| SSE tailing is OS/filesystem dependent | Medium | Low | Feature flag `supportsEventsFile` + fallback to polling for activity |
| Rapid polling causes CPU spikes | High | High | Process Supervisor with concurrency limits + in-flight deduping + SWR cache |
| CLI output format changes unexpectedly | Medium | High | Zod contract validation + graceful degradation with "contract mismatch" errors |
| Hard-coded paths break on different machines | High | Critical | Config autodiscovery + no absolute paths in routes |
| `execSync` blocks event loop | Medium | High | Audit and remove all `execSync` from request paths |

### Phase 2 Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API changes | Medium | High | Versioned API (`/api/v1`) + compatibility adapter |
| Auth token compromise | Low | Critical | Short-lived tokens + rotation + secure storage |
| WebSocket connection instability | Medium | Medium | Heartbeat + auto-reconnect + SSE fallback |
| Rate limiting affects legitimate users | Low | Medium | Per-user limits + burst allowance + clear error messages |

### Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No observability into CLI calls | High | Medium | Correlation IDs + structured logs + diagnostics endpoint |
| Users can't reproduce issues | Medium | High | "Copy debug bundle" feature + requestId in errors |
| Daemon unreachable but user doesn't know | High | High | Degraded mode banner + connection status indicator |

---

## LLM-Friendly Documentation

### Overview

Serve `/llms.txt` and `/llms-full.txt` as static files to provide machine-readable context for LLMs (including Claude Code) working on the codebase.

### llms.txt (Concise Index)

```
# static/llms.txt
# Gas Town UI - LLM Context File
# Generated: 2026-01-11

## Project Overview
Gas Town UI is a SvelteKit dashboard for monitoring and controlling the Gas Town agent orchestration system.
It provides visualization of agents, convoys, work items, and mail, with the goal of replacing CLI-only workflows.

## Architecture (Phase 1: CLI Bridge)
- SvelteKit frontend + Node.js server
- Server routes execute `gt` and `bd` CLI commands
- No Go backend changes required
- Process Supervisor manages CLI execution (no shell, concurrency limits)
- SWR caching for instant perceived performance
- File watchers for near-real-time updates

## Key Files
- `src/routes/api/gastown/` - API endpoints that call CLI
- `src/lib/server/cli/` - CLI execution layer
- `src/lib/stores/` - Svelte 5 reactive stores
- `src/lib/components/` - UI components
- `docs/INTEGRATION_PLAN.md` - Full architecture document

## CLI Commands (Quick Reference)
gt status --json          # System status
gt convoys --json         # Convoy list
gt rig list --json        # Rig list
bd list --json            # Work items
bd show <id> --json       # Work item details
gt mail inbox --json      # Mail (may hang, use bd list --type=message)
gt doctor --json          # Health checks

## Known Issues
- `gt mail inbox` may hang in Node.js - use `bd list --type=message --json` instead
- Some CLI commands don't support --json flag - parse text output
- Long-running ops (rig add, doctor) need timeout handling

## Endpoints
GET /api/gastown/status       - System status
GET /api/gastown/agents       - Agent list
GET /api/gastown/convoys      - Convoy list
GET /api/gastown/mail         - Mail messages
GET /api/gastown/queue        - Merge queue
GET /api/gastown/rigs         - Rig list
GET /api/gastown/work         - Work items
GET /api/gastown/capabilities - CLI version/features
GET /api/gastown/diagnostics  - System health checks
GET /api/gastown/feed/stream  - SSE activity stream

## Error Codes
CLI_ERROR      - CLI command failed
KNOWN_BUG      - Known CLI bug with workaround
SCHEMA_MISMATCH - CLI output doesn't match expected format
PARSE_ERROR    - Failed to parse CLI JSON output
TIMEOUT        - CLI command timed out
```

### llms-full.txt Generation

```typescript
// scripts/generate-llms-txt.ts
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DOCS_DIR = 'docs';
const OUTPUT_DIR = 'static';

function collectDocs(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectDocs(fullPath));
    } else if (entry.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function generateLlmsFull() {
  const docs = collectDocs(DOCS_DIR);
  let content = `# Gas Town UI - Full Documentation\n# Generated: ${new Date().toISOString()}\n\n`;

  for (const docPath of docs) {
    const docContent = readFileSync(docPath, 'utf-8');
    content += `\n${'='.repeat(80)}\n`;
    content += `# File: ${docPath}\n`;
    content += `${'='.repeat(80)}\n\n`;
    content += docContent;
    content += '\n';
  }

  writeFileSync(join(OUTPUT_DIR, 'llms-full.txt'), content);
  console.log(`Generated llms-full.txt (${Math.round(content.length / 1024)}KB)`);
}

// Run
generateLlmsFull();
```

### CI Integration

```yaml
# .github/workflows/docs.yml
name: Generate LLM Docs

on:
  push:
    paths:
      - 'docs/**'
      - 'scripts/generate-llms-txt.ts'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - run: bun run scripts/generate-llms-txt.ts

      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'docs: regenerate llms.txt files'
          file_pattern: 'static/llms*.txt'
```

---

## Appendix: CLI Command Reference

### Status Commands
```bash
gt status --json              # Full system status
gt status --agents            # Agents only
gt peek <agent>               # Agent details
```

### Convoy Commands
```bash
gt convoy list --json         # All convoys
gt convoy show <id> --json    # Convoy details
gt convoy create --title "..." # Create (Phase 2)
```

### Mail Commands
```bash
gt mail inbox --json          # Inbox (may hang)
bd list --type=message --json # Alternative (recommended)
bd show <id> --json           # Message details
gt mail send <to> -s "..." -m "..." # Send (Phase 2)
```

### Queue Commands
```bash
gt mq list --json             # Queue items
gt mq status                  # Queue summary
```

### Rig Commands
```bash
gt rig list --json            # All rigs
gt rig show <name>            # Rig details
gt rig config <name>          # Rig config
gt rig add --name <n> --url <u>  # Add rig (long-running!)
```

### Work Commands
```bash
bd list --json                # All work items
bd list --type=task --json    # Tasks only
bd create --title "..." --priority 1  # Create work
bd show <id> --json           # Work details
gt sling <bead-id> <target>   # Assign to agent
```

### Workflow Commands
```bash
gt formula list               # Available formulas
gt formula show <name>        # Formula details
bd list --type=molecule --json # Running molecules
gt formula run <name>         # Execute (Phase 2)
```

### Health Commands
```bash
gt doctor --json              # All health checks
gt doctor --category=<cat>    # Filtered checks
```

### Feed Commands
```bash
gt feed --json                # Activity feed
gt feed --limit=50            # Limited items
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-11 | Claude | Initial document |
| 2.0 | 2026-01-11 | Claude | Added CUJs, long-running operations, toast system, error handling, testing strategy, manual checklists |
| 3.0 | 2026-01-11 | Claude | Major enhancement: Added Decision Log, Environment Configuration, CLI Wrapper & Caching, Security Hardening, Performance Targets, Accessibility (WCAG 2.2), Integration Gap Analysis. Integrated best ideas from competing plans (integration-codex.md, integration-chatgpt.md, integration-gemini.md, integration-architecture.md, integration-no-backend-change.md, gastown-ui-architecture-final.md, gastown-ui-layouts.md) |
| 4.0 | 2026-01-11 | Claude | **5 Key Innovations**: (1) Effect.ts CLI Execution Layer with typed errors, circuit breaker, retry policies; (2) Stale-While-Revalidate (SWR) data fetching for instant UI responsiveness; (3) Contract Testing with Zod for CLI output validation; (4) Real-Time Activity Stream via SSE for .events.jsonl; (5) Vim-Style Keyboard Navigation with multi-key sequences and command palette. Updated implementation checklist with v4.0 items. Added CUJ-6 for keyboard navigation verification. |
| 5.0 | 2026-01-11 | Claude | **Hybrid "Best of All Worlds" Release**: Synthesized improvements from INTEGRATION_PLAN_Codex_V1a (CLI Bridge), INTEGRATION_PLAN_Codex_V1b (Daemon API), and INTEGRATION_PLAN_PHASE1_TOP5_PATCH. **New in v5.0**: (D0.5) Process Supervisor with no-shell execution, concurrency limits, cancellation; (D0.6) Capabilities Probe + CLI Contracts for drift tolerance; (D0.7) Watch-First Updates with `.beads/` watcher and WS broadcast; (D0.8) Power-User Ergonomics (Command Palette, Global Search, Copy CLI); (D0.9) LLM-Friendly Docs (`/llms.txt`); (D0.10) Observable Operations with correlation IDs. Added: Current Reality Check section, Operation Center UI, Risks & Mitigations, Diagnostics endpoint. Updated Testing Strategy to match repo posture (no Playwright). |

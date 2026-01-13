# Gas Town UI - Backend Integration Plan

> **Document Version**: 4.0
> **Created**: 2026-01-11
> **Last Updated**: 2026-01-11
> **Status**: Planning Phase
> **Priority**: Visualization-first (read-only dashboard to replace CLI)
> **Architecture Style**: CLI Bridge (Phase 1) → Go Daemon API (Phase 2+)
> **Deployment Model**: Single-machine local dev → Two-origins remote
> **Previous Version**: [INTEGRATION_PLAN_V3.md](./INTEGRATION_PLAN_V3.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Key Innovations (v4.0)](#key-innovations-v40)
3. [Architecture Overview](#architecture-overview)
4. [Decision Log](#decision-log)
5. [Critical User Journeys (CUJs)](#critical-user-journeys-cujs)
6. [Phase 1: MVP (CLI Bridge)](#phase-1-mvp-cli-bridge)
7. [Phase 2: REST API](#phase-2-rest-api)
8. [Phase 3: Real-Time](#phase-3-real-time)
9. [Effect.ts CLI Execution Layer](#effectts-cli-execution-layer)
10. [Stale-While-Revalidate (SWR) Pattern](#stale-while-revalidate-swr-pattern)
11. [Contract Testing with Zod](#contract-testing-with-zod)
12. [Real-Time Activity Stream](#real-time-activity-stream)
13. [Vim-Style Keyboard Navigation](#vim-style-keyboard-navigation)
14. [Long-Running Operations](#long-running-operations)
15. [Optimistic UI & State Transitions](#optimistic-ui--state-transitions)
16. [Toast System & User Feedback](#toast-system--user-feedback)
17. [Error Handling Strategy](#error-handling-strategy)
18. [Environment Configuration](#environment-configuration)
19. [CLI Wrapper & Caching](#cli-wrapper--caching)
20. [Data Models](#data-models)
21. [API Specifications](#api-specifications)
22. [Authentication Strategy](#authentication-strategy)
23. [Security Hardening](#security-hardening)
24. [Performance Targets](#performance-targets)
25. [Accessibility (WCAG 2.2)](#accessibility-wcag-22)
26. [Testing Strategy](#testing-strategy)
27. [Deployment Architecture](#deployment-architecture)
28. [Implementation Checklist](#implementation-checklist)
29. [Manual Verification Checklists](#manual-verification-checklists)
30. [Integration Gap Analysis](#integration-gap-analysis)

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
8. **Type-Safe Errors**: Effect.ts for compile-time error tracking (v4.0)
9. **Instant Performance**: SWR caching for perceived speed (v4.0)
10. **Keyboard-First**: Vim-style navigation for power users (v4.0)

### Phased Approach

| Phase | Focus | Backend Changes | Deployment |
|-------|-------|-----------------|------------|
| **Phase 1** | CLI Bridge (Visualization) | None | Local single-machine |
| **Phase 2** | REST API + Auth | Go HTTP handlers | Two-origin remote |
| **Phase 3** | Real-Time (WebSocket) | Go WebSocket server | Kubernetes scalable |

---

## Key Innovations (v4.0)

This version introduces **five key innovations** that significantly improve robustness, reliability, performance, and user experience:

### Innovation Summary

| # | Innovation | Impact Area | Complexity | ROI |
|---|------------|-------------|------------|-----|
| 1 | **Effect.ts CLI Layer** | Robustness, Reliability | Medium-High | ★★★★★ |
| 2 | **SWR Data Pattern** | Performance, UX | Low-Medium | ★★★★★ |
| 3 | **Zod Contract Testing** | Reliability, DX | Low | ★★★★☆ |
| 4 | **Activity Stream** | Real-Time, UX | Medium | ★★★★☆ |
| 5 | **Vim Keyboard UX** | Ergonomics, UX | Low-Medium | ★★★★☆ |

### 1. Effect.ts for CLI Execution Layer

**Problem**: Current `exec()` calls are brittle—no type-safe error handling, no built-in retry, no circuit breaker, no timeouts.

**Solution**: Replace imperative Promise-based CLI execution with Effect.ts, tracking errors at the type level.

**Benefits**:
- Compile-time error tracking (know what can fail)
- Built-in retry with exponential backoff
- Circuit breaker prevents hammering dead daemon
- Streaming support for file watching
- Dependency injection for testability

### 2. Stale-While-Revalidate (SWR) Data Pattern

**Problem**: Every navigation triggers fresh API calls, causing loading spinners and perceived slowness.

**Solution**: Implement SWR caching—serve cached data instantly, revalidate in background.

**Benefits**:
- App feels 10x faster (instant page loads)
- Background refresh keeps data fresh
- Works offline (shows last-known state)
- Reduces CLI load (fewer concurrent calls)

### 3. CLI Contract Testing with Zod

**Problem**: CLI JSON output schema can drift from TypeScript types, causing runtime errors.

**Solution**: Use Zod schemas to validate CLI output at test time, catching drift before production.

**Benefits**:
- Prevents silent type mismatches
- Schemas serve as living documentation
- Zero new dependencies (Zod already installed)
- Easy to add incrementally

### 4. Real-Time Activity Stream via .events.jsonl

**Problem**: No real-time updates without Go WebSocket server changes (Phase 3).

**Solution**: Stream `.events.jsonl` file using Node.js file watching + SSE, providing real-time activity without backend changes.

**Benefits**:
- Real-time updates in Phase 1
- No backend changes required
- Simpler than WebSocket for one-way push
- Foundation for Phase 3 patterns

### 5. Vim-Style Keyboard Navigation

**Problem**: Dashboard requires mouse for most interactions, slowing down power users.

**Solution**: Comprehensive vim-style shortcuts (j/k navigation, g+key routes, / for search).

**Benefits**:
- Matches developer terminal expectations
- Navigate entire app without mouse
- Differentiator from other dashboards
- Accessibility bonus

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
└── health/
    └── +server.ts             NEW - gt doctor --json
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

### Legacy CLI Executor (Superseded by Effect.ts)

> **Note**: The Effect.ts CLI Execution Layer (Section above) provides a more robust implementation
> with typed errors, circuit breakers, and retry policies. This section documents the legacy
> approach for reference.

```typescript
// src/lib/server/cli-executor.ts (LEGACY - see Effect.ts section for preferred approach)

import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '$lib/config/environment';
import { identifyKnownBug } from '$lib/errors/known-bugs';

const execAsync = promisify(exec);

export interface CLIResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    stderr?: string;
    exitCode?: number;
    knownBug?: unknown;
  };
  cached: boolean;
  duration: number;
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
- [ ] `GET /api/gastown/status` - Refactor to use Effect.ts
- [ ] `GET /api/gastown/agents` - Extract agents from status
- [ ] `GET /api/gastown/agents/[id]` - Agent details via `gt peek`
- [ ] `GET /api/gastown/convoys` - Refactor to use Effect.ts
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

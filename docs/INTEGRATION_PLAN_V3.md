# Gas Town UI - Backend Integration Plan

> **Document Version**: 3.0
> **Created**: 2026-01-11
> **Last Updated**: 2026-01-11
> **Status**: Planning Phase
> **Priority**: Visualization-first (read-only dashboard to replace CLI)
> **Architecture Style**: CLI Bridge (Phase 1) → Go Daemon API (Phase 2+)
> **Deployment Model**: Single-machine local dev → Two-origins remote
> **Previous Version**: [INTEGRATION_PLAN_V2.md](./INTEGRATION_PLAN_V2.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Decision Log](#decision-log)
4. [Critical User Journeys (CUJs)](#critical-user-journeys-cujs)
5. [Phase 1: MVP (CLI Bridge)](#phase-1-mvp-cli-bridge)
6. [Phase 2: REST API](#phase-2-rest-api)
7. [Phase 3: Real-Time](#phase-3-real-time)
8. [Long-Running Operations](#long-running-operations)
9. [Optimistic UI & State Transitions](#optimistic-ui--state-transitions)
10. [Toast System & User Feedback](#toast-system--user-feedback)
11. [Error Handling Strategy](#error-handling-strategy)
12. [Environment Configuration](#environment-configuration)
13. [CLI Wrapper & Caching](#cli-wrapper--caching)
14. [Data Models](#data-models)
15. [API Specifications](#api-specifications)
16. [Authentication Strategy](#authentication-strategy)
17. [Security Hardening](#security-hardening)
18. [Performance Targets](#performance-targets)
19. [Accessibility (WCAG 2.2)](#accessibility-wcag-22)
20. [Testing Strategy](#testing-strategy)
21. [Deployment Architecture](#deployment-architecture)
22. [Implementation Checklist](#implementation-checklist)
23. [Manual Verification Checklists](#manual-verification-checklists)
24. [Integration Gap Analysis](#integration-gap-analysis)

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

### Phased Approach

| Phase | Focus | Backend Changes | Deployment |
|-------|-------|-----------------|------------|
| **Phase 1** | CLI Bridge (Visualization) | None | Local single-machine |
| **Phase 2** | REST API + Auth | Go HTTP handlers | Two-origin remote |
| **Phase 3** | Real-Time (WebSocket) | Go WebSocket server | Kubernetes scalable |

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

### Target State (Phase 1 MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                      PHASE 1: CLI BRIDGE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     HTTP      ┌────────────────────┐          │
│  │              │◄─────────────►│                    │          │
│  │  Browser     │               │  SvelteKit Server  │          │
│  │  (SPA)       │  Polling 5s   │  (Node.js)         │          │
│  │              │               │                    │          │
│  └──────────────┘               └─────────┬──────────┘          │
│        │                                  │                      │
│        │ Toast/Store                      │ child_process.exec() │
│        │ Updates                          ▼                      │
│        │                        ┌────────────────────┐          │
│        │                        │                    │          │
│        └───────────────────────►│  gt / bd CLI       │          │
│          (State Transitions)    │  (Go binary)       │          │
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
│  1. Navigate to /rigs           → Rig list loaded                │
│  2. Click "Add Rig"             → Modal opens                    │
│  3. Enter name + URL            → Validation runs                │
│  4. Click "Add"                 → Modal closes IMMEDIATELY       │
│                                 → Toast: "Adding rig..."         │
│                                 → Rig appears in list: PENDING   │
│                                                                  │
│  [... git clone runs: 30-150 seconds ...]                       │
│                                                                  │
│  5. (Async) Clone completes     → Toast: "zoo-game added"        │
│                                 → Rig status: ACTIVE             │
│                                 → Agents available dropdown      │
│                                                                  │
│  ERROR PATH:                                                     │
│  5a. Clone fails                → Toast: "Failed to add rig"     │
│                                 → Rig status: ERROR              │
│                                 → Error details accessible       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Critical Timing**:
- Modal close: **Immediate** (non-blocking)
- Initial toast: **< 100ms**
- Git clone: **30-150 seconds** (depends on repo size)
- Status update: Via polling (5s) or WebSocket (Phase 3)

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
│  1. Navigate to /work           → Work list loaded               │
│  2. Click "New Work Item"       → Form modal opens               │
│  3. Fill form:                                                   │
│     - Title: "Analyze code"                                     │
│     - Priority: "high"                                          │
│     - Labels: "analysis"                                        │
│  4. Click "Create"              → Modal closes                   │
│                                 → Toast: "Creating work item..." │
│                                 → Toast: "Work item created:     │
│                                          hq-abc123"              │
│                                 → Item appears at TOP of list    │
│                                                                  │
│  ID EXTRACTION:                                                  │
│  - Toast contains ID in format: ([a-z]+-[a-z0-9]+)              │
│  - Item element has: data-bead-id="hq-abc123"                   │
│  - URL becomes: /work/hq-abc123 (if navigating)                 │
│                                                                  │
│  5. View item details           → Status: OPEN                   │
│  6. (Agent picks up)            → Status: IN_PROGRESS            │
│  7. (Agent completes)           → Status: CLOSED                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**ID Extraction Pattern**:
```typescript
// Toast message format for machine readability
const BEAD_ID_REGEX = /([a-z]+-[a-z0-9]+)/;

// Example toast: "Work item created: hq-abc123"
// Extracted ID: "hq-abc123"

// DOM attribute for testing
<div data-testid="work-item" data-bead-id="hq-abc123">
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
│  1. On work item, click "Sling" → Sling dialog opens             │
│  2. Select target dropdown      → Dynamically loaded targets:    │
│                                   - zoo-game/witness             │
│                                   - zoo-game/nux                 │
│                                   - roxas/dag                    │
│  3. Select "zoo-game/witness"                                   │
│  4. Click "Sling"               → Dialog closes                  │
│                                 → Toast: "Slinging to witness..."│
│                                 → Work item: ASSIGNED badge      │
│                                                                  │
│  5. (Async) Agent receives      → Toast: "Work slung to witness" │
│                                 → Status: IN_PROGRESS            │
│                                                                  │
│  KNOWN ISSUE HANDLING:                                          │
│  - mol bond daemon bug may cause failure                        │
│  - UI shows: "Sling queued (daemon not running)"               │
│  - Error is logged but treated as soft-fail                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Target Dropdown Population**:
```typescript
// Targets loaded from: gt rig list --json + gt status --json
interface SlingTarget {
  rig: string;      // "zoo-game"
  agent: string;    // "witness"
  status: string;   // "idle" | "busy"
  display: string;  // "zoo-game/witness (idle)"
}
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
│  │  │  ACTIVITY FEED (Real-time in Phase 3)           │   │    │
│  │  │  - 10:45 - nux completed task hq-123           │   │    │
│  │  │  - 10:42 - witness started code review         │   │    │
│  │  │  - 10:40 - dag merged PR #45                   │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │                                                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  AUTO-REFRESH: 5 seconds (visible indicator)                    │
│  MANUAL REFRESH: Button available                               │
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
│  │  INBOX (12 unread)                          [Refresh]   │    │
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
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: MVP (CLI Bridge)

### Scope
- **Visualization only** (read-only dashboard)
- Replace `gt status`, `gt convoy`, `gt mail inbox` with web UI
- 5-second polling refresh (with visibility detection)
- Demo authentication (UI-only)
- No backend modifications
- **Non-blocking UI for all operations**

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
| Activity Feed | `.events.jsonl` file | P1 | Missing | CUJ-4 |
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
│   └── +server.ts             NEW - read .events.jsonl
├── workflows/
│   ├── formulas/+server.ts    EXISTS - gt formula list
│   └── molecules/+server.ts   EXISTS - bd list --type=molecule
├── dashboard/
│   └── +server.ts             NEW - composite endpoint
└── health/
    └── +server.ts             NEW - gt doctor --json
```

### Polling Strategy

```typescript
// src/lib/stores/polling.svelte.ts

interface PollingConfig {
  // High-frequency (5s) - Agent status, queue
  critical: {
    endpoints: ['/api/gastown/status', '/api/gastown/queue'],
    interval: 5000,
  },
  // Medium-frequency (15s) - Convoys, mail
  standard: {
    endpoints: ['/api/gastown/convoys', '/api/gastown/mail'],
    interval: 15000,
  },
  // Low-frequency (60s) - Rigs, health
  background: {
    endpoints: ['/api/gastown/rigs', '/api/gastown/health'],
    interval: 60000,
  }
}

// Visibility-aware polling with jitter
class PollingManager {
  #intervals: Map<string, number> = new Map();
  #paused = false;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
        this.refreshAll();
      }
    });
  }

  #addJitter(interval: number): number {
    const jitter = interval * 0.1;
    return interval + (Math.random() * jitter * 2 - jitter);
  }

  pause() { this.#paused = true; }
  resume() { this.#paused = false; }
  refreshAll() { /* Force refresh all endpoints */ }
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

    // Workflows
    mux.HandleFunc("GET /api/v1/formulas", handleListFormulas)
    mux.HandleFunc("GET /api/v1/molecules", handleListMolecules)
    mux.HandleFunc("POST /api/v1/formulas/{name}/run", handleRunFormula)

    // Health
    mux.HandleFunc("GET /api/v1/health", handleHealth)
    mux.HandleFunc("GET /api/v1/doctor", handleDoctor)
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
| Long-running ops | Timeout issues | Async job queue |

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

interface WSRigStatus {
  type: 'rig_status';
  rig_name: string;
  status: 'pending' | 'cloning' | 'active' | 'error';
  progress?: number;
  error?: string;
  timestamp: number;
}

interface WSWorkStatus {
  type: 'work_status';
  bead_id: string;
  status: 'open' | 'in_progress' | 'closed';
  assignee?: string;
  timestamp: number;
}

interface WSLogEntry {
  type: 'log_entry';
  agent_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}
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

### Unified CLI Executor

```typescript
// src/lib/server/cli-executor.ts

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

interface ExecOptions {
  timeout?: number;
  cwd?: string;
  cache?: boolean;
  cacheTTL?: number;
  parse?: boolean;
}

const cache = new Map<string, { data: unknown; expires: number }>();

export async function execGt<T = unknown>(
  args: string,
  options: ExecOptions = {}
): Promise<CLIResult<T>> {
  const command = `${config.GASTOWN_GT_BIN} ${args}`;
  return execCLI<T>(command, {
    cwd: config.GASTOWN_TOWN_ROOT,
    ...options,
  });
}

export async function execBd<T = unknown>(
  args: string,
  options: ExecOptions = {}
): Promise<CLIResult<T>> {
  const command = `${config.GASTOWN_BD_BIN} ${args}`;
  return execCLI<T>(command, {
    cwd: config.GASTOWN_BD_CWD,
    ...options,
  });
}

async function execCLI<T>(
  command: string,
  options: ExecOptions = {}
): Promise<CLIResult<T>> {
  const {
    timeout = config.GASTOWN_CLI_TIMEOUT,
    cwd = process.cwd(),
    cache: useCache = true,
    cacheTTL = config.GASTOWN_CACHE_TTL,
    parse = true,
  } = options;

  const startTime = Date.now();
  const cacheKey = `${cwd}:${command}`;

  // Check cache
  if (useCache && !command.includes('create') && !command.includes('delete')) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return {
        success: true,
        data: cached.data as T,
        cached: true,
        duration: Date.now() - startTime,
      };
    }
  }

  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout,
      cwd,
      maxBuffer: 10 * 1024 * 1024,
    });

    const knownBug = stderr ? identifyKnownBug(stderr) : null;

    let data: T;
    if (parse) {
      try {
        data = JSON.parse(stdout) as T;
      } catch {
        data = stdout.trim() as unknown as T;
      }
    } else {
      data = stdout as unknown as T;
    }

    if (useCache) {
      cache.set(cacheKey, { data, expires: Date.now() + cacheTTL });
    }

    return {
      success: true,
      data,
      cached: false,
      duration: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stderr?: string; message?: string };
    const stderr = execError.stderr ?? '';
    const knownBug = identifyKnownBug(stderr);

    return {
      success: false,
      cached: false,
      duration: Date.now() - startTime,
      error: {
        code: knownBug ? 'KNOWN_BUG' : 'CLI_ERROR',
        message: knownBug?.userMessage ?? execError.message ?? 'Command failed',
        stderr: stderr.slice(0, 1000),
        exitCode: execError.code,
      },
    };
  }
}

export function clearCache(): void { cache.clear(); }

export function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
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

```typescript
// src/lib/types/gastown.schema.ts
import { z } from 'zod';

export const GtAgentSchema = z.object({
  name: z.string(),
  id: z.string(),
  status: z.enum(['idle', 'active', 'busy', 'parked', 'stuck', 'orphaned']),
  session_id: z.string(),
  rig: z.string(),
  worktree: z.string(),
  branch: z.string().optional(),
  last_activity: z.string(),
  last_activity_ago: z.string(),
  current_task: z.string().optional(),
  current_molecule: z.string().optional(),
  health: z.enum(['healthy', 'warning', 'critical']),
});

export const GtStatusSchema = z.object({
  town: z.string(),
  daemon: z.object({
    running: z.boolean(),
    pid: z.number().optional(),
    uptime: z.string().optional(),
    version: z.string(),
  }),
  agents: z.array(GtAgentSchema),
  rigs: z.array(z.object({
    name: z.string(),
    path: z.string(),
    agents: z.number(),
    active: z.number(),
    docked: z.boolean(),
  })),
  queue: z.object({
    pending: z.number(),
    in_progress: z.number(),
    total: z.number(),
  }),
});

export const BdBeadSchema = z.object({
  id: z.string().regex(/^[a-z]+-[a-z0-9]+$/),
  title: z.string(),
  description: z.string(),
  status: z.enum(['open', 'in_progress', 'closed']),
  priority: z.number().min(1).max(3),
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

export function parseGtStatus(output: string) {
  const parsed = JSON.parse(output);
  return GtStatusSchema.parse(parsed);
}

export function parseBdBead(output: string) {
  const parsed = JSON.parse(output);
  return BdBeadSchema.parse(parsed);
}
```

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

#### CLI Wrapper Infrastructure
- [ ] Create `src/lib/server/cli-executor.ts`
- [ ] Implement timeout handling
- [ ] Implement caching layer with TTL
- [ ] Add known bug detection
- [ ] Add execution metrics logging

#### Server Routes
- [ ] `GET /api/gastown/status` - Refactor to use CLI wrapper
- [ ] `GET /api/gastown/agents` - Extract agents from status
- [ ] `GET /api/gastown/agents/[id]` - Agent details via `gt peek`
- [ ] `GET /api/gastown/convoys` - Refactor to use CLI wrapper
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

#### Polling System
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
- [ ] Activity feed timeline
- [ ] Health status panel
- [ ] Keyboard shortcut overlay (?)

#### Accessibility
- [ ] Add ARIA attributes to all interactive components
- [ ] Implement keyboard navigation
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
- [ ] Contract tests for CLI output schemas
- [ ] Accessibility tests with axe-core
- [ ] Performance tests for bundle size

#### Documentation
- [ ] Update README with setup instructions
- [ ] Document environment variables
- [ ] Document operational requirements
- [ ] Create troubleshooting guide

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
| Activity feed | Recent events | `gt feed --json` | May not exist | High | Read .events.jsonl |
| Health check | Doctor results | `gt doctor --json` | Partial JSON | Medium | Parse mixed output |
| Formulas | Formula list | `gt formula list` | No JSON | Low | Parse text output |
| Molecules | Running molecules | `bd list --type=molecule` | Available | - | - |

### Wiring Steps (Implementation Order)

1. **Environment Setup**
   - Create `src/lib/config/environment.ts`
   - Create `.env.example` with all variables
   - Update `.gitignore` for `.env`

2. **CLI Wrapper**
   - Create `src/lib/server/cli-executor.ts`
   - Add caching layer
   - Add error classification

3. **Type Definitions**
   - Create `src/lib/types/gastown.ts`
   - Create `src/lib/types/gastown.schema.ts` (Zod)
   - Add contract tests

4. **Server Routes (Read)**
   - `/api/gastown/status` - refactor to use CLI wrapper
   - `/api/gastown/agents` - new
   - `/api/gastown/convoys` - refactor
   - `/api/gastown/mail` - refactor
   - `/api/gastown/queue` - new
   - `/api/gastown/rigs` - refactor

5. **Server Routes (Write)**
   - `/api/gastown/rigs` POST - add rig
   - `/api/gastown/work/issues` POST - create work
   - `/api/gastown/work/sling` POST - sling work

6. **Polling Infrastructure**
   - Create `src/lib/stores/polling.svelte.ts`
   - Add visibility-aware polling
   - Add jitter to prevent thundering herd

7. **UI Components**
   - Dashboard with cards
   - Agent list and detail
   - Work item CRUD
   - Sling dialog

8. **Testing**
   - MSW handlers for all endpoints
   - Component tests
   - E2E tests for CUJs
   - Accessibility tests

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

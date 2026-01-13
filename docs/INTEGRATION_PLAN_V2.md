# Gas Town UI ↔ Backend Integration Plan

> **Document Version**: 2.0
> **Created**: 2026-01-11
> **Last Updated**: 2026-01-11
> **Status**: Planning Phase
> **Priority**: Visualization-first (read-only dashboard to replace CLI)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Critical User Journeys (CUJs)](#critical-user-journeys-cujs)
4. [Phase 1: MVP (CLI Bridge)](#phase-1-mvp-cli-bridge)
5. [Phase 2: REST API](#phase-2-rest-api)
6. [Phase 3: Real-Time](#phase-3-real-time)
7. [Long-Running Operations](#long-running-operations)
8. [Optimistic UI & State Transitions](#optimistic-ui--state-transitions)
9. [Toast System & User Feedback](#toast-system--user-feedback)
10. [Error Handling Strategy](#error-handling-strategy)
11. [Data Models](#data-models)
12. [API Specifications](#api-specifications)
13. [Authentication Strategy](#authentication-strategy)
14. [Testing Strategy](#testing-strategy)
15. [Deployment Architecture](#deployment-architecture)
16. [Implementation Checklist](#implementation-checklist)
17. [Manual Verification Checklists](#manual-verification-checklists)

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

### Phased Approach

| Phase | Focus | Backend Changes | Timeline |
|-------|-------|-----------------|----------|
| **Phase 1** | CLI Bridge (Visualization) | None | MVP |
| **Phase 2** | REST API + Auth | Go HTTP handlers | Post-MVP |
| **Phase 3** | Real-Time (WebSocket) | Go WebSocket server | Future |

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
│  │  │   5 Active   │  │   3 Pending  │  │   ✓ Healthy  │  │    │
│  │  │   2 Idle     │  │   1 Running  │  │   2 Warnings │  │    │
│  │  │   1 Stuck    │  │              │  │              │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │    │
│  │                                                         │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │  ACTIVITY FEED (Real-time in Phase 3)           │   │    │
│  │  │  • 10:45 - nux completed task hq-123           │   │    │
│  │  │  • 10:42 - witness started code review         │   │    │
│  │  │  • 10:40 - dag merged PR #45                   │   │    │
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
│  │  ● ESCALATION: Agent dag stuck on merge conflict        │    │
│  │    From: witness | 2 min ago | Priority: HIGH           │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  ○ HANDOFF: Context passed from nux to dag              │    │
│  │    From: nux | 15 min ago | Priority: NORMAL            │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  ○ DONE: Task hq-abc123 completed                       │    │
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
| System Status | `gt status --json` | P0 | 🟡 Partial | CUJ-4 |
| Agent List | `gt status --json` (parse agents) | P0 | 🔴 Missing | CUJ-4 |
| Agent Details | `gt peek <agent>` | P1 | 🔴 Missing | CUJ-4 |
| Convoy List | `gt convoy list --json` | P0 | 🟡 Partial | CUJ-4 |
| Convoy Details | `gt convoy show <id> --json` | P1 | 🔴 Missing | CUJ-4 |
| Mail Inbox | `bd list --type=message --json` | P0 | 🟢 Done | CUJ-5 |
| Mail Thread | `gt mail thread <id>` | P2 | 🔴 Missing | CUJ-5 |
| Merge Queue | `gt mq list --json` | P0 | 🔴 Missing | CUJ-4 |
| Rig Status | `gt rig list --json` | P1 | 🟡 Partial | CUJ-1 |
| Activity Feed | `gt feed --json` | P1 | 🔴 Missing | CUJ-4 |
| Workflow List | `gt formula list` | P2 | 🔴 Missing | CUJ-4 |
| Health Check | `gt doctor --json` | P2 | 🔴 Missing | CUJ-4 |
| Work Items | `bd list --type=task --json` | P0 | 🔴 Missing | CUJ-2 |

### Server Route Implementation

```
src/routes/api/gastown/
├── status/+server.ts          ✅ EXISTS - gt status --json
├── agents/
│   ├── +server.ts             🔴 NEW - Parse agents from gt status
│   └── [id]/+server.ts        🔴 NEW - gt peek <id>
├── convoys/
│   ├── +server.ts             ✅ EXISTS - gt convoy list --json
│   └── [id]/+server.ts        🔴 NEW - gt convoy show <id> --json
├── mail/
│   ├── +server.ts             ✅ EXISTS - bd list --type=message
│   └── [id]/+server.ts        🔴 NEW - bd show <id> --json
├── queue/
│   └── +server.ts             🔴 NEW - gt mq list --json
├── rigs/
│   ├── +server.ts             ✅ EXISTS - gt rig list --json
│   └── [name]/+server.ts      🔴 NEW - gt rig show <name>
├── work/
│   ├── issues/+server.ts      ✅ EXISTS - bd list
│   └── [id]/+server.ts        🔴 NEW - bd show <id> --json
├── feed/
│   └── +server.ts             🔴 NEW - gt feed --json
├── workflows/
│   ├── formulas/+server.ts    ✅ EXISTS - gt formula list
│   └── molecules/+server.ts   ✅ EXISTS - bd list --type=molecule
└── health/
    └── +server.ts             🔴 NEW - gt doctor --json
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

// Visibility-aware polling
class PollingManager {
  #intervals: Map<string, number> = new Map();
  #paused = false;

  constructor() {
    // Pause polling when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else {
        this.resume();
        this.refreshAll(); // Immediate refresh on return
      }
    });
  }

  pause() {
    this.#paused = true;
    // Clear all intervals
  }

  resume() {
    this.#paused = false;
    // Restart all intervals
  }

  refreshAll() {
    // Force refresh all endpoints immediately
  }
}
```

### Type Definitions

Create `src/lib/types/gastown.ts` with types matching CLI JSON output:

```typescript
// Agent from gt status --json
export interface GtAgent {
  name: string;
  status: 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';
  session_id: string;
  rig: string;
  worktree: string;
  last_activity: string;
  current_task?: string;
}

// Convoy from gt convoy list --json
export interface GtConvoy {
  id: string;
  title: string;
  status: 'open' | 'closed';
  work_status: 'complete' | 'active' | 'stale' | 'stuck' | 'waiting';
  progress: string; // "2/5"
  completed: number;
  total: number;
  tracked_issues: GtTrackedIssue[];
}

// ... (see full types in data models section)
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
    // Auth (session-based, OAuth-ready)
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
// Message types
type WSMessageType =
  | 'ping' | 'pong'
  | 'subscribe' | 'unsubscribe'
  | 'agent_status'
  | 'log_entry'
  | 'queue_update'
  | 'convoy_update'
  | 'mail_received'
  | 'rig_status'       // NEW: For long-running rig operations
  | 'work_status';     // NEW: For work item state changes

// Client → Server
interface WSSubscribe {
  type: 'subscribe';
  channels: ('agents' | 'logs' | 'queue' | 'convoys' | 'mail' | 'rigs' | 'work')[];
}

// Server → Client: Agent Status
interface WSAgentStatus {
  type: 'agent_status';
  agent_id: string;
  status: string;
  current_task?: string;
  timestamp: number;
}

// Server → Client: Rig Status (for long-running operations)
interface WSRigStatus {
  type: 'rig_status';
  rig_name: string;
  status: 'pending' | 'cloning' | 'active' | 'error';
  progress?: number;      // 0-100 for clone progress
  error?: string;
  timestamp: number;
}

// Server → Client: Work Item Status
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

### Go Implementation

```go
// internal/web/websocket.go
type WSHub struct {
    clients    map[*WSClient]bool
    broadcast  chan []byte
    register   chan *WSClient
    unregister chan *WSClient
    events     <-chan events.Event // Subscribe to internal events
}

func (h *WSHub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
        case client := <-h.unregister:
            delete(h.clients, client)
        case event := <-h.events:
            // Transform internal event to WS message
            msg := transformEvent(event)
            h.broadcast <- msg
        case msg := <-h.broadcast:
            for client := range h.clients {
                client.send <- msg
            }
        }
    }
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

    // Execute in background
    this.#executeWithTimeout(id, executor, options.timeout ?? 180000);

    return id;
  }

  async #executeWithTimeout(
    id: string,
    executor: () => Promise<unknown>,
    timeout: number
  ) {
    const operation = this.#operations.get(id)!;
    operation.status = 'running';
    this.#notify(id, operation);

    try {
      const result = await Promise.race([
        executor(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timed out')), timeout)
        ),
      ]);

      operation.status = 'completed';
      operation.result = result;
      operation.completedAt = Date.now();
    } catch (error) {
      operation.status = 'failed';
      operation.error = error instanceof Error ? error.message : 'Unknown error';
      operation.completedAt = Date.now();
    }

    this.#notify(id, operation);
  }

  subscribe(id: string, callback: (op: AsyncOperation) => void): () => void {
    if (!this.#subscribers.has(id)) {
      this.#subscribers.set(id, []);
    }
    this.#subscribers.get(id)!.push(callback);

    // Immediate callback with current state
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

  #notify(id: string, operation: AsyncOperation) {
    const subs = this.#subscribers.get(id) ?? [];
    for (const callback of subs) {
      try {
        callback(operation);
      } catch (e) {
        console.error('Operation subscriber error:', e);
      }
    }
  }
}

export const asyncOps = new AsyncOperationManager();
```

### Timeout Configuration

```typescript
// src/lib/config/timeouts.ts

export const OPERATION_TIMEOUTS = {
  // Rig operations (git clone can be slow)
  'rig_add': 180_000,      // 3 minutes
  'rig_update': 120_000,   // 2 minutes

  // Work operations
  'work_create': 30_000,   // 30 seconds
  'work_sling': 60_000,    // 1 minute

  // Workflow operations
  'formula_run': 120_000,  // 2 minutes
  'molecule_start': 60_000,// 1 minute

  // Health checks
  'doctor_full': 90_000,   // 1.5 minutes
  'doctor_quick': 30_000,  // 30 seconds

  // Default
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

// Rig states
type RigState = 'pending' | 'cloning' | 'active' | 'error' | 'parked';

const RIG_TRANSITIONS: Record<RigState, RigState[]> = {
  pending: ['cloning', 'error'],
  cloning: ['active', 'error'],
  active: ['parked', 'error'],
  error: ['pending', 'cloning'],  // Can retry
  parked: ['active'],
};

// Work item states
type WorkState = 'draft' | 'open' | 'assigned' | 'in_progress' | 'closed' | 'error';

const WORK_TRANSITIONS: Record<WorkState, WorkState[]> = {
  draft: ['open', 'error'],
  open: ['assigned', 'in_progress', 'closed', 'error'],
  assigned: ['in_progress', 'open', 'error'],
  in_progress: ['closed', 'error'],
  closed: [],  // Terminal
  error: ['open'],  // Can reopen
};

// Agent states
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

### Optimistic Update Pattern

```typescript
// src/lib/stores/work.svelte.ts

import { asyncOps } from '$lib/services/async-operations';
import { toast } from '$lib/stores/toast.svelte';

class WorkStore {
  #items = $state<Map<string, WorkItem>>(new Map());

  async createWorkItem(data: CreateWorkItemRequest): Promise<string> {
    // 1. Generate optimistic ID
    const optimisticId = `temp-${crypto.randomUUID().slice(0, 8)}`;

    // 2. Create optimistic entry
    const optimisticItem: WorkItem = {
      id: optimisticId,
      title: data.title,
      status: 'draft',
      priority: data.priority,
      createdAt: new Date().toISOString(),
      _optimistic: true,  // Mark as optimistic
    };

    // 3. Update store immediately
    this.#items.set(optimisticId, optimisticItem);

    // 4. Show immediate feedback
    toast.info('Creating work item...');

    // 5. Start async operation
    const opId = await asyncOps.startOperation('work_create', async () => {
      const response = await fetch('/api/gastown/work/issues', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    });

    // 6. Subscribe to operation result
    asyncOps.subscribe(opId, (op) => {
      if (op.status === 'completed') {
        // Replace optimistic entry with real one
        this.#items.delete(optimisticId);
        const realItem = op.result as WorkItem;
        this.#items.set(realItem.id, realItem);

        // Toast with extractable ID
        toast.success(`Work item created: ${realItem.id}`);
      } else if (op.status === 'failed') {
        // Remove optimistic entry
        this.#items.delete(optimisticId);
        toast.error(`Failed to create work item: ${op.error}`);
      }
    });

    return optimisticId;
  }
}
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
  // For machine readability
  data?: {
    entityType?: 'rig' | 'work' | 'agent' | 'convoy';
    entityId?: string;
    operation?: string;
  };
}

// Toast message patterns (for testing)
export const TOAST_PATTERNS = {
  // Rig operations
  RIG_ADDING: /^Adding rig\.\.\.$/,
  RIG_ADDED: /^Rig (.+) added successfully$/,
  RIG_FAILED: /^Failed to add rig: (.+)$/,

  // Work operations
  WORK_CREATING: /^Creating work item\.\.\.$/,
  WORK_CREATED: /^Work item created: ([a-z]+-[a-z0-9]+)$/,
  WORK_FAILED: /^Failed to create work item: (.+)$/,

  // Sling operations
  SLING_SENDING: /^Slinging to (.+)\.\.\.$/,
  SLING_SENT: /^Work slung to (.+)$/,
  SLING_FAILED: /^Failed to sling: (.+)$/,
  SLING_QUEUED: /^Sling queued \((.+)\)$/,  // Soft failure
} as const;

// ID extraction helper
export function extractIdFromToast(message: string): string | null {
  const match = message.match(/([a-z]+-[a-z0-9]+)/);
  return match ? match[1] : null;
}
```

### Toast Component with Data Attributes

```svelte
<!-- src/lib/components/ui/Toast.svelte -->
<script lang="ts">
  import type { ToastMessage } from '$lib/stores/toast.svelte';

  export let toast: ToastMessage;
</script>

<div
  role="status"
  aria-live="polite"
  class="toast toast-{toast.type}"
  data-testid="toast"
  data-toast-type={toast.type}
  data-entity-type={toast.data?.entityType}
  data-entity-id={toast.data?.entityId}
>
  <span class="toast-message" data-testid="toast-message">
    {toast.message}
  </span>

  {#if toast.action}
    <button
      type="button"
      class="toast-action"
      data-testid="toast-action"
      on:click={toast.action.onClick}
    >
      {toast.action.label}
    </button>
  {/if}
</div>
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
  | 'CLI_ERROR'       // CLI command failed
  | 'PARSE_ERROR'     // Failed to parse CLI output
  | 'NETWORK_ERROR'   // Network/fetch failure
  | 'TIMEOUT'         // Operation timed out
  | 'VALIDATION'      // Input validation failed
  | 'NOT_FOUND'       // Resource doesn't exist
  | 'KNOWN_BUG'       // Known CLI bug (soft fail)
  | 'UNKNOWN';        // Unexpected error

export interface AppError {
  category: ErrorCategory;
  code: string;
  message: string;         // User-friendly message
  technicalDetails?: {
    command?: string;      // CLI command that ran
    exitCode?: number;     // CLI exit code
    stderr?: string;       // CLI stderr output
    stack?: string;        // JS stack trace
  };
  recoverable: boolean;
  suggestedAction?: string;
}
```

### Known Bug Handling

Some CLI commands have known issues. The UI should handle these gracefully:

```typescript
// src/lib/errors/known-bugs.ts

export const KNOWN_BUGS: Record<string, {
  pattern: RegExp;
  category: 'KNOWN_BUG';
  userMessage: string;
  suggestedAction: string;
  isSoftFail: boolean;  // True = operation may still succeed
}> = {
  // mol bond daemon issue
  'MOL_BOND_DAEMON': {
    pattern: /mol bond.*daemon/i,
    category: 'KNOWN_BUG',
    userMessage: 'Command queued (daemon not running)',
    suggestedAction: 'Run "gt up" to start the daemon',
    isSoftFail: true,
  },

  // Git clone permission issues
  'GIT_AUTH_FAILED': {
    pattern: /Permission denied|Authentication failed/i,
    category: 'KNOWN_BUG',
    userMessage: 'Git authentication failed',
    suggestedAction: 'Check your SSH keys or credentials',
    isSoftFail: false,
  },

  // Beads database locked
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

### Error Response Format

```typescript
// src/lib/api/errors.ts

interface ApiErrorResponse {
  error: {
    code: string;           // 'CLI_ERROR', 'PARSE_ERROR', 'NOT_FOUND'
    message: string;        // User-readable message
    category: ErrorCategory;
    details?: {
      command?: string;     // CLI command that failed
      stderr?: string;      // CLI stderr output (sanitized)
      exitCode?: number;    // CLI exit code
      knownBug?: string;    // Known bug identifier
    };
    recoverable: boolean;
    suggestedAction?: string;
  };
  timestamp: string;
}

// Error display component
// src/lib/components/ErrorDisplay.svelte
```

### Error UI Patterns

```svelte
<!-- Inline error (in context) -->
<div class="error-inline" data-testid="error-inline">
  <span class="error-icon">⚠️</span>
  <span class="error-message">{error.message}</span>
  {#if error.suggestedAction}
    <button on:click={handleRetry}>
      {error.suggestedAction}
    </button>
  {/if}
</div>

<!-- Error toast (floating) -->
<Toast type="error">
  {error.message}
  {#if error.recoverable}
    <button>Retry</button>
  {/if}
</Toast>

<!-- Error boundary (full page) -->
<div class="error-boundary" data-testid="error-boundary">
  <h2>Something went wrong</h2>
  <p>{error.message}</p>
  <details>
    <summary>Technical details</summary>
    <pre>{JSON.stringify(error.technicalDetails, null, 2)}</pre>
  </details>
  <button on:click={resetError}>Try again</button>
</div>
```

---

## Data Models

### CLI Output Types

These types match the JSON output from `gt` and `bd` commands:

```typescript
// src/lib/types/gastown.ts

// ============================================
// GT STATUS OUTPUT
// ============================================

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
  last_activity: string;       // ISO timestamp
  last_activity_ago: string;   // "2m ago"
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

// ============================================
// CONVOY OUTPUT
// ============================================

export interface GtConvoy {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'closed';
  work_status: 'complete' | 'active' | 'stale' | 'stuck' | 'waiting';
  progress: string;            // "2/5" format
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

// ============================================
// MAIL / BEADS OUTPUT
// ============================================

export interface BdBead {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'closed';
  priority: number;            // 1=high, 2=normal, 3=low
  issue_type: string;          // 'message', 'task', 'convoy', 'molecule'
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

// ============================================
// MERGE QUEUE OUTPUT
// ============================================

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

// ============================================
// WORKFLOW OUTPUT
// ============================================

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

// ============================================
// HEALTH / DOCTOR OUTPUT
// ============================================

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

// ============================================
// RIG OUTPUT
// ============================================

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

// ============================================
// FEED OUTPUT
// ============================================

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

// ============================================
// SLING TARGET OUTPUT
// ============================================

export interface SlingTarget {
  rig: string;
  agent: string;
  status: 'idle' | 'busy' | 'parked';
  display: string;  // "zoo-game/witness (idle)"
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

// Validate CLI output and extract with type safety
export function parseGtStatus(output: string): GtStatus {
  const parsed = JSON.parse(output);
  return GtStatusSchema.parse(parsed);
}

export function parseBdBead(output: string): BdBead {
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
| `/api/gastown/feed` | GET | `gt feed --json` | `GtFeedItem[]` | 30s |
| `/api/gastown/health` | GET | `gt doctor --json` | `GtDoctorResult` | 90s |
| `/api/gastown/workflows/formulas` | GET | `gt formula list` | `GtFormula[]` | 30s |
| `/api/gastown/workflows/molecules` | GET | `bd list --type=molecule` | `GtMolecule[]` | 30s |

### Error Response Format

```typescript
interface ApiErrorResponse {
  error: {
    code: string;           // 'CLI_ERROR', 'PARSE_ERROR', 'NOT_FOUND', 'KNOWN_BUG'
    message: string;        // Human-readable message
    category: ErrorCategory;
    details?: {
      command?: string;     // CLI command that failed
      stderr?: string;      // CLI stderr output (sanitized)
      exitCode?: number;    // CLI exit code
      knownBug?: string;    // Known bug identifier if applicable
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
// Hardcoded demo credentials
const DEMO_USERS = {
  admin: { password: 'demo', roles: ['admin'] },
  viewer: { password: 'demo', roles: ['viewer'] },
};

// Session stored in HttpOnly cookie
// No backend validation (trusted environment)
```

### Test Authentication Injection

For E2E and manual testing, auth can be injected:

```typescript
// src/lib/auth/test-helpers.ts

export function injectTestSession(user: 'admin' | 'viewer') {
  // Set cookie directly for testing
  document.cookie = `session=${DEMO_SESSIONS[user]}; path=/`;
}

// MSW handler for test auth
export const testAuthHandler = http.get('/api/auth/me', () => {
  return HttpResponse.json({
    user: { id: 'test-user', roles: ['admin'] },
    authenticated: true,
  });
});
```

### Phase 2: Session Auth (Go Backend)

```go
// internal/web/auth/session.go
type Session struct {
    ID        string    `json:"id"`
    UserID    string    `json:"user_id"`
    Roles     []string  `json:"roles"`
    CreatedAt time.Time `json:"created_at"`
    ExpiresAt time.Time `json:"expires_at"`
}

// Store sessions in .beads/sessions/ or SQLite
type SessionStore interface {
    Create(userID string, roles []string) (*Session, error)
    Get(sessionID string) (*Session, error)
    Delete(sessionID string) error
    Cleanup() error
}
```

### Phase 3: OAuth/SSO (External Provider)

```typescript
// SvelteKit handles OAuth flow
// Go backend validates JWT tokens

interface OAuthConfig {
  provider: 'github' | 'google' | 'okta' | 'azure';
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  scopes: string[];
}

// RBAC roles mapped from OAuth groups/claims
interface RBACMapping {
  adminGroups: string[];     // Full access
  operatorGroups: string[];  // Read + limited write
  viewerGroups: string[];    // Read-only
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

interface Role {
  name: string;
  permissions: Permission[];
}

const ROLES: Record<string, Role> = {
  admin: {
    name: 'Administrator',
    permissions: ['*'], // All permissions
  },
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
      'agents:read',
      'convoys:read',
      'mail:read',
      'queue:read',
      'rigs:read',
      'workflows:read',
    ],
  },
};
```

---

## Testing Strategy

### Test ID Conventions

Every interactive element must have a `data-testid` attribute:

```typescript
// src/lib/test/selectors.ts

export const SELECTORS = {
  // Navigation
  NAV_RIGS: '[data-testid="nav-rigs"]',
  NAV_WORK: '[data-testid="nav-work"]',
  NAV_MAIL: '[data-testid="nav-mail"]',
  NAV_DASHBOARD: '[data-testid="nav-dashboard"]',

  // Rig Management
  ADD_RIG_BTN: '[data-testid="add-rig-btn"]',
  RIG_NAME_INPUT: '[data-testid="rig-name-input"]',
  RIG_URL_INPUT: '[data-testid="rig-url-input"]',
  RIG_SUBMIT_BTN: '[data-testid="rig-submit-btn"]',
  RIG_LIST: '[data-testid="rig-list"]',
  RIG_ITEM: '[data-testid="rig-item"]',

  // Work Management
  NEW_WORK_BTN: '[data-testid="new-work-btn"]',
  WORK_TITLE_INPUT: '[data-testid="work-title-input"]',
  WORK_PRIORITY_SELECT: '[data-testid="work-priority-select"]',
  WORK_LABELS_INPUT: '[data-testid="work-labels-input"]',
  WORK_SUBMIT_BTN: '[data-testid="work-submit-btn"]',
  WORK_LIST: '[data-testid="work-list"]',
  WORK_ITEM: '[data-testid="work-item"]',

  // Sling
  SLING_BTN: '[data-testid="sling-btn"]',
  SLING_TARGET_SELECT: '[data-testid="sling-target-select"]',
  SLING_CONFIRM_BTN: '[data-testid="sling-confirm-btn"]',

  // Toasts
  TOAST: '[data-testid="toast"]',
  TOAST_MESSAGE: '[data-testid="toast-message"]',
  TOAST_ACTION: '[data-testid="toast-action"]',

  // Data attributes for entity identification
  BEAD_ID: (id: string) => `[data-bead-id="${id}"]`,
  RIG_NAME: (name: string) => `[data-rig-name="${name}"]`,
  AGENT_NAME: (name: string) => `[data-agent-name="${name}"]`,
} as const;
```

### Component Mapping (Vanilla JS → SvelteKit)

| Test Target | Selector Strategy | SvelteKit Component |
|-------------|-------------------|---------------------|
| Add Rig button | `data-testid="add-rig-btn"` | `<Button>` on `/rigs` |
| Rig name input | `name="name"` or `data-testid` | `<Input>` component |
| Rig URL input | `name="url"` or `data-testid` | `<Input>` component |
| Toast messages | `role="status"` or `.toast-viewport` | `Toast.svelte` |
| Target dropdown | Click trigger first, then option | Shadcn `<Select>` |
| Work item row | `data-bead-id="{id}"` | List item component |

### MSW Handlers

```typescript
// src/lib/test/msw-handlers.ts
import { http, HttpResponse, delay } from 'msw';

export const handlers = [
  // Status endpoint
  http.get('/api/gastown/status', async () => {
    await delay(100);
    return HttpResponse.json(mockStatus);
  }),

  // Rig add - simulates long-running operation
  http.post('/api/gastown/rigs', async ({ request }) => {
    const body = await request.json();

    // Simulate git clone delay
    await delay(2000); // 2s for tests, real is 30-150s

    return HttpResponse.json({
      id: `rig-${Date.now()}`,
      name: body.name,
      status: 'active',
    });
  }),

  // Work create - returns ID
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

  // Sling - may fail with known bug
  http.post('/api/gastown/work/sling', async ({ request }) => {
    const body = await request.json();

    // Simulate known daemon bug 20% of the time in tests
    if (Math.random() < 0.2) {
      return HttpResponse.json({
        error: {
          code: 'KNOWN_BUG',
          message: 'Sling queued (daemon not running)',
          category: 'KNOWN_BUG',
          details: { knownBug: 'MOL_BOND_DAEMON' },
          recoverable: true,
          suggestedAction: 'Run "gt up" to start the daemon',
        },
      }, { status: 202 }); // Accepted but queued
    }

    return HttpResponse.json({
      status: 'slung',
      target: body.target,
    });
  }),
];
```

### E2E Test Patterns

```typescript
// tests/e2e/rig-management.spec.ts

import { test, expect } from '@playwright/test';
import { SELECTORS } from '$lib/test/selectors';

test.describe('CUJ-1: Rig Management', () => {
  test('should add a rig with long git clone', async ({ page }) => {
    // Navigate
    await page.goto('/rigs');
    await expect(page.locator(SELECTORS.RIG_LIST)).toBeVisible();

    // Open modal
    await page.click(SELECTORS.ADD_RIG_BTN);

    // Fill form
    await page.fill(SELECTORS.RIG_NAME_INPUT, 'zoo-game');
    await page.fill(SELECTORS.RIG_URL_INPUT, 'https://github.com/example/zoo-game');

    // Submit - modal should close immediately
    await page.click(SELECTORS.RIG_SUBMIT_BTN);
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // Immediate toast feedback
    await expect(page.locator(SELECTORS.TOAST)).toContainText('Adding rig');

    // Wait for success (up to 150s in real scenario, 10s in test)
    await expect(page.locator(SELECTORS.TOAST)).toContainText(
      'added successfully',
      { timeout: 10000 }
    );

    // Verify rig appears in list
    await expect(page.locator(SELECTORS.RIG_NAME('zoo-game'))).toBeVisible();
  });
});
```

### Testing Long-Running Operations

```typescript
// tests/e2e/helpers/long-running.ts

/**
 * Wait for an async operation with appropriate timeout
 */
export async function waitForOperation(
  page: Page,
  options: {
    successPattern: RegExp;
    errorPattern?: RegExp;
    timeout: number;
    pollInterval?: number;
  }
): Promise<'success' | 'error' | 'timeout'> {
  const { successPattern, errorPattern, timeout, pollInterval = 1000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const toastText = await page.locator(SELECTORS.TOAST_MESSAGE).textContent();

    if (toastText && successPattern.test(toastText)) {
      return 'success';
    }

    if (errorPattern && toastText && errorPattern.test(toastText)) {
      return 'error';
    }

    await page.waitForTimeout(pollInterval);
  }

  return 'timeout';
}
```

---

## Deployment Architecture

### Development (Single Machine)

```yaml
# docker-compose.dev.yml
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
      - VITE_API_URL=http://localhost:3000/api
    # Requires gt/bd CLI available on host
    # Mount host tools into container
    volumes:
      - /usr/local/bin/gt:/usr/local/bin/gt:ro
      - /usr/local/bin/bd:/usr/local/bin/bd:ro
      - ~/.beads:/root/.beads
```

### Production (Docker)

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  ui:
    image: gastown-ui:latest
    ports:
      - "80:3000"
    environment:
      - NODE_ENV=production
      - ORIGIN=https://gastown.example.com
    deploy:
      replicas: 1
      resources:
        limits:
          cpus: '1'
          memory: 512M

  # Future: Separate API service
  # api:
  #   image: gastown-api:latest
  #   ports:
  #     - "8080:8080"
```

### Scalable (Kubernetes)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gastown-ui
spec:
  replicas: 3
  selector:
    matchLabels:
      app: gastown-ui
  template:
    spec:
      containers:
        - name: ui
          image: gastown-ui:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          env:
            - name: NODE_ENV
              value: production
          # CLI tools as sidecar or shared volume
          volumeMounts:
            - name: beads-data
              mountPath: /data/.beads
      volumes:
        - name: beads-data
          persistentVolumeClaim:
            claimName: beads-pvc
```

---

## Implementation Checklist

### Phase 1: MVP (CLI Bridge)

#### Server Routes
- [ ] `GET /api/gastown/status` - Parse full status
- [ ] `GET /api/gastown/agents` - Extract agents from status
- [ ] `GET /api/gastown/agents/[id]` - Agent details via `gt peek`
- [ ] `GET /api/gastown/convoys` - Convoy list
- [ ] `GET /api/gastown/convoys/[id]` - Convoy details
- [ ] `GET /api/gastown/mail` - ✅ Done
- [ ] `GET /api/gastown/mail/[id]` - Mail message detail
- [ ] `GET /api/gastown/queue` - Merge queue list
- [ ] `GET /api/gastown/rigs` - Rig list
- [ ] `GET /api/gastown/rigs/[name]` - Rig details
- [ ] `POST /api/gastown/rigs` - Add rig (long-running)
- [ ] `GET /api/gastown/work/issues` - Work item list
- [ ] `POST /api/gastown/work/issues` - Create work item
- [ ] `POST /api/gastown/work/sling` - Sling work item
- [ ] `GET /api/gastown/feed` - Activity feed
- [ ] `GET /api/gastown/health` - Doctor results

#### Type System
- [ ] Create `src/lib/types/gastown.ts`
- [ ] Create Zod schemas for validation
- [ ] Add CLI output type tests
- [ ] Define state transition types

#### Polling System
- [ ] Create `src/lib/stores/polling.svelte.ts`
- [ ] Implement multi-tier polling (5s/15s/60s)
- [ ] Add visibility-based pause (tab inactive)
- [ ] Handle network offline gracefully

#### Long-Running Operations
- [ ] Create `src/lib/services/async-operations.ts`
- [ ] Implement timeout configuration
- [ ] Add operation status tracking
- [ ] Create pending state UI components

#### Toast System
- [ ] Define machine-readable toast patterns
- [ ] Implement two-phase feedback (ing → ed)
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

#### Testing Infrastructure
- [ ] Define `data-testid` conventions
- [ ] Create selector constants
- [ ] Set up MSW handlers
- [ ] Create test helpers for long-running ops
- [ ] Add auth injection for tests

#### Testing
- [ ] MSW handlers for all endpoints
- [ ] Component tests with mock data
- [ ] E2E tests for CUJ-1 (Rig Management)
- [ ] E2E tests for CUJ-2 (Work Lifecycle)
- [ ] E2E tests for CUJ-3 (Orchestration)
- [ ] E2E tests for CUJ-4 (Monitoring)
- [ ] E2E tests for CUJ-5 (Mail)

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

Use these checklists for manual testing via browser dev tools or "Claude in Chrome" sessions.

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
gt mail inbox --json          # Inbox (may hang in child_process)
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
| 2.0 | 2026-01-11 | Claude | Major revision: Added CUJs, long-running operations, toast system, error handling, testing strategy, manual checklists. Integrated insights from PR #212 test analysis. |

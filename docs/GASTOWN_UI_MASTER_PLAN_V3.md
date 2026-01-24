# Gas Town UI - Master Reorganization Plan v3

> **Version**: 3.0 (Stress-Tested, Contract-Aligned)
> **Date**: 2026-01-21
> **Scope**: Complete codebase audit + reorganization plan + contract alignment
> **Status**: Ready for Implementation
> **Source of Truth**: `/Users/amrit/Documents/Projects/Rust/mouchak/gastown`

---

## Critical Corrections from v2

This version addresses fundamental contract mismatches discovered by cross-referencing the gastown source of truth.

### ⚠️ CRITICAL: Status Model is WRONG

**v2 Assumed (INCORRECT)**:
```typescript
type IssueStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'closed';
```

**Gastown Source of Truth (CORRECT)**:
```go
// Beads storage only has TWO statuses:
Status: "open" | "closed"

// "hooked" and "tombstone" are special states
// "in_progress", "blocked", "completed" DO NOT EXIST in beads

// MR Status (SEPARATE from bead status):
MRStatus: "open" | "in_progress" | "closed"

// Polecat State (SESSION-DERIVED, not stored):
State: "working" | "done" | "stuck"
// NOTE: There is NO "idle" state - polecats don't wait in pools
```

**Impact**: 28 files reference `in_progress` - all need correction.

### ⚠️ CRITICAL: Polecat Has NO Idle State

**v2 Assumed (INCORRECT)**:
```typescript
type PolecatSnapshotStatus = 'running' | 'idle';
type GtAgentStatus = 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';
```

**Gastown Source of Truth (CORRECT)**:
```go
// From internal/polecat/types.go:
// "There is no idle pool where polecats wait for work"
State: "working" | "done" | "stuck"
// "active" is deprecated, treated as "working"
```

### ⚠️ HIGH: Priority Format Differs by Context

**Beads**: Integer 0-4 (0=urgent, 4=low)
**Mail**: String enum ("low", "normal", "high", "urgent")

UI mixes these formats inconsistently.

---

## Executive Summary

| Metric | Current | Target |
|--------|---------|--------|
| Files in `src/` | 318 | ~320 |
| Max files per directory | 63 | ≤20 |
| Max directory depth | 4 | 3 |
| Large files (>500 LOC) | 7 | 0 |
| Contract mismatches | **41** | **0** |
| Test coverage | ~40% | 80% |

### Critical Issues Summary

| Severity | Count | Category |
|----------|-------|----------|
| **CONTRACT** | 8 | Status/type mismatches with gastown |
| **CRITICAL** | 6 | Security vulnerabilities |
| **HIGH** | 12 | Memory leaks, missing validation |
| **MEDIUM** | 26 | Architectural issues |
| **LOW** | 23 | Tech debt |

---

## Table of Contents

1. [Contract Alignment (NEW)](#1-contract-alignment)
2. [Unstated Assumptions & Risks (NEW)](#2-unstated-assumptions--risks)
3. [Failure Modes & Edge Cases (NEW)](#3-failure-modes--edge-cases)
4. [Critical Security Issues](#4-critical-security-issues)
5. [Memory & Performance Issues](#5-memory--performance-issues)
6. [Architectural Issues](#6-architectural-issues)
7. [Large File Analysis](#7-large-file-analysis)
8. [Proposed Directory Structure](#8-proposed-directory-structure)
9. [Component Reorganization](#9-component-reorganization)
10. [Store Reorganization](#10-store-reorganization)
11. [Route Reorganization](#11-route-reorganization)
12. [Server Module Reorganization](#12-server-module-reorganization)
13. [CSS & Styles Reorganization](#13-css--styles-reorganization)
14. [Test Infrastructure](#14-test-infrastructure)
15. [Import Migration Guide](#15-import-migration-guide)
16. [Implementation Phases](#16-implementation-phases)

---

## 1. Contract Alignment

### 1.1 Bead Status Alignment

**Source**: `gastown/internal/beads/beads.go`

| UI Status | Gastown Reality | Action |
|-----------|-----------------|--------|
| `open` | ✅ Exists | Keep |
| `closed` | ✅ Exists | Keep |
| `hooked` | ✅ Display state only | Keep as derived |
| `in_progress` | ❌ DOES NOT EXIST | Remove from bead types |
| `blocked` | ❌ DOES NOT EXIST | Derive from dependency graph |
| `completed` | ❌ DOES NOT EXIST | Remove (use `closed`) |

**Required Changes**:

```typescript
// BEFORE (WRONG)
export type BdBeadStatus = 'open' | 'in_progress' | 'closed' | 'hooked';

// AFTER (CORRECT)
// Storage status (what beads actually stores)
export type BdBeadStorageStatus = 'open' | 'closed';

// Display status (derived for UI)
export type BdBeadDisplayStatus =
  | 'open'           // status=open, not blocked, no MR
  | 'in_progress'    // status=open, has active MR
  | 'blocked'        // status=open, has blocking dependencies
  | 'closed'         // status=closed
  | 'hooked';        // pinned to agent hook

// Derivation function
export function deriveDisplayStatus(bead: BdBead, mrStatus?: MRStatus): BdBeadDisplayStatus {
  if (bead.status === 'closed') return 'closed';
  if (bead.hook_bead) return 'hooked';
  if (bead.blocked_by_count > 0) return 'blocked';
  if (mrStatus === 'in_progress') return 'in_progress';
  return 'open';
}
```

**Files to Update**:
- `src/lib/types/gastown.ts` - Fix type definitions
- `src/lib/utils/status.ts` - Add derivation logic
- `src/lib/server/cli/contracts.ts` - Fix Zod schemas
- All 28 files referencing `in_progress`

**Acceptance Criteria**:
- [ ] `BdBeadStorageStatus` only contains `'open' | 'closed'`
- [ ] Display status derived, never stored
- [ ] All Zod schemas validate against actual CLI output
- [ ] Contract tests pass against gastown fixtures

---

### 1.2 MR Status Alignment

**Source**: `gastown/internal/refinery/types.go`

```go
type MRStatus string
const (
    MRStatusOpen       = "open"        // Queued, waiting
    MRStatusInProgress = "in_progress" // Being merged
    MRStatusClosed     = "closed"      // Done (merged, rejected, conflict, superseded)
)

type CloseReason string
const (
    CloseReasonMerged     = "merged"
    CloseReasonRejected   = "rejected"
    CloseReasonConflict   = "conflict"
    CloseReasonSuperseded = "superseded"
)
```

**UI Currently Has (PARTIALLY WRONG)**:
```typescript
type GtMergeQueueStatus = 'pending' | 'processing' | 'merged' | 'failed';
```

**Correct Type**:
```typescript
// MR status (matches gastown)
export type MRStatus = 'open' | 'in_progress' | 'closed';

// Close reason (separate from status)
export type MRCloseReason = 'merged' | 'rejected' | 'conflict' | 'superseded';

// Failure type (for error handling)
export type MRFailureType =
  | 'conflict'
  | 'tests_fail'
  | 'build_fail'
  | 'flaky_test'
  | 'push_fail'
  | 'fetch_fail'
  | 'checkout_fail';
```

**Acceptance Criteria**:
- [ ] MR status enum matches gastown exactly
- [ ] CloseReason tracked separately from status
- [ ] FailureType matches refinery failure categories

---

### 1.3 Polecat State Alignment

**Source**: `gastown/internal/polecat/types.go`

**CRITICAL**: Polecat state is SESSION-DERIVED, not stored in beads.

```go
type State string
const (
    StateWorking = "working"  // ONLY healthy operating state
    StateDone    = "done"     // Completed, should exit after cleanup
    StateStuck   = "stuck"    // Needs assistance
    // "active" is DEPRECATED, treated as "working"
)

// THERE IS NO IDLE STATE
// "There is no idle pool where polecats wait for work"
```

**UI Currently Has (WRONG)**:
```typescript
type PolecatSnapshotStatus = 'running' | 'idle';  // "idle" DOES NOT EXIST
type GtAgentStatus = 'idle' | 'active' | 'busy' | 'parked' | 'stuck' | 'orphaned';
```

**Correct Types**:
```typescript
// Polecat state (session-derived)
export type PolecatState = 'working' | 'done' | 'stuck';

// Agent status (for display)
// Note: derived from session monitoring, tmux state, etc.
export type AgentDisplayStatus =
  | 'running'    // Has active tmux session, state=working
  | 'completing' // state=done, cleaning up
  | 'stuck'      // state=stuck, needs help
  | 'exited';    // No session found

// Cleanup status (for worktree management)
export type CleanupStatus =
  | 'clean'           // Safe to remove
  | 'has_uncommitted' // Uncommitted changes
  | 'has_stash'       // Stashed work
  | 'has_unpushed'    // Unpushed commits
  | 'unknown';
```

**Acceptance Criteria**:
- [ ] No `idle` state anywhere in codebase
- [ ] State derived from session monitoring, not stored
- [ ] `done` state treated as transient (agent exiting)

---

### 1.4 Priority Normalization

**Source**: `gastown/internal/beads/beads.go`, `gastown/internal/mail/types.go`

| Context | Format | Values |
|---------|--------|--------|
| Beads | Integer | 0=urgent, 1=high, 2=normal, 3=low, 4=backlog |
| Mail | String | "urgent", "high", "normal", "low" |

**Required Conversion Utilities**:

```typescript
// src/lib/utils/format/priority.ts

export type BeadPriority = 0 | 1 | 2 | 3 | 4;
export type MailPriority = 'urgent' | 'high' | 'normal' | 'low';

const BEAD_TO_MAIL: Record<BeadPriority, MailPriority> = {
  0: 'urgent',
  1: 'high',
  2: 'normal',
  3: 'low',
  4: 'low'  // backlog maps to low
};

const MAIL_TO_BEAD: Record<MailPriority, BeadPriority> = {
  'urgent': 0,
  'high': 1,
  'normal': 2,
  'low': 3
};

export function beadPriorityToMail(p: BeadPriority): MailPriority {
  return BEAD_TO_MAIL[p];
}

export function mailPriorityToBead(p: MailPriority): BeadPriority {
  return MAIL_TO_BEAD[p];
}
```

**Acceptance Criteria**:
- [ ] Priority conversion utilities created
- [ ] All priority displays use appropriate format
- [ ] No implicit type coercion between formats

---

### 1.5 Address Normalization

**Source**: `gastown/internal/mail/types.go`

Gastown uses Postel's Law: "Be liberal in what you accept, conservative in what you send."

**Address Normalization Rules**:
```
Input                        → Canonical
"overseer"                   → "overseer"       (human, NO trailing slash)
"mayor"                      → "mayor/"         (town-level agent)
"mayor/"                     → "mayor/"
"deacon"                     → "deacon/"
"gastown/Toast"              → "gastown/Toast"  (polecat canonical)
"gastown/polecats/Toast"     → "gastown/Toast"  (normalized)
"gastown/crew/yourname"      → "gastown/yourname"
"gastown/refinery"           → "gastown/refinery"
"gastown/"                   → "gastown"        (rig broadcast)
```

**Required Utility**:

```typescript
// src/lib/utils/format/address.ts

export function normalizeAddress(addr: string): string {
  // Town-level agents get trailing slash
  if (['mayor', 'deacon', 'witness'].includes(addr)) {
    return addr + '/';
  }

  // Already normalized town-level
  if (['mayor/', 'deacon/', 'witness/'].includes(addr)) {
    return addr;
  }

  // Human operator - no slash
  if (addr === 'overseer' || addr === 'overseer/') {
    return 'overseer';
  }

  // Polecat normalization: gastown/polecats/Name → gastown/Name
  const polecatMatch = addr.match(/^([^/]+)\/polecats\/(.+)$/);
  if (polecatMatch) {
    return `${polecatMatch[1]}/${polecatMatch[2]}`;
  }

  // Crew normalization: gastown/crew/Name → gastown/Name
  const crewMatch = addr.match(/^([^/]+)\/crew\/(.+)$/);
  if (crewMatch) {
    return `${crewMatch[1]}/${crewMatch[2]}`;
  }

  // Rig broadcast: gastown/ → gastown
  if (addr.endsWith('/') && !addr.includes('/polecats/') && !addr.includes('/crew/')) {
    return addr.slice(0, -1);
  }

  return addr;
}

export function formatDisplayAddress(addr: string): string {
  const normalized = normalizeAddress(addr);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}
```

**Acceptance Criteria**:
- [ ] Address normalization utility exists
- [ ] All mail send operations normalize addresses
- [ ] Display addresses use `formatDisplayAddress`
- [ ] Tests cover all normalization cases

---

### 1.6 CLI Output Format Handling

**Source**: `gastown/internal/beads/`

**CRITICAL**: CLI commands return ARRAYS, even for single items.

```bash
# bd show <id> returns:
[{"id": "gt-abc", "title": "...", ...}]  # Array with one element

# bd list returns:
[{"id": "gt-abc", ...}, {"id": "gt-def", ...}]  # Array

# Empty result:
[]  # Empty array, NOT null or error
```

**Required Handling**:

```typescript
// src/lib/server/cli/parse.ts

export function parseSingleBead(output: string): BdBead | null {
  const result = parseCliOutput(z.array(BdBeadSchema), output);
  if (!result.success) return null;
  return result.data[0] ?? null;  // First element or null
}

export function parseBeadList(output: string): BdBead[] {
  const result = parseCliOutput(z.array(BdBeadSchema), output);
  if (!result.success) return [];
  return result.data;
}
```

**Acceptance Criteria**:
- [ ] All CLI parsing handles array returns
- [ ] Empty arrays treated as "not found" (not errors)
- [ ] Single-item queries extract first element

---

### 1.7 Issue Type Alignment

**Source**: `gastown/internal/beads/`

**Gastown Issue Types**:
```
"task"          - Standard work item
"bug"           - Bug report
"feature"       - Feature request
"epic"          - Large work grouping
"merge-request" - MR bead (labeled gt:merge-request)
"convoy"        - Work batch tracking
"agent"         - Agent lifecycle bead
"gate"          - Synchronization primitive
```

**Label-Based Metadata**:
```
gt:merge-request  - Marks bead as MR
gt:agent          - Marks bead as agent
from:<identity>   - Sender in mail beads
thread:<id>       - Thread ID
msg-type:<type>   - Message type
queue:<name>      - Queue routing
channel:<name>    - Broadcast channel
```

**Acceptance Criteria**:
- [ ] All issue types from gastown supported
- [ ] Label parsing extracts metadata correctly
- [ ] MR detection via `gt:merge-request` label

---

### 1.8 Convoy Status Alignment

**Source**: `gastown/cmd/convoy.go`, `gastown/internal/beads/`

**Convoy Storage Status**: `"open"` | `"closed"` (same as beads)

**Convoy Work Status** (DERIVED):
```
"active"   - Has in-progress tracked issues
"stale"    - No recent activity
"stuck"    - Has stuck issues
"waiting"  - All tracked issues pending
"complete" - All tracked issues closed
```

**Convoy Completion Logic**:
```go
// Convoy closes when ALL tracked issues have status "closed" or "tombstone"
// NOT when convoy itself is marked complete
```

**Required Derivation**:

```typescript
export function deriveConvoyWorkStatus(convoy: GtConvoy): GtConvoyWorkStatus {
  const { tracked_issues } = convoy;
  if (!tracked_issues.length) return 'waiting';

  const allClosed = tracked_issues.every(i => i.status === 'closed');
  if (allClosed) return 'complete';

  const hasStuck = tracked_issues.some(i => i.status === 'stuck');
  if (hasStuck) return 'stuck';

  const hasInProgress = tracked_issues.some(i => i.assignee);
  if (hasInProgress) return 'active';

  // Check staleness via updated_at
  const lastUpdate = new Date(convoy.updated_at);
  const hoursSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > 24) return 'stale';

  return 'active';
}
```

**Acceptance Criteria**:
- [ ] Convoy work status derived, not stored
- [ ] Completion based on tracked issues, not convoy status
- [ ] Staleness threshold configurable

---

## 2. Unstated Assumptions & Risks

### 2.1 CLI Availability

**Assumption**: `gt` and `bd` CLI tools are always available.

**Risk**: CLI not installed, wrong version, or broken.

**Mitigation**:
```typescript
// src/lib/server/cli/capabilities.ts

interface CLICapabilities {
  gtAvailable: boolean;
  gtVersion: string | null;
  bdAvailable: boolean;
  bdVersion: string | null;
  minGtVersion: string;
  minBdVersion: string;
  compatible: boolean;
  error: string | null;
}

async function checkCapabilities(): Promise<CLICapabilities> {
  // Check gt --version
  // Check bd --version
  // Compare against minimum required versions
  // Return compatibility status
}
```

**Acceptance Criteria**:
- [ ] Startup checks CLI availability
- [ ] Version compatibility validated
- [ ] Graceful degradation with clear error messages
- [ ] Demo mode fallback when CLI unavailable

---

### 2.2 CLI Output Format Stability

**Assumption**: CLI JSON output format won't change.

**Risk**: Gastown update breaks UI parsing.

**Mitigation**:
1. Zod schemas with `.passthrough()` for forward compatibility
2. Contract tests against golden fixtures
3. Version-specific parsing if needed

```typescript
// Schema allows unknown fields (forward compatible)
export const BdBeadSchema = z.object({
  id: z.string(),
  // ... required fields
}).passthrough();  // <-- Allows new fields
```

**Acceptance Criteria**:
- [ ] All Zod schemas use `.passthrough()`
- [ ] Contract tests run against gastown fixtures
- [ ] Version mismatch logged with warning

---

### 2.3 ProcessSupervisor Reliability

**Assumption**: ProcessSupervisor always succeeds or fails cleanly.

**Risks**:
- Zombie processes
- Timeout without cleanup
- Circuit breaker stuck open

**Mitigation**:

```typescript
// src/lib/server/cli/process-supervisor.ts

class ProcessSupervisor {
  #activeProcesses = new Map<string, ChildProcess>();

  async execute(config: CLICommandConfig): Promise<CLIResult> {
    const proc = spawn(config.command, config.args);
    const id = crypto.randomUUID();
    this.#activeProcesses.set(id, proc);

    try {
      // Execute with timeout
      return await this.#runWithTimeout(proc, config.timeout);
    } finally {
      this.#activeProcesses.delete(id);
      if (!proc.killed) {
        proc.kill('SIGTERM');
      }
    }
  }

  // Cleanup all processes on shutdown
  destroy() {
    for (const [id, proc] of this.#activeProcesses) {
      proc.kill('SIGKILL');
    }
    this.#activeProcesses.clear();
  }
}
```

**Acceptance Criteria**:
- [ ] All spawned processes tracked
- [ ] Cleanup on timeout
- [ ] Graceful shutdown kills all processes
- [ ] Circuit breaker auto-resets

---

### 2.4 SvelteKit Route Groups

**Assumption**: Route groups `(app)`, `(auth)`, `(api)` work as expected.

**Risk**: SvelteKit version incompatibility or unexpected behavior.

**Verification**:
```bash
# Verify SvelteKit version supports route groups
cat package.json | grep svelte

# Test route group behavior
bun run build && bun run preview
# Verify URLs unchanged
```

**Acceptance Criteria**:
- [ ] SvelteKit version ≥1.0 (route groups supported)
- [ ] E2E tests verify all URLs unchanged
- [ ] Build succeeds with route groups

---

### 2.5 Bun Package Manager

**Assumption**: Project uses `bun` exclusively.

**Risk**: CI/CD might use npm/yarn, causing lockfile conflicts.

**Verification**:
```bash
# Check for lockfiles
ls -la | grep -E "package-lock|yarn.lock|pnpm-lock|bun.lockb"

# Verify CI/CD configuration
cat .github/workflows/*.yml | grep -E "npm|yarn|pnpm|bun"
```

**Acceptance Criteria**:
- [ ] Only `bun.lockb` exists
- [ ] CI/CD uses `bun` commands
- [ ] No npm/yarn/pnpm references

---

### 2.6 Single Rig Assumption

**Assumption**: UI operates on one rig at a time.

**Risk**: Multi-rig scenarios not handled.

**Current State**: Some pages hardcode rig name, others don't.

**Mitigation**:
```typescript
// src/lib/config/rig.ts
export function getCurrentRig(): string {
  return import.meta.env.GASTOWN_RIG || 'gastownui';
}
```

**Acceptance Criteria**:
- [ ] Rig name configurable via environment
- [ ] No hardcoded rig names
- [ ] Multi-rig display supported on dashboard

---

## 3. Failure Modes & Edge Cases

### 3.1 Beads Store Corruption

**Scenario**: `beads.jsonl` is corrupted or missing.

**Current Behavior**: Unknown (likely crash).

**Required Handling**:
```typescript
// Detect corruption via CLI error
if (result.error?.includes('invalid JSON') ||
    result.error?.includes('parse error')) {
  return {
    success: false,
    error: 'Beads store may be corrupted',
    category: 'corruption',
    retryable: false,
    recoveryAction: 'Run `bd repair` to attempt recovery'
  };
}
```

**Acceptance Criteria**:
- [ ] Corruption detected and reported
- [ ] Clear recovery instructions
- [ ] UI remains functional (read-only mode)

---

### 3.2 CLI Timeout

**Scenario**: CLI command hangs (e.g., git fetch on slow network).

**Current Behavior**: 30s timeout, then error.

**Required Handling**:
1. Progressive timeout increases for retries
2. User-cancellable operations
3. Background operations don't block UI

```typescript
const TIMEOUT_STRATEGY = {
  initial: 30_000,
  retry1: 60_000,
  retry2: 120_000,
  max: 300_000
};
```

**Acceptance Criteria**:
- [ ] Timeout progressive on retry
- [ ] Long operations show progress
- [ ] Cancel button on blocking operations

---

### 3.3 Network Partition

**Scenario**: Network drops during operation.

**Current Behavior**: Likely hung requests.

**Required Handling**:
1. Network status detection (`navigator.onLine`)
2. Request queue pauses during offline
3. Automatic retry on reconnection

```typescript
// src/lib/stores/core/network.svelte.ts
class NetworkStore {
  #online = $state(navigator.onLine);
  #pendingRequests = $state<QueuedRequest[]>([]);

  constructor() {
    window.addEventListener('online', () => this.#handleOnline());
    window.addEventListener('offline', () => this.#handleOffline());
  }

  #handleOffline() {
    this.#online = false;
    // Pause polling, show offline indicator
  }

  #handleOnline() {
    this.#online = true;
    // Resume polling, retry pending requests
  }
}
```

**Acceptance Criteria**:
- [ ] Offline state detected within 1s
- [ ] Offline indicator visible
- [ ] Requests resume on reconnection

---

### 3.4 Concurrent Modification

**Scenario**: Two users/agents modify same bead simultaneously.

**Current Behavior**: Last write wins (data loss).

**Required Handling**:
1. Optimistic updates with conflict detection
2. Version/etag checking before writes
3. Merge UI for conflicts

**Acceptance Criteria**:
- [ ] Concurrent modifications detected
- [ ] User notified of conflicts
- [ ] No silent data loss

---

### 3.5 Large Data Sets

**Scenario**: 10,000+ beads, 1,000+ mail messages.

**Current Behavior**: Likely slow/crashed.

**Required Handling**:
1. Pagination on all list endpoints
2. Virtual scrolling for long lists
3. Server-side filtering

```typescript
// API pagination
interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
```

**Acceptance Criteria**:
- [ ] Lists paginated (50 items default)
- [ ] Virtual scrolling for 100+ items
- [ ] Server-side filtering implemented

---

### 3.6 PWA Service Worker Conflicts

**Scenario**: Service worker caches stale data after UI update.

**Current Behavior**: Unknown.

**Required Handling**:
1. Version-based cache invalidation
2. Force update prompt for major versions
3. Clear cache on critical changes

**Acceptance Criteria**:
- [ ] Service worker versioned
- [ ] Update prompt shown for new versions
- [ ] Critical updates force reload

---

### 3.7 SSE/WebSocket Reconnection

**Scenario**: Real-time connection drops and reconnects.

**Current Behavior**: May lose events during disconnect.

**Required Handling**:
1. Exponential backoff on reconnect
2. Last-event-ID tracking for SSE
3. Full state refresh after long disconnect

```typescript
class SSEClient {
  #lastEventId: string | null = null;
  #reconnectAttempts = 0;

  connect() {
    const url = new URL('/api/gastown/feed', window.location.origin);
    if (this.#lastEventId) {
      url.searchParams.set('lastEventId', this.#lastEventId);
    }

    this.#eventSource = new EventSource(url);
    this.#eventSource.onmessage = (e) => {
      this.#lastEventId = e.lastEventId;
      this.#reconnectAttempts = 0;
      // Process event
    };
  }
}
```

**Acceptance Criteria**:
- [ ] Reconnection with exponential backoff
- [ ] Event ID tracking for SSE
- [ ] Full refresh after 5+ minutes offline

---

### 3.8 Memory Under Pressure

**Scenario**: Browser memory pressure (mobile, many tabs).

**Current Behavior**: Likely crash or OOM.

**Required Handling**:
1. Memory-aware caching (evict on pressure)
2. Reduce polling frequency when backgrounded
3. Page visibility API integration

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Reduce polling, pause non-essential updates
    pollingStore.setInterval(60_000);
  } else {
    // Resume normal operation
    pollingStore.setInterval(5_000);
  }
});
```

**Acceptance Criteria**:
- [ ] Reduced activity when backgrounded
- [ ] Memory stays under 100MB
- [ ] Graceful degradation on pressure

---

## 4. Critical Security Issues

### 4.1 Shell Injection Vulnerabilities

**Location**: Multiple route files
**Severity**: CRITICAL

**Files Affected**:
- `src/routes/mail/compose/+page.server.ts:142`
- `src/routes/rigs/+page.server.ts:123`
- `src/routes/api/gastown/work/issues/+server.ts:50`

**Problem**:
```typescript
// VULNERABLE - string interpolation in shell command
const command = `gt mail send '${escapedTo}' -s '${escapedSubject}'`;
await execAsync(command);
```

**Solution**:
```typescript
// SECURE - argument array, no shell
import { getProcessSupervisor } from '$lib/server/cli';

const supervisor = getProcessSupervisor();
const result = await supervisor.execute({
  command: 'gt',
  args: ['mail', 'send', to, '-s', subject, '-m', body]
});
```

**Acceptance Criteria**:
- [ ] Zero `exec()`/`execAsync()` with string interpolation
- [ ] All CLI calls via ProcessSupervisor with arg arrays
- [ ] Security audit passes
- [ ] Penetration test for injection

---

### 4.2 Missing Authentication

**Location**: All API routes
**Severity**: CRITICAL

**Problem**: No authentication on `/api/gastown/*` routes.

**Solution**:
```typescript
// src/routes/api/gastown/+layout.server.ts
import { verifyAuth } from '$lib/server/auth';
import { error } from '@sveltejs/kit';

export const load = async ({ cookies, request }) => {
  const auth = await verifyAuth(cookies);
  if (!auth.valid) {
    throw error(401, 'Authentication required');
  }
  return { user: auth.user };
};
```

**Acceptance Criteria**:
- [ ] All `/api/gastown/*` routes require auth
- [ ] JWT validation with proper expiry
- [ ] CSRF protection on mutations
- [ ] Auth tokens in HttpOnly cookies

---

## 5. Memory & Performance Issues

### 5.1 Orphaned Timers

**Severity**: HIGH

**Files**:
- `src/lib/api/handlers.ts:126`
- `src/lib/stores/operations.svelte.ts:102`
- `src/lib/stores/toast.svelte.ts:184`

**Problem**:
```typescript
// LEAKED - interval ID not stored
setInterval(() => this.#clearStaleOptimisticUpdates(), 1000);
```

**Solution**:
```typescript
#cleanupInterval: ReturnType<typeof setInterval> | null = null;

#init() {
  this.#cleanupInterval = setInterval(() => this.#cleanup(), 1000);
}

destroy() {
  if (this.#cleanupInterval) {
    clearInterval(this.#cleanupInterval);
    this.#cleanupInterval = null;
  }
}
```

**Acceptance Criteria**:
- [ ] All interval handles stored
- [ ] `destroy()` clears all timers
- [ ] Memory stable over 1 hour

---

### 5.2 Event Listener Leaks

**Location**: `src/lib/api/client.ts:296`
**Severity**: HIGH

**Problem**:
```typescript
externalSignal.addEventListener('abort', () => controller.abort());
// Never removed!
```

**Solution**:
```typescript
const abortHandler = () => controller.abort();
externalSignal.addEventListener('abort', abortHandler);

try {
  // ... operation
} finally {
  externalSignal.removeEventListener('abort', abortHandler);
}
```

**Acceptance Criteria**:
- [ ] All event listeners paired with removal
- [ ] Cleanup in finally blocks
- [ ] Memory profiling shows stable listener count

---

## 6. Architectural Issues

### 6.1 Mixed Client/Server Auth

**Location**: `src/lib/auth/`
**Severity**: MEDIUM

**Problem**: Server code may leak into client bundles.

**Solution**: Split into `src/lib/client/auth/` and `src/lib/server/auth/`.

**Acceptance Criteria**:
- [ ] Bundle analysis shows no server code in client
- [ ] Clear separation of client/server auth

---

### 6.2 Data Contract Mismatches

**Severity**: HIGH (Addressed in Section 1)

**Summary**:
- 41 contract mismatches identified
- Status models fundamentally wrong
- Priority formats inconsistent

---

## 7. Large File Analysis

| File | Lines | Split Strategy |
|------|-------|----------------|
| `routes/work/+page.svelte` | ~1050 | `WorkFilters`, `WorkList`, `WorkCreateForm`, `WorkSlingForm` |
| `app.css` | ~1021 | `tokens.css`, `base.css`, `components.css`, `animations.css` |
| `command-palette/CommandPalette.svelte` | ~795 | `CommandPaletteList`, `CommandPaletteItem`, `data.ts` |
| `routes/seance/+page.svelte` | ~773 | `SeanceControls`, `SeanceOutput`, `SeanceHistory` |
| `routes/workflows/+page.svelte` | ~699 | `WorkflowFilters`, `WorkflowList`, `WorkflowDetail` |
| `types/gastown.schema.ts` | ~643 | By domain: `status.schema.ts`, `agents.schema.ts`, etc. |
| `utils/keyboard-vim.ts` | ~630 | `vim-parser.ts`, `vim-bindings.ts`, `vim-modes.ts` |

**Acceptance Criteria**:
- [ ] No file >400 LOC (components) or 300 LOC (utilities)
- [ ] Each split file has single responsibility

---

## 8. Proposed Directory Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── core/                    # UI primitives
│   │   ├── layout/                  # Page structure
│   │   ├── navigation/              # Nav components
│   │   ├── feedback/                # User feedback
│   │   ├── skeleton/                # Loading states
│   │   ├── interaction/             # Touch & gesture
│   │   ├── overlays/                # Dialogs & palettes
│   │   ├── domain/                  # Feature-specific
│   │   │   ├── work/
│   │   │   ├── agents/
│   │   │   ├── mail/
│   │   │   ├── queue/
│   │   │   ├── activity/
│   │   │   └── shared/
│   │   └── index.ts
│   │
│   ├── stores/
│   │   ├── core/                    # Infrastructure
│   │   ├── domains/                 # Business entities
│   │   └── index.ts
│   │
│   ├── server/
│   │   ├── auth/                    # Server-side auth
│   │   ├── cli/                     # CLI execution
│   │   ├── cache/
│   │   ├── watch/
│   │   ├── data/
│   │   └── index.ts
│   │
│   ├── client/
│   │   ├── auth/                    # Client-side auth
│   │   └── index.ts
│   │
│   ├── contracts/                   # NEW: Source-of-truth alignment
│   │   ├── bead.ts                  # Bead contracts from gastown
│   │   ├── mail.ts                  # Mail contracts
│   │   ├── polecat.ts               # Polecat contracts
│   │   ├── refinery.ts              # MR contracts
│   │   ├── convoy.ts                # Convoy contracts
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── format/
│   │   │   ├── date.ts
│   │   │   ├── status.ts            # Status derivation logic
│   │   │   ├── priority.ts          # Priority conversion
│   │   │   ├── address.ts           # Address normalization
│   │   │   └── index.ts
│   │   ├── keyboard/
│   │   ├── interaction/
│   │   ├── core/
│   │   └── index.ts
│   │
│   ├── types/
│   │   ├── gastown/
│   │   │   ├── storage.ts           # Storage types (what gastown stores)
│   │   │   ├── display.ts           # Display types (UI derived)
│   │   │   ├── schemas/
│   │   │   └── index.ts
│   │   └── index.ts
│   │
│   ├── pwa/
│   ├── api/
│   ├── errors/
│   ├── actions/
│   ├── config/
│   └── index.ts
│
├── routes/
│   ├── (app)/                       # Main app
│   ├── (auth)/                      # Auth routes
│   ├── api/                         # API routes
│   └── +error.svelte
│
├── styles/
│   ├── tokens.css
│   ├── base.css
│   ├── components.css
│   ├── animations.css
│   ├── utilities.css
│   └── index.css
│
└── tests/
    ├── fixtures/
    │   ├── gastown/                 # Fixtures from gastown repo
    │   │   ├── bd-list-output.json
    │   │   ├── gt-status-output.json
    │   │   └── ...
    │   └── ...
    ├── contracts/                   # Contract tests
    ├── mocks/
    └── helpers/
```

**Key Addition**: `src/lib/contracts/` directory for source-of-truth alignment.

---

## 9-14. [Component, Store, Route, Server, CSS, Test Reorganization]

*(Same as v2, not repeated for brevity)*

---

## 15. Import Migration Guide

### Contract-Related Imports (NEW)

```typescript
// Storage types (what gastown stores)
import type { BdBeadStorageStatus } from '$lib/types/gastown/storage';

// Display types (UI derived)
import type { BdBeadDisplayStatus } from '$lib/types/gastown/display';

// Derivation utilities
import { deriveDisplayStatus } from '$lib/utils/format/status';

// Priority conversion
import { beadPriorityToMail } from '$lib/utils/format/priority';

// Address normalization
import { normalizeAddress } from '$lib/utils/format/address';

// Contracts (source of truth)
import { BeadContract, validateBead } from '$lib/contracts/bead';
```

---

## 16. Implementation Phases

### Phase 0: Contract Alignment (Week 0 - CRITICAL)

**Must complete before any other work.**

| Task | Files | Effort |
|------|-------|--------|
| Fix BdBeadStatus type | 5 files | 2h |
| Add status derivation | 3 files | 4h |
| Fix polecat states | 8 files | 4h |
| Add priority conversion | 2 files | 2h |
| Add address normalization | 2 files | 2h |
| Update all 28 `in_progress` references | 28 files | 8h |
| Add contract tests | 10 files | 8h |

**Acceptance Criteria**:
- [ ] All types match gastown source of truth
- [ ] Contract tests pass against gastown fixtures
- [ ] No invented status values in codebase

---

### Phase 1: Security Fixes (Week 1)

| Task | Effort |
|------|--------|
| Replace shell exec with spawn | 4h |
| Add auth guards | 8h |
| Fix timer leaks | 2h |
| Fix event listener leaks | 1h |

---

### Phase 2: Failure Mode Handling (Week 2)

| Task | Effort |
|------|--------|
| CLI availability checks | 4h |
| Network partition handling | 4h |
| Corruption detection | 2h |
| Timeout improvements | 2h |

---

### Phase 3-5: Reorganization (Weeks 3-5)

*(Same as v2)*

---

## Final Verification Checklist

### Contract Alignment
- [ ] All types match gastown source of truth
- [ ] Storage vs display status separated
- [ ] Priority formats handled correctly
- [ ] Address normalization implemented
- [ ] CLI output parsing handles arrays

### Failure Modes
- [ ] CLI unavailability handled gracefully
- [ ] Network partition recovery works
- [ ] Timeout strategy implemented
- [ ] Memory pressure handled

### Structure
- [ ] No directory >20 files
- [ ] No path >3 levels deep
- [ ] Route groups preserve URLs

### Quality
- [ ] TypeScript strict mode passes
- [ ] Contract tests pass
- [ ] ≥80% test coverage
- [ ] Bundle size unchanged (±5%)

### Security
- [ ] Zero shell injection vectors
- [ ] Auth on all protected routes
- [ ] No server code in client bundles

### Performance
- [ ] Memory stable over 1 hour
- [ ] Lighthouse scores maintained
- [ ] Tree-shaking effective

---

## Appendix A: Gastown Contract Reference

### Bead Status (internal/beads/beads.go)
```go
Status: "open" | "closed"
// "hooked" = pinned to hook (display only)
// "tombstone" = deleted
```

### Polecat State (internal/polecat/types.go)
```go
State: "working" | "done" | "stuck"
// NO "idle" state exists
```

### MR Status (internal/refinery/types.go)
```go
MRStatus: "open" | "in_progress" | "closed"
CloseReason: "merged" | "rejected" | "conflict" | "superseded"
```

### Mail Priority (internal/mail/types.go)
```go
Priority: "low" | "normal" | "high" | "urgent"
```

### Bead Priority (internal/beads/beads.go)
```go
Priority: 0 | 1 | 2 | 3 | 4  // int
// 0=urgent, 1=high, 2=normal, 3=low, 4=backlog
```

---

*Document Version: 3.0 (Stress-Tested)*
*Created: 2026-01-21*
*Source of Truth: gastown @ /Users/amrit/Documents/Projects/Rust/mouchak/gastown*

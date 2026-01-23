# Gas Town Contract Model

This document describes the data contracts between Gas Town (backend) and the UI. Understanding these contracts is essential for correctly displaying status, handling conversions, and avoiding common pitfalls.

## Core Principle: Storage vs Display

Gas Town follows a minimal storage model. Complex statuses are **derived at display time**, not stored.

| Layer | Status Values | Stored? | Source |
|-------|---------------|---------|--------|
| **Storage** | `'open' \| 'closed'` | Yes | beads.db, API responses |
| **Display** | `'open' \| 'in_progress' \| 'blocked' \| 'hooked' \| 'closed'` | No | Derived from context |

**Why?** Storage simplicity. The database stores the minimum necessary state. The UI computes display status by combining storage status with contextual signals (assignee, MR status, blocking dependencies).

---

## Status Derivation

### Bead Display Status

**Source:** `src/lib/utils/status.ts` - `deriveDisplayStatus()`

```
Input: BeadStatusContext
  - status: 'open' | 'closed'
  - hook_bead?: boolean
  - blocked_by_count?: number
  - assignee?: string

Output: BdBeadDisplayStatus
  - 'open' | 'in_progress' | 'blocked' | 'hooked' | 'closed'
```

**Derivation Rules (in precedence order):**

```typescript
1. status === 'closed' -> 'closed'
2. hook_bead === true  -> 'hooked'
3. blocked_by_count > 0 -> 'blocked'
4. has assignee OR mrStatus === 'in_progress' -> 'in_progress'
5. default -> 'open'
```

**Example:**
```typescript
import { deriveDisplayStatus } from '$lib/utils/status';

// Bead from API (storage status)
const bead = {
  id: 'bd-123',
  status: 'open',           // Storage status
  assignee: 'furiosa',
  blocked_by_count: 0
};

// Derive for display
const displayStatus = deriveDisplayStatus(bead);
// Result: 'in_progress' (because assignee is set)
```

### Convoy Work Status

**Source:** `src/lib/utils/format/convoy.ts` - `deriveConvoyWorkStatus()`

Convoys store `'open' | 'closed'` but display a work status derived from their tracked issues.

```
Input: DeriveConvoyStatusInput
  - trackedIssues: TrackedIssue[]
  - updatedAt: string (ISO timestamp)
  - stalenessThresholdHours?: number (default: 24)

Output: ConvoyWorkStatus
  - 'active' | 'stale' | 'stuck' | 'waiting' | 'complete'
```

**Derivation Rules (in precedence order):**

```typescript
1. trackedIssues.length === 0 -> 'waiting'
2. all issues closed -> 'complete'
3. any issue has isStuck === true -> 'stuck'
4. any issue has assignee -> 'active'
5. hours since update > threshold -> 'stale'
6. default -> 'active'
```

**Example:**
```typescript
import { deriveConvoyWorkStatus } from '$lib/utils/format';

const convoy = {
  trackedIssues: [
    { id: 'bd-1', status: 'open', assignee: 'nux' },
    { id: 'bd-2', status: 'closed' }
  ],
  updatedAt: new Date().toISOString()
};

const workStatus = deriveConvoyWorkStatus(convoy);
// Result: 'active' (has an assignee)
```

---

## Polecat State Machine

**CRITICAL:** Polecats have NO idle state. They are ephemeral workers.

```
+------------+       +-----------+       +-------+
|  (spawned) | ----> |  working  | ----> | done  | ----> (nuked)
+------------+       +-----------+       +-------+
                           |
                           v
                       +-------+
                       | stuck | ----> (needs help)
                       +-------+
```

**Source:** `src/lib/types/gastown.ts` - `PolecatState`

| State | Description | Lifecycle |
|-------|-------------|-----------|
| `working` | Actively processing assigned work | Normal operation |
| `done` | Completed work, cleaning up | Transient, before nuke |
| `stuck` | Cannot proceed, needs help | Blocked until resolved |

**There is NO `idle` state.** Polecats don't wait for work. They:
1. Spawn with work assigned
2. Process the work
3. Complete and get destroyed

**Display Status Mapping:**

```typescript
// In UI, we show:
type AgentDisplayStatus = 'running' | 'completing' | 'stuck' | 'exited';

// Mapping from PolecatState:
// 'working' -> 'running'
// 'done'    -> 'completing'
// 'stuck'   -> 'stuck'
// (no session) -> 'exited'
```

**Common Pitfall:** Old code may reference `'idle'` state. This is deprecated. Remove any idle handling and use the three-state model.

---

## Priority Conversion

**Source:** `src/lib/utils/format/priority.ts`

Gas Town has two priority systems that must be converted:

| System | Type | Values | Usage |
|--------|------|--------|-------|
| **Bead** | `number` | `0-4` | Issues, tasks, work items |
| **Mail** | `string` | `'urgent' \| 'high' \| 'normal' \| 'low'` | Messages |

### Bead-to-Mail Mapping

```typescript
const BEAD_TO_MAIL: Record<BeadPriority, MailPriority> = {
  0: 'urgent',
  1: 'high',
  2: 'normal',
  3: 'low',
  4: 'low'  // Note: P4 maps to 'low' (no 'backlog' in mail)
};
```

### Mail-to-Bead Mapping

```typescript
const MAIL_TO_BEAD: Record<MailPriority, BeadPriority> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3
};
```

### Display Formats

```typescript
const PRIORITY_DISPLAY: Record<BeadPriority, string> = {
  0: 'P0 Urgent',
  1: 'P1 High',
  2: 'P2 Normal',
  3: 'P3 Low',
  4: 'P4 Backlog'
};
```

**Usage:**

```typescript
import {
  beadPriorityToMail,
  mailPriorityToBead,
  formatPriorityDisplay,
  isValidBeadPriority
} from '$lib/utils/format';

// Convert for mail
const mailPriority = beadPriorityToMail(1); // 'high'

// Convert from mail
const beadPriority = mailPriorityToBead('urgent'); // 0

// Display
const display = formatPriorityDisplay(2); // 'P2 Normal'

// Validate before conversion
if (isValidBeadPriority(value)) {
  const priority = beadPriorityToMail(value);
}
```

---

## Address Normalization

**Source:** `src/lib/utils/format/address.ts`

Implements Postel's Law: "Be liberal in what you accept, conservative in what you send."

### Address Types

| Type | Format | Example |
|------|--------|---------|
| **Overseer** | `overseer` | `overseer` |
| **Town-level agent** | `{agent}/` | `mayor/`, `witness/`, `deacon/` |
| **Rig polecat** | `{rig}/{polecat}` | `gastownui/furiosa` |
| **Rig crew** | `{rig}/{member}` | `gastownui/amrit` |

### Normalization Rules

```typescript
// Town-level agents get trailing slash
normalizeAddress('mayor')  -> 'mayor/'
normalizeAddress('witness') -> 'witness/'

// Polecats: strip intermediate path segment
normalizeAddress('gastownui/polecats/furiosa') -> 'gastownui/furiosa'

// Crew: strip intermediate path segment
normalizeAddress('gastownui/crew/amrit') -> 'gastownui/amrit'

// Overseer: no trailing slash
normalizeAddress('overseer/') -> 'overseer'
normalizeAddress('overseer')  -> 'overseer'

// Trailing slashes on non-town-level addresses: strip
normalizeAddress('gastownui/furiosa/') -> 'gastownui/furiosa'
```

### Display Format

```typescript
// formatDisplayAddress extracts the final segment
formatDisplayAddress('gastownui/polecats/furiosa') -> 'furiosa'
formatDisplayAddress('mayor/')                      -> 'mayor'
formatDisplayAddress('gastownui/amrit')             -> 'amrit'
```

---

## MR (Merge Request) Status

**Source:** `src/lib/utils/status.ts`

### Status Lifecycle

```
+------+       +-------------+       +--------+
| open | ----> | in_progress | ----> | closed |
+------+       +-------------+       +--------+
```

| Status | Description |
|--------|-------------|
| `open` | Queued, waiting to be processed |
| `in_progress` | Currently being merged/tested by refinery |
| `closed` | Done (check `close_reason` for outcome) |

### Close Reasons

When status is `closed`, check `close_reason` for why:

| Reason | Description |
|--------|-------------|
| `merged` | Successfully merged to main |
| `rejected` | Rejected by review or tests |
| `conflict` | Could not resolve merge conflicts |
| `superseded` | Replaced by newer MR |

### Failure Types

When an MR fails, `failure_type` indicates what went wrong:

| Type | Description |
|------|-------------|
| `conflict` | Merge conflict |
| `tests_fail` | Test suite failed |
| `build_fail` | Build failed |
| `flaky_test` | Intermittent test failure |
| `push_fail` | Could not push to remote |
| `fetch_fail` | Could not fetch from remote |
| `checkout_fail` | Could not checkout branch |

---

## Label Metadata Extraction

**Source:** `src/lib/utils/format/labels.ts`

Beads use labels for metadata. Labels follow `prefix:value` format.

### Standard Label Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `from:` | Sender address | `from:gastownui/furiosa` |
| `thread:` | Thread ID for mail | `thread:abc123` |
| `msg-type:` | Message type | `msg-type:task` |
| `queue:` | Queue name | `queue:mq` |
| `channel:` | Channel name | `channel:escalations` |
| `gt:merge-request` | Flag: is MR | (no value) |
| `gt:agent` | Flag: is agent work | (no value) |

### Issue Types

```typescript
const GASTOWN_ISSUE_TYPES = [
  'task',
  'bug',
  'feature',
  'epic',
  'merge-request',
  'convoy',
  'agent',
  'gate',
  'message'
] as const;
```

### Usage

```typescript
import {
  extractMetadataFromLabels,
  extractLabelValue,
  hasLabel,
  isValidIssueType
} from '$lib/utils/format';

const labels = ['gt:merge-request', 'from:furiosa', 'queue:mq'];

// Extract all metadata
const metadata = extractMetadataFromLabels(labels);
// { isMergeRequest: true, sender: 'furiosa', queue: 'mq' }

// Check for specific label
const isMR = hasLabel(labels, 'gt:merge-request'); // true

// Extract single value
const sender = extractLabelValue(labels, 'from:'); // 'furiosa'
```

---

## Common Pitfalls

### 1. Treating Storage Status as Display Status

```typescript
// WRONG: Using storage status directly in UI
<Badge>{bead.status}</Badge>  // Shows 'open' when it should show 'in_progress'

// CORRECT: Derive display status
const displayStatus = deriveDisplayStatus(bead);
<Badge>{displayStatus}</Badge>
```

### 2. Expecting Idle Polecats

```typescript
// WRONG: Checking for idle state
if (polecat.state === 'idle') {
  assignWork(polecat);  // This will never execute
}

// CORRECT: Polecats are spawned with work
// There is no idle pool. Spawn creates a polecat with work assigned.
```

### 3. Hardcoding Priority Conversions

```typescript
// WRONG: Inline conversion
const mailPriority = priority === 0 ? 'urgent' : priority === 1 ? 'high' : 'normal';

// CORRECT: Use conversion functions
import { beadPriorityToMail } from '$lib/utils/format';
const mailPriority = beadPriorityToMail(priority);
```

### 4. Displaying Raw Addresses

```typescript
// WRONG: Showing full path
<span>{mail.from}</span>  // Shows 'gastownui/polecats/furiosa'

// CORRECT: Format for display
import { formatDisplayAddress } from '$lib/utils/format';
<span>{formatDisplayAddress(mail.from)}</span>  // Shows 'furiosa'
```

### 5. Not Normalizing Input Addresses

```typescript
// WRONG: Using address as-is
const target = userInput;

// CORRECT: Normalize first
import { normalizeAddress } from '$lib/utils/format';
const target = normalizeAddress(userInput);
```

---

## Type Reference

### Storage Types (from API)

```typescript
type BdBeadStorageStatus = 'open' | 'closed';
type ConvoyStorageStatus = 'open' | 'closed';
type GtMergeQueueStatus = 'open' | 'in_progress' | 'closed';
type PolecatState = 'working' | 'done' | 'stuck';
```

### Display Types (derived)

```typescript
type BdBeadDisplayStatus = 'open' | 'in_progress' | 'blocked' | 'hooked' | 'closed';
type ConvoyWorkStatus = 'active' | 'stale' | 'stuck' | 'waiting' | 'complete';
type AgentDisplayStatus = 'running' | 'completing' | 'stuck' | 'exited';
```

### Value Types

```typescript
type BeadPriority = 0 | 1 | 2 | 3 | 4;
type MailPriority = 'urgent' | 'high' | 'normal' | 'low';
type GastownIssueType = 'task' | 'bug' | 'feature' | 'epic' | 'merge-request' | 'convoy' | 'agent' | 'gate' | 'message';
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/types/gastown.ts` | Type definitions for all Gas Town entities |
| `src/lib/utils/status.ts` | Status derivation and configuration |
| `src/lib/utils/format/priority.ts` | Priority conversion utilities |
| `src/lib/utils/format/address.ts` | Address normalization utilities |
| `src/lib/utils/format/convoy.ts` | Convoy work status derivation |
| `src/lib/utils/format/labels.ts` | Label metadata extraction |
| `src/lib/utils/format/index.ts` | Barrel export for all format utilities |

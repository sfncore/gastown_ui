# INTEGRATION_PLAN Phase 1 — Surgical Patch (Top 5 Improvements)
> **Generated**: 2026-01-11  
> **Applies to**: Your current **Gas Town UI - Backend Integration Plan (v3.0)**  
> **Scope**: **Phase 1 first** (CLI Bridge hardening + UX wins), minimal accretive edits  
> **Note**: Per your rule, do a snapshot copy *before* rewriting the current plan file.

---

## How to apply

1) **Snapshot the current plan file** (choose the correct filename you use in-repo):
```bash
# pick the real filename in your repo (examples)
cp INTEGRATION_PLAN.md INTEGRATION_PLAN_V3_SNAPSHOT_2026-01-11.md
# or
cp INTEGRATION_PLAN_V3.md INTEGRATION_PLAN_V3_SNAPSHOT_2026-01-11.md
```

2) Apply the patch below to the **current plan file** (again: choose your real filename):
```bash
git apply INTEGRATION_PLAN_PHASE1_TOP5.patch
```

If you don’t want to create a separate `.patch` file, you can copy the diff block into one and apply it.

---

## Patch (git-diff style)

> Replace `INTEGRATION_PLAN.md` below with the actual filename you keep this plan in.

```diff
diff --git a/INTEGRATION_PLAN.md b/INTEGRATION_PLAN.md
index 1111111..2222222 100644
--- a/INTEGRATION_PLAN.md
+++ b/INTEGRATION_PLAN.md
@@
-# Gas Town UI - Backend Integration Plan
+# Gas Town UI - Backend Integration Plan
@@
-> **Document Version**: 3.0
+> **Document Version**: 4.0
 > **Created**: 2026-01-11
-> **Last Updated**: 2026-01-11
+> **Last Updated**: 2026-01-11
 > **Status**: Planning Phase
 > **Priority**: Visualization-first (read-only dashboard to replace CLI)
 > **Architecture Style**: CLI Bridge (Phase 1) → Go Daemon API (Phase 2+)
@@
 ## Executive Summary
@@
 ### Core Principles
@@
 7. **Accessible**: WCAG 2.2 AA compliance for inclusive access
+8. **No-Shell Execution**: All CLI invocations are arg-array based (spawn/execFile), never shell strings
+9. **CLI Drift-Tolerant**: Explicit capability probing + contracts prevent breakage when upstream output changes
@@
 ## Architecture Overview
@@
 ### Target State (Phase 1 MVP)
@@
-│                                 └─────────┬──────────┘          │
-│                                           │                      │
-│                                           ▼                      │
-│                                 ┌────────────────────┐          │
-│                                 │  .beads/ + SQLite  │          │
-│                                 └────────────────────┘          │
+│                                 └─────────┬──────────┘          │
+│                                           │                      │
+│                                           ▼                      │
+│                                 ┌────────────────────────────┐  │
+│                                 │ Local Data Sources         │  │
+│                                 │ - .beads/ + beads.db       │  │
+│                                 │ - .events.jsonl (tail)     │  │
+│                                 └────────────────────────────┘  │
+│                                           ▲                      │
+│                                           │                      │
+│                                 ┌────────────────────────────┐  │
+│                                 │ Watchers + WS Broadcaster  │  │
+│                                 │ (Phase 1 “Real-time enough”)│ │
+│                                 └────────────────────────────┘  │
@@
 ## Decision Log
@@
 ### D0.4 — Safe Write Operations Definition
@@
 | `gt rig delete` | No | Destructive, needs confirmation |
+
+### D0.5 — Process Supervisor: No Shell, Concurrency Limits, Cancellation (Phase 1)
+**Decision**: Replace shell-string `exec()` with a process supervisor that runs `gt/bd` using `spawn/execFile` with arg arrays, enforces global concurrency limits, supports cancellation, and captures streaming stderr/stdout.
+
+**Rationale**:
+- Eliminates shell-injection class of bugs and “sanitization deletes characters” issues
+- Prevents the UI from self-DOSing the machine under polling
+- Unlocks progress + better error UX for long-running ops (rig add, doctor)
+
+**Trade-offs**:
+- Slightly more code up-front, but much lower operational risk
+
+### D0.6 — Capabilities Probe + CLI Contracts (Phase 1)
+**Decision**: On boot, probe CLI capabilities (versions, flags, JSON support) and use per-command contracts (Zod + fallbacks) so UI degrades gracefully on output drift.
+
+### D0.7 — Watch-First Updates (Phase 1)
+**Decision**: Prefer file/event watchers + WS push (tail `.events.jsonl`, watch `.beads/`) for responsiveness; keep polling as fallback/SWR refresh.
+
+### D0.8 — Power-User Ergonomics Bundle (Phase 1)
+**Decision**: Add Command Palette (⌘K), “Copy CLI equivalent” everywhere, and global search across agents/beads/convoys/mail.
+
+### D0.9 — LLM-Friendly Docs Surface (Phase 1)
+**Decision**: Add `llms.txt` + `llms-full.txt` for Gas Town UI, generated from docs in CI and served as static files.
@@
 ## Phase 1: MVP (CLI Bridge)
@@
 ### Scope
 - **Visualization only** (read-only dashboard)
@@
-- 5-second polling refresh (with visibility detection)
+- SWR polling refresh (visibility aware) + watchers/WS push when possible
 - Demo authentication (UI-only)
 - No backend modifications
 - **Non-blocking UI for all operations**
+
+### Phase 1 Hardening Targets (Top 5 - Phase 1 slice)
+1) **Process Supervisor** (no shell, concurrency limits, cancel, streaming)
+2) **Capabilities Probe + Contracts** (drift-tolerant CLI bridge)
+3) **Watch-first updates** (tail `.events.jsonl`, watch `.beads/`, push over WS; polling fallback)
+4) **Power-user ergonomics** (⌘K palette, global search, copy CLI)
+5) **LLM-friendly docs** (`/llms.txt` and `/llms-full.txt`)
@@
 ### Features
@@
 | Work Items | `bd list --type=task --json` | P0 | Missing | CUJ-2 |
+| Snapshot Endpoint | composite | P0 | Missing | CUJ-4 |
+| Operation Center | (new) | P1 | Missing | CUJ-1/2/3 |
+| Command Palette | (new) | P1 | Missing | All |
+| Copy CLI Equivalent | (new) | P1 | Missing | All |
+| Global Search | (new) | P1 | Missing | All |
+| llms.txt surfaces | (new) | P2 | Missing | Docs |
@@
 ### Server Route Implementation
@@
 src/routes/api/gastown/
@@
 ├── dashboard/
 │   └── +server.ts             NEW - composite endpoint
+├── snapshot/
+│   └── +server.ts             NEW - coherent snapshot (status+queue+mail counts+convoy summary)
+├── capabilities/
+│   └── +server.ts             NEW - CLI capability probe (versions, flags, JSON support)
 └── health/
     └── +server.ts             NEW - gt doctor --json
@@
 ### Polling Strategy
@@
-// Visibility-aware polling with jitter
+// Visibility-aware SWR polling with jitter + in-flight de-dupe
 class PollingManager {
@@
   constructor() {
@@
   }
@@
-  refreshAll() { /* Force refresh all endpoints */ }
+  refreshAll() { /* Force refresh all endpoints (SWR: keep stale data until new arrives) */ }
 }
+
+### Watch-First Updates (Phase 1 “Real-time enough”)
+Prefer push updates when local data changes, and use polling only as fallback:
+- Tail `.events.jsonl` → append to activity feed immediately
+- Watch `.beads/` for changes → invalidate cache keys and trigger background refresh
+- Broadcast updates via existing WS plumbing (or minimal WS server if needed)
@@
 ## Long-Running Operations
@@
 ### Solution: Non-Blocking Async Pattern
@@
 class AsyncOperationManager {
@@
-    this.#executeWithTimeout(id, executor, options.timeout ?? 180000);
+    this.#executeWithTimeout(id, executor, options.timeout ?? 180000);
@@
 }
@@
+### Operation Center (UI)
+In addition to toasts, provide a dedicated panel (or drawer):
+- Running ops (rig add / doctor / formula run / create bead / sling)
+- Live logs (streaming stderr/stdout when available)
+- Elapsed time + timeout budget
+- Cancel / retry (when safe)
+- “Copy debug bundle”
@@
 ## CLI Wrapper & Caching
@@
-### Unified CLI Executor
+### Process Supervisor (Replace shell `exec`)
+**Rule**: Never run `gt`/`bd` via shell strings. Always pass `command + argv[]`.
+Add:
+- Global concurrency limiter (e.g., max 2–4 processes)
+- Request coalescing (same command key joins in-flight promise)
+- Cancellation (SIGTERM → SIGKILL)
+- Streaming logs for long ops
+
+### Unified CLI Executor (spawn/execFile, no shell)
@@
-// src/lib/server/cli-executor.ts
-
-import { exec } from 'child_process';
-import { promisify } from 'util';
+// src/lib/server/cli-executor.ts
+
+import { spawn } from 'child_process';
 import { config } from '$lib/config/environment';
 import { identifyKnownBug } from '$lib/errors/known-bugs';
-
-const execAsync = promisify(exec);
@@
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
@@
-async function execCLI<T>(
-  command: string,
-  options: ExecOptions = {}
-): Promise<CLIResult<T>> {
+async function execCLI<T>(
+  command: string,
+  argv: string[],
+  options: ExecOptions = {}
+): Promise<CLIResult<T>> {
@@
-  const cacheKey = `${cwd}:${command}`;
+  const cacheKey = `${cwd}:${command} ${argv.join(' ')}`;
@@
-  try {
-    const { stdout, stderr } = await execAsync(command, {
-      timeout,
-      cwd,
-      maxBuffer: 10 * 1024 * 1024,
-    });
+  try {
+    const start = Date.now();
+    const child = spawn(command, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
+    let stdout = '';
+    let stderr = '';
+
+    const killTimer = setTimeout(() => {
+      child.kill('SIGTERM');
+      setTimeout(() => child.kill('SIGKILL'), 2000);
+    }, timeout);
+
+    child.stdout.on('data', (d) => { stdout += String(d); });
+    child.stderr.on('data', (d) => { stderr += String(d); });
+
+    const exitCode: number = await new Promise((resolve, reject) => {
+      child.on('error', reject);
+      child.on('close', (code) => resolve(code ?? 0));
+    });
+
+    clearTimeout(killTimer);
+    const duration = Date.now() - start;
+    if (exitCode !== 0) {
+      const knownBug = identifyKnownBug(stderr);
+      return {
+        success: false,
+        cached: false,
+        duration,
+        error: {
+          code: knownBug ? 'KNOWN_BUG' : 'CLI_ERROR',
+          message: knownBug?.userMessage ?? `Command failed (exit ${exitCode})`,
+          stderr: stderr.slice(0, 1000),
+          exitCode,
+        },
+      };
+    }
@@
-    return {
-      success: true,
-      data,
-      cached: false,
-      duration: Date.now() - startTime,
-    };
-  } catch (error: unknown) {
-    const execError = error as { code?: number; stderr?: string; message?: string };
-    const stderr = execError.stderr ?? '';
-    const knownBug = identifyKnownBug(stderr);
-
-    return {
-      success: false,
-      cached: false,
-      duration: Date.now() - startTime,
-      error: {
-        code: knownBug ? 'KNOWN_BUG' : 'CLI_ERROR',
-        message: knownBug?.userMessage ?? execError.message ?? 'Command failed',
-        stderr: stderr.slice(0, 1000),
-        exitCode: execError.code,
-      },
-    };
-  }
+    return { success: true, data, cached: false, duration };
+  } catch (e: unknown) {
+    const err = e as { message?: string };
+    return {
+      success: false,
+      cached: false,
+      duration: Date.now() - startTime,
+      error: { code: 'CLI_ERROR', message: err.message ?? 'Command failed' },
+    };
+  }
 }
@@
 ## Security Hardening
@@
 ### Input Sanitization
@@
-export function sanitizeForCLI(input: string): string {
-  return input
-    .replace(/[;&|`$(){}[\]<>\\'"]/g, '')
-    .replace(/\n|\r/g, ' ')
-    .trim()
-    .slice(0, 1000);
-}
+// NOTE: Prefer arg-array execution over “deleting characters” sanitization.
+// Validate inputs strictly (Zod) and pass as argv[].
+// Only sanitize for *display/logging* to avoid leaking secrets or confusing UI.
+export function sanitizeForDisplay(input: string): string {
+  return input.replace(/\s+/g, ' ').trim().slice(0, 1000);
+}
@@
 ## Testing Strategy
@@
-#### Testing
-- [ ] MSW handlers for all endpoints
-- [ ] Component tests with mock data
-- [ ] E2E tests for CUJ-1 (Rig Management)
-- [ ] E2E tests for CUJ-2 (Work Lifecycle)
-- [ ] E2E tests for CUJ-3 (Orchestration)
-- [ ] E2E tests for CUJ-4 (Monitoring)
-- [ ] E2E tests for CUJ-5 (Mail)
-- [ ] Contract tests for CLI output schemas
-- [ ] Accessibility tests with axe-core
-- [ ] Performance tests for bundle size
+#### Testing (Aligned with current repo posture: no Playwright)
+- [ ] MSW handlers for all endpoints
+- [ ] Component tests with mock data
+- [ ] Contract tests for CLI output schemas (golden fixtures + capability profiles)
+- [ ] Smoke runner script (headless) for CUJ happy paths in local dev
+- [ ] Accessibility tests with axe-core
+- [ ] Performance tests for bundle size
@@
 #### Documentation
 - [ ] Update README with setup instructions
 - [ ] Document environment variables
 - [ ] Document operational requirements
 - [ ] Create troubleshooting guide
+- [ ] Add `static/llms.txt` + `static/llms-full.txt` (generated in CI)
+- [ ] Document “Copy CLI equivalent” and Command Palette usage
@@
 ## Integration Gap Analysis
@@
 | UI Feature | Required Data | CLI Command | Gap | Severity | Resolution |
@@
 | Health check | Doctor results | `gt doctor --json` | Partial JSON | Medium | Parse mixed output |
 | Formulas | Formula list | `gt formula list` | No JSON | Low | Parse text output |
@@
+### New Gap: CLI Output Drift
+**Problem**: Upstream `gt/bd` output can change across versions and break parsing.
+**Resolution**:
+- Capabilities probe (versions + flag support)
+- Per-command contract validation (Zod) with fallbacks
+- “Contract mismatch” error surfaces clear guidance and does not crash the app
@@
 ## Appendix: CLI Command Reference
@@
 ### Feed Commands
@@
 gt feed --json                # Activity feed
 gt feed --limit=50            # Limited items
+
+---
+
+## Appendix: LLM-Friendly Docs (Phase 1)
+Serve these static files (and keep them current via CI generation):
+- `/llms.txt` — concise index of docs and entry points
+- `/llms-full.txt` — full concatenation of architecture + API + troubleshooting
+
+Recommended contents for `llms.txt`:
+- Project overview and goals
+- Phase 1 architecture (CLI bridge + process supervisor)
+- Endpoint index + response types
+- Known bugs registry + suggested actions
+- “How to reproduce” + “How to debug bundle”
```

---

## What changed (summary for humans)

- **Phase 1 now explicitly hardens CLI execution**: no shell, concurrency limits, cancellation, streaming → fewer hangs + better security.
- Adds **capabilities probe + contracts** so CLI output drift doesn’t break the UI.
- Adds **watch-first updates** (tail `.events.jsonl`, watch `.beads/`) for near-real-time UX without waiting for Phase 3.
- Adds **power-user ergonomics** (⌘K palette, global search, copy CLI) to win adoption.
- Adds **`llms.txt` + `llms-full.txt`** for LLM-friendly docs and smoother contributor onboarding.
- Adjusts testing to match current repo posture (**no Playwright**) while keeping strong coverage via contracts + components + smoke runner.

---

## Suggested new/updated files (implementation guidance, not required for the doc patch)

- `src/lib/server/process-supervisor.ts` (concurrency + cancel + streaming)
- `src/lib/server/cli-executor.ts` (reworked to use supervisor)
- `src/routes/api/gastown/capabilities/+server.ts`
- `src/routes/api/gastown/snapshot/+server.ts`
- `src/lib/server/watchers/events-tailer.ts`
- `src/lib/server/watchers/beads-watcher.ts`
- `static/llms.txt`
- `static/llms-full.txt`
- `src/lib/components/CommandPalette.svelte`
- `src/lib/stores/search-index.ts`


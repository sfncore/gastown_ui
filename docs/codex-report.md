# Codex Report - Gastown UI Code Exploration, Fixes, and Reorganization Plan

Date: 2026-01-XX
Workspace: /Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp-stage/gastown_ui

## Scope of Exploration
- Traced data flow for Work Items:
  - UI: `src/routes/work/+page.svelte`
  - Server load: `src/routes/work/+page.server.ts`
  - API: `src/routes/api/gastown/work/+server.ts`, `src/routes/api/gastown/work/issues/+server.ts`, `src/routes/api/gastown/work/sling/+server.ts`
  - Components: `src/lib/components/WorkItemCard.svelte`, `src/lib/components/WorkItemDetail.svelte`
  - Store: `src/lib/stores/work.svelte.ts`
- Cross-checked architectural alignment with:
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/gastown-ui-architecture-final.md`
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/gastown-ui-layouts.md`
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/gastown-arch.md`
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/docs/INTEGRATION_PLAN.md`

## Key Findings and Fixes Applied

1) Data contract mismatch: `/api/gastown/work` vs client store
- Problem:
  - API returned `issueType` while `WorkStore` expects `type`.
  - Status values from beads (`closed`, `hooked`) did not align with UI statuses (`done`, `in_progress`).
- Fix:
  - Normalized API response shape to `type`.
  - Added status mapping and priority clamping for safety.
- Files:
  - `src/routes/api/gastown/work/+server.ts`
  - `src/routes/api/gastown/__tests__/work.test.ts`

2) Work page server load using shell exec + raw bd list fields
- Problem:
  - `+page.server.ts` used `exec` shell strings (against Integration Plan's "no-shell execution").
  - Returned raw bead fields (`issue_type`, `created_at`) and limited results to open-only,
    breaking filters and UI display.
- Fix:
  - Switched to Process Supervisor (`getProcessSupervisor`) with arg arrays.
  - Mapped bead fields to UI-consumable shape and normalized status/type.
  - Removed open-only restriction to allow status filters to work.
- Files:
  - `src/routes/work/+page.server.ts`

3) Client/API payload and response mismatches on Work page
- Problem:
  - `/api/gastown/work/sling` expects `{ beadId, agentId }` but UI sent `{ issue, rig }`.
  - Create-issue handler assumed top-level `id` instead of `{ data: ... }`.
  - Newly created issues were appended without normalization.
- Fix:
  - Adjusted payload to `{ beadId, agentId }`.
  - Hardened response parsing; normalize created issue before appending.
- Files:
  - `src/routes/work/+page.svelte`

## Alignment with Architecture & Integration Plan
- Adopted Process Supervisor usage for CLI calls (INTEGRATION_PLAN: "No-Shell Execution").
- Kept UI data shape consistent with WorkItem components to preserve industrial control-room UX
  specified in `gastown-ui-layouts.md`.
- Normalized status semantics to reduce UI ambiguity, aligning with the "observable and
  trustworthy" UX goal in `INTEGRATION_PLAN.md`.

## Residual Risks / Open Questions
- `WorkStore.fetchItem()` points to `/api/gastown/work/{id}` which does not exist.
  Consider adding a dedicated endpoint or removing the unused method.
- Work item detail panel is present but not explicitly opened from the list view. If intended
  behavior is to open the slide-out panel, wiring may be needed.

## Files Changed (Summary)
- `src/routes/api/gastown/work/+server.ts`
- `src/routes/api/gastown/__tests__/work.test.ts`
- `src/routes/work/+page.server.ts`
- `src/routes/work/+page.svelte`
- `codex-report.md`

## Tests
- `bun run test:unit -- src/routes/api/gastown/__tests__/work.test.ts`

## Codebase Reorganization Assessment
- Completed a full scan of all 318 files under `src/` with import extraction and line counts.
- Reviewed architecture and layout references in:
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/docs/gastown-ui-architecture-final.md`
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/docs/gastown-ui-layouts.md`
  - `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/docs/INTEGRATION_PLAN.md`

## Proposed Code File Reorganization Plan

### Goals and Constraints
- Make structure intuitive by domain and responsibility (API vs UI vs data vs utilities).
- Avoid deep nesting (prefer 1–2 levels below `src/lib` or `src/routes`).
- Keep SvelteKit routing semantics intact (use route groups to reorganize without URL changes).
- Minimize churn by starting with low-risk, "no-brainer" moves.
- Keep import paths consistent and predictable (primarily via `$lib/...` and re-export indexes).

### Current Structure Summary (from full `src/` scan)
- 318 files under `src/`.
- Large files likely candidates for splitting:
  - `src/routes/work/+page.svelte` (~1050 lines)
  - `src/app.css` (~1021 lines)
  - `src/lib/components/command-palette/CommandPalette.svelte` (~795 lines)
  - `src/routes/seance/+page.svelte` (~773 lines)
  - `src/routes/workflows/+page.svelte` (~699 lines)
  - `src/lib/types/gastown.schema.ts` (~643 lines)
  - `src/lib/utils/keyboard-vim.ts` (~630 lines)

### Proposed High-Level Structure (Minimal Depth)

```
src/
  lib/
    components/
      core/                # Button, Input, Switch, Badge, Icon, etc.
      layout/              # Layout shells and page scaffolds
      feedback/            # Error/Empty/Toast/Skeleton/Status/Indicators
      navigation/          # Sidebar, BottomNav, SheetNav, SkipLink, PageHeader
      interaction/         # PullToRefresh, SwipeableItem, TouchTarget, FAB
      overlays/            # CommandPalette, GlobalSearch, dialogs
      domain/              # Domain-specific cards/detail panels
        work/
        agents/
        mail/
        queue/
        convoys/
        workflows/
    stores/
      core/                # swr, polling, network, sync, websocket, sse, theme, toast
      domains/             # work, mail, agents, convoys, rigs, queue, operations
    api/
      client/              # client.ts, types.ts
      realtime/            # handlers.ts, activity-stream.ts
    server/
      cli/                 # process supervisor, capabilities, validation, tests
      cache/               # swr cache, tests
      watch/               # watchers, cache-events, events-tailer, tests
      operations/          # operations-store.ts
      workflows/           # workflows-store.ts
      rate-limit.ts
      auth/                # server-side auth helpers
    utils/
      keyboard/            # keyboard.ts, keyboard-vim.ts
      format/              # date.ts, status.ts, id-extraction.ts
      interaction/         # haptics.ts, gestures.ts, clipboard.ts
      logger.ts
    types/
      gastown/             # gastown.ts, gastown.schema.ts
      index.ts
    styles/                # touch-targets.css (if used)
    test/                  # contract-helper.ts, fixtures (or move to src/tests)
  routes/
    (app)/
      +layout.svelte       # main app layout
      +page.svelte         # dashboard
      +page.server.ts
      work/
      agents/
      mail/
      queue/
      convoys/
      workflows/
      rigs/
      logs/
      activity/
      health/
      watchdog/
      seance/
      stats/
      issues/
      escalations/
      dogs/
      crew/
      settings/
    (auth)/
      login/
      login/mobile/
    (api)/
      api/
        gastown/
          (core)/status/
          (core)/snapshot/
          (core)/health/
          (core)/diagnostics/
          (core)/capabilities/
          agents/
          rigs/
          work/
          convoys/
          workflows/
          queue/
          mail/
          operations/
          escalations/
        auth/
          login/
          logout/
          me/
          refresh/
  styles/
    index.css
    focus.css
    skip-link.css
```

Notes:
- Route groups `(app)`, `(auth)`, `(api)` keep URLs identical but isolate concerns.
- Components and stores are grouped by responsibility with only 1 extra directory level.
- Domain UI components go under `lib/components/domain/*` to keep feature UI together.

### No-Brainer Changes (Low Risk, High Clarity)
1) Route groups for organization:
   - Move all UI routes under `src/routes/(app)/`.
   - Move login routes under `src/routes/(auth)/`.
   - Move API routes under `src/routes/(api)/api/...` and organize with group folders.
   - URLs remain unchanged, so this is a structural-only improvement.

2) Component categorization:
   - Split `src/lib/components` into category folders.
   - Keep `src/lib/components/index.ts` re-exporting from new paths.

3) Store separation:
   - Split `src/lib/stores` into `core` and `domains` subfolders.
   - Keep `src/lib/stores/index.ts` as a stable public surface.

4) Move `src/lib/server/watchers/events-tailer.ts` into `src/lib/server/watch/`.
5) Consolidate `src/lib/test` with `src/tests` or vice versa (one source of fixtures).

### Component Reorganization Details

Core UI (`src/lib/components/core/`):
- `Button.svelte`, `Input.svelte`, `Switch.svelte`, `Badge.svelte`, `StatusBadge.svelte`,
  `StatusIndicator.svelte`, `Icon.svelte`, `CircularProgress.svelte`, `ProgressBar.svelte`,
  `ShimmerText.svelte`

Layout (`src/lib/components/layout/`):
- `DashboardLayout.svelte`, `QueueLayout.svelte`, `WorkflowLayout.svelte`,
  `AgentDetailLayout.svelte`, `LogsLayout.svelte`, `SplitView.svelte`, `Dashboard.svelte`

Feedback (`src/lib/components/feedback/`):
- `ErrorBoundary.svelte`, `ErrorState.svelte`, `EmptyState.svelte`,
  `Toast.svelte`, `ToastContainer.svelte`,
  `OfflineIndicator.svelte`, `ConnectionLost.svelte`, `DegradedModeBanner.svelte`,
  `Skeleton*`

Navigation (`src/lib/components/navigation/`):
- `Sidebar.svelte`, `BottomNav.svelte`, `SheetNav.svelte`, `PageHeader.svelte`,
  `SkipLink.svelte`, `NavigationLoader.svelte`

Interaction (`src/lib/components/interaction/`):
- `PullToRefresh.svelte`, `SwipeableItem.svelte`, `FloatingActionButton.svelte`, `TouchTarget.svelte`

Overlays (`src/lib/components/overlays/`):
- `command-palette/*`, `global-search/*`, `KeyboardHelpDialog.svelte`, `UpdatePrompt.svelte`

Domain (`src/lib/components/domain/`):
- `work/WorkItemCard.svelte`, `work/WorkItemDetail.svelte`, `work/IssueTypeSelector.svelte`
- `agents/AgentCard.svelte`, `agents/AgentCardSkeleton.svelte`
- `mail/UnreadDot.svelte`
- `queue/OperationCenter.svelte`, `queue/StatusCards.svelte`

### Store Reorganization Details

Core (`src/lib/stores/core/`):
- `swr.ts`, `polling.svelte.ts`, `network.svelte.ts`, `sync.svelte.ts`,
  `websocket.svelte.ts`, `sse.svelte.ts`, `cache-sync.ts`, `theme.svelte.ts`,
  `toast.svelte.ts`, `search-index.svelte.ts`

Domains (`src/lib/stores/domains/`):
- `work.svelte.ts`, `mail.svelte.ts`, `agents.svelte.ts`, `convoys.svelte.ts`,
  `rigs.svelte.ts`, `queue.svelte.ts`, `operations.svelte.ts`

### API and Server Structure

`src/lib/api`:
- `api/client/` for `client.ts` + `types.ts`
- `api/realtime/` for `handlers.ts`, `activity-stream.ts`

`src/lib/server`:
- Move `watchers/events-tailer.ts` into `watch/`.
- Move `operations-store.ts` into `operations/`.
- Move `workflows-store.ts` into `workflows/`.

### Types and Schemas

Move to:
- `src/lib/types/gastown/index.ts`
- `src/lib/types/index.ts` (root barrel)

### Tests and Fixtures

Consolidate:
- `src/lib/test/fixtures` and `src/tests/fixtures` -> `src/tests/fixtures`
- Keep helpers under `src/tests/helpers/` (or keep `src/lib/test`, choose one)

### Styles

Split `src/app.css` into:
- `src/styles/tokens.css`
- `src/styles/base.css`
- `src/styles/components.css`
- `src/styles/animations.css`
- `src/styles/utilities.css`

### Large File Refactor Candidates

1) `src/routes/work/+page.svelte`
   - Split into `WorkFilters.svelte`, `WorkList.svelte`,
     `WorkCreateIssueForm.svelte`, `WorkConvoyForm.svelte`, `WorkSlingForm.svelte`

2) `src/app.css`
   - Split into the style files above.

3) `src/lib/components/command-palette/CommandPalette.svelte`
   - Extract data and list item rendering into smaller files.

4) `src/routes/workflows/+page.svelte`, `src/routes/seance/+page.svelte`
   - Extract filters + list + detail sections into components.

5) `src/lib/utils/keyboard-vim.ts`
   - Split bindings and parser into `src/lib/utils/keyboard/`.

### Consolidation Opportunities
- Merge `src/lib/test/index.ts` + `src/lib/test/contract-helper.ts` into a single helper module.
- Group PWA utilities: `src/lib/serviceWorker.ts`, `src/lib/sw.ts`, `src/service-worker.ts`
  under `src/lib/pwa/` (if we keep them separate).

### Required Import and Call-Site Updates

- Update `$lib/components/...` imports after category moves.
- Update `src/lib/components/index.ts` re-exports.
- Update `$lib/stores/...` imports after splitting `core` and `domains`.
- Update `src/lib/stores/index.ts` re-exports.
- Update server helper imports after moves:
  - `$lib/server/watchers/events-tailer` -> `$lib/server/watch/events-tailer`
  - `$lib/server/operations-store` -> `$lib/server/operations/operations-store`
  - `$lib/server/workflows-store` -> `$lib/server/workflows/workflows-store`
- Update fixture imports if tests are consolidated.
- Update CSS imports if `app.css` is split.

### Migration Plan (Safe, Incremental)
1) Create route groups `(app)`, `(auth)`, `(api)` and move route folders.
2) Move components into category folders; update `index.ts` re-exports.
3) Move stores into `core/` and `domains/`; update `index.ts` re-exports.
4) Move server submodules; update imports.
5) Consolidate tests/fixtures.
6) Split CSS and update imports.
7) Run `rg` to update `$lib/...` imports and verify with `bun run check`.

### Why This Structure Is Optimal
- Mirrors the mental model of the UI: domain features, shared UI, and infra.
- Keeps file paths discoverable (two levels max).
- Route groups allow logical organization without breaking URLs.
- Large files become modular, easier to test, and safer to change.
- New contributors can answer “where does X live?” with minimal context.

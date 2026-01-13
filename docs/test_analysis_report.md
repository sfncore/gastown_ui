# Test Analysis Report: PR #212 (Gas Town GUI)

## 1. Overview
The extracted test file (`gui/test-ui-flow.cjs`) is a **Puppeteer-based E2E test suite** designed to validate the core "Critical User Journeys" (CUJs) of the Gas Town system. It focuses on the "Happy Path" for managing Rigs and Work Items, with specific handling for long-running operations (async/toast-based).

**Key Scope:**
- **Rig Management**: Adding a repository (handling long git clone times).
- **Work Management**: Creating issues (Beads).
- **Orchestration**: Assigning work (Slinging) to agents.
- **Feedback Loop**: Verifying UI updates via Toasts and DOM changes.

## 2. Detailed Test Flow & Assertions

The test executes a single linear scenario with the following 14 steps:

### Phase A: Rig Creation (Steps 1-6)
- **Action**: Navigate to `http://localhost:5555` -> Click "Rigs" -> Click "Add Rig".
- **Input**:
  - Name: `zoo-game`
  - URL: `https://github.com/web3dev1337/zoo-game`
- **Assertions**:
  - **Immediate**: Modal closes instantly (non-blocking UI check).
  - **Feedback**: Toast "Adding rig" appears immediately.
  - **Async Success**: Toast "added successfully" appears within **150 seconds** (Critical: accounts for `git clone`).
  - **State**: "zoo-game" text appears in the rig list after refresh.

### Phase B: Work Item Creation (Steps 7-10)
- **Action**: Navigate to "Work" -> Click "New Work Item".
- **Input**:
  - Title: "Analyze zoo-game code quality"
  - Priority: "high"
  - Labels: "analysis, code-quality"
- **Assertions**:
  - **Feedback**: Toast "Creating work item" -> "Work item created".
  - **Data Extraction**: regex matches `([a-z]+-[a-z0-9]+)` in toast to capture the new **Bead ID** (e.g., `hq-abc`).

### Phase C: Orchestration / Slinging (Steps 11-13)
- **Action**: Click "Sling" button.
- **Input**:
  - Bead ID: (Extracted from Phase B)
  - Target: Selects `zoo-game/witness` (or first available).
- **Assertions**:
  - **Pre-check**: Validates target dropdown is populated.
  - **Feedback**: Toast "Slinging" -> "Work slung".
  - **Error Handling**: Explicitly catches known CLI bug (`mol bond` daemon issue) as a "soft fail" or expected error, proving robust test design.

## 3. Replication Strategy for Gastown UI (SvelteKit)

To replicate this in `gastown_exp` (SvelteKit), we must adapt the logic to the modern stack.

### Mapping Components
| PR (Vanilla JS) | Gastown UI (SvelteKit) | Selector Strategy |
|-----------------|------------------------|-------------------|
| `#new-rig-btn` | `<Button>` on `/rigs` | Use `data-testid="add-rig-btn"` or accessible name |
| `#rig-name`, `#rig-url` | `<Input>` components | Use `name="name"`, `name="url"` |
| `.toast` text content | `$lib/components/Toast.svelte` | Target `role="status"` or `.toast-viewport` |
| `select[name="target"]` | `<Select>` / `<Combobox>` | Shadcn Select requires clicking trigger first |

### Critical "Wiring" Differences

1.  **Async/Optimistic UI**:
    -   **PR**: Relies on WebSocket events to trigger UI refreshes (`ws.on('rig_added')`).
    -   **Our Project**: Uses Svelte runes/stores (`$lib/stores/websocket.svelte.ts`).
    -   **Replication**: The test must wait for the **Store** to update, not just the DOM. In E2E, this still means waiting for text to appear, but internal integration tests could verify the store state directly.

2.  **Authentication/Context**:
    -   **PR**: No auth, local only.
    -   **Our Project**: Has `HttpOnly` auth cookies.
    -   **Replication**: Test runner needs to inject a valid session cookie or mock the auth state.

3.  **Long-Running Operations**:
    -   **Observation**: The PR test waits **150s** for rig creation.
    -   **Our Project**: Should likely implement a "Pending" state in the UI that transitions to "Active" via WebSocket, rather than blocking the user. The test should verify this transition.

### Recommended Test Plan (Manual/Chrome Tools)

Since `gastown_exp` policies currently **forbid Playwright**, use this checklist for "Claude in Chrome" verification sessions:

1.  **Rig Add Check**:
    -   [ ] Go to `/rigs`.
    -   [ ] Add Rig `zoo-game`.
    -   [ ] **Verify**: Toast appears immediately? UI doesn't freeze?
    -   [ ] **Verify**: After ~90s, does "zoo-game" appear in the list without manual refresh? (Tests WebSocket).

2.  **Bead Lifecycle**:
    -   [ ] Go to `/work`.
    -   [ ] Create Bead.
    -   [ ] **Verify**: Bead ID returned in toast.
    -   [ ] **Verify**: Bead appears at top of list.

3.  **Sling Flow**:
    -   [ ] Click Sling on the new Bead.
    -   [ ] **Verify**: Target dropdown loads targets dynamically from backend?
    -   [ ] **Verify**: Success toast confirms command sent.

## 4. Key Takeaways from PR #212
- **Toast-Driven Testing**: The test relies heavily on toast messages as the "API" for success/failure. We should ensure our Toasts in SvelteKit provide clear, unique messages for machine readability.
- **ID Extraction**: The test dynamically captures the created Item ID to use in the next step. Our UI should make this ID easily copyable/accessible (e.g., `data-bead-id` attribute).
- **Graceful Error Handling**: The test acknowledges CLI limitations. Our UI should surface these CLI errors (like the `mol bond` daemon issue) clearly to the user, perhaps parsing the raw stderr.

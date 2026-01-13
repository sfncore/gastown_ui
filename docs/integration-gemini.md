# Gastown UI <-> Backend Integration Plan

**Date:** 11 Jan 2026
**Agent:** Gemini

## 1. Executive Summary
The current Gastown UI operates in a hybrid state:
- **Data Loading:** Uses server-side shell commands (`gt status --json`) to fetch initial state.
- **Real-time Updates:** Has a robust WebSocket handler (`handlers.ts`) pre-wired for specific events, but likely unconnected to a live backend.
- **Actions:** User actions (e.g., "Reboot Agent") are currently unimplemented (`TODO`s in code).
- **API Client:** A full-featured `apiClient` exists (`src/lib/api/client.ts`) but is currently **unused**.

**Goal:** Transition from a CLI-wrapper architecture to a proper Client-Server architecture using REST and WebSockets.

---

## 2. Current Architecture vs. Target Architecture

### Current State ("CLI Wrapper")
- **Read Path:** `+page.server.ts` executes `gt status --json`, parses stdout, and passes data to the frontend.
- **Write Path:** Non-existent (TODOs).
- **Real-time:** `RealtimeHandlers` class exists but relies on `VITE_WS_URL` which is likely not serving data matching the `gt` CLI output structure.

### Target State ("API Integration")
- **Read Path:** Frontend calls `GET /api/status` (or similar) via `apiClient`.
- **Write Path:** Frontend calls `POST /api/agents/:id/reboot` via `apiClient`.
- **Real-time:** Backend pushes updates via WebSocket to `ws://.../ws`, matching the `AgentStatusPayload` types.

---

## 3. The Integration Gap

### A. Missing REST Endpoints (Demand Side)
The UI implies the need for the following endpoints based on `handlers.ts` and `+page.svelte`:

| Method | Endpoint | Purpose | Current Implementation |
|--------|----------|---------|------------------------|
| `GET` | `/status` or `/agents` | Initial load of agents/rigs | `gt status --json` (CLI) |
| `POST` | `/agents/:id/reboot` | Reboot an agent | `// TODO: Implement reboot` |
| `GET` | `/agents/:id` | Inspect specific agent details | N/A (Relies on initial load?) |

### B. WebSocket Events (Demand Side)
The `src/lib/api/handlers.ts` expects the following event types:
1. `agent_status`: `{ agentId, status, currentTask }`
2. `log_entry`: `{ agentId, level, message, timestamp }`
3. `queue_update`: `{ action, queueId, item? }`
4. `workflow_update`: `{ workflowId, status, step? }`

### C. Backend Unknowns
- Does the `gastown` backend (Rust) expose an HTTP server?
- Does it support WebSockets?
- Does it have CORS configured for the UI's development port?

---

## 4. Implementation Steps

### Step 1: Backend Verification (Requires User Action)
1.  Check if `gt` CLI has a "server mode" (e.g., `gt serve` or `gt daemon`).
2.  Verify if `../gastown` contains a web server implementation (e.g., `axum`, `actix-web`, `warp`).
3.  If no server exists, one must be created to expose `gt` functionality via HTTP.

### Step 2: Wire Up Actions (Frontend)
Modify `src/routes/agents/+page.svelte` to use `apiClient`.

**Current:**
```typescript
function handleReboot(_agentId: string) {
    // TODO: Implement reboot API call
}
```

**Proposed Change:**
```typescript
import { apiClient } from '$lib/api';

async function handleReboot(agentId: string) {
    try {
        await apiClient.post(`/agents/${agentId}/reboot`);
        toastStore.success('Agent rebooting...');
    } catch (e) {
        toastStore.error('Failed to reboot agent');
    }
}
```

### Step 3: Transition Data Loading (Frontend/Backend)
1.  **Interim:** Keep `gt status --json` in `+page.server.ts` but map it strictly to the `Agent` type.
2.  **Final:** Replace `execAsync` in `+page.server.ts` with `apiClient.get('/status')` once the backend server is ready.

### Step 4: Validate WebSocket Connection
1.  Ensure `VITE_WS_URL` in `.env` points to the running backend.
2.  Monitor `src/lib/stores/websocket.svelte` logs to confirm connection.

---

## 5. "Ultrathink" Recommendations

1.  **Develop against a Mock:** Since the backend access is restricted/unknown, create a simple standard Node.js/Bun script (`mock-server.ts`) that:
    - Serves `GET /agents` (returning data shaped like `gt status --json`).
    - Accepts `POST /agents/:id/reboot`.
    - Broadcasts random `agent_status` WS events.
    *This allows UI development to finish completely without waiting for the Rust backend.*

2.  **Contract Testing:** Define the JSON schema for `Agent` and `LogEntry` strictly. The `gt` CLI output and the API response must match.

3.  **Authentication:** The `apiClient` supports CSRF and Bearer tokens. Determine which one the Rust backend will use. The current `client.ts` defaults to checking cookies for CSRF.

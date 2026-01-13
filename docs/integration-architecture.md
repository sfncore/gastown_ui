# Gastown UI Integration: Update Strategy, API Surface, and Auth Path

## Context and goals
- Single-user today, visualization-first (replace CLI for visibility, not control).
- Must run on same machine now, but should be deployable in Docker and scale to other machines later.
- Demo/no-auth acceptable now; needs a clear path to RBAC + OAuth SSO later.
- Prefer backend API (REST/WS/SSE) if feasible; CLI-only fallback is possible but limiting.

## Sub-second updates vs polling (tradeoffs)

### Sub-second updates (WebSocket or SSE)
**Pros**
- Near-real-time UI (sub-second), better for live status/visualization.
- Push model reduces client work and server compute for unchanged data.
- Good for streams: events, activity feed, agent state.

**Cons**
- More backend complexity: connection lifecycle, keepalives, fanout, backpressure.
- Harder to scale on single-node without limits; needs connection limits and drop policy.
- Requires structured events and delta payloads; must handle reconnection and replay.
- Requires a live process; tricky if backend is just CLI invocation.

### Polling (HTTP GET at interval)
**Pros**
- Dead simple to implement and debug.
- Works with any backend (even CLI-only) and cached responses.
- No long-lived connections; easier through proxies and Docker.

**Cons**
- Wastes CPU and I/O; clients hammer for unchanged data.
- Latency = polling interval; sub-second polling can be expensive.
- Can overload backend as number of clients grows.

### Suggested hybrid
- Use polling for low-frequency panels (rigs list, workflows list).
- Use SSE (or WS) for activity feed and status updates.
- If backend is CLI-only, start with polling and migrate to SSE later.

## WebSocket/REST in Go backend: feasible and recommended
**Yes**, we can add REST and WS/SSE to the Go code.
- Go `net/http` makes REST straightforward.
- WebSocket support can be added via `nhooyr.io/websocket` or `gorilla/websocket`.
- SSE can be implemented with plain `net/http` and streaming.

## CLI-only interface: fallback and limitations
You *can* stay CLI-only and wrap `gt`/`bd` from SvelteKit, but:
- It locks you to the local machine and local filesystem.
- Hard to deploy in Docker or scale to other machines cleanly.
- Hard to add proper auth and RBAC.

Recommendation: build a small Go API server now, even if it just wraps existing CLI and file reads initially.

## Visualization-first scope (no control yet)
Focus on read-only endpoints first:
- Status, agents, rigs
- Activity and logs
- Mail inbox
- Convoys and issues (read-only)
- Workflows list/details

Control actions (create issue, sling, convoy create) can come later.

## Deployment topology

### Phase 1: Single machine (local)
- Run Go API server on localhost (e.g., `127.0.0.1:4170`).
- SvelteKit BFF can proxy to it or call directly from browser.
- Keep demo auth in SvelteKit or bypass auth for now.

### Phase 2: Docker / remote
- Run Go API server in a container.
- Expose HTTP endpoints on a stable port.
- SvelteKit front-end uses env-configured base URL.

## Auth strategy: demo now, RBAC + SSO later

### Demo/no-auth now
- Keep endpoints open or use a static shared token.
- Fast to build and demo.

### Extend to OAuth SSO later
- Add middleware in Go API for JWT validation.
- Add RBAC claims (`roles`, `teams`, `rigs`) in token.
- SvelteKit can keep its auth routes, or use direct OAuth flow with the API.

**Tradeoff summary**
- Demo/no-auth: fast, zero friction, but unsafe in multi-user deployments.
- OAuth + RBAC: more complexity, but required for multi-user and remote access.

## Proposed API surface (read-only first)
- `GET /api/v1/status`
- `GET /api/v1/agents`
- `GET /api/v1/rigs`
- `GET /api/v1/convoys`
- `GET /api/v1/issues?status=open`
- `GET /api/v1/mail`
- `GET /api/v1/workflows/formulas`
- `GET /api/v1/workflows/formulas/{name}`
- `GET /api/v1/workflows/molecules`
- `GET /api/v1/activity`
- `GET /api/v1/logs`

Optional streaming:
- `GET /api/v1/stream/activity` (SSE)
- `GET /api/v1/stream/status` (SSE)

## How to implement streaming updates (options)

### Option A: SSE (recommended for now)
- Simple to implement.
- One-way server -> client is enough for visualization.
- Easy reconnect; can send heartbeat and event IDs.

### Option B: WebSocket
- Two-way communication (good for control later).
- More complex connection management.
- Better if you plan to add control commands soon.

## Suggested plan (visualization-first)
1. Add Go API server with read-only REST endpoints.
2. Map endpoints to internal packages (avoid shelling out where possible).
3. Provide a minimal activity stream (SSE), even if it just tails `.events.jsonl`.
4. Update UI API routes to call Go API (keep SvelteKit as BFF initially).
5. Add base URL config and remove hardcoded paths.
6. Add auth later (JWT validation + RBAC), then optional WS for control.

## Open questions (need your choice)
1. Do you want SSE now, or stick with polling until the API is stable?
2. Should SvelteKit remain a BFF (server routes) or should the UI call Go API directly?
3. Should the Go API server be started by `gt` (e.g., `gt api`) or run as a standalone service?

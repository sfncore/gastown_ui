# Gastown UI <-> Backend Integration Report

## Scope and sources
- UI repo: `gastown_exp` (SvelteKit)
- Backend repo: `../gastown` (Go CLI + minimal web dashboard)
- Architecture notes: `/Users/amrit/Documents/Projects/Rust/mouchak/gt-ui-bkp/gastown-arch.md` (read in chunks with offsets)

## Current UI data access (what the UI actually uses today)
The UI is not wired to a networked backend. It uses local exec and filesystem reads via SvelteKit server routes:

- API routes call CLI commands directly
  - `gt status --json` -> `/api/gastown/status`
  - `gt rigs --json` -> `/api/gastown/rigs`
  - `gt convoy create ...` -> `/api/gastown/work/convoys`
  - `gt sling ...` -> `/api/gastown/work/sling`
  - `bd list ...` -> `/api/gastown/work/issues`, `/api/gastown/convoys`, `/api/gastown/mail`, escalations
  - `bd formula ...` and `bd mol ...` -> `/api/gastown/workflows/*`
- Server pages read local files directly
  - `.events.jsonl` for activity/logs
  - `~/gt/boot/status.json` for watchdog
- Hardcoded local paths
  - Several routes use absolute paths like `/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp` and `~/.events.jsonl`
- Authentication is mock and local
  - `/api/auth/*` is a demo JWT mock; no real backend auth

This is a local BFF style, but it is tied to the workstation and assumes the CLI and .beads files are available locally.

## Backend capabilities (gastown repo)
- No JSON REST API server exists for the data the UI needs.
- `internal/web` only serves an HTML convoy dashboard for `gt dashboard` (non-JSON).
- Backend data lives in files (beads JSONL, sqlite, .events.jsonl) and is accessed via CLI or internal Go packages.

## Core gap analysis (what is missing to wire UI to backend)
1. **No API surface for the UI**
   - UI expects `/api/gastown/*` endpoints. Backend exposes no JSON endpoints for status, agents, issues, mail, workflows, logs, etc.
2. **Local-only data access**
   - UI relies on local `bd`/`gt` CLI and local filesystem state; cannot run against a remote backend.
3. **Hardcoded paths and machine-specific assumptions**
   - Absolute paths and local file reads prevent deployment or multi-user access.
4. **Authentication is mock-only**
   - No real auth or session validation between UI and backend.
5. **No streaming or push updates**
   - UI is polling/refreshing with ad-hoc fetch; backend does not provide SSE/WS for events.
6. **Missing API contracts**
   - There is no shared schema for issues, agents, workflows, convoys, logs.

## Recommended integration architecture (keep current style, with a stronger alternative)

### Option A (minimal change, keep current architecture)
**Keep SvelteKit as BFF**, but replace local CLI execution with HTTP calls to a new Go API server in `gastown`.
- SvelteKit stays the place for session handling, CSRF, and BFF logic.
- `src/routes/api/gastown/*` becomes a proxy/adapter to the Go API instead of `exec`.

### Option B (better long-term)
**Create a real Gastown API server (Go)** and have the UI call it directly.
- SvelteKit UI becomes a pure frontend; no local CLI use.
- Add versioned JSON endpoints in `gastown` (e.g., `/api/v1/...`).
- Introduce proper auth and token verification in Go.

Recommendation: Option B if this is going beyond local-only use. Option A if you need a quick step without disrupting the current SvelteKit security layer.

## Proposed API contract (minimum viable to support current UI)
These endpoints map to existing UI needs and existing CLI capabilities:

- `GET /api/v1/status`
  - currently: `gt status --json`
- `GET /api/v1/rigs`
  - currently: `gt rigs --json`
- `GET /api/v1/agents`
  - derived from status payload; can be server-side mapping
- `GET /api/v1/issues?status=open`
  - currently: `bd list --status=open --json`
- `POST /api/v1/issues`
  - currently: `bd create ... --json`
- `GET /api/v1/convoys`
  - currently: `bd list --type=convoy --status=open --json`
- `POST /api/v1/convoys`
  - currently: `gt convoy create ...`
- `POST /api/v1/sling`
  - currently: `gt sling ...`
- `GET /api/v1/mail`
  - currently: `bd list --type=message --status=open --json`
- `GET /api/v1/workflows/formulas`
  - currently: `bd formula list --json`
- `GET /api/v1/workflows/formulas/{name}`
  - currently: `bd formula show {name} --json`
- `POST /api/v1/workflows/cook`
  - currently: `bd cook ... --json`
- `POST /api/v1/workflows/pour`
  - currently: `bd mol pour ... --json`
- `GET /api/v1/workflows/molecules`
  - currently: `bd mol stale --json`, `bd mol wisp list --json`, `bd list --type=epic --status=in_progress --json`
- `GET /api/v1/events` and `GET /api/v1/logs`
  - currently: read `.events.jsonl`

## Concrete wiring steps (order)
1. **Decide runtime topology**
   - Same host (localhost) or remote? Choose ports and base URL.
2. **Define API contract**
   - Document request/response schemas for each endpoint above (even if they mirror CLI output).
3. **Implement Go API server in `gastown`**
   - Add a new package (e.g., `internal/api`) with handlers and JSON responses.
   - Reuse existing internal packages where possible instead of shelling out to `bd`.
   - Start server from a new `gt api` command or add to `gt dashboard` command.
4. **Auth plan**
   - Either start with no auth for local-only, or implement token auth (static token, or integrate with existing session model).
   - Update SvelteKit auth routes accordingly.
5. **Update SvelteKit API routes**
   - Replace `exec` and local filesystem access with `fetch` to the new API server.
   - Remove hardcoded absolute paths.
   - Centralize base URL via env (e.g., `VITE_GASTOWN_API_BASE_URL`).
6. **Normalize models**
   - Create shared TypeScript interfaces for API payloads and use in UI.
   - Optionally mirror Go structs with JSON tags.
7. **Add error and empty states**
   - Most pages already have patterns; ensure backend errors are surfaced.
8. **Add minimal integration tests**
   - API unit tests in Go (handlers).
   - SvelteKit route tests or Playwright smoke for key flows.

## Additional missing pieces and risks
- Hardcoded paths will break in any other environment.
- Exec-based commands block server threads; need timeouts and concurrency control.
- Current UI expects derived fields (agent uptime, efficiency) that are mocked.
- CSRF handling in SvelteKit will not apply if UI calls backend directly from the browser.
- CORS and cookie domain handling are undefined if UI and backend are on different origins.

## Questions to resolve before implementation
1. Should the UI talk to a local daemon (same machine) or a remote Gastown backend?
2. Do you want to keep SvelteKit API routes as a BFF, or make the UI call the Go API directly?
3. Is authentication required now, or can we start with local-only and add auth later?
4. Are we OK mirroring CLI output as API responses for v1, or do you want a cleaner schema?
5. Should the new API be bundled into `gt` (new command like `gt api`) or run as a separate service?

## Next step I recommend
- Confirm topology (local vs remote) and BFF vs direct. I can then draft the exact API schema and start wiring one vertical slice (status + agents) end-to-end.

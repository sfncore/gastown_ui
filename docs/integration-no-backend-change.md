# Gastown UI Integration (No Backend Changes)

## Decision
No changes to `gastown` backend. Use only existing CLI commands and local files. SvelteKit remains the BFF and owns all integration logic.

## Implications
- Local‑only by default; the UI requires access to the same machine, filesystem, and `gt`/`bd` binaries.
- Polling is the default update model (aligned with `gt dashboard` htmx polling).
- Authentication remains demo/mock; RBAC/SSO deferred until a real API exists.

## Current integration surface (already in UI)
- CLI exec via SvelteKit API routes:
  - `gt status --json`
  - `gt rigs --json`
  - `gt convoy create ...`
  - `gt sling ...`
  - `bd list ...`
  - `bd formula ...`, `bd mol ...`
- File reads:
  - `.events.jsonl` for activity/logs
  - `~/gt/boot/status.json` for watchdog

## Hardening steps (no backend changes)
1. **Remove hardcoded absolute paths**
   - Use env vars: `GASTOWN_TOWN_ROOT`, `GASTOWN_HOME`, `GASTOWN_BD_CWD`.
   - Default to `process.cwd()` or `process.env.HOME` where applicable.
2. **Centralize CLI execution**
   - Create a shared server utility for `exec` with timeout, cwd, error parsing.
   - Standardize error formats for UI.
3. **Add caching for polling endpoints**
   - 2–5s cache for high-frequency reads to reduce CLI load.
4. **Limit polling frequency**
   - Match `gt dashboard` (10s) for convoys and status; faster polling only for activity if needed.
5. **Tighten input sanitization**
   - Keep sanitizers for `bd create`, `gt convoy create`, `gt sling`.
6. **Document operational requirements**
   - CLI binaries must be in PATH.
   - `.beads` and `.events.jsonl` must exist.

## Known constraints
- No remote access without sharing filesystem and CLI.
- No sub‑second live updates without adding a backend stream.
- Multi-user access and RBAC not possible in this model.

## Future migration path (when backend changes are allowed)
- Replace CLI exec with HTTP calls to a Go API server.
- Introduce JWT auth + RBAC.
- Add SSE for activity/status.

## Next steps (if you want me to implement)
1. Add env-based path config and remove absolute paths.
2. Build a shared server-side CLI wrapper with timeouts/caching.
3. Normalize API responses for status, agents, activity, workflows, mail.

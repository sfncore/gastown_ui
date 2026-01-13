# Gas Town Issue: `role_agents` Configuration Not Implemented

**Date:** 2026-01-13
**Reporter:** Refinery Agent
**Severity:** Medium
**Component:** `internal/config/loader.go`, Agent Managers
**Affects:** All agent services (Deacon, Witness, Refinery, Mayor)

---

## Summary

The `role_agents` field in `TownSettings` exists in the data structure but is **not implemented** in the agent resolution logic. This causes all services to fall back to the default agent (Claude) instead of using role-specific agent assignments.

---

## Current Behavior

When `gt up` or individual agent start commands are run:

1. Services call `ResolveAgentConfig(townRoot, rigPath)`
2. Function checks only:
   - `rigSettings.Runtime` (legacy)
   - `rigSettings.Agent` (rig-level override)
   - `townSettings.DefaultAgent` (town default)
3. **`townSettings.RoleAgents` is never checked**
4. All agents default to Claude

---

## Expected Behavior

When `role_agents` is configured in `settings/config.json`:

```json
{
  "type": "town-settings",
  "version": 1,
  "default_agent": "claude",
  "role_agents": {
    "deacon": "codex",
    "refinery": "gemini",
    "witness": "gemini",
    "mayor": "claude"
  }
}
```

Each service should start with its assigned agent:
- **Deacon** → Codex (`codex --yolo`)
- **Witness** → Gemini (`gemini --approval-mode yolo`)
- **Refinery** → Gemini (`gemini --approval-mode yolo`)
- **Mayor** → Claude (`claude --dangerously-skip-permissions`)

---

## Reproduction Steps

1. Create `gastown_exp/settings/config.json`:
   ```json
   {
     "type": "town-settings",
     "version": 1,
     "default_agent": "claude",
     "agents": {},
     "role_agents": {
       "deacon": "codex",
       "refinery": "gemini",
       "witness": "gemini"
     }
   }
   ```

2. Run `gt up`

3. Check running processes:
   ```bash
   ps aux | grep -E "(codex|gemini|claude)" | grep -v grep
   ```

4. **Observe:** All agents running Claude instead of configured models

---

## Root Cause Analysis

### File: `internal/config/loader.go`

The `ResolveAgentConfig` function does not check `RoleAgents`:

```go
func ResolveAgentConfig(townRoot, rigPath string) *RuntimeConfig {
    // ... loads settings ...

    // Determine which agent name to use
    agentName := ""
    if rigSettings != nil && rigSettings.Agent != "" {
        agentName = rigSettings.Agent           // ← Checks rig agent
    } else if townSettings.DefaultAgent != "" {
        agentName = townSettings.DefaultAgent   // ← Checks town default
    } else {
        agentName = "claude"                    // ← Falls back to claude
    }

    // ❌ NEVER checks townSettings.RoleAgents[role]

    return lookupAgentConfig(agentName, townSettings, rigSettings)
}
```

### File: `internal/config/types.go`

The `RoleAgents` field exists but is unused:

```go
type TownSettings struct {
    Type    string `json:"type"`
    Version int    `json:"version"`

    DefaultAgent string `json:"default_agent,omitempty"`
    Agents map[string]*RuntimeConfig `json:"agents,omitempty"`

    // RoleAgents maps role names to agent aliases for per-role model selection.
    // Keys: "mayor", "deacon", "witness", "refinery", "polecat", "crew"
    // ⚠️ DEFINED BUT NOT IMPLEMENTED
    RoleAgents map[string]string `json:"role_agents,omitempty"`
}
```

---

## Agent Start Command Analysis

| Service | Command | `--agent` Flag | Status |
|---------|---------|----------------|--------|
| **Deacon** | `gt deacon start` | ✅ `--agent string` | Works |
| **Witness** | `gt witness start <rig>` | ✅ `--agent string` | Works |
| **Refinery** | `gt refinery start [rig]` | ❌ Not supported | **Missing** |
| **Mayor** | `gt mayor start` | Needs verification | Unknown |

### Deacon Start (Works)

**File:** `internal/cmd/deacon.go`

```go
var deaconStartCmd = &cobra.Command{
    // ...
}

func init() {
    deaconStartCmd.Flags().StringVar(&deaconAgent, "agent", "",
        "Agent alias to run the Deacon with (overrides town default)")
}
```

### Witness Start (Works)

**File:** `internal/cmd/witness.go`

```go
var witnessStartCmd = &cobra.Command{
    // ...
}

func init() {
    witnessStartCmd.Flags().StringVar(&witnessAgent, "agent", "",
        "Agent alias to run the Witness with (overrides town default)")
}
```

### Refinery Start (Missing `--agent`)

**File:** `internal/cmd/refinery.go`

```go
var refineryStartCmd = &cobra.Command{
    Use:     "start [rig]",
    Aliases: []string{"spawn"},
    Short:   "Start the refinery",
    // ...
}

func init() {
    refineryStartCmd.Flags().BoolVar(&refineryForeground, "foreground", false,
        "Run in foreground (default: background)")
    // ❌ NO --agent flag defined
}
```

---

## Built-in Agent YOLO Flags

From `internal/config/agents_test.go:174-184`:

```go
func TestAgentPresetYOLOFlags(t *testing.T) {
    tests := []struct {
        preset  AgentPreset
        wantArg string
    }{
        {AgentClaude, "--dangerously-skip-permissions"},
        {AgentGemini, "yolo"}, // Part of "--approval-mode yolo"
        {AgentCodex, "--yolo"},
    }
    // ...
}
```

### Full Agent Commands

| Agent | Command | YOLO Flag |
|-------|---------|-----------|
| **Claude** | `claude` | `--dangerously-skip-permissions` |
| **Gemini** | `gemini` | `--approval-mode yolo` |
| **Codex** | `codex` | `--yolo` |
| **Cursor** | `cursor` | TBD |
| **Auggie** | `auggie` | TBD |
| **Amp** | `amp` | TBD |

---

## Proposed Fix

### Step 1: Add Role-Aware Agent Resolution

**File:** `internal/config/loader.go`

```go
// ResolveAgentConfigForRole resolves agent config with role-based lookup.
// Priority order:
//   1. Rig-level RoleAgents[role]
//   2. Town-level RoleAgents[role]
//   3. Rig-level Agent
//   4. Town-level DefaultAgent
//   5. Hardcoded "claude" fallback
func ResolveAgentConfigForRole(townRoot, rigPath, role string) *RuntimeConfig {
    rigSettings, _ := LoadRigSettings(RigSettingsPath(rigPath))
    townSettings, err := LoadOrCreateTownSettings(TownSettingsPath(townRoot))
    if err != nil {
        townSettings = NewTownSettings()
    }

    // Load registries
    _ = LoadAgentRegistry(DefaultAgentRegistryPath(townRoot))
    _ = LoadRigAgentRegistry(RigAgentRegistryPath(rigPath))

    // Priority 1: Rig-level role_agents
    if rigSettings != nil && rigSettings.RoleAgents != nil {
        if agentName, ok := rigSettings.RoleAgents[role]; ok && agentName != "" {
            return lookupAgentConfig(agentName, townSettings, rigSettings)
        }
    }

    // Priority 2: Town-level role_agents
    if townSettings.RoleAgents != nil {
        if agentName, ok := townSettings.RoleAgents[role]; ok && agentName != "" {
            return lookupAgentConfig(agentName, townSettings, rigSettings)
        }
    }

    // Priority 3-5: Fall back to existing logic
    return ResolveAgentConfig(townRoot, rigPath)
}
```

### Step 2: Add RoleAgents to RigSettings

**File:** `internal/config/types.go`

```go
type RigSettings struct {
    Type    string `json:"type"`
    Version int    `json:"version"`

    Agent      string                    `json:"agent,omitempty"`
    Runtime    *RuntimeConfig            `json:"runtime,omitempty"`
    MergeQueue *MergeQueueConfig         `json:"merge_queue,omitempty"`
    Namepool   *NamepoolConfig           `json:"namepool,omitempty"`

    // RoleAgents allows per-rig role-based agent overrides
    // Keys: "witness", "refinery", "polecat", "crew"
    RoleAgents map[string]string `json:"role_agents,omitempty"`  // ← ADD THIS
}
```

### Step 3: Update Refinery Manager

**File:** `internal/refinery/manager.go`

```go
func (m *Manager) Start(foreground bool) error {
    // ... existing code ...

    // Replace:
    // agentCfg := config.ResolveAgentConfig(townRoot, m.rig.Path)

    // With:
    agentCfg := config.ResolveAgentConfigForRole(townRoot, m.rig.Path, "refinery")

    // ... rest of function ...
}
```

### Step 4: Add `--agent` Flag to Refinery Start

**File:** `internal/cmd/refinery.go`

```go
var refineryAgent string

func init() {
    refineryStartCmd.Flags().BoolVar(&refineryForeground, "foreground", false,
        "Run in foreground (default: background)")
    refineryStartCmd.Flags().StringVar(&refineryAgent, "agent", "",
        "Agent alias to run the Refinery with (overrides town/rig settings)")
}

func runRefineryStart(cmd *cobra.Command, args []string) error {
    // ... existing setup ...

    // Pass agent override to manager
    if err := mgr.StartWithAgent(refineryForeground, refineryAgent); err != nil {
        // ...
    }
    // ...
}
```

### Step 5: Update Witness Manager (Similar Pattern)

Ensure witness manager uses `ResolveAgentConfigForRole(townRoot, rigPath, "witness")`.

### Step 6: Update Deacon Manager (Similar Pattern)

Ensure deacon manager uses `ResolveAgentConfigForRole(townRoot, "", "deacon")`.

---

## Workaround (Until Fixed)

### Option A: Start Services Individually

```bash
# Stop everything
gt down

# Start daemon
gt daemon start

# Start with explicit --agent flags (where supported)
gt deacon start --agent codex
gt witness start gastown_ui --agent gemini

# Refinery requires manual tmux session
cd /path/to/gastown_exp/gastown_ui/refinery/rig
tmux new-session -d -s gt-gastown_ui-refinery \
  "export BD_ACTOR=refinery GIT_AUTHOR_NAME=refinery GT_ROLE=refinery && gemini --approval-mode yolo"
```

### Option B: Startup Script

Create `scripts/start-agents.sh`:

```bash
#!/bin/bash
set -e

TOWN_ROOT="${TOWN_ROOT:-/Users/amrit/Documents/Projects/Rust/mouchak/gastown_exp}"
RIG_NAME="${RIG_NAME:-gastown_ui}"

echo "=== Gas Town Agent Startup ==="
echo "Town: $TOWN_ROOT"
echo "Rig: $RIG_NAME"
echo ""

# Stop all services
echo "Stopping all services..."
gt down 2>/dev/null || true

# Start daemon
echo "Starting daemon..."
gt daemon start

# Start Deacon with Codex
echo "Starting Deacon with Codex..."
gt deacon start --agent codex

# Start Witness with Gemini
echo "Starting Witness with Gemini..."
gt witness start "$RIG_NAME" --agent gemini

# Start Refinery with Gemini (manual tmux)
echo "Starting Refinery with Gemini..."
REFINERY_DIR="$TOWN_ROOT/$RIG_NAME/refinery/rig"
if [ -d "$REFINERY_DIR" ]; then
    tmux kill-session -t "gt-${RIG_NAME}-refinery" 2>/dev/null || true
    cd "$REFINERY_DIR"
    tmux new-session -d -s "gt-${RIG_NAME}-refinery" \
      "export BD_ACTOR=refinery GIT_AUTHOR_NAME=refinery GT_ROLE=refinery && gemini --approval-mode yolo"
    echo "  ✓ Refinery started in tmux session"
else
    echo "  ⚠ Refinery directory not found: $REFINERY_DIR"
fi

echo ""
echo "=== Status ==="
gt status

echo ""
echo "=== Running Agents ==="
ps aux | grep -E "(codex|gemini)" | grep -v grep || echo "No codex/gemini processes found"
```

---

## Test Plan

### Unit Tests

Add tests to `internal/config/loader_test.go`:

```go
func TestResolveAgentConfigForRole(t *testing.T) {
    t.Parallel()
    townRoot := t.TempDir()
    rigPath := filepath.Join(townRoot, "testrig")

    // Setup town settings with role_agents
    townSettings := NewTownSettings()
    townSettings.DefaultAgent = "claude"
    townSettings.RoleAgents = map[string]string{
        "deacon":   "codex",
        "witness":  "gemini",
        "refinery": "gemini",
    }
    SaveTownSettings(TownSettingsPath(townRoot), townSettings)
    SaveRigSettings(RigSettingsPath(rigPath), NewRigSettings())

    t.Run("deacon gets codex from role_agents", func(t *testing.T) {
        rc := ResolveAgentConfigForRole(townRoot, rigPath, "deacon")
        if rc.Command != "codex" {
            t.Errorf("expected codex, got %s", rc.Command)
        }
    })

    t.Run("witness gets gemini from role_agents", func(t *testing.T) {
        rc := ResolveAgentConfigForRole(townRoot, rigPath, "witness")
        if rc.Command != "gemini" {
            t.Errorf("expected gemini, got %s", rc.Command)
        }
    })

    t.Run("unknown role falls back to default", func(t *testing.T) {
        rc := ResolveAgentConfigForRole(townRoot, rigPath, "unknown")
        if rc.Command != "claude" {
            t.Errorf("expected claude fallback, got %s", rc.Command)
        }
    })
}
```

### Integration Tests

```go
func TestRoleAgentsE2E(t *testing.T) {
    // 1. Create town with role_agents config
    // 2. Start services via gt up
    // 3. Verify each service runs correct agent
    // 4. Check ps output for correct processes
}
```

### Manual Verification

```bash
# After implementing fix:
gt down
gt up

# Verify processes
ps aux | grep -E "(codex|gemini|claude)" | grep -v grep

# Expected output should show:
# - codex process for deacon
# - gemini --approval-mode yolo for witness
# - gemini --approval-mode yolo for refinery
# - claude --dangerously-skip-permissions for mayor (if default)
```

---

## Files to Modify

| File | Change |
|------|--------|
| `internal/config/loader.go` | Add `ResolveAgentConfigForRole()` function |
| `internal/config/types.go` | Add `RoleAgents` to `RigSettings` struct |
| `internal/config/loader_test.go` | Add tests for role-based resolution |
| `internal/refinery/manager.go` | Use `ResolveAgentConfigForRole()` |
| `internal/cmd/refinery.go` | Add `--agent` flag |
| `internal/witness/manager.go` | Use `ResolveAgentConfigForRole()` |
| `internal/deacon/manager.go` | Use `ResolveAgentConfigForRole()` |

---

## Related Documentation

- [TownSettings struct](../gastown/internal/config/types.go)
- [Agent presets](../gastown/internal/config/agents.go)
- [Refinery manager](../gastown/internal/refinery/manager.go)
- [Polecat lifecycle](../gastown/docs/concepts/polecat-lifecycle.md)

---

## Priority Recommendation

**Medium-High Priority**

This issue affects:
- Cost optimization (using cheaper models for specific roles)
- Model-specific capabilities (Codex for code, Gemini for analysis)
- Organizational preferences for agent assignment

The workaround (manual start with `--agent` flags) is functional but tedious and error-prone.

---

## Assignee Suggestions

- **Primary:** Gas Town core maintainer
- **Reviewer:** Config/settings specialist
- **Testing:** QA with multi-agent experience

---

## Experimental Validation (2026-01-13)

### Test Configuration

Tested with extended agent registry including OpenCode variants:

**`settings/agents.json`:**
```json
{
  "version": 1,
  "agents": {
    "codex-yolo": {
      "command": "codex",
      "args": ["--yolo"]
    },
    "gemini-yolo": {
      "command": "gemini",
      "args": ["--approval-mode", "yolo"]
    },
    "opencode": {
      "command": "opencode",
      "args": [],
      "resume_flag": "--session",
      "resume_style": "flag",
      "non_interactive": {
        "subcommand": "run",
        "output_flag": "--format json"
      }
    },
    "opencode-glm": {
      "command": "opencode",
      "args": ["-m", "opencode/glm-4.7-free"]
    },
    "opencode-codex-extended": {
      "command": "opencode",
      "args": ["-m", "openai/gpt-5.2-pro"]
    },
    "opencode-gemini3-high": {
      "command": "opencode",
      "args": ["-m", "google/gemini-3-pro-high"]
    }
  }
}
```

**`settings/config.json`:**
```json
{
  "type": "town-settings",
  "version": 1,
  "default_agent": "claude",
  "role_agents": {
    "polecat": "amp",
    "deacon": "opencode-gemini3-high",
    "refinery": "opencode-codex-extended",
    "witness": "opencode-glm",
    "mayor": "claude"
  }
}
```

### Agent Registry Verification

`gt config agent list` correctly shows all registered agents:

```
Available Agents

  amp [built-in] amp --dangerously-allow-all --no-ide
  auggie [built-in] auggie --allow-indexing
  claude [built-in] claude --dangerously-skip-permissions
  codex [built-in] codex --yolo
  codex-yolo [built-in] codex --yolo
  gemini [built-in] gemini --approval-mode yolo
  gemini-yolo [built-in] gemini --approval-mode yolo
  opencode [built-in] opencode
  opencode-codex-extended [built-in] opencode -m openai/gpt-5.2-pro
  opencode-gemini3-high [built-in] opencode -m google/gemini-3-pro-high
  opencode-glm [built-in] opencode -m opencode/glm-4.7-free

Default: claude
```

### Individual Agent Testing (tmux)

Each agent was tested individually in tmux sessions:

| Agent | Command | Result |
|-------|---------|--------|
| `amp` | `amp --dangerously-allow-all --no-ide` | ✅ Starts in smart mode |
| `opencode-gemini3-high` | `opencode -m google/gemini-3-pro-high` | ✅ Connects to Antigravity plugin |
| `opencode-codex-extended` | `opencode -m openai/gpt-5.2-pro` | ✅ Works with OpenAI |
| `opencode-glm` | `opencode -m opencode/glm-4.7-free` | ✅ Works with free GLM-4.7 |

### `gt up` Test Results

After running `gt up` with the above configuration:

```bash
$ gt up
✓ Daemon: PID 50466
✓ Deacon: hq-deacon
✓ Mayor: hq-mayor
✓ Witness (gastown_ui): gt-gastown_ui-witness
✓ Refinery (gastown_ui): gt-gastown_ui-refinery

✓ All services running
```

**Actual agents running (captured from tmux sessions):**

| Service | Session | Expected Agent | Actual Agent | Status |
|---------|---------|----------------|--------------|--------|
| Deacon | `hq-deacon` | opencode-gemini3-high | Claude Opus 4.5 | ❌ FAIL |
| Mayor | `hq-mayor` | claude | Claude Opus 4.5 | ✅ PASS |
| Witness | `gt-gastown_ui-witness` | opencode-glm | Claude Opus 4.5 | ❌ FAIL |
| Refinery | `gt-gastown_ui-refinery` | opencode-codex-extended | Claude Opus 4.5 | ❌ FAIL |

### Key Findings

1. **Agent registry works correctly** - `gt config agent list` shows all custom agents
2. **`role_agents` is completely ignored** - All services default to `claude`
3. **Custom agents work when started manually** - tmux tests confirm opencode variants work
4. **The bug is in service startup, not agent resolution** - The config is loaded but never consulted

### tmux Session Evidence

All sessions show Claude banner instead of configured agents:

```
 ▐▛███▜▌   Claude Code v2.1.5
▝▜█████▛▘  Opus 4.5 · Claude Max
```

Expected for deacon would be:
```
█▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█░░█ █░░█ █▀▀▀ █░░█ █░░░ █░░█ █░░█ █▀▀▀
▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀
                    Gemini 3 Pro High (Antigravity)
```

### Additional Agent YOLO Flags Discovered

| Agent | Command | YOLO Flag |
|-------|---------|-----------|
| **Amp** | `amp` | `--dangerously-allow-all --no-ide` |
| **OpenCode** | `opencode` | (none needed - runs in interactive mode) |

### Conclusion

The experiment conclusively proves:
1. `role_agents` configuration is parsed but never used
2. All services fall back to `default_agent` (claude)
3. The fix must be in the service startup code, not config loading
4. Manual `--agent` flags are the only current workaround

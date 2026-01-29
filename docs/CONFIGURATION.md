# Model Configuration System

This document describes the model configuration system for Claude Code agents in the Gas Town UI project.

## Overview

Model configurations are stored in `~/.claude/settings/` as JSON files. Each configuration file defines:
- Environment variables for API endpoints and authentication
- CLI arguments for agent behavior
- Model selection (primary and fast/small variants)
- Custom announcements for the agent

## Configuration Location

```
~/.claude/settings/
└── {model-name}.json
```

**Current configurations:**
- `kimi.json` - Moonshot AI's Kimi K2.5 model

## Configuration Schema

```typescript
interface ModelConfig {
  /** Environment variables for the agent process */
  env: {
    /** Base URL for the Anthropic-compatible API */
    ANTHROPIC_BASE_URL: string;
    /** Authentication token for API access */
    ANTHROPIC_AUTH_TOKEN: string;
    /** Primary model identifier */
    ANTHROPIC_MODEL: string;
    /** Fast/small model identifier (for quick tasks) */
    ANTHROPIC_SMALL_FAST_MODEL: string;
  };

  /** CLI arguments passed to the agent */
  args: string[];

  /** Announcements shown at session start */
  companyAnnouncements: string[];
}
```

## Current Configuration: Kimi K2.5

**File:** `~/.claude/settings/kimi.json`

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.moonshot.ai/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "sk-H52fldDubOi8JbWR8LPdXg3zmKrtdIzqoqn92uVreHvZa6Bk",
    "ANTHROPIC_MODEL": "kimi-k2.5",
    "ANTHROPIC_SMALL_FAST_MODEL": "kimi-k2.5"
  },
  "args": ["--dangerously-skip-permissions"],
  "companyAnnouncements": [
    "Using Moonshot AI's Kimi K2.5 model"
  ]
}
```

### Configuration Details

| Setting | Value | Description |
|---------|-------|-------------|
| `ANTHROPIC_BASE_URL` | `https://api.moonshot.ai/anthropic` | Moonshot AI's Anthropic-compatible API endpoint |
| `ANTHROPIC_MODEL` | `kimi-k2.5` | Primary model for all operations |
| `ANTHROPIC_SMALL_FAST_MODEL` | `kimi-k2.5` | Fast variant (same model in this config) |
| `--dangerously-skip-permissions` | CLI arg | Skips interactive permission prompts |

## Usage

### Selecting a Model Configuration

The model configuration is selected based on the hook or task assignment. When work is assigned:

1. The `gt hook` command identifies the appropriate configuration
2. The settings file is loaded from `~/.claude/settings/{config-name}.json`
3. Environment variables and CLI args are applied to the agent session

### Switching Configurations

To switch between model configurations:

```bash
# Current configuration is active in the session
cat ~/.claude/settings/kimi.json

# To use a different model, create a new config:
cat > ~/.claude/settings/claude-opus.json << 'EOF'
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com",
    "ANTHROPIC_AUTH_TOKEN": "${ANTHROPIC_API_KEY}",
    "ANTHROPIC_MODEL": "claude-opus-4-5-20251101",
    "ANTHROPIC_SMALL_FAST_MODEL": "claude-haiku-20250301"
  },
  "args": [],
  "companyAnnouncements": [
    "Using Anthropic Claude Opus"
  ]
}
EOF
```

## Adding New Model Configurations

To add a new model configuration:

1. Create a new JSON file in `~/.claude/settings/`
2. Follow the schema above
3. Set appropriate environment variables
4. Add any required CLI arguments
5. Include descriptive company announcements

### Example: OpenRouter Configuration

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://openrouter.ai/api/v1",
    "ANTHROPIC_AUTH_TOKEN": "sk-or-v1-...",
    "ANTHROPIC_MODEL": "anthropic/claude-opus-4",
    "ANTHROPIC_SMALL_FAST_MODEL": "anthropic/claude-haiku-3.5"
  },
  "args": [],
  "companyAnnouncements": [
    "Using OpenRouter with Claude models"
  ]
}
```

## Security Considerations

⚠️ **WARNING**: The `--dangerously-skip-permissions` flag allows the agent to execute operations without interactive confirmation. Only use this in trusted environments with:
- Controlled access to the workspace
- Backup systems in place
- Code review workflows

## Environment Variable Precedence

Configuration values are loaded in this order (later overrides earlier):

1. Default system environment
2. `~/.claude/settings/{config}.json` env section
3. Shell environment variables
4. Task-specific overrides from hook system

## Related Documentation

- [AGENTS.md](./AGENTS.md) - Agent instructions and coding patterns
- [CLAUDE.md](./CLAUDE.md) - Mayor context and project overview
- [Gas Town Contracts](./CONTRACTS.md) - Data contracts between backend and UI

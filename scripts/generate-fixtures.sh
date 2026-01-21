#!/usr/bin/env bash
#
# Generate Golden Fixtures for Contract Tests
#
# This script captures real CLI output and stores it as golden fixtures
# for validating Zod schemas in contract tests.
#
# Usage:
#   ./scripts/generate-fixtures.sh
#
# Requirements:
#   - gt and bd CLI tools must be installed and in PATH
#   - Must be run from a valid Gas Town workspace
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
FIXTURES_DIR="$PROJECT_ROOT/src/lib/test/fixtures"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure fixtures directory exists
mkdir -p "$FIXTURES_DIR"

log_info "Generating golden fixtures in $FIXTURES_DIR"
echo ""

# gt status --json
log_info "Capturing: gt status --json"
if gt status --json > "$FIXTURES_DIR/gt-status.json" 2>/dev/null; then
    log_info "  -> gt-status.json ($(wc -c < "$FIXTURES_DIR/gt-status.json" | tr -d ' ') bytes)"
else
    log_error "  -> Failed to capture gt status"
fi

# bd list --json (limited to avoid huge files)
log_info "Capturing: bd list --json --limit=10"
if bd list --json --limit=10 > "$FIXTURES_DIR/bd-list.json" 2>/dev/null; then
    log_info "  -> bd-list.json ($(wc -c < "$FIXTURES_DIR/bd-list.json" | tr -d ' ') bytes)"
else
    log_error "  -> Failed to capture bd list"
fi

# gt convoy list --json
log_info "Capturing: gt convoy list --json"
if gt convoy list --json > "$FIXTURES_DIR/gt-convoy-list.json" 2>/dev/null; then
    log_info "  -> gt-convoy-list.json ($(wc -c < "$FIXTURES_DIR/gt-convoy-list.json" | tr -d ' ') bytes)"
else
    log_error "  -> Failed to capture gt convoy list"
fi

# gt mq list --json (rig name required)
log_info "Capturing: gt mq list gastown_ui --json"
if gt mq list gastown_ui --json > "$FIXTURES_DIR/gt-mq-list.json" 2>/dev/null; then
    log_info "  -> gt-mq-list.json ($(wc -c < "$FIXTURES_DIR/gt-mq-list.json" | tr -d ' ') bytes)"
else
    log_warn "  -> gt-mq-list.json may be null (empty queue)"
fi

# gt mail inbox --json
log_info "Capturing: gt mail inbox --json"
if gt mail inbox --json > "$FIXTURES_DIR/gt-mail-inbox.json" 2>/dev/null; then
    log_info "  -> gt-mail-inbox.json ($(wc -c < "$FIXTURES_DIR/gt-mail-inbox.json" | tr -d ' ') bytes)"
else
    log_warn "  -> gt-mail-inbox.json may be null (empty inbox)"
fi

echo ""
log_info "Fixture generation complete!"
echo ""
log_info "Files generated:"
ls -la "$FIXTURES_DIR"/*.json 2>/dev/null || log_warn "No JSON fixtures found"
echo ""
log_info "Run 'bun test src/lib/types/__tests__/contracts.test.ts' to validate schemas"

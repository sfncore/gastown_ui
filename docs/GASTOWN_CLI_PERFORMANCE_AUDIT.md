# Gas Town CLI Performance Audit & Optimization Recommendations

> **Document Version**: 1.0
> **Created**: 2026-01-12
> **Status**: Audit Complete, Recommendations Pending Implementation
> **Scope**: Performance analysis of `../gastown` Go CLI commands
> **Related**: [INTEGRATION_PLAN.md](./INTEGRATION_PLAN.md) (v5.0)
> **Audience**: Backend (Go) developers working on `github.com/Avyukth/gastown`

---

## Executive Summary

This document presents findings from a performance audit of the Gas Town CLI (`gt`, `bd`) commands, with a focus on their impact on the UI dashboard integration. The audit identified **`gt status --json`** as a critical bottleneck at **~1.26 seconds per invocation**, which is called from **8 different frontend routes** with no caching.

### Key Finding

The frontend dashboard's perceived latency is dominated by CLI execution time, not network or rendering. A 1.2s `gt status` call blocks the UI on every navigation.

### Impact

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| `gt status --json` latency | ~1260ms | <200ms | **6x slower** |
| Dashboard initial load | ~2.5s | <500ms | **5x slower** |
| Page navigation (cached) | ~1.3s | <100ms | **13x slower** |

---

## Baseline Measurements

### CLI Command Latencies

Measured on local development machine (macOS, M1, SSD):

| Command | Mean Latency | Std Dev | Notes |
|---------|-------------|---------|-------|
| `gt status --json` | **1264ms** | ±15ms | Critical path |
| `gt status --fast --json` | **1022ms** | ±35ms | Skips mail lookups |
| `bd list --json` | **70ms** | ±5ms | Acceptable |
| `gt convoys --json` | **15ms** | ±2ms | Fast |
| `bd list --type=message --status=open --json` | **75ms** | ±8ms | Mail query |

### Frontend Route Impact

Each route calls CLI commands synchronously:

| Route | CLI Calls | Total Latency |
|-------|-----------|---------------|
| `/` (dashboard) | `gt status` | ~1.3s |
| `/agents` | `gt status` | ~1.3s |
| `/agents/[id]` | `gt status` | ~1.3s |
| `/health` | `gt status` + `gt doctor` | ~2.5s |
| `/mail` | `bd list --type=message` | ~100ms |
| `/mail/compose` | `gt status` | ~1.3s |
| `/rigs` | `gt status` | ~1.3s |
| `/watchdog` | `gt status` | ~1.3s |

---

## Bottleneck Analysis: `gt status`

### Source Code Reference

`gastown/internal/cmd/status.go` (1235 lines)

### Execution Profile (Estimated)

| Phase | Est. Time | Description |
|-------|-----------|-------------|
| Daemon health check | ~200ms | `beads.EnsureBdDaemonHealth()` |
| Workspace discovery | ~50ms | `workspace.FindFromCwdOrError()` |
| Config loading | ~30ms | Town + rigs config files |
| tmux session listing | ~150ms | Subprocess: `tmux list-sessions` |
| Rig discovery | ~100ms | Filesystem scan for rigs |
| Agent bead queries | ~300ms | SQLite queries (town + per-rig DBs) |
| Hook bead queries | ~150ms | Additional SQLite lookups |
| Mail lookups | ~200ms | Per-agent mailbox count (skipped with `--fast`) |
| Crew listing | ~50ms | Git operations per rig |
| MQ summary | ~50ms | Merge queue beads query |
| **Total** | **~1280ms** | |

### Identified Bottlenecks

#### 1. Daemon Health Check on Every Call (Line 194)

```go
bdWarning := beads.EnsureBdDaemonHealth(townRoot)
```

**Problem**: Checks (and potentially restarts) bd daemon on every `gt status` invocation.

**Impact**: ~200ms overhead even when daemon is healthy.

**Recommendation**:
- Cache daemon health state with TTL (e.g., 30s)
- Skip check if last check was recent
- Make async/non-blocking for status display

#### 2. tmux Session Listing (Lines 219-225)

```go
if sessions, err := t.ListSessions(); err == nil {
    for _, s := range sessions {
        allSessions[s] = true
    }
}
```

**Problem**: Spawns `tmux list-sessions` subprocess on every call.

**Impact**: ~150ms for subprocess spawn + tmux query.

**Recommendation**:
- Cache session list with short TTL (5-10s)
- Use tmux control mode for persistent connection (Phase 2)
- Consider inotify/fswatch on tmux socket for push updates

#### 3. Multiple SQLite Database Queries (Lines 238-300)

```go
townBeadsClient := beads.New(townBeadsPath)
townAgentBeads, _ := townBeadsClient.ListAgentBeads()
// ... then for each rig:
rigBeads := beads.New(rigBeadsPath)
rigAgentBeads, _ := rigBeads.ListAgentBeads()
```

**Problem**: Opens and queries multiple SQLite databases sequentially.

**Impact**: ~450ms for all bead queries.

**Recommendation**:
- Batch queries where possible
- Consider read-only connection pooling
- Add query result caching with cache invalidation on writes
- Evaluate single consolidated DB vs per-rig DBs trade-off

#### 4. Per-Agent Mail Lookups (Lines 994-1009)

```go
func populateMailInfo(agent *AgentRuntime, router *mail.Router) {
    mailbox, err := router.GetMailbox(agent.Address)
    // ...
    _, unread, _ := mailbox.Count()
    if unread > 0 {
        if messages, err := mailbox.ListUnread(); err == nil && len(messages) > 0 {
            agent.FirstSubject = messages[0].Subject
        }
    }
}
```

**Problem**: Makes mailbox query for each agent even when `--fast` isn't used.

**Impact**: ~200ms total across all agents.

**Recommendation**:
- The `--fast` flag already helps; document its use for UI integration
- Consider caching mail counts with invalidation on new mail
- Batch mail queries: get all unread counts in one query

#### 5. Filesystem Discovery Operations (Lines 228-230)

```go
rigs, err := mgr.DiscoverRigs()
```

**Problem**: Scans filesystem for rig directories on every call.

**Impact**: ~100ms for directory enumeration.

**Recommendation**:
- Cache discovered rigs with fswatch invalidation
- Maintain rig registry in daemon state
- Only re-scan when explicitly requested or on change detection

---

## Optimization Recommendations

### Tier 1: Quick Wins (No Backend Changes Required)

These optimizations can be implemented in the frontend without modifying the Go codebase.

| Optimization | Effort | Impact | Implementation |
|--------------|--------|--------|----------------|
| Use `--fast` flag | 1 line | -200ms | Change CLI args in routes |
| Add response caching (10s TTL) | 1 day | -90% redundant calls | In-memory cache in SvelteKit |
| Composite endpoint | 2 days | -50% latency | Single route calls multiple CLIs |

### Tier 2: Go Backend Caching (Recommended)

Add internal caching to `gt status` without changing the API.

#### 2.1 Daemon Health Cache

```go
// In beads package
var daemonHealthCache struct {
    sync.RWMutex
    healthy   bool
    checkedAt time.Time
}

func EnsureBdDaemonHealthCached(townRoot string, ttl time.Duration) string {
    daemonHealthCache.RLock()
    if time.Since(daemonHealthCache.checkedAt) < ttl {
        daemonHealthCache.RUnlock()
        return ""
    }
    daemonHealthCache.RUnlock()

    // Do actual check...
    warning := EnsureBdDaemonHealth(townRoot)

    daemonHealthCache.Lock()
    daemonHealthCache.healthy = warning == ""
    daemonHealthCache.checkedAt = time.Now()
    daemonHealthCache.Unlock()

    return warning
}
```

**Expected Impact**: -200ms when daemon is healthy (common case).

#### 2.2 tmux Session Cache

```go
// In tmux package
type SessionCache struct {
    sessions  map[string]bool
    fetchedAt time.Time
    mu        sync.RWMutex
}

func (c *SessionCache) Get(ttl time.Duration) (map[string]bool, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    if time.Since(c.fetchedAt) < ttl {
        return c.sessions, true
    }
    return nil, false
}
```

**Expected Impact**: -150ms on repeated calls within TTL window.

#### 2.3 Rig Discovery Cache

```go
// In rig package
type DiscoveryCache struct {
    rigs      []*Rig
    timestamp time.Time
    mu        sync.RWMutex
}

func (m *Manager) DiscoverRigsCached(ttl time.Duration) ([]*Rig, error) {
    // Check cache first
    if cached := m.cache.Get(ttl); cached != nil {
        return cached, nil
    }
    // Discover and cache
    rigs, err := m.DiscoverRigs()
    if err == nil {
        m.cache.Set(rigs)
    }
    return rigs, err
}
```

**Expected Impact**: -100ms on repeated calls.

### Tier 3: New `--cached` Mode for Status

Add a new flag that returns cached data immediately:

```go
var statusCached bool

func init() {
    statusCmd.Flags().BoolVar(&statusCached, "cached", false,
        "Return cached status (instant, may be stale)")
}

func runStatusOnce(cmd *cobra.Command, args []string) error {
    if statusCached {
        if cached := getStatusCache(); cached != nil {
            return outputStatus(cached)
        }
        // Fall through to fetch if no cache
    }
    // ... existing logic ...
}
```

**Expected Impact**: <10ms response time when cache is warm.

### Tier 4: Background Refresh Daemon (Phase 2)

Add a background goroutine to the daemon that continuously refreshes status:

```go
// In daemon startup
go func() {
    ticker := time.NewTicker(5 * time.Second)
    for range ticker.C {
        status := computeStatus()
        statusCache.Store(status)
    }
}()
```

**Expected Impact**: Status always available instantly from cache.

---

## Proposed Implementation Order

### Phase 1: Frontend-Only Optimizations (Week 1)

1. Switch to `gt status --fast --json` in all routes
2. Add server-side response cache with 10s TTL
3. Add HTTP `Cache-Control` headers for client-side caching
4. Implement composite `/api/gastown/snapshot` endpoint

**Expected Result**: Dashboard load time reduced from ~2.5s to ~1.2s (first load) / ~0ms (cached).

### Phase 2: Go Backend Quick Wins (Week 2)

1. Add daemon health cache (30s TTL)
2. Add tmux session cache (5s TTL)
3. Add rig discovery cache (30s TTL)
4. Document `--fast` flag in gt help and README

**Expected Result**: `gt status --fast` reduced from ~1s to ~400ms.

### Phase 3: Comprehensive Caching (Week 3-4)

1. Add `--cached` flag for instant responses
2. Implement background status refresh in daemon
3. Add cache invalidation hooks on state changes
4. Add metrics for cache hit rates

**Expected Result**: `gt status --cached` responds in <10ms.

---

## Metrics & Observability

### Recommended Instrumentation

Add timing metrics to `gt status`:

```go
func runStatusOnce(cmd *cobra.Command, args []string) error {
    start := time.Now()
    defer func() {
        if metricsEnabled {
            recordMetric("gt_status_duration_ms", time.Since(start).Milliseconds())
        }
    }()

    // Track individual phases
    t1 := time.Now()
    bdWarning := beads.EnsureBdDaemonHealth(townRoot)
    recordMetric("gt_status_daemon_check_ms", time.Since(t1).Milliseconds())

    // ... etc
}
```

### Cache Hit Rate Tracking

```go
var cacheMetrics struct {
    hits   atomic.Int64
    misses atomic.Int64
}

func getCacheHitRate() float64 {
    hits := cacheMetrics.hits.Load()
    misses := cacheMetrics.misses.Load()
    total := hits + misses
    if total == 0 {
        return 0
    }
    return float64(hits) / float64(total)
}
```

---

## Testing Requirements

### Regression Tests

Before implementing optimizations, add regression tests:

```go
func TestStatusPerformance(t *testing.T) {
    // Warm up
    runStatusOnce(nil, nil)

    // Measure
    start := time.Now()
    for i := 0; i < 5; i++ {
        runStatusOnce(nil, nil)
    }
    avgMs := time.Since(start).Milliseconds() / 5

    // Assert performance bound
    if avgMs > 500 {
        t.Errorf("gt status too slow: %dms (target: <500ms)", avgMs)
    }
}
```

### Cache Correctness Tests

```go
func TestStatusCacheInvalidation(t *testing.T) {
    // Get initial status
    status1 := getStatusCached()

    // Make a change (e.g., start an agent)
    startAgent("test-agent")

    // Force cache invalidation
    invalidateStatusCache()

    // Verify new status reflects change
    status2 := getStatusCached()
    assert.NotEqual(t, status1, status2)
}
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Stale cache data | Users see outdated status | Short TTLs + manual refresh button |
| Cache invalidation bugs | Status doesn't update | Comprehensive invalidation tests |
| Memory growth from caching | OOM on long-running daemon | Bounded cache sizes + eviction |
| Race conditions | Inconsistent data | Proper mutex usage |

---

## Appendix: Full `gt status` Execution Flow

```
gt status --json
│
├── workspace.FindFromCwdOrError()           [~50ms]
│
├── beads.EnsureBdDaemonHealth()             [~200ms] ← OPTIMIZE
│
├── config.LoadTownConfig()                   [~15ms]
├── config.LoadRigsConfig()                   [~15ms]
│
├── tmux.ListSessions()                       [~150ms] ← OPTIMIZE
│
├── rig.DiscoverRigs()                        [~100ms] ← OPTIMIZE
│
├── [PARALLEL] For each DB:
│   ├── beads.ListAgentBeads()                [~150ms]
│   └── beads.ShowMultiple(hookIDs)           [~100ms]
│
├── config.LoadOrDetectOverseer()             [~20ms]
│
├── [PARALLEL] For each rig:
│   ├── crew.List()                           [~50ms]
│   ├── discoverRigHooks()                    [~30ms]
│   ├── discoverRigAgents()                   [~50ms]
│   │   └── populateMailInfo()                [~200ms] ← --fast skips
│   └── getMQSummary()                        [~50ms]
│
└── outputStatusJSON()                        [~5ms]

TOTAL: ~1260ms (with mail) / ~1020ms (--fast)
```

---

## References

- `gastown/internal/cmd/status.go` - Main status command implementation
- `gastown/internal/beads/beads.go` - Beads database operations
- `gastown/internal/tmux/tmux.go` - tmux session management
- `gastown/internal/rig/manager.go` - Rig discovery
- `gastown/internal/mail/router.go` - Mail routing

---

## Changelog

### v1.0 (2026-01-12)
- Initial performance audit
- Baseline measurements established
- Optimization recommendations documented

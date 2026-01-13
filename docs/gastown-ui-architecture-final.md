# Gas Town UI Architecture

One protocol. One auth. Ship in 7 weeks.

---

## Design Philosophy: Industrial Control Center

Gas Town UI embodies the **factory control room** metaphor—a mission control interface for monitoring and managing autonomous agent "workers" on the production floor.

### Conceptual Model

| Gas Town Concept | Factory Metaphor | UI Representation |
|------------------|------------------|-------------------|
| Polecats | Factory workers | Agent cards with status indicators |
| Witnesses | Floor supervisors | Observer panels |
| Refinery | Assembly line | Merge queue visualization |
| Workflows | Work orders | Progress pipelines |
| Queue | Job board | Prioritized task list |
| Daemon | Central control | System status header |

### Visual Language

**Terminal Precision:**
- Monospace typography (JetBrains Mono)
- Grid-based layouts with systematic spacing
- High-contrast text on dark backgrounds

**Industrial Indicators:**
- Status lights (running/idle/error)
- Animated gauges and progress bars
- Pulse effects for active operations

**Mechanical Motion:**
- Controlled easing (ease-out for responses)
- Staggered animations for lists
- Smooth state transitions

**Glass Control Panels:**
- Frosted glass morphism for elevated surfaces
- Subtle depth through shadows
- Border beam effects for active elements

---

## Overview

| Component | Purpose | Timeline |
|-----------|---------|----------|
| **API Server** | HTTP + WebSocket endpoint in daemon | Week 1–2 |
| **Web Dashboard** | Remote access, team view, mobile | Week 3–5 |
| **Rust TUI** | Performance experiment (potential BubbleTea replacement) | Week 6–7 |

---

## Architecture

```
                         All remote clients use WebSocket + JSON
    ┌───────────────────────────┬───────────────────────────┐
    │                           │                           │
    ▼                           ▼                           ▼
┌────────────┐            ┌───────────┐            ┌────────────┐
│  Rust TUI  │            │    Web    │            │   Mobile   │
│   (new)    │            │   (new)   │            │   (web)    │
└─────┬──────┘            └─────┬─────┘            └─────┬──────┘
      │                         │                        │
      └─────────────────────────┼────────────────────────┘
                                │
                       WebSocket :8080/ws
                                │
┌───────────┐                   ▼
│  Go TUI   │    ┌─────────────────────────────────────────────┐
│ (existing)│    │            GAS TOWN DAEMON                  │
└─────┬─────┘    │  ┌───────────────────────────────────────┐  │
      │          │  │           API SERVER (new)            │  │
 Unix Socket     │  │  HTTP /api/*  │  WebSocket /ws        │  │
 (unchanged)     │  │  (commands)   │  (events)             │  │
      │          │  │               │                       │  │
      │          │  │         Bearer Token Auth             │  │
      │          │  └───────────────────────────────────────┘  │
      │          │                      │                      │
      └──────────┼──────────────────────┼──────────────────────┤
                 │              Event Bus (Go channels)        │
                 │                      │                      │
                 │  ┌─────────┬─────────┼─────────┬─────────┐  │
                 │  │ Agents  │Molecules│ Queues  │ Health  │  │
                 │  │   ↓ existing daemon services ↓        │  │
                 │  └─────────┴─────────┴─────────┴─────────┘  │
                 └─────────────────────────────────────────────┘
```

**Design decisions:**
- Keep Unix socket for existing Go TUI (don't break what works)
- WebSocket + JSON for all remote clients (one protocol)
- Stateless bearer tokens (no session management)
- Responsive web = mobile (no separate app)

---

## Part 1: API Server (Go)

Add to daemon: `internal/api/` (~500 LOC total)

```
internal/api/
├── server.go      # HTTP server, routes
├── auth.go        # Token auth
├── handlers.go    # REST endpoints  
├── websocket.go   # Event streaming
└── events.go      # Pub/sub broadcaster
```

### server.go

```go
package api

import (
	"context"
	"net/http"
	"time"
)

type Server struct {
	addr        string
	auth        *Auth
	daemon      DaemonInterface
	broadcaster *Broadcaster
	mux         *http.ServeMux
}

func New(addr string, auth *Auth, daemon DaemonInterface) *Server {
	s := &Server{
		addr:        addr,
		auth:        auth,
		daemon:      daemon,
		broadcaster: NewBroadcaster(),
		mux:         http.NewServeMux(),
	}
	s.routes()
	return s
}

func (s *Server) routes() {
	// Public
	s.mux.HandleFunc("POST /api/auth/token", s.handleCreateToken)

	// Protected
	s.mux.HandleFunc("GET /api/status", s.requireAuth(s.handleStatus))
	s.mux.HandleFunc("GET /api/agents", s.requireAuth(s.handleListAgents))
	s.mux.HandleFunc("POST /api/agents", s.requireAuth(s.handleSpawnAgent))
	s.mux.HandleFunc("DELETE /api/agents/{id}", s.requireAuth(s.handleStopAgent))
	s.mux.HandleFunc("GET /api/workflows", s.requireAuth(s.handleListWorkflows))
	s.mux.HandleFunc("POST /api/workflows", s.requireAuth(s.handleStartWorkflow))
	s.mux.HandleFunc("GET /api/queue", s.requireAuth(s.handleListQueue))
	s.mux.HandleFunc("POST /api/queue", s.requireAuth(s.handleSubmitToQueue))

	// WebSocket (auth via query param)
	s.mux.HandleFunc("GET /ws", s.handleWebSocket)

	// Static files
	s.mux.Handle("/", http.FileServer(http.Dir("web/build")))
}

func (s *Server) Start(ctx context.Context) error {
	srv := &http.Server{
		Addr:         s.addr,
		Handler:      s.mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		srv.Shutdown(context.Background())
	}()
	return srv.ListenAndServe()
}
```

### auth.go

```go
package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
)

type Token struct {
	Value     string
	User      string
	Role      string // admin | operator | viewer
	ExpiresAt time.Time
}

type Auth struct {
	tokens sync.Map
	users  map[string]UserConfig // from config file
}

type UserConfig struct {
	PasswordHash []byte
	Role         string
}

func (a *Auth) CreateToken(username, password string) (string, error) {
	user, ok := a.users[username]
	if !ok || bcrypt.CompareHashAndPassword(user.PasswordHash, []byte(password)) != nil {
		return "", errors.New("invalid credentials")
	}

	b := make([]byte, 32)
	rand.Read(b)
	token := hex.EncodeToString(b)

	a.tokens.Store(token, Token{
		Value:     token,
		User:      username,
		Role:      user.Role,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	})
	return token, nil
}

func (a *Auth) Validate(token string) (*Token, error) {
	v, ok := a.tokens.Load(token)
	if !ok {
		return nil, errors.New("invalid token")
	}
	t := v.(Token)
	if time.Now().After(t.ExpiresAt) {
		a.tokens.Delete(token)
		return nil, errors.New("token expired")
	}
	return &t, nil
}

type ctxKey string

func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		token, err := s.auth.Validate(strings.TrimPrefix(auth, "Bearer "))
		if err != nil {
			http.Error(w, err.Error(), http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), ctxKey("user"), token)
		next(w, r.WithContext(ctx))
	}
}
```

### websocket.go

```go
package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

type WSMessage struct {
	Type string          `json:"type"` // snapshot | event | error
	Data json.RawMessage `json:"data"`
}

type Event struct {
	Topic   string      `json:"topic"` // agent.status | workflow.progress | log
	Time    time.Time   `json:"time"`
	Payload interface{} `json:"payload"`
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Auth via query param (browsers can't set WS headers)
	token, err := s.auth.Validate(r.URL.Query().Get("token"))
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	ctx := r.Context()

	// Send current state
	wsjson.Write(ctx, conn, WSMessage{
		Type: "snapshot",
		Data: mustJSON(s.daemon.Snapshot()),
	})

	// Stream events
	events := s.broadcaster.Subscribe(token.User)
	defer s.broadcaster.Unsubscribe(token.User)

	for {
		select {
		case <-ctx.Done():
			return
		case e := <-events:
			if wsjson.Write(ctx, conn, WSMessage{Type: "event", Data: mustJSON(e)}) != nil {
				return
			}
		}
	}
}

func mustJSON(v interface{}) json.RawMessage {
	b, _ := json.Marshal(v)
	return b
}
```

### events.go

```go
package api

import "sync"

type Broadcaster struct {
	mu      sync.RWMutex
	clients map[string]chan Event
}

func NewBroadcaster() *Broadcaster {
	return &Broadcaster{clients: make(map[string]chan Event)}
}

func (b *Broadcaster) Subscribe(id string) <-chan Event {
	b.mu.Lock()
	defer b.mu.Unlock()
	ch := make(chan Event, 100)
	b.clients[id] = ch
	return ch
}

func (b *Broadcaster) Unsubscribe(id string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if ch, ok := b.clients[id]; ok {
		close(ch)
		delete(b.clients, id)
	}
}

func (b *Broadcaster) Broadcast(e Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.clients {
		select {
		case ch <- e:
		default: // drop if slow
		}
	}
}
```

### handlers.go

```go
package api

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.daemon.Status())
}

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.daemon.ListAgents())
}

func (s *Server) handleSpawnAgent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type     string `json:"type"`
		Worktree string `json:"worktree,omitempty"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	agent, err := s.daemon.SpawnAgent(req.Type, req.Worktree)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(agent)
}

func (s *Server) handleStopAgent(w http.ResponseWriter, r *http.Request) {
	if err := s.daemon.StopAgent(r.PathValue("id")); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleListWorkflows(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.daemon.ListWorkflows())
}

func (s *Server) handleStartWorkflow(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Formula string                 `json:"formula"`
		Params  map[string]interface{} `json:"params,omitempty"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	wf, err := s.daemon.StartWorkflow(req.Formula, req.Params)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(wf)
}

func (s *Server) handleListQueue(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(s.daemon.ListQueue())
}

func (s *Server) handleSubmitToQueue(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Summary  string `json:"summary"`
		Priority int    `json:"priority,omitempty"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	item, err := s.daemon.SubmitToQueue(req.Summary, req.Priority)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

func (s *Server) handleCreateToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if json.NewDecoder(r.Body).Decode(&req) != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	token, err := s.auth.CreateToken(req.Username, req.Password)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}
```

---

## Part 2: Web Dashboard (SvelteKit)

```bash
npx sv create web --template minimal --types ts
cd web && npm install
```

### Project Structure

```
web/src/
├── lib/
│   ├── api.ts           # REST + WebSocket client
│   ├── state.svelte.ts  # Reactive store
│   └── types.ts         # TypeScript types
├── routes/
│   ├── +layout.svelte   # App shell
│   ├── +page.svelte     # Dashboard
│   └── login/+page.svelte
└── app.css              # Styles
```

### lib/api.ts

```typescript
type Agent = { id: string; name: string; type: string; status: string; task?: string };
type Workflow = { id: string; name: string; status: string; currentStep: number; totalSteps: number };
type QueueItem = { id: string; summary: string; status: string };
type LogEntry = { id: string; timestamp: number; level: string; source: string; message: string };

class API {
  private token: string | null = null;
  private ws: WebSocket | null = null;

  getToken(): string | null {
    return this.token ?? localStorage.getItem('gt_token');
  }

  setToken(t: string) {
    this.token = t;
    localStorage.setItem('gt_token', t);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('gt_token');
  }

  private async request<T>(path: string, opts: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(this.getToken() ? { Authorization: `Bearer ${this.getToken()}` } : {}),
        ...opts.headers,
      },
    });
    if (res.status === 401) {
      this.clearToken();
      location.href = '/login';
      throw new Error('unauthorized');
    }
    if (!res.ok) throw new Error(await res.text());
    return res.status === 204 ? (undefined as T) : res.json();
  }

  async login(username: string, password: string) {
    const { token } = await this.request<{ token: string }>('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(token);
  }

  listAgents = () => this.request<Agent[]>('/agents');
  spawnAgent = (type: string) => this.request<Agent>('/agents', { method: 'POST', body: JSON.stringify({ type }) });
  stopAgent = (id: string) => this.request<void>(`/agents/${id}`, { method: 'DELETE' });
  listWorkflows = () => this.request<Workflow[]>('/workflows');
  listQueue = () => this.request<QueueItem[]>('/queue');

  connect(onSnapshot: (d: any) => void, onEvent: (e: any) => void) {
    const token = this.getToken();
    if (!token) return;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${proto}//${location.host}/ws?token=${token}`);

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'snapshot') onSnapshot(msg.data);
      else if (msg.type === 'event') onEvent(msg.data);
    };

    this.ws.onclose = () => setTimeout(() => this.connect(onSnapshot, onEvent), 2000);
  }

  disconnect() {
    this.ws?.close();
  }
}

export const api = new API();
export type { Agent, Workflow, QueueItem, LogEntry };
```

### lib/state.svelte.ts

```typescript
import { api, type Agent, type Workflow, type QueueItem, type LogEntry } from './api';

function createState() {
  let connected = $state(false);
  let agents = $state<Agent[]>([]);
  let workflows = $state<Workflow[]>([]);
  let queue = $state<QueueItem[]>([]);
  let logs = $state<LogEntry[]>([]);

  function handleSnapshot(data: any) {
    connected = true;
    agents = data.agents ?? [];
    workflows = data.workflows ?? [];
    queue = data.queue ?? [];
    logs = data.logs ?? [];
  }

  function handleEvent(event: any) {
    switch (event.topic) {
      case 'agent.spawned':
        agents = [...agents, event.payload];
        break;
      case 'agent.stopped':
        agents = agents.filter((a) => a.id !== event.payload.id);
        break;
      case 'agent.status':
        agents = agents.map((a) => (a.id === event.payload.id ? { ...a, ...event.payload } : a));
        break;
      case 'workflow.progress':
        workflows = workflows.map((w) => (w.id === event.payload.id ? { ...w, ...event.payload } : w));
        break;
      case 'queue.updated':
        queue = event.payload;
        break;
      case 'log':
        logs = [...logs.slice(-499), event.payload];
        break;
    }
  }

  return {
    get connected() { return connected; },
    get agents() { return agents; },
    get workflows() { return workflows; },
    get queue() { return queue; },
    get logs() { return logs; },
    connect() { api.connect(handleSnapshot, handleEvent); },
    disconnect() { api.disconnect(); connected = false; },
  };
}

export const state = createState();
```

### app.css

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

/* ============================================
   DESIGN TOKENS - Industrial Control Center
   ============================================ */

:root {
  /* Backgrounds - Industrial Dark */
  --bg-void: #050507;
  --bg: #0a0a0c;
  --bg1: #111114;
  --bg2: #1a1a1f;
  --bg-hover: #242429;
  --bg-glass: rgba(17, 17, 20, 0.8);
  --bg-glass-strong: rgba(17, 17, 20, 0.95);

  /* Text - High Contrast */
  --fg: #f4f4f5;
  --fg1: #a1a1aa;
  --fg2: #71717a;

  /* Status - Industrial Indicators */
  --status-running: #22c55e;
  --status-idle: #6b7280;
  --status-error: #ef4444;
  --status-warning: #f59e0b;
  --status-info: #3b82f6;

  /* Accent - Teal/Cyan (Factory Machinery) */
  --accent: #0da;
  --accent-hover: #22d3ee;
  --accent-glow: rgba(13, 221, 170, 0.3);
  --accent-glow-strong: rgba(13, 221, 170, 0.5);

  /* Borders */
  --border: #1e1e26;
  --border-strong: #2a2a36;

  /* Shadows */
  --shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 8px 32px -8px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 20px var(--accent-glow);

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Animation Timing */
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-gradient: 3s;
  --duration-shimmer: 2s;
  --duration-beam: 4s;
  --duration-glow: 2s;

  /* Easing */
  --ease-out: cubic-bezier(0.33, 1, 0.68, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* ============================================
   BASE STYLES
   ============================================ */

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  height: 100%;
  background: var(--bg);
  color: var(--fg);
  font: 13px/1.5 'JetBrains Mono', monospace;
}

/* ============================================
   ANIMATION KEYFRAMES - Magic UI System
   ============================================ */

/* Gradient shift for backgrounds */
@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes gradient-y {
  0%, 100% { background-position: 50% 0%; }
  50% { background-position: 50% 100%; }
}

/* Shimmer effect for text and skeletons */
@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}

/* Blur fade entrance animations */
@keyframes blur-fade-up {
  from { opacity: 0; transform: translateY(8px); filter: blur(4px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes blur-fade-down {
  from { opacity: 0; transform: translateY(-8px); filter: blur(4px); }
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}

@keyframes blur-fade-left {
  from { opacity: 0; transform: translateX(8px); filter: blur(4px); }
  to { opacity: 1; transform: translateX(0); filter: blur(0); }
}

@keyframes blur-fade-right {
  from { opacity: 0; transform: translateX(-8px); filter: blur(4px); }
  to { opacity: 1; transform: translateX(0); filter: blur(0); }
}

/* Grid background pulse */
@keyframes grid-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* Border beam sweep */
@keyframes border-beam {
  0% { background-position: 0% 0%; }
  100% { background-position: 200% 0%; }
}

/* Glow pulse for status indicators */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 8px var(--accent-glow); }
  50% { box-shadow: 0 0 20px var(--accent-glow-strong); }
}

/* Typing cursor blink */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Spin for processing indicators */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Scale in for completed states */
@keyframes scale-in {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* Shake for errors */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

/* Slide animations */
@keyframes slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================
   ANIMATION UTILITIES
   ============================================ */

.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x var(--duration-gradient) ease infinite;
}

.animate-shimmer {
  background: linear-gradient(90deg, transparent, var(--fg2), transparent);
  background-size: 200% 100%;
  animation: shimmer var(--duration-shimmer) linear infinite;
}

.animate-blur-fade-up { animation: blur-fade-up var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-down { animation: blur-fade-down var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-left { animation: blur-fade-left var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-right { animation: blur-fade-right var(--duration-slow) var(--ease-out) forwards; }

.animate-glow-pulse { animation: glow-pulse var(--duration-glow) ease-in-out infinite; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-scale-in { animation: scale-in 0.2s var(--ease-out); }
.animate-shake { animation: shake 0.5s var(--ease-in-out); }

/* Stagger system for list animations */
.stagger > * {
  opacity: 0;
  animation: blur-fade-up 0.4s var(--ease-out) forwards;
}
.stagger > *:nth-child(1) { animation-delay: 0.05s; }
.stagger > *:nth-child(2) { animation-delay: 0.10s; }
.stagger > *:nth-child(3) { animation-delay: 0.15s; }
.stagger > *:nth-child(4) { animation-delay: 0.20s; }
.stagger > *:nth-child(5) { animation-delay: 0.25s; }
.stagger > *:nth-child(6) { animation-delay: 0.30s; }
.stagger > *:nth-child(7) { animation-delay: 0.35s; }
.stagger > *:nth-child(8) { animation-delay: 0.40s; }

/* ============================================
   GLASS MORPHISM
   ============================================ */

.panel-glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

.panel-glass-strong {
  background: var(--bg-glass-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-strong);
}

/* ============================================
   COMPONENT STYLES
   ============================================ */

/* Status indicators */
.status::before {
  content: '';
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background: var(--fg2);
  transition: all var(--duration-fast) var(--ease-out);
}
.status.running::before {
  background: var(--status-running);
  box-shadow: 0 0 8px var(--status-running);
  animation: glow-pulse var(--duration-glow) ease-in-out infinite;
}
.status.error::before {
  background: var(--status-error);
  box-shadow: 0 0 8px var(--status-error);
}
.status.warning::before {
  background: var(--status-warning);
}
.status.idle::before {
  background: var(--status-idle);
}

/* Panels */
.panel {
  background: var(--bg1);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

.panel:hover {
  border-color: var(--border-strong);
}

.panel-header {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg2);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Interactive cards */
.card-interactive {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out),
              border-color var(--duration-fast) var(--ease-out);
}

.card-interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}

/* Border beam effect for active elements */
.border-beam {
  position: relative;
  overflow: hidden;
}

.border-beam::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  background-size: 200% 100%;
  animation: border-beam var(--duration-beam) linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1px;
  border-radius: inherit;
  pointer-events: none;
}

/* Skeleton loading */
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg1) 0%,
    var(--bg2) 50%,
    var(--bg1) 100%
  );
  background-size: 200% 100%;
  animation: shimmer var(--duration-shimmer) linear infinite;
  border-radius: var(--radius-sm);
}

/* Typing cursor */
.typing-cursor::after {
  content: '█';
  animation: blink 1s step-end infinite;
  color: var(--accent);
}

/* Buttons */
button {
  font: inherit;
  padding: var(--space-2) var(--space-3);
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--fg1);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  min-height: 44px; /* Touch target */
  min-width: 44px;
}

button:hover {
  background: var(--bg-hover);
  color: var(--fg);
  border-color: var(--border-strong);
}

button:active {
  transform: scale(0.98);
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Grid pattern background */
.bg-grid {
  background-image:
    radial-gradient(circle, var(--border) 1px, transparent 1px);
  background-size: 24px 24px;
  animation: grid-pulse var(--duration-glow) ease-in-out infinite;
}

/* ============================================
   ACCESSIBILITY
   ============================================ */

/* Skip link */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--bg);
  border-radius: var(--radius-sm);
  z-index: 1000;
  transition: top var(--duration-fast);
}

.skip-link:focus {
  top: var(--space-4);
}

/* Focus visible */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 768px) {
  html { font-size: 14px; }

  button {
    min-height: 48px; /* Larger touch targets on mobile */
    min-width: 48px;
  }
}
```

### routes/+layout.svelte

```svelte
<script>
  import { onMount } from 'svelte';
  import { state } from '$lib/state.svelte';
  import '../app.css';

  onMount(() => { state.connect(); return () => state.disconnect(); });

  let { children } = $props();
</script>

<div class="app">
  <header>
    <span class="brand">◆ GAS TOWN</span>
    <span class="status" class:running={state.connected}>{state.connected ? 'Connected' : 'Connecting...'}</span>
  </header>
  <main>{@render children()}</main>
</div>

<style>
  .app { display: grid; grid-template-rows: 48px 1fr; height: 100vh; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 0 16px; background: var(--bg1); border-bottom: 1px solid var(--border); }
  .brand { font-weight: 700; letter-spacing: 0.1em; }
  .brand::first-letter { color: var(--accent); }
  main { overflow: auto; padding: 16px; }
</style>
```

### routes/+page.svelte

```svelte
<script>
  import { state } from '$lib/state.svelte';
  import { api } from '$lib/api';
</script>

<div class="grid">
  <section class="panel">
    <div class="panel-header">
      <span>AGENTS ({state.agents.length})</span>
      <button onclick={() => api.spawnAgent('polecat')}>+ New</button>
    </div>
    <div class="list">
      {#each state.agents as a (a.id)}
        <div class="row">
          <span class="status {a.status}"></span>
          <span class="name">{a.name}</span>
          <span class="meta">{a.type}</span>
          <button onclick={() => api.stopAgent(a.id)}>Stop</button>
        </div>
      {:else}
        <div class="empty">No agents</div>
      {/each}
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">WORKFLOWS</div>
    <div class="list">
      {#each state.workflows as w (w.id)}
        <div class="row">
          <span class="name">{w.name}</span>
          <div class="bar"><div style="width:{(w.currentStep/w.totalSteps)*100}%"></div></div>
          <span class="meta">{w.currentStep}/{w.totalSteps}</span>
        </div>
      {:else}
        <div class="empty">No workflows</div>
      {/each}
    </div>
  </section>

  <section class="panel">
    <div class="panel-header">QUEUE ({state.queue.length})</div>
    <div class="list">
      {#each state.queue.slice(0,10) as q (q.id)}
        <div class="row">
          <span class="status {q.status}"></span>
          <span class="id">{q.id}</span>
          <span class="summary">{q.summary}</span>
        </div>
      {:else}
        <div class="empty">Empty</div>
      {/each}
    </div>
  </section>

  <section class="panel logs">
    <div class="panel-header">LOGS</div>
    <div class="log-list">
      {#each state.logs.slice(-50) as l (l.id)}
        <div class="log {l.level}">
          <span class="time">{new Date(l.timestamp).toLocaleTimeString()}</span>
          <span class="src">{l.source}</span>
          <span class="msg">{l.message}</span>
        </div>
      {/each}
    </div>
  </section>
</div>

<style>
  .grid { display: grid; gap: 16px; height: 100%; }
  @media (min-width: 1024px) { .grid { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; } .logs { grid-column: span 2; } }
  @media (min-width: 768px) and (max-width: 1023px) { .grid { grid-template-columns: 1fr 1fr; } .logs { grid-column: span 2; } }

  .list, .log-list { padding: 8px; }
  .row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-bottom: 1px solid var(--border); }
  .row:last-child { border: none; }
  .row .name { flex: 1; font-weight: 700; }
  .row .meta { color: var(--fg2); font-size: 11px; }
  .row .id { color: var(--fg2); width: 70px; }
  .row .summary { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row button { opacity: 0; transition: opacity 0.1s; }
  .row:hover button { opacity: 1; }

  .bar { flex: 1; height: 4px; background: var(--bg2); border-radius: 2px; overflow: hidden; }
  .bar div { height: 100%; background: var(--accent); transition: width 0.3s; }

  .log-list { max-height: 180px; overflow-y: auto; font-size: 11px; }
  .log { display: flex; gap: 8px; padding: 2px 8px; }
  .log .time { color: var(--fg2); }
  .log .src { color: #59f; width: 80px; }
  .log .msg { flex: 1; }
  .log.error .msg { color: var(--err); }
  .log.warn .msg { color: var(--warn); }

  .empty { padding: 24px; text-align: center; color: var(--fg2); }
</style>
```

---

## Part 3: Rust TUI (Experiment)

Minimal implementation to benchmark against BubbleTea.

```bash
cargo new gastown-tui && cd gastown-tui
```

### Cargo.toml

```toml
[package]
name = "gastown-tui"
version = "0.1.0"
edition = "2021"

[dependencies]
ratatui = "0.29"
crossterm = { version = "0.28", features = ["event-stream"] }
tokio = { version = "1", features = ["full"] }
tokio-tungstenite = "0.24"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
color-eyre = "0.6"
futures-util = "0.3"
```

### src/main.rs

```rust
use std::time::Duration;
use color_eyre::Result;
use crossterm::event::{self, Event, KeyCode};
use futures_util::StreamExt;
use ratatui::{prelude::*, widgets::*};
use serde::Deserialize;
use tokio::sync::mpsc;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Clone, Deserialize)]
struct Agent { id: String, name: String, status: String }

#[derive(Deserialize)]
struct Snapshot { agents: Vec<Agent> }

#[derive(Deserialize)]
struct WSMsg { #[serde(rename = "type")] msg_type: String, data: serde_json::Value }

struct App { agents: Vec<Agent>, selected: usize, quit: bool }

impl App {
    fn new() -> Self { Self { agents: vec![], selected: 0, quit: false } }

    fn on_key(&mut self, k: KeyCode) {
        match k {
            KeyCode::Char('q') => self.quit = true,
            KeyCode::Up | KeyCode::Char('k') => self.selected = self.selected.saturating_sub(1),
            KeyCode::Down | KeyCode::Char('j') => {
                if self.selected < self.agents.len().saturating_sub(1) { self.selected += 1; }
            }
            _ => {}
        }
    }

    fn draw(&self, f: &mut Frame) {
        let chunks = Layout::vertical([Constraint::Length(2), Constraint::Min(0), Constraint::Length(1)]).split(f.area());

        f.render_widget(Paragraph::new("◆ GAS TOWN").fg(Color::Cyan).bold(), chunks[0]);

        let items: Vec<ListItem> = self.agents.iter().enumerate().map(|(i, a)| {
            let sym = if a.status == "running" { "●" } else { "○" };
            let color = if a.status == "running" { Color::Green } else { Color::DarkGray };
            let style = if i == self.selected { Style::new().bg(Color::DarkGray).bold() } else { Style::new() };
            ListItem::new(format!(" {} {:<12} {}", sym, a.name, a.status.to_uppercase())).style(style).fg(color)
        }).collect();

        f.render_widget(List::new(items).block(Block::bordered().title("AGENTS")), chunks[1]);
        f.render_widget(Paragraph::new(" q:quit  j/k:nav").fg(Color::DarkGray), chunks[2]);
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;

    let token = std::env::var("GASTOWN_TOKEN").unwrap_or_default();
    let (ws, _) = connect_async(format!("ws://localhost:8080/ws?token={}", token)).await?;
    let (_, mut rx) = ws.split();
    let (tx, mut erx) = mpsc::channel::<WSMsg>(100);

    tokio::spawn(async move {
        while let Some(Ok(Message::Text(t))) = rx.next().await {
            if let Ok(m) = serde_json::from_str(&t) { let _ = tx.send(m).await; }
        }
    });

    let mut term = ratatui::init();
    let mut app = App::new();

    loop {
        term.draw(|f| app.draw(f))?;

        tokio::select! {
            _ = tokio::time::sleep(Duration::from_millis(50)) => {
                if event::poll(Duration::ZERO)? {
                    if let Event::Key(k) = event::read()? { app.on_key(k.code); }
                }
            }
            Some(m) = erx.recv() => {
                if m.msg_type == "snapshot" {
                    if let Ok(s) = serde_json::from_value::<Snapshot>(m.data) { app.agents = s.agents; }
                }
            }
        }
        if app.quit { break; }
    }

    ratatui::restore();
    Ok(())
}
```

### Benchmarking

After building both TUIs, measure:

```bash
# 1. Startup time
time gt tui         # Go
time gastown-tui    # Rust

# 2. Memory
ps aux | grep -E 'gt|gastown-tui'

# 3. Event throughput (send 1000 events/sec to daemon, observe lag)

# 4. Input latency (subjective: does typing feel instant?)
```

**Decision rule**: If Rust TUI shows >30% improvement in any metric, consider migration. Otherwise, keep Go TUI (simpler, same language as daemon).

---

## Configuration

Add to `.beads/config.yaml`:

```yaml
api:
  enabled: true
  addr: ":8080"
  secret: "generate-with-openssl-rand-hex-32"
  users:
    admin:
      password: "$2y$10$..."  # bcrypt hash
      role: admin
```

Generate password hash: `htpasswd -nB admin`

---

## PWA Architecture

Gas Town is designed as a **Progressive Web App** for mobile access, offline resilience, and installability.

### Web App Manifest

```json
{
  "name": "Gas Town Mission Control",
  "short_name": "Gas Town",
  "description": "Agent fleet management and monitoring",
  "display": "standalone",
  "orientation": "portrait-primary",
  "theme_color": "#00ddaa",
  "background_color": "#0a0a0c",
  "start_url": "/",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile.png",
      "sizes": "390x844",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

### Service Worker Strategy

```typescript
// src/service-worker.ts
import { build, files, version } from '$service-worker';

const CACHE_NAME = `gastown-${version}`;
const APP_SHELL = [...build, ...files];

// Install: Cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    // API: Network first, fallback to cache
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone)
          );
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Static: Cache first, fallback to network
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
  }
});
```

### WebSocket Reconnection

```typescript
// lib/websocket.ts
class ReconnectingWebSocket {
  private ws: WebSocket | null = null;
  private reconnectDelay = 1000;
  private maxDelay = 30000;

  connect(url: string, onMessage: (data: any) => void) {
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.reconnectDelay = 1000; // Reset on success
    };

    this.ws.onmessage = (e) => onMessage(JSON.parse(e.data));

    this.ws.onclose = () => {
      setTimeout(() => this.connect(url, onMessage), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay);
    };
  }

  disconnect() {
    this.ws?.close();
  }
}
```

### Push Notifications

```typescript
// lib/notifications.ts
export async function subscribeToPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: PUBLIC_VAPID_KEY
  });

  await fetch('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: { 'Content-Type': 'application/json' }
  });
}

// Notification types
type NotificationPayload =
  | { type: 'agent.error'; agent: string; message: string }
  | { type: 'workflow.complete'; workflow: string }
  | { type: 'queue.assigned'; item: string };
```

### Offline Indicator Component

```svelte
<!-- lib/components/OfflineIndicator.svelte -->
<script>
  import { onMount } from 'svelte';

  let isOnline = true;

  onMount(() => {
    isOnline = navigator.onLine;
    window.addEventListener('online', () => isOnline = true);
    window.addEventListener('offline', () => isOnline = false);
  });
</script>

{#if !isOnline}
  <div class="offline-banner animate-slide-down">
    <span class="status warning">Offline</span>
    <span>Showing cached data</span>
  </div>
{/if}

<style>
  .offline-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-2) var(--space-4);
    background: var(--status-warning);
    color: var(--bg);
    text-align: center;
    font-size: 12px;
    z-index: 1000;
  }
</style>
```

---

## Security Hardening

### Content Security Policy

```typescript
// src/hooks.server.ts
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);

  // Content Security Policy
  response.headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",  // SvelteKit requires inline
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' wss: https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));

  // Security Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // HSTS (production only)
  if (import.meta.env.PROD) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
};
```

### Secure Authentication

```typescript
// src/routes/api/auth/token/+server.ts
import { json, error } from '@sveltejs/kit';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export async function POST({ request, cookies }) {
  const { username, password } = await request.json();

  const user = await getUser(username);
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    throw error(401, 'Invalid credentials');
  }

  const token = crypto.randomBytes(32).toString('hex');
  await storeToken(token, user.id, Date.now() + 24 * 60 * 60 * 1000);

  // HttpOnly cookie - not accessible via JavaScript
  cookies.set('gt_session', token, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });

  return json({ success: true, role: user.role });
}
```

### XSS Prevention

```typescript
// lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
    ALLOWED_ATTR: []
  });
}

// Usage in components
// {@html sanitizeHtml(userContent)}
```

### Error Monitoring

```typescript
// src/hooks.client.ts
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.browserTracingIntegration()
  ],
  environment: import.meta.env.MODE
});

export const handleError = Sentry.handleErrorWithSentry();
```

### Rate Limiting (Client-Side)

```typescript
// lib/rateLimit.ts
class RateLimiter {
  private requests: number[] = [];
  private limit: number;
  private window: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.window = windowMs;
  }

  canRequest(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter(t => t > now - this.window);

    if (this.requests.length >= this.limit) {
      return false;
    }

    this.requests.push(now);
    return true;
  }
}

// Limit API calls: 100 requests per minute
export const apiLimiter = new RateLimiter(100, 60000);
```

---

## Performance Targets

### Core Web Vitals

| Metric | Target | Measurement |
|--------|--------|-------------|
| **LCP** | < 2.5s | Largest Contentful Paint |
| **FID** | < 100ms | First Input Delay |
| **CLS** | < 0.1 | Cumulative Layout Shift |
| **TTFB** | < 600ms | Time to First Byte |
| **FCP** | < 1.8s | First Contentful Paint |

### Bundle Size Budgets

| Bundle | Budget | Notes |
|--------|--------|-------|
| Initial JS | < 100KB | Code-split routes |
| Vendor chunk | < 150KB | External libraries |
| CSS | < 50KB | Tailwind purged |
| Total initial | < 300KB | Gzipped |

### Performance Monitoring

```typescript
// lib/performance.ts
export function reportWebVitals() {
  if ('web-vital' in window) return;

  import('web-vitals').then(({ onCLS, onFID, onLCP, onFCP, onTTFB }) => {
    const report = (metric: any) => {
      fetch('/api/metrics', {
        method: 'POST',
        body: JSON.stringify({
          name: metric.name,
          value: metric.value,
          id: metric.id
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    };

    onCLS(report);
    onFID(report);
    onLCP(report);
    onFCP(report);
    onTTFB(report);
  });
}
```

---

## Timeline

| Week | Deliverable |
|------|-------------|
| 1 | API server: HTTP endpoints working |
| 2 | WebSocket events streaming, auth complete |
| 3 | Web: login, layout, live connection |
| 4 | Web: agents, workflows, queue panels |
| 5 | Web: responsive polish, error states |
| 6 | Rust TUI: connect, display, navigate |
| 7 | Benchmark Rust vs Go TUI, decide |

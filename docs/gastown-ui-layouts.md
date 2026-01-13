# Gas Town UI Layouts & Design Specification

Complete responsive layouts for mobile, tablet, and desktop. All pages and components.

Themed as an **Industrial Control Center** — a mission control interface for monitoring autonomous agent workers.

---

## Design System

### Typography

```css
/* Font Families */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-sans: 'IBM Plex Sans', system-ui, sans-serif;
--font-display: 'IBM Plex Sans', system-ui, sans-serif;

/* Type Scale */
--text-xs: 11px;      /* Labels, badges */
--text-sm: 12px;      /* Secondary text */
--text-base: 13px;    /* Body text */
--text-lg: 14px;      /* Emphasized text */
--text-xl: 16px;      /* Subheadings */
--text-2xl: 20px;     /* Headings */
--text-3xl: 24px;     /* Page titles */

/* Line Heights */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* Letter Spacing */
--tracking-tight: -0.02em;
--tracking-normal: 0;
--tracking-wide: 0.05em;
--tracking-wider: 0.1em;  /* For uppercase labels */
```

### Colors (Industrial Control Center Theme)

```css
/* Backgrounds - Industrial Dark */
--bg-void: #050507;        /* Deepest background, full bleed */
--bg-base: #0a0a0c;        /* Primary background */
--bg-raised: #111114;      /* Elevated surfaces, panels */
--bg-elevated: #1a1a1f;    /* Cards, dropdowns */
--bg-hover: #242429;       /* Interactive hover states */
--bg-active: #2a2a32;      /* Active/pressed states */

/* Glass Morphism */
--bg-glass: rgba(17, 17, 20, 0.8);
--bg-glass-strong: rgba(17, 17, 20, 0.95);
--bg-glass-blur: 12px;
--bg-glass-blur-strong: 20px;

/* Text - High Contrast */
--text-primary: #f4f4f5;   /* Primary content */
--text-secondary: #a1a1aa; /* Secondary content */
--text-muted: #71717a;     /* Tertiary/disabled */
--text-inverse: #0a0a0c;   /* On accent backgrounds */

/* Status - Industrial Indicators */
--status-running: #22c55e;     /* Green - operational */
--status-running-glow: rgba(34, 197, 94, 0.4);
--status-idle: #6b7280;        /* Gray - standby */
--status-error: #ef4444;       /* Red - fault */
--status-error-glow: rgba(239, 68, 68, 0.4);
--status-warning: #f59e0b;     /* Amber - caution */
--status-warning-glow: rgba(245, 158, 11, 0.4);
--status-info: #3b82f6;        /* Blue - informational */
--status-info-glow: rgba(59, 130, 246, 0.4);

/* Accent - Teal/Cyan (Factory Machinery) */
--accent: #0da;                /* Primary accent #00ddaa */
--accent-hover: #22d3ee;       /* Hover state */
--accent-active: #06b6d4;      /* Active state */
--accent-muted: rgba(13, 221, 170, 0.2);
--accent-glow: rgba(13, 221, 170, 0.3);
--accent-glow-strong: rgba(13, 221, 170, 0.5);

/* Borders */
--border: #1e1e26;             /* Default borders */
--border-strong: #2a2a36;      /* Emphasized borders */
--border-accent: var(--accent);
--border-focus: var(--accent);

/* Shadows */
--shadow-sm: 0 2px 8px -2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 16px -4px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 8px 32px -8px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px var(--accent-glow);
--shadow-glow-strong: 0 0 40px var(--accent-glow-strong);
```

### Animation Tokens

```css
/* Timing */
--duration-instant: 50ms;
--duration-fast: 150ms;
--duration-normal: 300ms;
--duration-slow: 500ms;
--duration-gradient: 3s;
--duration-shimmer: 2s;
--duration-beam: 4s;
--duration-glow: 2s;
--duration-typing: 3s;

/* Easing Functions */
--ease-linear: linear;
--ease-out: cubic-bezier(0.33, 1, 0.68, 1);
--ease-in: cubic-bezier(0.32, 0, 0.67, 0);
--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-bounce: cubic-bezier(0.68, -0.6, 0.32, 1.6);

/* Stagger Delays */
--stagger-1: 0.05s;
--stagger-2: 0.10s;
--stagger-3: 0.15s;
--stagger-4: 0.20s;
--stagger-5: 0.25s;
--stagger-6: 0.30s;
--stagger-7: 0.35s;
--stagger-8: 0.40s;
```

### Spacing

```css
--space-0: 0;
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;

/* Touch Targets */
--touch-target-min: 44px;      /* WCAG 2.2 minimum */
--touch-target-comfortable: 48px;
```

### Radii

```css
--radius-none: 0;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;
--radius-full: 9999px;
```

### Breakpoints

```css
/* Mobile:    < 640px   (single column, bottom nav) */
/* Tablet:    640px – 1023px (two column, sidebar) */
/* Desktop:   ≥ 1024px  (three column, full dashboard) */
/* Wide:      ≥ 1280px  (expanded panels, more data) */
/* Ultrawide: ≥ 1536px  (maximum width, extra detail) */

@custom-media --mobile (max-width: 639px);
@custom-media --tablet (min-width: 640px) and (max-width: 1023px);
@custom-media --desktop (min-width: 1024px);
@custom-media --wide (min-width: 1280px);
@custom-media --ultrawide (min-width: 1536px);
```

### Z-Index Scale

```css
--z-base: 0;
--z-dropdown: 100;
--z-sticky: 200;
--z-overlay: 300;
--z-modal: 400;
--z-popover: 500;
--z-toast: 600;
--z-tooltip: 700;
--z-max: 9999;
```

---

## Animation System (Magic UI)

Adopted from Mouchak Mail's factory-inspired animation library. All animations respect `prefers-reduced-motion`.

### Core Keyframes

```css
/* Gradient shift for animated backgrounds */
@keyframes gradient-x {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

@keyframes gradient-y {
  0%, 100% { background-position: 50% 0%; }
  50% { background-position: 50% 100%; }
}

/* Shimmer effect for text highlights and skeletons */
@keyframes shimmer {
  from { background-position: -200% 0; }
  to { background-position: 200% 0; }
}

/* Blur fade entrance - 4 directions */
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

/* Grid pattern pulse for backgrounds */
@keyframes grid-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

/* Border beam sweep for active elements */
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

/* Status-specific animations */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes scale-in {
  from { transform: scale(0); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

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

/* Number counter tick */
@keyframes count-up {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}
```

### Animation Classes

```css
/* Gradient animations */
.animate-gradient-x {
  background-size: 200% 200%;
  animation: gradient-x var(--duration-gradient) ease infinite;
}

/* Shimmer text effect */
.animate-shimmer {
  background: linear-gradient(
    90deg,
    var(--text-primary) 0%,
    var(--accent) 50%,
    var(--text-primary) 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: shimmer var(--duration-shimmer) linear infinite;
}

/* Blur fade entrances */
.animate-blur-fade-up { animation: blur-fade-up var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-down { animation: blur-fade-down var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-left { animation: blur-fade-left var(--duration-slow) var(--ease-out) forwards; }
.animate-blur-fade-right { animation: blur-fade-right var(--duration-slow) var(--ease-out) forwards; }

/* Status animations */
.animate-glow-pulse { animation: glow-pulse var(--duration-glow) ease-in-out infinite; }
.animate-spin { animation: spin 1s linear infinite; }
.animate-scale-in { animation: scale-in 0.2s var(--ease-out); }
.animate-shake { animation: shake 0.5s var(--ease-in-out); }

/* Typing cursor */
.typing-cursor::after {
  content: '█';
  animation: blink 1s step-end infinite;
  color: var(--accent);
}
```

### Stagger System

For animating lists and groups of elements with sequential delays:

```css
/* Container with staggered children */
.stagger > * {
  opacity: 0;
  animation: blur-fade-up 0.4s var(--ease-out) forwards;
}

.stagger > *:nth-child(1) { animation-delay: var(--stagger-1); }
.stagger > *:nth-child(2) { animation-delay: var(--stagger-2); }
.stagger > *:nth-child(3) { animation-delay: var(--stagger-3); }
.stagger > *:nth-child(4) { animation-delay: var(--stagger-4); }
.stagger > *:nth-child(5) { animation-delay: var(--stagger-5); }
.stagger > *:nth-child(6) { animation-delay: var(--stagger-6); }
.stagger > *:nth-child(7) { animation-delay: var(--stagger-7); }
.stagger > *:nth-child(8) { animation-delay: var(--stagger-8); }

/* Fast stagger for compact lists */
.stagger-fast > * {
  opacity: 0;
  animation: slide-up 0.3s var(--ease-out) forwards;
}

.stagger-fast > *:nth-child(1) { animation-delay: 0.02s; }
.stagger-fast > *:nth-child(2) { animation-delay: 0.04s; }
.stagger-fast > *:nth-child(3) { animation-delay: 0.06s; }
.stagger-fast > *:nth-child(4) { animation-delay: 0.08s; }
.stagger-fast > *:nth-child(5) { animation-delay: 0.10s; }
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .stagger > *,
  .stagger-fast > * {
    opacity: 1;
    animation: none;
  }
}
```

---

## Glass Morphism

Frosted glass panels for the control room aesthetic:

```css
/* Standard glass panel */
.panel-glass {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--bg-glass-blur));
  -webkit-backdrop-filter: blur(var(--bg-glass-blur));
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}

/* Strong glass for overlays */
.panel-glass-strong {
  background: var(--bg-glass-strong);
  backdrop-filter: blur(var(--bg-glass-blur-strong));
  -webkit-backdrop-filter: blur(var(--bg-glass-blur-strong));
  border: 1px solid var(--border-strong);
}

/* Header glass (sticky) */
.header-glass {
  background: var(--bg-glass);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid var(--border);
}

/* Modal overlay glass */
.overlay-glass {
  background: rgba(5, 5, 7, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
```

---

## Interactive States

### Card Hover Effects

```css
/* Standard interactive card */
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

.card-interactive:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
```

### Border Beam Effect

Animated gradient border for active/selected elements:

```css
.border-beam {
  position: relative;
  overflow: hidden;
}

.border-beam::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--accent) 50%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: border-beam var(--duration-beam) linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  -webkit-mask-composite: xor;
  padding: 1px;
  border-radius: inherit;
  pointer-events: none;
}
```

### Focus States

```css
/* Keyboard focus visible */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Focus within container */
.focus-within:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}
```

### Button States

```css
.btn {
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.btn:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.btn:active {
  transform: scale(0.98);
  background: var(--bg-active);
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Primary button */
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-inverse);
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}
```

---

## Loading States

### Skeleton Shimmer

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-raised) 0%,
    var(--bg-elevated) 50%,
    var(--bg-raised) 100%
  );
  background-size: 200% 100%;
  animation: shimmer var(--duration-shimmer) linear infinite;
  border-radius: var(--radius-sm);
}

/* Skeleton variants */
.skeleton-text {
  height: 1em;
  width: 100%;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
}

.skeleton-card {
  height: 120px;
  width: 100%;
}
```

### Progress Indicators

```css
/* Determinate progress bar */
.progress {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out);
}

/* Indeterminate progress */
.progress-indeterminate .progress-bar {
  width: 30%;
  animation: indeterminate 1.5s ease-in-out infinite;
}

@keyframes indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}

/* Spinner */
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}
```

### Empty States

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8);
  text-align: center;
  color: var(--text-muted);
}

.empty-state-icon {
  width: 48px;
  height: 48px;
  margin-bottom: var(--space-4);
  opacity: 0.5;
}

.empty-state-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--space-2);
}

.empty-state-description {
  font-size: var(--text-sm);
  max-width: 280px;
}
```

---

## Page Layouts

### 1. Login Page

#### Mobile (< 640px)
```
┌─────────────────────────────────┐
│                                 │
│                                 │
│            ◆                    │
│         GAS TOWN                │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Username                │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │ Password                │   │
│   └─────────────────────────┘   │
│                                 │
│   ┌─────────────────────────┐   │
│   │        Sign In          │   │
│   └─────────────────────────┘   │
│                                 │
│                                 │
└─────────────────────────────────┘
```

#### Tablet & Desktop (≥ 640px)
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                                                             │
│                    ┌───────────────────┐                    │
│                    │                   │                    │
│                    │        ◆          │                    │
│                    │     GAS TOWN      │                    │
│                    │   Mission Control │                    │
│                    │                   │                    │
│                    │ ┌───────────────┐ │                    │
│                    │ │ Username      │ │                    │
│                    │ └───────────────┘ │                    │
│                    │                   │                    │
│                    │ ┌───────────────┐ │                    │
│                    │ │ Password      │ │                    │
│                    │ └───────────────┘ │                    │
│                    │                   │                    │
│                    │ ┌───────────────┐ │                    │
│                    │ │    Sign In    │ │                    │
│                    │ └───────────────┘ │                    │
│                    │                   │                    │
│                    └───────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### 2. Dashboard (Main View)

#### Mobile (< 640px)
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │ ← Header (48px)
├─────────────────────────────────┤
│                                 │
│  AGENTS (3)              [+ New]│ ← Panel header
│  ─────────────────────────────  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ● polecat-01    RUNNING   │  │ ← Agent cards
│  │   Security audit          │  │   (full width)
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ● polecat-02    RUNNING   │  │
│  │   Code review             │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ○ wisp-03       IDLE      │  │
│  │   Waiting                 │  │
│  └───────────────────────────┘  │
│                                 │
│  [View All Agents →]            │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │ ← Bottom nav (56px)
└─────────────────────────────────┘
```

**Mobile Navigation Tabs:**
```
┌────────┬────────┬────────┬────────┐
│   📊   │   ⚡   │   📋   │   📜   │
│ Agents │ Flows  │ Queue  │  Logs  │
└────────┴────────┴────────┴────────┘
```

**Mobile - Workflows Tab Active:**
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │
├─────────────────────────────────┤
│                                 │
│  WORKFLOWS                      │
│  ─────────────────────────────  │
│                                 │
│  code-review                    │
│  ████████████░░░░  4/5   2m 34s │
│                                 │
│  security-audit                 │
│  ████████████████  5/5   done ✓ │
│                                 │
│  refactor-auth                  │
│  ░░░░░░░░░░░░░░░░  0/8   queued │
│                                 │
│  update-deps                    │
│  ████░░░░░░░░░░░░  1/4   1m 02s │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

**Mobile - Queue Tab Active:**
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │
├─────────────────────────────────┤
│                                 │
│  QUEUE (12)              [+ Add]│
│  ─────────────────────────────  │
│                                 │
│  ● gt-a3f2d                     │
│    Review PR #142               │
│    → polecat-01                 │
│                                 │
│  ◐ gt-b8e1c                     │
│    Fix auth bug                 │
│    processing...                │
│                                 │
│  ○ gt-c9d4e                     │
│    Update docs                  │
│    pending                      │
│                                 │
│  ○ gt-d7f3a                     │
│    Refactor tests               │
│    pending                      │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

**Mobile - Logs Tab Active:**
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │
├─────────────────────────────────┤
│                                 │
│  LOGS                [⏸] [Filter]│
│  ─────────────────────────────  │
│                                 │
│  14:23:01 INF polecat-01        │
│  Starting security audit        │
│                                 │
│  14:23:02 DBG polecat-01        │
│  Loaded 47 files                │
│                                 │
│  14:23:05 INF daemon            │
│  Heartbeat OK (4 agents)        │
│                                 │
│  14:23:07 WRN witness-01        │
│  High latency: 234ms            │
│                                 │
│  14:23:08 INF queue             │
│  New item: gt-e2a4b             │
│                                 │
│  █                              │ ← Auto-scroll indicator
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

---

#### Tablet (640px – 1023px)
```
┌────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN              [Search...]           ● Connected  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────┐  ┌──────────────────────────┐  │
│  │ AGENTS (3)      [+ New]│  │ DETAIL                   │  │
│  │────────────────────────│  │──────────────────────────│  │
│  │                        │  │                          │  │
│  │ ▸ ● polecat-01 RUNNING │◀─│ polecat-01               │  │
│  │   ○ wisp-03    IDLE    │  │ Type: polecat            │  │
│  │   ◐ witness-01 OBSERV  │  │ Status: ● Running        │  │
│  │                        │  │ Task: Security audit     │  │
│  │────────────────────────│  │ Uptime: 2h 34m           │  │
│  │ WORKFLOWS              │  │ Worktree: feature/auth   │  │
│  │────────────────────────│  │                          │  │
│  │ ▶ code-review   4/5    │  │ ┌──────────────────────┐ │  │
│  │ ✓ security      5/5    │  │ │ Recent Output        │ │  │
│  │ ○ refactor      0/8    │  │ │ > Analyzing file 3/47│ │  │
│  │                        │  │ │ > Found 2 issues     │ │  │
│  └────────────────────────┘  │ │ > Fixing issue 1...  │ │  │
│                              │ └──────────────────────┘ │  │
│                              │                          │  │
│                              │ [Stop] [Restart] [Logs]  │  │
│                              └──────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ LOGS                                       [⏸] [▼]   │  │
│  │──────────────────────────────────────────────────────│  │
│  │ 14:23:01 INF polecat-01  Starting security audit     │  │
│  │ 14:23:02 DBG polecat-01  Loaded 47 files into ctx    │  │
│  │ 14:23:05 INF daemon      Heartbeat check passed      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

#### Desktop (≥ 1024px)
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN                    ⌘K Search...                       ● Connected │
│   Mission Control                                                 admin@local │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  ┌───────────────┐  │
│  │ AGENTS      3/4 │  │ WORKFLOWS                       │  │ SYSTEM        │  │
│  │─────────────────│  │─────────────────────────────────│  │───────────────│  │
│  │                 │  │                                 │  │ Daemon: ● Up  │  │
│  │ ┌─────────────┐ │  │  code-review                    │  │ Uptime: 4h12m │  │
│  │ │● polecat-01 │ │  │  ████████████░░░░░░  4/5  2m34s │  │ Memory: 124MB │  │
│  │ │  Running    │ │  │                                 │  │ CPU: 2.3%     │  │
│  │ │  2h 34m     │ │  │  security-audit                 │  │               │  │
│  │ └─────────────┘ │  │  ████████████████████  5/5  ✓   │  │───────────────│  │
│  │ ┌─────────────┐ │  │                                 │  │ QUEUE         │  │
│  │ │● polecat-02 │ │  │  refactor-auth                  │  │───────────────│  │
│  │ │  Running    │ │  │  ░░░░░░░░░░░░░░░░░░  0/8  queued│  │ Pending: 12   │  │
│  │ │  1h 12m     │ │  │                                 │  │ Active: 3     │  │
│  │ └─────────────┘ │  │  update-deps                    │  │ Failed: 0     │  │
│  │ ┌─────────────┐ │  │  ████░░░░░░░░░░░░░░  1/4  1m02s │  │               │  │
│  │ │○ wisp-03    │ │  │                                 │  │───────────────│  │
│  │ │  Idle       │ │  └─────────────────────────────────┘  │ ACTIONS       │  │
│  │ └─────────────┘ │  ┌─────────────────────────────────┐  │───────────────│  │
│  │ ┌─────────────┐ │  │ QUEUE                        12 │  │ [+ Agent]     │  │
│  │ │◐ witness-01 │ │  │─────────────────────────────────│  │ [▶ Formula]   │  │
│  │ │  Observing  │ │  │ ● gt-a3f2d Review PR #142    →  │  │ [⏹ Stop All]  │  │
│  │ └─────────────┘ │  │ ◐ gt-b8e1c Fix auth bug     ... │  │               │  │
│  │                 │  │ ○ gt-c9d4e Update docs          │  │───────────────│  │
│  │ [+ New Agent]   │  │ ○ gt-d7f3a Refactor tests       │  │ SHORTCUTS     │  │
│  └─────────────────┘  └─────────────────────────────────┘  │───────────────│  │
│                                                            │ ⌘K Command    │  │
│  ┌──────────────────────────────────────────────────────┐  │ ⌘1 Agents     │  │
│  │ LOGS                                    [⏸] [↓] [⚙] │  │ ⌘2 Workflows  │  │
│  │────────────────────────────────────────────────────────│ │ ⌘L Logs       │  │
│  │ 14:23:01.234 INF polecat-01  Starting security audit │  │ ?  Help       │  │
│  │ 14:23:02.456 DBG polecat-01  Loaded 47 files         │  └───────────────┘  │
│  │ 14:23:05.789 INF daemon      Heartbeat OK            │                     │
│  │ 14:23:07.012 WRN witness-01  High latency: 234ms     │                     │
│  │ █                                                    │                     │
│  └──────────────────────────────────────────────────────┘                     │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

#### Wide Desktop (≥ 1280px)

Same as desktop but with more horizontal space for log messages and queue summaries.

---

### 3. Agent Detail Page

#### Mobile
```
┌─────────────────────────────────┐
│ ← Back                          │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │         ●                 │  │
│  │    polecat-01             │  │
│  │    Running · 2h 34m       │  │
│  └───────────────────────────┘  │
│                                 │
│  DETAILS                        │
│  ───────────────────────────    │
│  Type        polecat            │
│  Status      ● Running          │
│  Task        Security audit     │
│  Worktree    feature/auth       │
│  Started     14:23:01           │
│                                 │
│  ACTIONS                        │
│  ───────────────────────────    │
│  ┌───────────┐ ┌───────────┐    │
│  │   Stop    │ │  Restart  │    │
│  └───────────┘ └───────────┘    │
│                                 │
│  OUTPUT                         │
│  ───────────────────────────    │
│  > Analyzing file 3/47...       │
│  > Found 2 security issues      │
│  > Fixing issue 1 of 2...       │
│  > Applied patch to auth.go     │
│  █                              │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

#### Tablet
```
┌────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN    ← Agents / polecat-01           ● Connected  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │  ●  polecat-01                                     │    │
│  │     Running · 2h 34m 12s                           │    │
│  │                                                    │    │
│  │  ┌──────────────┬──────────────┬──────────────┐   │    │
│  │  │ Type         │ Task         │ Worktree     │   │    │
│  │  │ polecat      │ Security     │ feature/auth │   │    │
│  │  │              │ audit        │              │   │    │
│  │  └──────────────┴──────────────┴──────────────┘   │    │
│  │                                                    │    │
│  │  [Stop]  [Restart]  [View Logs]  [Reassign]       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
│  ┌────────────────────────────────────────────────────┐    │
│  │ LIVE OUTPUT                                 [⏸]   │    │
│  │──────────────────────────────────────────────────────│  │
│  │ 14:23:01 > Starting security audit...              │    │
│  │ 14:23:02 > Loading context (47 files)              │    │
│  │ 14:23:15 > Analyzing file 3/47...                  │    │
│  │ 14:23:18 > Found 2 security issues                 │    │
│  │ 14:23:20 > Fixing issue 1 of 2...                  │    │
│  │ 14:23:25 > Applied patch to auth.go                │    │
│  │ █                                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Desktop
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN    ← Agents / polecat-01                              ● Connected │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────────────────────────────┐  ┌───────────────────────────────┐ │
│  │  ●  polecat-01                        │  │ LIVE OUTPUT              [⏸] │ │
│  │     Running                           │  │─────────────────────────────────│
│  │                                       │  │                               │ │
│  │  ┌─────────────────────────────────┐  │  │ 14:23:01 Starting audit...   │ │
│  │  │ Type          polecat           │  │  │ 14:23:02 Loading 47 files    │ │
│  │  │ Status        ● Running         │  │  │ 14:23:15 Analyzing 3/47...   │ │
│  │  │ Uptime        2h 34m 12s        │  │  │ 14:23:18 Found 2 issues      │ │
│  │  │ Task          Security audit    │  │  │ 14:23:20 Fixing issue 1/2... │ │
│  │  │ Worktree      feature/auth      │  │  │ 14:23:25 Patched auth.go     │ │
│  │  │ Started       2025-01-02 14:23  │  │  │ 14:23:30 Fixing issue 2/2... │ │
│  │  │ Heartbeat     2s ago            │  │  │ 14:23:35 Patched session.go  │ │
│  │  └─────────────────────────────────┘  │  │ 14:23:40 Running tests...    │ │
│  │                                       │  │ 14:23:55 Tests passed (12/12)│ │
│  │  ACTIONS                              │  │ 14:24:00 Committing changes  │ │
│  │  ─────────────────────────────────    │  │ █                            │ │
│  │  [Stop] [Restart] [Reassign] [Kill]   │  │                               │ │
│  │                                       │  │                               │ │
│  │  METRICS                              │  │                               │ │
│  │  ─────────────────────────────────    │  │                               │ │
│  │  CPU: ████░░░░░░ 42%                  │  │                               │ │
│  │  Mem: ██░░░░░░░░ 18%                  │  │                               │ │
│  │  Events: 1,247 processed             │  │                               │ │
│  │                                       │  │                               │ │
│  └───────────────────────────────────────┘  └───────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### 4. Workflow Detail Page

#### Mobile
```
┌─────────────────────────────────┐
│ ← Back                          │
├─────────────────────────────────┤
│                                 │
│  code-review                    │
│  ████████████░░░░  4/5          │
│  Running · 2m 34s               │
│                                 │
│  STEPS                          │
│  ───────────────────────────    │
│                                 │
│  ✓ 1. Clone repository          │
│       12s · polecat-01          │
│                                 │
│  ✓ 2. Analyze changes           │
│       45s · polecat-01          │
│                                 │
│  ✓ 3. Run linter                │
│       23s · polecat-02          │
│                                 │
│  ● 4. Security scan             │ ← Current
│       1m 14s · polecat-01       │
│                                 │
│  ○ 5. Generate report           │
│       pending                   │
│                                 │
│  [Cancel Workflow]              │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

#### Desktop
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN    ← Workflows / code-review                         ● Connected │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                         │  │
│  │   code-review                                          Running · 2m 34s │  │
│  │   ═══════════════════════════════════════════●═══════════○              │  │
│  │   1           2           3           4                  5              │  │
│  │                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌───────────────────────────────────────┐  ┌───────────────────────────────┐ │
│  │ STEPS                                 │  │ STEP 4: Security scan         │ │
│  │─────────────────────────────────────────│ │─────────────────────────────────│
│  │                                       │  │                               │ │
│  │  ✓ 1. Clone repository      12s      │  │ Status: ● Running             │ │
│  │       polecat-01 · done              │  │ Agent: polecat-01             │ │
│  │                                       │  │ Duration: 1m 14s             │ │
│  │  ✓ 2. Analyze changes       45s      │  │                               │ │
│  │       polecat-01 · done              │  │ Output:                       │ │
│  │                                       │  │ ─────────────────────────     │ │
│  │  ✓ 3. Run linter            23s      │  │ > Scanning dependencies...    │ │
│  │       polecat-02 · done              │  │ > Found 0 critical vulns      │ │
│  │                                       │  │ > Found 2 moderate vulns     │ │
│  │  ● 4. Security scan         1m 14s   │  │ > Analyzing code patterns...  │ │
│  │       polecat-01 · running ◀─────────│──│ > 47% complete                │ │
│  │                                       │  │ █                            │ │
│  │  ○ 5. Generate report       —        │  │                               │ │
│  │       pending                        │  │                               │ │
│  │                                       │  │                               │ │
│  └───────────────────────────────────────┘  └───────────────────────────────┘ │
│                                                                               │
│  [Cancel Workflow]  [Pause]  [Skip Step]                                      │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### 5. Queue Page (Full View)

#### Mobile
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │
├─────────────────────────────────┤
│                                 │
│  QUEUE (12)              [+ Add]│
│  ───────────────────────────    │
│                                 │
│  PROCESSING (2)                 │
│  ┌───────────────────────────┐  │
│  │ ● gt-a3f2d                │  │
│  │   Review PR #142          │  │
│  │   polecat-01 · 2m 15s     │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ◐ gt-b8e1c                │  │
│  │   Fix auth bug            │  │
│  │   polecat-02 · 45s        │  │
│  └───────────────────────────┘  │
│                                 │
│  PENDING (10)                   │
│  ┌───────────────────────────┐  │
│  │ ○ gt-c9d4e                │  │
│  │   Update docs             │  │
│  │   Priority: Normal        │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ ○ gt-d7f3a                │  │
│  │   Refactor tests          │  │
│  │   Priority: Low           │  │
│  └───────────────────────────┘  │
│         ... 8 more              │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

#### Desktop
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN    Queue                                              ● Connected │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────┐  ┌────────┐  │
│  │ QUEUE                                             [+ Add]   │  │ STATS  │  │
│  │─────────────────────────────────────────────────────────────│  │────────│  │
│  │                                                             │  │        │  │
│  │  ID        SUMMARY                    STATUS     AGENT      │  │ Total  │  │
│  │  ───────────────────────────────────────────────────────    │  │   12   │  │
│  │  gt-a3f2d  Review PR #142             ● running  polecat-01 │  │        │  │
│  │  gt-b8e1c  Fix auth bug               ◐ running  polecat-02 │  │ Active │  │
│  │  gt-c9d4e  Update documentation       ○ pending  —          │  │   2    │  │
│  │  gt-d7f3a  Refactor test suite        ○ pending  —          │  │        │  │
│  │  gt-e5h2k  Add logging middleware     ○ pending  —          │  │ Pending│  │
│  │  gt-f6j3m  Fix memory leak            ○ pending  —          │  │   10   │  │
│  │  gt-g7k4n  Update dependencies        ○ pending  —          │  │        │  │
│  │  gt-h8l5p  Implement caching          ○ pending  —          │  │ Failed │  │
│  │  gt-i9m6q  Write API docs             ○ pending  —          │  │   0    │  │
│  │  gt-j0n7r  Performance optimization   ○ pending  —          │  │        │  │
│  │                                                             │  │        │  │
│  │  [Load More...]                                             │  │        │  │
│  │                                                             │  │        │  │
│  └─────────────────────────────────────────────────────────────┘  └────────┘  │
│                                                                               │
│  Selected: gt-a3f2d                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Review PR #142                                                          │  │
│  │ Submitted: 2025-01-02 14:20:15 · Priority: High · Assigned: polecat-01  │  │
│  │                                                                         │  │
│  │ [Reassign] [Bump Priority] [Cancel]                                     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### 6. Logs Page (Full View)

#### Mobile
```
┌─────────────────────────────────┐
│ ◆ GAS TOWN          ● Connected │
├─────────────────────────────────┤
│                                 │
│  LOGS                           │
│  ┌───────────────────────────┐  │
│  │ [All ▼] [Filter...] [⏸]  │  │
│  └───────────────────────────┘  │
│                                 │
│  14:23:01 INF                   │
│  polecat-01                     │
│  Starting security audit        │
│  ───────────────────────────    │
│  14:23:02 DBG                   │
│  polecat-01                     │
│  Loaded 47 files into context   │
│  ───────────────────────────    │
│  14:23:05 INF                   │
│  daemon                         │
│  Heartbeat check passed         │
│  ───────────────────────────    │
│  14:23:07 WRN                   │
│  witness-01                     │
│  High latency detected: 234ms   │
│  ───────────────────────────    │
│  14:23:08 ERR                   │
│  polecat-02                     │
│  Connection timeout             │
│  ───────────────────────────    │
│  █                              │
│                                 │
├─────────────────────────────────┤
│ [Agents] [Flows] [Queue] [Logs] │
└─────────────────────────────────┘
```

#### Desktop
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN    Logs                                               ● Connected │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ FILTERS                                                                 │  │
│  │─────────────────────────────────────────────────────────────────────────│  │
│  │ Level: [All ▼]  Source: [All ▼]  Search: [________________]  [⏸] [↓]   │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ TIMESTAMP       LEVEL  SOURCE       MESSAGE                             │  │
│  │─────────────────────────────────────────────────────────────────────────│  │
│  │ 14:23:01.234    INF    polecat-01   Starting security audit task       │  │
│  │ 14:23:01.456    DBG    polecat-01   Loaded 47 files into context       │  │
│  │ 14:23:02.789    INF    daemon       Heartbeat check passed (4 agents)  │  │
│  │ 14:23:05.012    INF    polecat-02   Running test suite: 42/50 passed   │  │
│  │ 14:23:07.345    WRN    witness-01   High latency detected: 234ms       │  │
│  │ 14:23:08.678    INF    queue        New item submitted: gt-e2a4b       │  │
│  │ 14:23:10.901    DBG    polecat-01   Analyzing file 12/47: auth.go      │  │
│  │ 14:23:12.234    INF    polecat-01   Found 2 security issues            │  │
│  │ 14:23:15.567    DBG    polecat-01   Applying fix to issue 1            │  │
│  │ 14:23:18.890    ERR    polecat-02   Connection timeout to API          │  │
│  │ 14:23:20.123    INF    polecat-02   Retrying connection (attempt 2)    │  │
│  │ 14:23:22.456    INF    polecat-02   Connection restored                │  │
│  │ 14:23:25.789    INF    polecat-01   Fix applied successfully           │  │
│  │ █                                                                       │  │
│  │                                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  Showing 1,247 entries · Auto-scroll: ON                                      │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### 7. Command Palette

Triggered by `⌘K` or clicking search bar.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│         ┌─────────────────────────────────────────────────────────┐           │
│         │ > spawn polecat█                                        │           │
│         └─────────────────────────────────────────────────────────┘           │
│         ┌─────────────────────────────────────────────────────────┐           │
│         │                                                         │           │
│         │  ▸ Spawn polecat agent                         ⏎ Run   │           │
│         │    Create a new polecat agent                          │           │
│         │                                                         │           │
│         │    Spawn wisp agent                                     │           │
│         │    Create a new wisp agent                              │           │
│         │                                                         │           │
│         │    Spawn witness agent                                  │           │
│         │    Create a new witness observing an agent              │           │
│         │                                                         │           │
│         │  ─────────────────────────────────────────────────────  │           │
│         │                                                         │           │
│         │    Run formula: code-review                             │           │
│         │    Run formula: security-audit                          │           │
│         │    Run formula: refactor                                │           │
│         │                                                         │           │
│         │  ─────────────────────────────────────────────────────  │           │
│         │                                                         │           │
│         │    Stop all agents                              ⌘⇧S    │           │
│         │    View system status                           ⌘I     │           │
│         │    Open settings                                ⌘,     │           │
│         │                                                         │           │
│         └─────────────────────────────────────────────────────────┘           │
│                                                                               │
│                           ESC to close · ↑↓ to navigate                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

### 8. Error States

#### Connection Lost (All Layouts)
```
┌─────────────────────────────────────────────────────────────┐
│ ◆ GAS TOWN                                   ○ Disconnected │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                    ┌─────────────────┐                      │
│                    │                 │                      │
│                    │       ⚠️        │                      │
│                    │                 │                      │
│                    │  Connection     │                      │
│                    │  Lost           │                      │
│                    │                 │                      │
│                    │  Reconnecting   │                      │
│                    │  in 3s...       │                      │
│                    │                 │                      │
│                    │  [Retry Now]    │                      │
│                    │                 │                      │
│                    └─────────────────┘                      │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Empty State
```
┌─────────────────────────────────────────────────────────────┐
│ AGENTS                                                      │
│─────────────────────────────────────────────────────────────│
│                                                             │
│                                                             │
│                         ○                                   │
│                                                             │
│                  No agents running                          │
│                                                             │
│             Spawn an agent to get started                   │
│                                                             │
│                   [+ New Agent]                             │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Loading State
```
┌─────────────────────────────────────────────────────────────┐
│ AGENTS                                                      │
│─────────────────────────────────────────────────────────────│
│                                                             │
│                                                             │
│                         ◐                                   │
│                                                             │
│                   Loading agents...                         │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Components (Enhanced)

### Status Badge

Visual indicators with animation states:

```
● Running    (green, glow-pulse animation)
○ Idle       (gray, static)
◐ Processing (amber, spin animation)
✗ Error      (red, shake on enter, static after)
✓ Complete   (green, scale-in animation)
⏸ Paused     (gray, static)
```

**CSS Implementation:**
```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  transition: all var(--duration-fast) var(--ease-out);
}

.status-dot[data-status="running"] {
  background: var(--status-running);
  box-shadow: 0 0 8px var(--status-running-glow);
  animation: glow-pulse var(--duration-glow) ease-in-out infinite;
}

.status-dot[data-status="processing"] {
  background: var(--status-warning);
  animation: spin 1s linear infinite;
}

.status-dot[data-status="error"] {
  background: var(--status-error);
  box-shadow: 0 0 8px var(--status-error-glow);
}

.status-dot[data-status="idle"] {
  background: var(--status-idle);
}
```

### Progress Bar

```
Determinate:   ████████░░░░░░░░  50%
Indeterminate: ░▒▓█▓▒░░░░░░░░░░  (shimmer animated)
```

**CSS Implementation:**
```css
.progress {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out);
}

/* Animated fill on mount */
.progress-bar[data-animate] {
  animation: progress-fill 1s var(--ease-out) forwards;
}

@keyframes progress-fill {
  from { width: 0; }
}
```

### Agent Card (Enhanced)

```
┌─────────────────────────────┐  ← border-beam when running
│ ● polecat-01       RUNNING  │  ← glow-pulse on status dot
│   Security audit            │  ← typing-cursor effect on active task
│   2h 34m · feature/auth     │
│   ████████░░ 80%            │  ← animated progress bar
└─────────────────────────────┘
```

**CSS Implementation:**
```css
.agent-card {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  transition: all var(--duration-fast) var(--ease-out);
}

/* Interactive hover */
.agent-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}

/* Active agent with border beam */
.agent-card[data-status="running"] {
  position: relative;
}

.agent-card[data-status="running"]::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  background-size: 200% 100%;
  animation: border-beam var(--duration-beam) linear infinite;
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  padding: 1px;
  border-radius: inherit;
  pointer-events: none;
}

/* Glass variant */
.agent-card-glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
}
```

### Workflow Row

```
code-review     ████████████░░░░░░░░  4/5  2m 34s
                └── Progress bar ───┘  └─┘  └────┘
                                      step  elapsed
```

**Micro-interactions:**
- Row enters with `blur-fade-up` animation
- Progress bar animates from 0 to current value
- Step counter uses `count-up` animation
- Active row has subtle left border accent

### Queue Item

```
● gt-a3f2d  Review PR #142                    → polecat-01
└─┘ └─────┘ └────────────────────────────────┘  └─────────┘
status  id  summary                             assignment
```

**States:**
- `.queue-item` - Base styling with hover elevation
- `.queue-item[data-active]` - Border beam + glow
- `.queue-item[data-selected]` - Accent left border + muted background
- Queue list uses `.stagger` for entrance animation

### Log Entry (Enhanced)

```
14:23:01.234  INF  polecat-01  Starting security audit task
└──────────┘  └─┘  └────────┘  └──────────────────────────┘
   typing    badge   shimmer        blur-fade entrance
```

**Animation Features:**
- New entries animate in with `blur-fade-up`
- Timestamp has subtle `typing-cursor` effect on latest entry
- Source field has `shimmer` highlight on new entries
- Level badges have color-coded backgrounds
- Auto-scroll indicator pulses at bottom

**CSS Implementation:**
```css
.log-entry {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-sm);
  font-family: var(--font-mono);
  opacity: 0;
  animation: blur-fade-up 0.3s var(--ease-out) forwards;
}

.log-entry:last-child .log-timestamp::after {
  content: '█';
  animation: blink 1s step-end infinite;
  color: var(--accent);
  margin-left: 2px;
}

.log-level {
  padding: 0 var(--space-1);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
}

.log-level[data-level="inf"] { background: var(--status-info); color: white; }
.log-level[data-level="wrn"] { background: var(--status-warning); color: black; }
.log-level[data-level="err"] { background: var(--status-error); color: white; }
.log-level[data-level="dbg"] { background: var(--bg-elevated); color: var(--text-muted); }

/* Log list uses stagger */
.log-list {
  display: flex;
  flex-direction: column;
}

.log-list .log-entry:nth-child(1) { animation-delay: 0; }
.log-list .log-entry:nth-child(2) { animation-delay: 0.02s; }
.log-list .log-entry:nth-child(3) { animation-delay: 0.04s; }
```

### Number Counter Component

For animated metric displays (queue counts, agent totals, etc.):

```css
.counter {
  display: inline-block;
  overflow: hidden;
}

.counter-digit {
  display: inline-block;
  animation: count-up 0.4s var(--ease-out);
}

/* Usage: Queue count animates when value changes */
```

### Grid Pattern Background

Industrial control room texture:

```css
.bg-grid-pattern {
  background-image: radial-gradient(
    circle,
    var(--border) 1px,
    transparent 1px
  );
  background-size: 24px 24px;
  animation: grid-pulse var(--duration-glow) ease-in-out infinite;
}

/* Masked gradient fade */
.bg-grid-pattern-masked {
  mask-image: radial-gradient(
    ellipse 80% 50% at 50% 50%,
    black 40%,
    transparent 100%
  );
}
```

### Shimmer Text (Branding)

For "GAS TOWN" header branding:

```css
.shimmer-text {
  background: linear-gradient(
    90deg,
    var(--text-primary) 0%,
    var(--accent) 50%,
    var(--text-primary) 100%
  );
  background-size: 200% 100%;
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  animation: shimmer var(--duration-shimmer) linear infinite;
}
```

---

## Rust TUI Layout

Desktop only. Matches web dashboard information density.

```
┌─ GAS TOWN ────────────────────────────────────────────────────────── v0.1.0 ─┐
│ [1]Agents [2]Workflows [3]Queue [4]Logs                     ● daemon:online │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ AGENTS                   3/4 │ WORKFLOWS                                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                              │                                               │
│ ▸ ● polecat-01    RUNNING    │  code-review      ████████████░░░░  4/5  2:34 │
│   │ Task: Security audit     │  security-audit   ████████████████  5/5  done │
│   │ Uptime: 2h 34m 12s       │  refactor-auth    ░░░░░░░░░░░░░░░░  0/8  wait │
│   └─ feature/auth            │  update-deps      ████░░░░░░░░░░░░  1/4  1:02 │
│                              │                                               │
│   ● polecat-02    RUNNING    ├───────────────────────────────────────────────┤
│   │ Task: Code review        │ QUEUE                                     12  │
│   │ Uptime: 1h 12m 45s       │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│   └─ main                    │                                               │
│                              │  ● gt-a3f2d  Review PR #142        → polecat  │
│   ○ wisp-03       IDLE       │  ◐ gt-b8e1c  Fix auth bug          process... │
│   │ Waiting for work         │  ○ gt-c9d4e  Update docs           pending    │
│   └─ —                       │  ○ gt-d7f3a  Refactor tests        pending    │
│                              │                                               │
│   ◐ witness-01    OBSERVING  │                                               │
│   │ Target: polecat-01       │                                               │
│   └─ Events: 1,247           │                                               │
│                              │                                               │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ LOGS                                                         [F]ilter [P]ause│
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 14:23:01 INF polecat-01  Starting security audit task                        │
│ 14:23:02 DBG polecat-01  Loaded 47 files into context                        │
│ 14:23:05 INF daemon      Heartbeat check passed for 4 agents                 │
│ 14:23:07 WRN witness-01  High latency detected: 234ms                        │
│ 14:23:08 INF queue       New item submitted: gt-e2a4b                        │
│ █                                                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ q:quit  r:refresh  n:new  s:stop  h:help  │  ↑↓:navigate  ⏎:select  /:search │
└──────────────────────────────────────────────────────────────────────────────┘
```

### TUI Keybindings

| Key | Action |
|-----|--------|
| `1` | Focus Agents panel |
| `2` | Focus Workflows panel |
| `3` | Focus Queue panel |
| `4` | Focus Logs panel |
| `Tab` | Cycle panels |
| `j/↓` | Move down |
| `k/↑` | Move up |
| `g` | Go to top |
| `G` | Go to bottom |
| `Enter` | Select/expand |
| `n` | New agent |
| `s` | Stop selected |
| `f` | Filter logs |
| `p` | Pause logs |
| `/` | Search |
| `?` | Help |
| `q` | Quit |

---

## Responsive Behavior Summary

| Breakpoint | Layout | Navigation |
|------------|--------|------------|
| < 640px | Single column, stacked panels | Bottom tab bar |
| 640–1023px | 2-column with detail panel | Header nav |
| ≥ 1024px | 3-column dashboard | Header nav + keyboard shortcuts |
| ≥ 1280px | Wide 3-column with more space | Header nav + command palette |

---

## Accessibility

### Touch Targets (WCAG 2.2 SC 2.5.8)

All interactive elements meet minimum touch target requirements:

| Element | Desktop | Mobile | Spacing |
|---------|---------|--------|---------|
| Buttons | 44×44px | 48×48px | 8px min |
| Nav items | 44×44px | 48×48px | 4px min |
| Cards | Full width | Full width | 8px gap |
| Icon buttons | 44×44px | 48×48px | 8px min |

```css
/* Touch target enforcement */
.touch-target {
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
}

@media (max-width: 639px) {
  .touch-target {
    min-height: var(--touch-target-comfortable);
    min-width: var(--touch-target-comfortable);
  }
}
```

### Focus Management

```css
/* Skip to main content link */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: var(--text-inverse);
  border-radius: var(--radius-sm);
  font-weight: 600;
  z-index: var(--z-max);
  transition: top var(--duration-fast);
}

.skip-link:focus {
  top: var(--space-4);
}

/* Visible focus ring (keyboard only) */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Remove default focus for mouse users */
:focus:not(:focus-visible) {
  outline: none;
}

/* Focus trap for modals */
.focus-trap {
  /* JS-based focus containment */
}
```

### Screen Reader Support

```html
<!-- Live region for status updates -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
>
  <!-- Announce agent status changes -->
</div>

<!-- Log region with live updates -->
<div
  role="log"
  aria-live="polite"
  aria-relevant="additions"
>
  <!-- New log entries announced -->
</div>

<!-- Progress announcements -->
<div
  role="progressbar"
  aria-valuenow="4"
  aria-valuemin="0"
  aria-valuemax="5"
  aria-label="Workflow progress: 4 of 5 steps complete"
>
```

**ARIA Patterns:**
- Agent cards: `role="article"` with descriptive `aria-label`
- Status badges: Include text equivalent (not just color)
- Progress bars: `role="progressbar"` with value attributes
- Logs: `role="log"` with `aria-live="polite"`
- Modals: `role="dialog"` with `aria-modal="true"`
- Navigation: `role="navigation"` with `aria-label`

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move to next interactive element |
| `Shift+Tab` | Move to previous interactive element |
| `Enter/Space` | Activate button/link |
| `Escape` | Close modal/dropdown |
| `Arrow keys` | Navigate within lists/menus |
| `/` | Open command palette (global) |
| `?` | Show keyboard shortcuts |

### Color Contrast

All text meets WCAG 2.1 AA contrast requirements (4.5:1 for normal text, 3:1 for large text):

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Primary text | #f4f4f5 | #0a0a0c | 15.8:1 |
| Secondary text | #a1a1aa | #0a0a0c | 7.3:1 |
| Muted text | #71717a | #0a0a0c | 4.5:1 |
| Accent on dark | #00ddaa | #0a0a0c | 9.2:1 |
| Status running | #22c55e | #0a0a0c | 7.8:1 |
| Status error | #ef4444 | #0a0a0c | 5.4:1 |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Disable parallax and complex animations */
  .animate-gradient-x,
  .animate-shimmer,
  .animate-glow-pulse,
  .border-beam::before {
    animation: none !important;
  }

  /* Keep essential state indicators visible */
  .status-dot[data-status="running"] {
    box-shadow: 0 0 0 2px var(--status-running);
  }
}
```

### Screen Reader Only Content

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Show on focus (for skip links) */
.sr-only-focusable:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
```

---

## Mobile-Specific Patterns

### Safe Area Insets

For devices with notches, home indicators, and rounded corners:

```css
/* Root padding for safe areas */
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-right: env(safe-area-inset-right);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
}

/* Header respects notch */
.header {
  padding-top: max(var(--space-3), var(--safe-area-top));
  padding-left: max(var(--space-4), var(--safe-area-left));
  padding-right: max(var(--space-4), var(--safe-area-right));
}

/* Bottom nav respects home indicator */
.bottom-nav {
  padding-bottom: max(var(--space-2), var(--safe-area-bottom));
}

/* Full-bleed backgrounds extend into safe areas */
.full-bleed {
  padding-left: var(--safe-area-left);
  padding-right: var(--safe-area-right);
  margin-left: calc(-1 * var(--safe-area-left));
  margin-right: calc(-1 * var(--safe-area-right));
}
```

### Thumb Zone Optimization

Primary actions placed in easy-reach zones:

```
┌─────────────────────────────────┐
│                                 │  ← Stretch zone (secondary)
│         Header / Title          │
│                                 │
├─────────────────────────────────┤
│                                 │
│                                 │  ← Natural zone (primary content)
│         Content Area            │
│                                 │
│                                 │
├─────────────────────────────────┤
│                                 │  ← Easy zone (primary actions)
│   [Primary Action]  [Actions]   │
│                                 │
├─────────────────────────────────┤
│ [Tab] [Tab] [Tab] [Tab]         │  ← Bottom nav (thumb accessible)
└─────────────────────────────────┘
```

### Pull-to-Refresh

```css
.pull-to-refresh {
  position: relative;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

.pull-to-refresh-indicator {
  position: absolute;
  top: -48px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity var(--duration-fast);
}

.pull-to-refresh.pulling .pull-to-refresh-indicator {
  opacity: 1;
}
```

### Swipe Gestures

```css
/* Swipe hint indicator */
.swipe-hint {
  position: absolute;
  right: var(--space-2);
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.5;
}

/* Swipe action revealed */
.swipe-actions {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  transform: translateX(100%);
  transition: transform var(--duration-fast) var(--ease-out);
}

.swiped .swipe-actions {
  transform: translateX(0);
}
```

### Haptic Feedback Integration

```javascript
// Haptic patterns for mobile (when supported)
const haptics = {
  light: () => navigator.vibrate?.(10),
  medium: () => navigator.vibrate?.(20),
  heavy: () => navigator.vibrate?.(30),
  success: () => navigator.vibrate?.([10, 50, 10]),
  error: () => navigator.vibrate?.([50, 30, 50, 30, 50]),
};

// Usage with status changes
function onAgentStatusChange(status) {
  if (status === 'error') haptics.error();
  else if (status === 'complete') haptics.success();
}
```

---

## Implementation Checklist

### Design System
- [ ] CSS custom properties defined
- [ ] Animation keyframes implemented
- [ ] Glass morphism styles ready
- [ ] Status colors with glow variants

### Components
- [ ] Agent cards with border beam effect
- [ ] Status indicators with animations
- [ ] Progress bars (determinate + indeterminate)
- [ ] Log entries with stagger animation
- [ ] Skeleton loading states

### Accessibility
- [ ] Skip link implemented
- [ ] Focus visible styles
- [ ] ARIA labels on all interactive elements
- [ ] Reduced motion support
- [ ] Screen reader announcements for status changes

### Mobile
- [ ] Safe area insets
- [ ] 48px touch targets
- [ ] Bottom navigation
- [ ] Pull-to-refresh
- [ ] Thumb-zone optimized layout

### Performance
- [ ] Animations use transform/opacity only
- [ ] Stagger delays prevent layout thrashing
- [ ] Backdrop-filter has fallback
- [ ] Critical CSS inlined

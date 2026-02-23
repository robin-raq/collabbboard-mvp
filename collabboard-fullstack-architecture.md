# CollabBoard — Fullstack Architecture Guide

**Project:** CollabBoard — Real-time Collaborative Whiteboard with AI Agent
**Live URL:** [collabboard.raqdrobinson.com](https://collabboard.raqdrobinson.com)
**Date:** February 22, 2026
**Codebase:** 169 commits | ~7,100 source lines | ~6,800 test lines | 415 passing tests

---

## 1. High-Level Overview

CollabBoard is a real-time collaborative whiteboard built with:

- **React + Konva.js** frontend (infinite canvas with pan/zoom)
- **Node.js WebSocket server** (Yjs CRDT relay + HTTP API)
- **Yjs CRDTs** for conflict-free real-time sync
- **Anthropic Claude** AI agent with tool calling
- **Supabase PostgreSQL** for persistence
- **Clerk** for authentication (Google OAuth + guest mode)

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT                              │
│  React 19 + Konva.js + Yjs                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  Board    │ │  useYjs  │ │ Toolbar  │ │  ChatPanel    │  │
│  │ (canvas)  │ │ (CRDT    │ │ Color    │ │  (AI agent)   │  │
│  │ BoardShape│ │  sync)   │ │ Picker   │ │  HelpPanel    │  │
│  │ Connector │ │          │ │ Presence │ │               │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│       ↕              ↕              ↕            ↕          │
│    Konva Stage   WebSocket     State Hooks   HTTP POST      │
└──────────┬──────────┬──────────────────────────┬────────────┘
           │          │                          │
           │    Binary Protocol              REST API
           │    (Yjs updates +               /api/ai
           │     Awareness)                  /api/boards
           │          │                          │
┌──────────┴──────────┴──────────────────────────┴────────────┐
│                         SERVER                               │
│  Node.js 20 + ws + Yjs                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  WS Relay│ │ AI Agent │ │ Security │ │ Room Manager  │  │
│  │  (rooms) │ │ (Claude  │ │ (CORS,   │ │ (idle evict,  │  │
│  │          │ │  tools)  │ │  limits) │ │  snapshots)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│       ↕              ↕                         ↕            │
│    Y.Doc         Anthropic API            Supabase          │
│    (in-memory)   + Langfuse               (PostgreSQL)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Client Architecture

### 2.1 Component Tree

```
App.tsx (Clerk auth wrapper)
├── Dashboard.tsx (board list — authenticated users)
│   └── /board/:boardId → BoardPage.tsx
│       └── Board.tsx (main canvas)
│           ├── Konva Stage (infinite canvas)
│           │   ├── BoardShape.tsx × N (sticky, rect, circle, text, frame)
│           │   ├── Connector.tsx × N (line, arrow)
│           │   └── CursorBadge.tsx × N (remote cursors)
│           ├── Toolbar.tsx (left — tool selection)
│           ├── ColorPicker.tsx (popup color grid)
│           ├── ZoomControls.tsx (bottom-right)
│           ├── PresenceBar.tsx (top-right — avatars)
│           ├── ChatPanel.tsx (right — AI assistant)
│           └── HelpPanel.tsx (center modal — shortcuts)
└── Guest mode (shared sandbox — no auth required)
```

### 2.2 Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `Board.tsx` | ~872 | Canvas orchestrator: scroll pan, zoom, tools, rubber-band selection, keyboard shortcuts, Space+drag |
| `useYjs.ts` | ~402 | Real-time sync hook: Y.Doc, WebSocket, awareness, undo/redo |
| `BoardShape.tsx` | ~590 | Unified shape renderer (memoized) with drag, resize, rotate |
| `Connector.tsx` | ~284 | Line/arrow renderer with edge-point attachment |
| `ChatPanel.tsx` | ~361 | AI chat panel with message history |
| `HelpPanel.tsx` | ~182 | Keyboard shortcuts & features overlay |
| `Toolbar.tsx` | ~100 | Tool buttons with keyboard shortcut labels |
| `PresenceBar.tsx` | ~80 | Connection indicator + remote user avatars |
| `ZoomControls.tsx` | ~50 | Zoom in/out/reset buttons |
| `ColorPicker.tsx` | ~60 | 10-color swatch popup |

### 2.3 useYjs Hook

The central real-time sync hook manages all Yjs state:

```typescript
// Exported interface
{
  objects: BoardObject[]       // All board objects as array
  objectMap: Map<string, BoardObject>  // For React.memo optimization
  remoteCursors: RemoteCursor[]  // Active remote users
  connected: boolean           // WebSocket connection status
  createObject(obj)            // Add object to Y.Map
  updateObject(id, updates)    // Partial update on Y.Map entry
  deleteObject(id)             // Remove from Y.Map
  setCursor(x, y)              // Throttled cursor broadcast (50ms)
  undo()                       // Yjs UndoManager — undo local changes
  redo()                       // Yjs UndoManager — redo
  canUndo: boolean             // Reactive state for UI buttons
  canRedo: boolean             // Reactive state for UI buttons
}
```

**Key behaviors:**
- **UndoManager** tracks only local mutations (`trackedOrigins: new Set([null])`). Remote changes (origin `'remote'`) are excluded — User A can't undo User B's work.
- **captureTimeout: 500ms** groups rapid changes (like dragging) into a single undo step.
- **Cursor throttle: 50ms** (20 updates/sec max)
- **Heartbeat: 2s** to maintain presence
- **Stale cursor cleanup: 8s** of inactivity

### 2.4 Object Types

```typescript
type ObjectType = 'sticky' | 'rect' | 'circle' | 'text' | 'frame' | 'line'

interface BoardObject {
  id: string             // crypto.randomUUID()
  type: ObjectType
  x: number; y: number   // Canvas position
  width: number; height: number
  fill: string           // CSS color
  text?: string          // Sticky notes, text objects, frame labels
  fontSize?: number      // Text objects
  rotation?: number      // 0–360 degrees, center-pivot
  parentId?: string      // Frame grouping — links children to parent frame
  points?: number[]      // Lines: [x1, y1, x2, y2] relative to (x, y)
  fromId?: string        // Connector: source object ID
  toId?: string          // Connector: target object ID
  arrowEnd?: boolean     // Show arrowhead at endpoint
}
```

**Default dimensions:**
| Type | Width | Height | Default Fill |
|------|-------|--------|-------------|
| sticky | 150 | 150 | #FFEB3B (yellow) |
| rect | 120 | 80 | #42A5F5 (blue) |
| circle | 100 | 100 | #66BB6A (green) |
| text | 200 | 40 | transparent |
| frame | 300 | 200 | transparent |
| line | 2 | 2 | #333333 |

### 2.5 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| V | Select tool |
| S | Sticky note tool |
| R | Rectangle tool |
| C | Circle tool |
| T | Text tool |
| F | Frame tool |
| L | Line tool |
| A | Arrow tool |
| Ctrl+Z / Cmd+Z | Undo |
| Ctrl+Shift+Z / Cmd+Shift+Z | Redo |
| Ctrl+Y / Cmd+Y | Redo (alt) |
| Ctrl+C / Cmd+C | Copy selected |
| Ctrl+V / Cmd+V | Paste with +20px offset |
| Ctrl+D / Cmd+D | Duplicate selected |
| Ctrl+A / Cmd+A | Select all objects |
| Delete / Backspace | Delete selected |
| Escape | Deselect / cancel tool |
| Scroll / Trackpad | Pan canvas |
| Ctrl+Scroll / Pinch | Zoom (0.1x–5x range) |
| Space+Drag | Pan canvas (grab mode) |
| Shift+Click | Toggle multi-select |
| Rubber-band drag | Select multiple objects (drag on empty canvas) |
| ? button | Help panel |

### 2.6 Performance Optimizations

- **Viewport culling:** `cullObjects()` limits rendered objects to 150 max, sorted by distance to viewport center
- **React.memo:** `BoardShape` and `Connector` memoized with primitive props (no objects/Sets)
- **Map-based state:** `objectMap: Map<string, BoardObject>` — only changed objects trigger re-renders
- **Throttled updates:** Cursor 50ms, heartbeat 2s, snapshot 30s

---

## 3. Server Architecture

### 3.1 Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | ~595 | WebSocket relay, HTTP API, snapshot persistence, room lifecycle |
| `aiHandler.ts` | ~750 | Claude AI agent with 4 tools, model routing, Langfuse tracing |
| `localParser.ts` | ~870 | Regex-based fallback — 12 command patterns, no API calls |
| `security.ts` | ~100 | CORS, message size limits, object count cap, room validation |
| `roomManager.ts` | ~80 | Room lifecycle: create, touch, evict idle rooms |
| `db/supabase.ts` | ~20 | Supabase client initialization |
| `langfuse.ts` | ~30 | Langfuse observability client |
| `auth.ts` | ~50 | Clerk JWT verification for WebSocket + REST |

### 3.2 WebSocket Protocol

Binary protocol with two message types:

```
[byte 0]    [bytes 1+]
0 (MSG_YJS)    → Yjs binary update (applied to server-side Y.Doc)
1 (MSG_AWARE)  → UTF-8 JSON awareness message (cursor positions)
```

**Connection flow:**
1. Client connects to `wss://server/<room-name>`
2. Server calls `getOrCreateDoc(room)` — loads from Supabase if available
3. Server sends full Y.Doc state as initial sync
4. Client applies state, begins sending incremental updates
5. Server relays all updates to other clients in the same room

**Awareness payload:**
```json
{
  "clientId": "uuid",
  "name": "User Name",
  "color": "#EF4444",
  "cursor": { "x": 450, "y": 300 }
}
```

### 3.3 Room Management

| Parameter | Value |
|-----------|-------|
| Snapshot interval | 30 seconds (dirty rooms only) |
| Room idle timeout | 1 hour |
| Eviction check interval | 5 minutes |
| Max message size | 1 MB |
| Max objects per board | 5,000 |
| Max AI message length | 2,000 chars |

**Lifecycle:** Room created on first connection → Snapshot loaded from Supabase → Updates relayed in real-time → Dirty rooms saved every 30s → Idle rooms (>1hr no activity) evicted (saved to Supabase first, Y.Doc destroyed).

### 3.4 Persistence (Supabase)

```sql
CREATE TABLE board_snapshots (
  board_id TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,        -- base64-encoded Yjs state
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_clerk_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Snapshot flow:**
1. `Y.encodeStateAsUpdate(doc)` → Uint8Array
2. Base64-encode → upsert to `board_snapshots`
3. On room creation: load snapshot → `Y.applyUpdate(doc, decoded)`

If Supabase not configured, boards live in memory only (lost on restart).

---

## 4. AI Agent Architecture

### 4.1 Dual-Model Routing

The AI agent uses complexity-based model routing:

| Model | Used For | Cost |
|-------|----------|------|
| **Claude 3.5 Haiku** (`claude-3-5-haiku-20241022`) | Simple commands: create, move, update single objects | $0.25/$1.25 per 1M tokens |
| **Claude Sonnet 4** (`claude-sonnet-4-20250514`) | Complex commands: flowcharts, templates, multi-step layouts | $3/$15 per 1M tokens |

**Routing logic:**
```
COMPLEX_PATTERNS = grid, layout, arrange, template, retrospective, swot,
                   journey, kanban, columns, rows, flowchart, chart,
                   diagram, visualize, map, board, pros & cons, compare,
                   brainstorm, matrix, timeline, roadmap, workflow,
                   prioritize, categorize, connect, arrow
```
Commands matching `COMPLEX_PATTERNS` or exceeding 120 characters → Sonnet. All others → Haiku.

**Token budgets:**
| Complexity | Max Tokens | Max Turns |
|------------|-----------|-----------|
| Simple (Haiku) | 512 | 3 |
| Complex (Sonnet) | 2,048 | 8 |

### 4.2 AI Tools

| Tool | Purpose |
|------|---------|
| `createObject` | Create any object type (sticky, rect, circle, text, frame, line) with position, size, color, text, rotation, and connector properties |
| `updateObject` | Modify properties of existing objects by ID |
| `moveObject` | Reposition objects by ID to new (x, y) coordinates |
| `getBoardState` | Retrieve current board snapshot for spatial awareness |

**Line/arrow creation for flowcharts:**
- Lines use `points: [x1, y1, x2, y2]` relative to the line's (x, y) position
- `fromId` and `toId` semantically link connectors to objects
- `arrowEnd` defaults to true (shows arrowhead)
- Lines auto-skip collision avoidance
- AI creates boxes first, then connecting arrows

### 4.3 Local Parser Fallback

When `ANTHROPIC_API_KEY` is not set, the server falls back to a regex-based parser handling 12 command patterns at zero API cost:

1. Retrospective board
2. SWOT analysis
3. Grid of objects
4. Journey map
5. Create object (with color, position, text)
6. Update object
7. Move object
8. List/arrange objects
9. Kanban board
10. Timeline
11. Pros & cons
12. Generic sticky note

### 4.4 Langfuse Observability

Every AI command is traced with Langfuse (when configured):
- **Trace per command:** User message, model used, board context
- **Generation spans:** Per Claude API call within multi-turn loop
- **Metadata:** boardId, token counts, tool executions
- **Cost tracking:** Automatic per-model cost attribution

---

## 5. Authentication & Multi-Board

### 5.1 Authentication Flow

```
Clerk configured?
├── YES → Google OAuth / email sign-in
│         ├── Extract user name from profile
│         ├── Generate session token
│         └── Pass to Board with auth headers
└── NO  → Guest mode
          ├── Random animal name from GUEST_NAMES array
          └── Shared sandbox board (all guests collaborate)
```

### 5.2 Multi-Board Support

Authenticated users get personal board management:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/boards` | List user's boards (requires Clerk JWT) |
| `POST /api/boards` | Create new board |
| `/board/:boardId` | Client route to specific board |

**Guest mode:** All guests share a single sandbox board — no dashboard, no board creation.

### 5.3 WebSocket Authentication

1. Client gets session token from Clerk
2. Passes token as query parameter on WebSocket connection
3. Server verifies JWT with Clerk's `verifyToken()`
4. Authenticated connections can access user's boards
5. Guest connections route to shared sandbox

---

## 6. Deployment

### 6.1 Infrastructure

| Component | Service | URL |
|-----------|---------|-----|
| Frontend | Vercel | `https://collabboard.raqdrobinson.com` |
| WebSocket + API | Railway (Docker) | `wss://raqdrobinson.com` |
| Database | Supabase | PostgreSQL (free tier) |
| Auth | Clerk | Google OAuth (free tier) |

### 6.2 Vercel Configuration

```json
{
  "buildCommand": "cd client && npm install && npm run build",
  "outputDirectory": "client/dist",
  "regions": ["iad1"]
}
```

### 6.3 Railway Configuration

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/src ./src
COPY server/tsconfig.json ./tsconfig.json
EXPOSE 1234
CMD ["npx", "tsx", "src/index.ts"]
```

### 6.4 Environment Variables

**Client (Vercel):**
| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | No | Clerk auth (guest mode if absent) |
| `VITE_API_URL` | No | Override API endpoint |
| `VITE_WS_URL` | No | Override WebSocket endpoint |

**Server (Railway):**
| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | Yes | Server port (default: 1234) |
| `ANTHROPIC_API_KEY` | No | Claude API (falls back to local parser) |
| `SUPABASE_URL` | No | Database (in-memory if absent) |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Database auth |
| `ALLOWED_ORIGINS` | No | CORS whitelist (comma-separated) |
| `CLERK_SECRET_KEY` | No | WebSocket JWT verification |
| `LANGFUSE_SECRET_KEY` | No | AI observability |
| `LANGFUSE_PUBLIC_KEY` | No | AI observability |
| `LANGFUSE_BASEURL` | No | AI observability |

---

## 7. Security

### 7.1 Implemented Protections

| Protection | Implementation |
|------------|---------------|
| CORS restriction | `ALLOWED_ORIGINS` env var whitelist |
| Message size limit | 1 MB max per WebSocket message |
| Object count cap | 5,000 objects per board |
| Room name validation | Alphanumeric + hyphens only |
| AI message validation | 2,000 character max |
| WebSocket compression | `perMessageDeflate` (~70% bandwidth reduction) |
| Preemptive validation | Reject BEFORE applying Yjs update |
| WebSocket auth | Clerk JWT verification on connection |

### 7.2 Security Remediation Backlog

| Severity | Item | Status |
|----------|------|--------|
| CRITICAL | WebSocket JWT authentication | Partial (Clerk) |
| CRITICAL | Room access control (board membership) | Partial (owner-based) |
| HIGH | Yjs payload validation & size limits | Implemented |
| HIGH | CORS hardening | Implemented |
| HIGH | WebSocket origin validation | Deferred |
| HIGH | Rate limiting (connections + messages) | Deferred |
| MEDIUM | HTTP security headers (Helmet) | Deferred |
| MEDIUM | Room enumeration protection | Deferred |
| LOW | Dockerfile non-root USER | Deferred |
| LOW | Production logging controls | Deferred |

---

## 8. Testing

### 8.1 Test Distribution

| Suite | Framework | Tests | Lines |
|-------|-----------|-------|-------|
| Server | Vitest | 190 | ~3,300 |
| Client | Vitest + jsdom | 225 | ~3,500 |
| **Total** | | **415** | **~6,800** |

### 8.2 Test Coverage Areas

**Server tests:**
- AI handler (59 tests): tool execution, model routing, system prompt, board context, line/arrow support
- Local parser (53 tests): all 12 command patterns
- Security (21 tests): CORS, message size, object limits, room validation
- Persistence (15 tests): Supabase snapshot save/load, dirty tracking
- Room manager (12 tests): idle eviction, room lifecycle
- Langfuse (8 tests): trace creation, generation spans
- Auth (12+ tests): JWT verification, token handling

**Client tests:**
- Undo/redo (15+ tests): UndoManager basics, remote change exclusion, capture timeout grouping
- Clipboard (10+ tests): copy/paste with offset stacking
- Selection (10+ tests): rubber-band, multi-select, bounds calculation
- Rubber-band Stage (11 tests): drag-to-select lifecycle, click suppression, pan guards
- Geometry (8+ tests): rotation math, angle calculation
- Yjs sync (20+ tests): WebSocket lifecycle, Y.Map operations, awareness
- Viewport culling (10+ tests): render budget, distance sorting
- Components (50+ tests): Board, Toolbar, ChatPanel, PresenceBar

### 8.3 Running Tests

```bash
# Server tests
cd server && npm test

# Client tests
cd client && npm test
```

---

## 9. Tech Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React | 19.2 |
| Canvas rendering | Konva.js | 10.2 |
| Real-time sync | Yjs (CRDT) | 13.6 |
| Styling | Inline CSS-in-JS | — |
| Font | DM Sans | Google Fonts |
| Build tool | Vite | 6.x |
| Server runtime | Node.js | 20 (Alpine) |
| WebSocket | ws | 8.19 |
| AI | Anthropic Claude (Haiku + Sonnet) | SDK 0.76 |
| Database | Supabase (PostgreSQL) | 2.97 |
| Authentication | Clerk | 5.60 |
| Observability | Langfuse | — |
| Testing | Vitest | — |
| TypeScript | Strict mode | 5.x |
| Deployment (frontend) | Vercel | — |
| Deployment (server) | Railway (Docker) | — |

---

## 10. Feature Inventory

| Feature | Status | Notes |
|---------|--------|-------|
| Real-time collaboration | Complete | Yjs CRDTs over WebSocket binary protocol |
| Infinite canvas | Complete | Scroll/trackpad pan, Ctrl+scroll zoom (0.1x–5x), Space+drag pan, viewport culling |
| 6 shape types | Complete | Sticky, rect, circle, text, frame, line |
| Multi-select & group ops | Complete | Shift-click, rubber-band drag-to-select, Ctrl+A |
| Rotation | Complete | Center-pivot with handle UI |
| Inline text editing | Complete | Double-click for textarea overlay |
| Multiplayer cursors | Complete | Color-coded with presence awareness |
| Undo / Redo | Complete | Yjs UndoManager (local changes only) |
| Copy / Paste | Complete | Ctrl+C/V with +20px stacking offset |
| Frame grouping | Complete | parentId links children to frames |
| Connectors (lines/arrows) | Complete | Edge-point attachment, arrowheads |
| AI assistant | Complete | Claude tool calling with model routing |
| AI flowcharts | Complete | Line/arrow support with fromId/toId |
| Local parser fallback | Complete | 12 regex patterns, zero API cost |
| State persistence | Complete | Supabase snapshots every 30s |
| Clerk authentication | Complete | Google OAuth + guest fallback |
| Multi-board support | Complete | Dashboard, board CRUD, per-user boards |
| Guest sandbox | Complete | Shared board for unauthenticated users |
| Help panel | Complete | 18 shortcuts, 8 features listed |
| Performance optimization | Complete | 150-object render budget, React.memo |
| Security hardening | Partial | CORS, size limits, auth — rate limiting deferred |
| Langfuse observability | Complete | Per-command traces with cost tracking |

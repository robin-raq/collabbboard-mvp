# CollabBoard

A real-time collaborative whiteboard with AI assistance. Multiple users share an infinite canvas where they can create, move, resize, and rotate shapes — all synced instantly via Yjs CRDTs over WebSockets. An AI chat agent can create and manipulate board objects on command.

**Live:** [collabboard.raqdrobinson.com](https://collabboard.raqdrobinson.com)

## Features

- **Infinite canvas** — scroll/trackpad pan, Ctrl+scroll zoom (0.1x–5x), Space+drag pan, with viewport culling for performance
- **7 shape types** — sticky notes, rectangles, circles, text, frames, lines, arrows
- **Real-time sync** — every mutation syncs instantly to all connected clients via Yjs CRDTs
- **AI chat agent** — natural language commands to create, update, and arrange objects
- **Multi-select** — shift-click, rubber-band drag-to-select, Cmd+A, group drag
- **Undo / Redo** — Yjs UndoManager scoped to local changes only (Ctrl+Z / Ctrl+Shift+Z)
- **Copy / Paste** — Ctrl+C/V with +20px stacking offset to prevent overlap
- **Rotation** — center-pivot rotation with handle UI on all shapes
- **Inline text editing** — double-click sticky notes to edit in place
- **Multiplayer cursors** — color-coded remote cursors with name labels
- **Presence awareness** — live connection status and user avatars
- **Authentication** — Clerk sign-in (Google OAuth) or guest access
- **State persistence** — Supabase snapshots every 30 seconds, survives server restarts
- **AI dual-model routing** — simple commands use Haiku (~10x cheaper), complex commands use Sonnet
- **Langfuse observability** — every AI call traced with model, tokens, turns, and tool execution spans
- **Frame grouping** — objects placed inside frames auto-detect parentId and move with the frame
- **Keyboard shortcuts** — V/S/R/C/T/F/L/A tools, Delete, Ctrl+Z/Shift+Z, Ctrl+C/V, Ctrl+A/D, Escape
- **Performance optimized** — render budget caps at 150 objects, React.memo with primitive props

## Architecture

```
┌─────────────────────┐       WebSocket (wss://)       ┌──────────────────────┐
│   React + Konva.js  │ ◄────────────────────────────► │  Node.js + ws        │
│   (Vercel)          │   Yjs binary + awareness msgs   │  (Railway)           │
│                     │                                  │                      │
│  Y.Doc ◄─► Y.Map   │       POST /api/ai               │  Y.Doc per room      │
│  useYjs.ts hook     │ ─────────────────────────────► │  AI handler (Claude)  │
│  Clerk auth         │                                  │  Supabase snapshots   │
└─────────────────────┘                                  └──────────┬───────────┘
                                                                    │
                                                         ┌──────────▼───────────┐
                                                         │  Supabase PostgreSQL  │
                                                         │  board_snapshots      │
                                                         └──────────────────────┘
```

| Layer      | Technology                   | Purpose                                |
|------------|------------------------------|----------------------------------------|
| Frontend   | React 19 + Vite + TypeScript | Fast dev, type safety, HMR             |
| Canvas     | Konva.js + react-konva       | Pan/zoom/drag/rotate built-in          |
| Real-time  | Yjs + custom WebSocket       | CRDT = no merge conflicts              |
| AI         | Anthropic Claude (Haiku + Sonnet) | Dual-model tool-calling agent with 4 tools |
| Observability | Langfuse                  | AI call tracing (model, tokens, turns, tool spans) |
| Auth       | Clerk                        | Google OAuth + guest mode              |
| Backend    | Node.js + ws                 | WebSocket relay + AI endpoint          |
| Database   | Supabase PostgreSQL          | Board state persistence                |
| Deployment | Vercel + Railway             | Free tier, auto-deploy on push         |

## Project Structure

```
collabboard-mvp/
├── client/                          # Vite React app (Vercel)
│   └── src/
│       ├── App.tsx                  # Auth wrapper (Clerk + guest)
│       ├── Board.tsx                # Main canvas — tools, selection, zoom
│       ├── BoardShape.tsx           # Unified shape renderer (all 7 types)
│       ├── Connector.tsx            # Line/arrow connectors
│       ├── useYjs.ts                # Yjs sync hook (WebSocket + CRDT + awareness)
│       ├── types.ts                 # Re-exports from shared/types.ts
│       ├── constants.ts             # All magic numbers and defaults
│       ├── components/
│       │   ├── ChatPanel.tsx        # AI chat side panel
│       │   ├── Toolbar.tsx          # Tool selection buttons
│       │   ├── ColorPicker.tsx      # Color selection UI
│       │   ├── PresenceBar.tsx      # Connection status + user avatars
│       │   ├── ZoomControls.tsx     # Zoom in/out/reset
│       │   ├── HelpPanel.tsx       # Keyboard shortcuts overlay
│       │   └── CursorBadge.tsx      # Remote cursor labels
│       ├── utils/
│       │   ├── viewportCulling.ts   # Render budget + spatial culling
│       │   ├── selection.ts         # Multi-select geometry
│       │   └── throttle.ts          # Event throttling
│       └── test/                    # 225 client tests
│
├── server/                          # WebSocket server (Railway)
│   └── src/
│       ├── index.ts                 # HTTP + WebSocket server (~500 lines)
│       ├── aiHandler.ts             # Claude tool-calling agent
│       ├── localParser.ts           # Regex fallback (12 AI commands)
│       ├── langfuse.ts              # Langfuse tracing (no-op when disabled)
│       ├── security.ts              # CORS, message size, object limits
│       ├── roomManager.ts           # Room lifecycle + idle eviction
│       ├── db/supabase.ts           # Supabase client
│       └── __tests__/               # 190 server tests
│
├── shared/
│   └── types.ts                     # BoardObject, ToolType, ObjectType
│
├── Dockerfile                       # Server container for Railway
├── railway.json                     # Railway deployment config
└── vercel.json                      # Vercel deployment config
```

**~7,100 lines of source code + ~6,800 lines of tests across 415 test cases.**

## Quick Start

### Prerequisites

- Node.js 20+
- [Clerk](https://clerk.com) account (free tier) — or skip for guest-only mode
- [Supabase](https://supabase.com) project (free tier) — for persistence
- [Anthropic API key](https://console.anthropic.com) — optional, falls back to local parser

### 1. Clone and install

```bash
git clone https://github.com/robin-raq/collabbboard-mvp.git
cd collabbboard-mvp

npm install --prefix client
npm install --prefix server
```

### 2. Configure environment

```bash
# Client
cp client/.env.example client/.env.local
# Set: VITE_CLERK_PUBLISHABLE_KEY, VITE_API_URL

# Server
cp server/.env.example server/.env
# Set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, CLERK_SECRET_KEY, ALLOWED_ORIGINS
# Optional: LANGFUSE_SECRET_KEY, LANGFUSE_PUBLIC_KEY, LANGFUSE_HOST
```

### 3. Set up Supabase

Create a `board_snapshots` table:

```sql
CREATE TABLE board_snapshots (
  board_id TEXT PRIMARY KEY,
  snapshot TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 4. Run locally

```bash
# Terminal 1 — WebSocket server
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

Open http://localhost:5173 in two browser tabs to test real-time sync.

### 5. Run tests

```bash
cd server && npm test    # 190 tests (Vitest)
cd client && npm test    # 225 tests (Vitest + jsdom)
```

## AI Commands

The AI chat agent supports natural language commands:

| Command | Example |
|---------|---------|
| Create objects | "Add a yellow sticky note that says 'User Research'" |
| Position objects | "Create a blue rectangle at position 100, 200" |
| Update properties | "Change the sticky note color to green" |
| Grid layouts | "Create a 2x3 grid of sticky notes for pros and cons" |
| Arrange existing | "Arrange these sticky notes in a grid" |
| Templates | "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns" |

The AI runs server-side with 4 tools (`createObject`, `updateObject`, `moveObject`, `getBoardState`). Simple commands are routed to Claude Haiku for cost efficiency (~10x cheaper); complex commands (grids, SWOT, templates) use Claude Sonnet for stronger reasoning. A complexity classifier selects the model automatically based on keyword patterns and message length. When no API key is configured, a local regex parser handles the same 12 command patterns.

## Security

- CORS restriction via `ALLOWED_ORIGINS` environment variable
- WebSocket origin validation
- Message size limit (1 MB per WebSocket message)
- Object count limit (5,000 per board) with preemptive rejection
- Room name validation (alphanumeric + hyphens/underscores)
- AI message length limit (2,000 characters)
- WebSocket compression (perMessageDeflate)
- Idle room eviction (1 hour timeout, saves to Supabase before cleanup)

## Deployment

Both services auto-deploy when you push to `main`.

**Frontend (Vercel):** Import repo → set env vars → add custom domain.

**Server (Railway):** Connect repo → set env vars → deploys via Dockerfile.

**Cost: $5/month** (Railway $5 + Supabase free + Vercel free + Clerk free).

## Future Work

- **Horizontal scaling** — Redis pub/sub between server instances for multi-process WebSocket routing. Server-side cursor batching (100ms aggregation) to reduce message storms from ~1,200 msg/sec to ~200 msg/sec per room at 20 users.
- **AI selective context** — Send only viewport-relevant objects to Claude instead of the full board snapshot. A board with 500 objects burns tokens unnecessarily when the user says "make these sticky notes blue" and only 6 are in view.
- **Offline-first** — Yjs already supports offline editing via its CRDT model. Add IndexedDB persistence on the client so edits queue locally and sync automatically when the connection restores.
- **Version history** — Yjs stores document history internally. Expose periodic snapshots to let users rewind a board to any previous state — the infrastructure is already there.
- **Export** — PNG, SVG, and PDF export of boards for sharing outside the app.
- **Prompt caching** — Anthropic's prompt caching for the system prompt (board context + tool definitions), which is largely static between commands in the same session. Estimated ~30% additional cost reduction on top of model routing.
- **Mobile / touch support** — Touch gestures for pan, zoom, drag, and rotate on tablets. Konva supports touch events natively.

## License

MIT

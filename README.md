# CollabBoard MVP

A real-time collaborative whiteboard built in under 4 hours. Multiple users share an infinite canvas where they can create, move, and edit sticky notes and shapes — all synced instantly via Yjs CRDTs over WebSockets.

**Live:** [collabboard.raqdrobinson.com](https://collabboard.raqdrobinson.com)

## Features

- **Infinite canvas** — pan (drag) and zoom (scroll wheel) with no boundaries
- **Sticky notes** — create, drag, and double-click to edit text
- **Rectangles** — drag-and-drop shape primitives
- **Real-time sync** — every mutation syncs instantly to all connected clients
- **Multiplayer cursors** — see other users' cursor positions with name labels
- **Presence awareness** — live count of who's online
- **Authentication** — Clerk sign-in with Google/email, or guest access
- **Console-driven TDD** — every mutation logs to the browser console for instant feedback

## Architecture

```
┌─────────────────────┐         WebSocket (wss://)         ┌──────────────────┐
│   React + Konva.js  │ ◄──────────────────────────────► │  Node.js + ws    │
│   (Vercel)          │    Yjs binary updates + awareness  │  (Railway)       │
│                     │                                     │                  │
│  Y.Doc ◄─► Y.Map   │                                     │  Y.Doc per room  │
│  useYjs.ts hook     │                                     │  ~90 lines       │
│  Clerk auth         │                                     │  No database     │
└─────────────────────┘                                     └──────────────────┘
```

| Layer      | Technology                  | Why                              |
|------------|-----------------------------|----------------------------------|
| Frontend   | React 19 + Vite + TypeScript| Fast dev, type safety            |
| Canvas     | Konva.js + react-konva      | Pan/zoom/drag built-in           |
| Real-time  | Yjs + custom WebSocket      | CRDT = no merge conflicts        |
| Auth       | Clerk                       | 15-min setup, Google OAuth free  |
| Backend    | Node.js + ws               | ~90 lines, just a WS relay       |
| Database   | None (in-memory Yjs)        | MVP speed; persistence = Week 2  |
| Deployment | Vercel + Railway            | Free tier, zero cost             |

## Project Structure

```
collabboard-mvp/
├── client/                     # Vite React app (deployed to Vercel)
│   ├── src/
│   │   ├── App.tsx             # Auth wrapper (Clerk + guest mode)
│   │   ├── Board.tsx           # Main canvas — toolbar, presence, zoom
│   │   ├── StickyNote.tsx      # Draggable sticky with text editing
│   │   ├── Rectangle.tsx       # Draggable rectangle shape
│   │   ├── useYjs.ts           # Yjs sync hook (WebSocket + CRDT)
│   │   ├── types.ts            # BoardObject type definition
│   │   ├── main.tsx            # React entry point
│   │   └── index.css           # Global styles
│   ├── .env.example            # Environment variable template
│   └── package.json
│
├── server/                     # WebSocket relay (deployed to Railway)
│   ├── src/
│   │   └── index.ts            # ~90 lines — rooms, broadcast, health check
│   ├── .env.example
│   └── package.json
│
├── Dockerfile                  # Server container for Railway
├── railway.json                # Railway deployment config
├── vercel.json                 # Vercel deployment config
└── .cursorrules                # AI code conventions
```

**Total source code: ~8 files, ~1,000 lines.**

## Quick Start

### Prerequisites

- Node.js 20+
- A [Clerk](https://clerk.com) account (free tier)

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
# Edit client/.env.local — add your Clerk publishable key

# Server (optional — defaults work for local dev)
cp server/.env.example server/.env
```

### 3. Run locally

**Terminal 1 — WebSocket server:**
```bash
cd server && npm run dev
# [WS] y-websocket server running on :1234
```

**Terminal 2 — Frontend:**
```bash
cd client && npm run dev
# VITE ready at http://localhost:5174
```

Open http://localhost:5174 in two browser tabs to test real-time sync.

## Console-Driven Testing

Every mutation logs to the browser console. Open DevTools (F12) and watch:

```
[YJS] Connected to wss://raqdrobinson.com/mvp-board-1
[YJS STATUS] connected
[YJS CREATE] f4a8... sticky {x: 100, y: 100}
[YJS OBSERVE] Changes received: 1
  f4a8...: add {id: 'f4a8...', type: 'sticky', ...}
[YJS UPDATE] f4a8... BEFORE: {x:100} AFTER: {x:250}
[AWARENESS] Remote users: 1
```

**Test by opening two browser tabs** — create a sticky in one, watch it appear in the other.

## Deployment

### WebSocket Server (Railway)

The server deploys via the `Dockerfile` at the repo root:

1. Connect GitHub repo in [Railway dashboard](https://railway.app)
2. Set `PORT=1234` in environment variables
3. Railway auto-deploys on push to main

### Frontend (Vercel)

1. Import repo in [Vercel dashboard](https://vercel.com)
2. Set environment variables:
   - `VITE_CLERK_PUBLISHABLE_KEY` — your Clerk key
   - `VITE_WS_URL` — `wss://your-railway-domain.com`
3. Add custom domain in Settings → Domains

**Cost: $0/month** (both services on free tier).

## What's Next (Post-MVP)

- [ ] Database persistence (Supabase)
- [ ] Delete objects
- [ ] Undo/redo
- [ ] Color picker
- [ ] AI chat agent
- [ ] Mobile touch support

## License

MIT

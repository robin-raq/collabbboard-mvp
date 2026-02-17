# CollabBoard AI — Full-Stack Collaborative Whiteboard

A real-time collaborative whiteboard with AI agent manipulation, built with React + Vite, Express, Yjs (CRDTs), and Supabase.

**Status**: MVP in development (Day 1 of 5-day sprint)

## Quick Start

### Prerequisites
- Node.js 20+
- npm 11+

### Installation

```bash
# Install all dependencies
npm install --prefix client
npm install --prefix server
```

### Run Locally

**Terminal 1 — Start the backend (HTTP API + WebSocket server):**
```bash
cd server
npm run dev
```
Expected output:
```
HTTP API server running on port 3001
WebSocket server running on port 1234
```

**Terminal 2 — Start the frontend (Vite dev server):**
```bash
cd client
npm run dev
```
Expected output:
```
VITE v7.3.1  ready in 803 ms
  ➜  Local:   http://localhost:5174/
```

Then open **http://localhost:5174** in your browser.

### Run Tests

```bash
# Client tests
cd client && npm test

# Server tests
cd server && npm test

# Watch mode
cd client && npm run test:watch
cd server && npm run test:watch
```

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + Konva.js
- **Backend**: Express + Node.js + y-websocket
- **Real-time Sync**: Yjs (CRDTs) — handles multi-user conflict resolution automatically
- **Database**: Supabase PostgreSQL (optional — can run without it)
- **Auth**: Clerk (optional — runs with mock auth for local dev)
- **AI**: Anthropic Claude (optional — logs to console when not configured)

### Project Structure
```
.
├── client/                # React frontend (Vite + Tailwind)
│   ├── src/
│   │   ├── components/    # canvas, toolbar, chat, auth
│   │   ├── hooks/         # useYjsBoard, useAwareness, useAgentChat
│   │   ├── lib/           # yjs, api, boardHelpers
│   │   ├── pages/         # BoardPage, Dashboard, Login
│   │   └── stores/        # Zustand (uiStore)
│   └── vitest.config.ts
├── server/                # Express backend
│   ├── src/
│   │   ├── routes/        # /api/boards, /api/ai
│   │   ├── services/      # boardService, agentService, yjsService
│   │   ├── middleware/    # auth, rateLimit
│   │   ├── ws/            # WebSocket server (y-websocket compatible)
│   │   └── lib/           # supabase, yjsRoom registry
│   └── vitest.config.ts
├── shared/                # Shared TypeScript types
└── .cursorrules           # Cursor AI agent rules
```

## Development Notes

### Without Clerk (Local Dev)
The server runs with **mock auth** — all requests are accepted as `dev-user`.

To enable real Clerk auth:
1. Create a Clerk account at https://clerk.com
2. Set `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` in `/server/.env.local` and `/client/.env.local`
3. Restart the servers

### Without Supabase (Local Dev)
The server logs a warning but runs fine. Database features are disabled.

To enable Supabase:
1. Create a project at https://supabase.com
2. Run the schema SQL from `shared/types.ts` (section 6.1 of architecture doc)
3. Set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` in `/server/.env.local`
4. Restart the server

### Without AI (Local Dev)
The AI endpoint logs warnings but returns a fallback response.

To enable Anthropic Claude:
1. Get an API key from https://console.anthropic.com
2. Set `ANTHROPIC_API_KEY` in `/server/.env.local`
3. Restart the server

## Roadmap (5-Day Sprint)

- [x] Day 1: Monorepo scaffold + auth + Yjs + canvas + WS
- [ ] Day 2: Board objects (sticky, rect, circle, line, text) + presence
- [ ] Day 3: Persistence + multi-select + undo/redo
- [ ] Day 4: AI agent chat panel + tool calls
- [ ] Day 5: E2E tests + polish + deploy to Railway + Vercel

## Contributing

All code follows TDD (Test-Driven Development):
1. Write a failing test
2. Use Cursor Ultra to implement the feature
3. Ensure tests pass
4. Commit with small, focused PRs

See `.cursorrules` for code conventions.

## License

MIT

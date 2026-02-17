# CollabBoard AI — Full-Stack Collaborative Whiteboard

A real-time collaborative whiteboard with AI agent manipulation, built with React 19 + Vite, Express, Liveblocks, and Clerk authentication.

**Status**: MVP complete with user authentication, real-time collaboration, and deployment ready!

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

### First Time Setup

**Important**: Clerk authentication is required. Before starting:

1. Set up Clerk authentication (see [SETUP_CLERK.md](./SETUP_CLERK.md))
2. Add your Clerk keys to `.env.local` files in both `client/` and `server/`
3. Then start the development servers

Without Clerk configured, the app will show an error on startup.

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
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS + Konva.js
- **Backend**: Express + Node.js
- **Real-time Sync**: Liveblocks — cloud-based real-time synchronization
- **Authentication**: Clerk — user authentication and session management
- **Database**: PostgreSQL (optional — can run without it)
- **Deployment**: Docker + Railway (one-click deployment from GitHub)
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

## Features

### ✅ Core Features (MVP Complete)
- **Real-time Collaboration**: Multiple users see each other's changes instantly
- **User Authentication**: Clerk-based authentication with email and OAuth support
- **Presence Awareness**: See who's online and where they're pointing their cursor
- **Sticky Notes**: Create, edit, and delete collaborative sticky notes
- **Drawing Tools**: Rectangle, circle, line drawing (foundation for future tools)
- **Pan & Zoom**: Navigate the board with mouse wheel and middle-click drag
- **Selection**: Click to select objects, Shift+click for multi-select
- **Deletion**: Select objects and press Delete or Backspace to remove them

### 🚀 Deployment
- **Platform**: Railway with custom domain ($3-5/year)
- **Authentication**: Clerk production keys (pk_live_) on custom domain
- **Real-time Sync**: Liveblocks cloud service (automatic scaling)
- **HTTPS**: Automatic certificate generation
- **Auto-Deploy**: Automatic deployment on git push to main branch
- **See**: [RAILWAY_CUSTOM_DOMAIN.md](./RAILWAY_CUSTOM_DOMAIN.md) for complete setup (RECOMMENDED)
- See [DEPLOYMENT_ARCHITECTURE.md](./DEPLOYMENT_ARCHITECTURE.md) for architecture overview

## Setup & Configuration

### 🚀 Production Deployment (Railway with Custom Domain)

For the fastest path to production with authenticated users:

1. **Custom Domain Setup**: See [RAILWAY_CUSTOM_DOMAIN.md](./RAILWAY_CUSTOM_DOMAIN.md) (1 hour total)
   - Buy cheap domain ($3-5/year)
   - Point to Railway
   - Get Clerk production keys (pk_live_)
   - Deploy complete app with full authentication

**Architecture**: Everything on Railway + Custom domain + Clerk production auth

### 🔐 Clerk Authentication (Required)
Clerk authentication is mandatory for all users. For production:
1. Buy custom domain ($3-5/year) - Clerk requirement for `pk_live_` keys
2. Point domain to Railway
3. Follow [RAILWAY_CUSTOM_DOMAIN.md](./RAILWAY_CUSTOM_DOMAIN.md) for complete setup
4. See [SETUP_CLERK.md](./SETUP_CLERK.md) for:
   - Creating Clerk application
   - Getting development keys (test locally)
   - Configuring OAuth providers (Google, GitHub, etc.)

### 🔄 Liveblocks Real-time Sync
Get your Liveblocks API keys from https://liveblocks.io/dashboard and add to:
- `.env.local` for local development
- Railway environment variables for production deployment

### Optional Services
- **Database**: PostgreSQL (for board persistence)
- **AI**: Anthropic Claude API (for AI chat features)
- **Email**: SendGrid or similar (for email notifications)

## Roadmap

### ✅ MVP Complete
- Monorepo scaffold with shared types
- Clerk authentication (mandatory)
- Liveblocks real-time synchronization
- Canvas with Konva.js rendering
- Sticky note creation, editing, deletion
- User presence and cursor tracking
- Board object creation (sticky notes, shapes)
- Docker containerization
- Railway deployment configuration

### 🔄 Future Enhancements
- [ ] Advanced drawing tools (freehand, shapes)
- [ ] Undo/redo functionality
- [ ] Persistent storage (PostgreSQL)
- [ ] AI chat panel with agent capabilities
- [ ] Collaborative text editing
- [ ] Board templates
- [ ] Export to image/PDF
- [ ] Comments and annotations
- [ ] Mobile responsive design
- [ ] Offline mode with sync

## Contributing

All code follows TDD (Test-Driven Development):
1. Write a failing test
2. Use Cursor Ultra to implement the feature
3. Ensure tests pass
4. Commit with small, focused PRs

See `.cursorrules` for code conventions.

## License

MIT

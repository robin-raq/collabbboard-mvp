# CollabBoard MVP - Deployment Architecture

Complete architecture overview of CollabBoard MVP in production.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          Users' Browsers                         │
│                                                                   │
│  Browser 1          Browser 2          Browser 3 (Incognito)    │
│  User A             User B             User C                    │
│  ┌────────────┐     ┌────────────┐     ┌────────────┐           │
│  │ React App  │     │ React App  │     │ React App  │           │
│  │ Vite Build │     │ Vite Build │     │ Vite Build │           │
│  └────────────┘     └────────────┘     └────────────┘           │
└─────────────┬──────────────┬──────────────┬───────────────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │ All HTTPS requests │ WebSocket for sync │
        ↓                    ↓                    ↓
┌───────────────────────────────────────────────────────────────────┐
│                        Vercel CDN / Edge                          │
│                    (Serves React Frontend)                        │
│                                                                   │
│  collabbboard-mvp.vercel.app                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Next.js/Vite Build                     │  │
│  │  - Static assets cached globally                          │  │
│  │  - Automatic HTTPS                                        │  │
│  │  - Auto-deploy on git push                                │  │
│  │  - Environment variables injected at build time           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────┬─────────────────────────────────────────────────────────┘
          │
          │ REST API + WebSocket
          │ (to https://your-railway-app.railway.app)
          ↓
┌───────────────────────────────────────────────────────────────────┐
│                    Railway (Backend Server)                       │
│                                                                   │
│  your-app.railway.app                                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │               Express.js + Node.js 20                     │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │          REST API Endpoints                        │ │  │
│  │  │  GET  /api/boards        - List user's boards      │ │  │
│  │  │  POST /api/boards        - Create new board        │ │  │
│  │  │  GET  /api/boards/:id    - Get board details       │ │  │
│  │  │  POST /api/health        - Health check            │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │     Clerk Authentication Verification              │ │  │
│  │  │  - Validate JWT tokens from client                │ │  │
│  │  │  - Verify user identity                           │ │  │
│  │  │  - Check user permissions                         │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │      Liveblocks Server Listener                    │ │  │
│  │  │  - WebSocket connection handling                  │ │  │
│  │  │  - Real-time storage updates                      │ │  │
│  │  │  - Presence broadcasting                          │ │  │
│  │  │  - Object mutations validation                    │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │           Static File Serving                      │ │  │
│  │  │  - Serves built React app (dist folder)           │ │  │
│  │  │  - Fallback to index.html for SPA routing         │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │         Health Check Endpoint                      │ │  │
│  │  │  GET /health                                       │ │  │
│  │  │  - Returns 200 OK if healthy                       │ │  │
│  │  │  - Used by Vercel/Railway monitoring              │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │                                                           │  │
│  │  Logs & Monitoring:                                       │  │
│  │  - Accessible via Railway dashboard                      │  │
│  │  - Real-time error tracking                              │  │
│  │  - Performance metrics                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────┬──────────────────────────────────────────────────────────┘
          │
          │ HTTP/WebSocket requests
          │
        ┌─┴─────────────────────────────────┐
        │                                   │
        ↓                                   ↓
┌──────────────────┐             ┌──────────────────┐
│     Clerk        │             │   Liveblocks     │
│   Auth Service   │             │  Real-time Sync  │
│                  │             │   Database       │
│ - JWT validation │             │                  │
│ - User sessions  │             │ - Object storage │
│ - OAuth providers│             │ - Presence data  │
│ - User data      │             │ - Sync engine    │
└──────────────────┘             └──────────────────┘
```

## Data Flow Diagram

### User Sign-up / Login Flow

```
Browser                        Vercel (Frontend)              Clerk
  │                                 │                          │
  │─── "Sign Up" click ────────────→ │                          │
  │                                 │                          │
  │                    Clerk signup form rendered              │
  │                                 │                          │
  │─── Enter email/password ───────────────────────────────────→ │
  │                                 │                          │
  │                                 │ ← JWT token returned ────│
  │                                 │                          │
  │ ← Store token in localStorage ──│                          │
  │                                 │                          │
  │ ← Redirect to dashboard ────────│                          │
  │                                 │
```

### Create Board Flow

```
Browser               Vercel             Railway Backend        Liveblocks
  │                    │                     │                     │
  │─ "New Board" ────→ │                     │                     │
  │                    │─ POST /api/boards ─→ │                     │
  │                    │  (with JWT token)    │                     │
  │                    │                     │                     │
  │                    │  ← Board ID ────────│                     │
  │                    │                     │                     │
  │                    │─────────────────────────→ Create Room ───→ │
  │                    │                          Initialize      │
  │                    │                          Storage        │
  │                    │                                         │
  │ ← Board created ──→ │ ← Liveblocks init ─────────────────────│
  │                    │                     │
  │─────────────────────────────────→ Connect to room via WebSocket
```

### Real-time Collaboration Flow

```
User A's Browser        Liveblocks        User B's Browser
     │                    │                     │
     │─ Creates sticky ──→ │                    │
     │   note              │                    │
     │                    │─ Broadcast mutation│
     │                    │──────────────────→ │
     │                    │                     │
     │                    │ ← Acknowledge ─────│
     │                    │                     │
     │                    │ Sticky note appears instantly
     │                    │ on User B's canvas  │
     │                    │                     │
     │ ← Moves cursor ─────→ │                  │
     │                    │─ Presence update ─→ │
     │                    │                     │
     │                    │─ Cursor position ─→ │
     │                    │   displayed         │
     │ ← Sees User B's ──────────────────────────│
     │   cursor moving       │
```

## Environment Variables by Platform

### Local Development (.env.local in /client)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_xxx...
VITE_API_URL=http://localhost:3001
```

Used by: `npm run dev`

### Production (Vercel Environment Variables Dashboard)

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxx...
VITE_API_URL=https://your-railway-app.railway.app
```

Set via: Vercel Dashboard → Settings → Environment Variables

### Railway Backend (.env on Railway)

```env
NODE_ENV=production
PORT=3001
LIVEBLOCKS_PUBLIC_KEY=pk_xxx...
# Backend doesn't need Clerk keys (client handles auth)
```

Set via: Railway Dashboard → Variables

## Deployment Pipeline

```
Developer's Computer
        │
        ├─ git push origin main
        │        │
        │        ↓
        │    GitHub Repository
        │    (collabbboard-mvp)
        │        │
        │        ├─ Webhook → Vercel
        │        │   ├─ Fetch latest code
        │        │   ├─ Install dependencies: npm ci
        │        │   ├─ Build: cd client && npm run build
        │        │   ├─ Deploy to CDN (dist folder)
        │        │   └─ Set environment variables
        │        │       from dashboard
        │        │
        │        └─ Webhook → Railway (if configured)
        │            ├─ Fetch latest code
        │            ├─ Install dependencies: npm ci
        │            ├─ Build: npm run build
        │            ├─ Start: node dist/index.js
        │            └─ Health check: /health
        │
        └─ Within 5 minutes:
            ✓ Frontend live on Vercel
            ✓ Backend running on Railway
            ✓ Users can access app
```

## Monitoring & Health Checks

### Vercel Monitoring

```
Dashboard → Deployments
├─ Build status (blue = building, green = success)
├─ Deployment logs (click to view)
├─ Analytics (performance, errors)
└─ Function logs (if using serverless)

Production Checks:
├─ Auto-deploys on git push
├─ Rollback to previous versions available
├─ CDN cache invalidation on new builds
└─ HTTPS certificates auto-renewed
```

### Railway Monitoring

```
Dashboard → Your Project
├─ Deployments (active, previous)
├─ Logs (real-time application output)
├─ Metrics (CPU, Memory, Network)
├─ Health checks (continuous monitoring)
└─ Alerts (email/webhook on failure)

Production Checks:
├─ Auto-restart on crash (configured)
├─ Health check every 10s
├─ Status page at railway.app/status
└─ Uptime monitoring available
```

### Application Health Checks

```
Vercel → checks frontend build
         └─ GET https://collabbboard.vercel.app
            ├─ Returns index.html
            ├─ Loads JavaScript
            ├─ Initializes React
            └─ Connects to Liveblocks

Railway → checks backend health
          └─ GET https://your-app.railway.app/health
             ├─ Returns { status: "ok" }
             ├─ Database connections OK
             ├─ Liveblocks connected
             └─ All services running

Liveblocks → checks sync service
             └─ Real-time sync working
                ├─ WebSocket connected
                ├─ Storage accessible
                ├─ Presence tracking
                └─ Mutations processed
```

## Scaling Considerations

### Current Setup
- **Frontend**: Vercel's global CDN (auto-scaling)
- **Backend**: Railway single instance
- **Real-time**: Liveblocks managed service

### For Growth (If Needed)
```
Millions of objects?
→ Liveblocks handles automatically

Thousands of concurrent users?
→ Railway can upgrade to higher tier
→ Vercel CDN scales automatically

Database getting large?
→ Liveblocks provides analytics
→ Can implement archival strategy
```

## Backup & Recovery

### Code
- GitHub stores all history
- Vercel keeps 10 latest deployments
- Railway keeps recent deployments

### Data
- Liveblocks manages backup (enterprise feature)
- Export from Liveblocks dashboard
- Regular snapshots recommended

### Recovery Procedure
```
If frontend breaks:
1. Go to Vercel Deployments
2. Select previous good deployment
3. Click "Promote to Production"
4. Instant rollback (2-3 seconds)

If backend breaks:
1. Go to Railway Deployments
2. Select previous good deployment
3. Click "Deploy to Production"
4. Auto-restart containers

If data corrupted:
1. Contact Liveblocks support
2. Restore from backup (if available)
3. Manual recovery tools available
```

## Security Overview

```
├─ Clerk Authentication
│  └─ OAuth2, JWT tokens
│  └─ HTTPS only
│  └─ Session tokens encrypted
│
├─ Data in Transit
│  └─ All HTTPS (Vercel, Railway, APIs)
│  └─ WebSocket WSS (secure)
│  └─ No plaintext data
│
├─ Data at Rest
│  └─ Liveblocks encrypted
│  └─ No sensitive data in localStorage
│  └─ Environment variables secured
│
├─ Infrastructure
│  └─ Vercel firewalls
│  └─ Railway isolation
│  └─ Liveblocks protection
│
└─ Code
   └─ No secrets in repository
   └─ .env.example templates only
   └─ GitHub branch protection possible
```

## Common Ports & Endpoints

### Development
```
Frontend: http://localhost:5173 (Vite dev server)
Backend:  http://localhost:3001
API:      http://localhost:3001/api
WebSocket: ws://localhost:3001/ws
```

### Production
```
Frontend: https://collabbboard-mvp.vercel.app
Backend:  https://your-app.railway.app
API:      https://your-app.railway.app/api
WebSocket: wss://your-app.railway.app/ws
Health:   https://your-app.railway.app/health
Clerk:    https://accounts.clerk.com
Liveblocks: https://liveblocks.io
```

## Troubleshooting Connection Issues

```
Cannot reach frontend?
→ Check Vercel deployment status
→ Check if domain DNS is resolved
→ Check browser console for errors

Cannot reach backend?
→ Check Railway deployment status
→ Verify VITE_API_URL environment variable
→ Check if Railway health check passing
→ Verify CORS headers configured

Real-time not syncing?
→ Check WebSocket connection in DevTools
→ Verify Liveblocks API key
→ Check if browser has stable connection
→ Check for Liveblocks status page

Cannot log in?
→ Check Clerk domain in allowed origins
→ Verify pk_live_ key (not pk_test_)
→ Check if Clerk service is up
→ Clear browser cookies and retry
```

---

## Summary

CollabBoard MVP uses a **split deployment architecture**:

- **Frontend** on Vercel: Fast, global CDN, easy deployment
- **Backend** on Railway: Persistent service, API server, WebSocket handler
- **Real-time Sync** with Liveblocks: Managed service, automatic scaling
- **Authentication** with Clerk: Secure, user management, OAuth

This architecture provides:
✅ Automatic scaling
✅ High availability
✅ Real-time collaboration
✅ Easy deployment (git push)
✅ Production-grade infrastructure

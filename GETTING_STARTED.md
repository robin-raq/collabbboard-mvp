# CollabBoard MVP - Getting Started

Welcome! This guide will help you navigate all the documentation and get started quickly.

## 🚀 Quick Links

### **I want to run it locally RIGHT NOW**
→ Go to **[RUN_LOCALLY.md](./RUN_LOCALLY.md)** (5 minute setup guide)

### **I need to set up Clerk authentication**
→ Go to **[SETUP_CLERK.md](./SETUP_CLERK.md)** (detailed Clerk configuration)

### **I want to deploy to production**
→ Go to **[DEPLOYMENT.md](./DEPLOYMENT.md)** (Railway deployment guide)

### **I want a 5-minute overview**
→ Go to **[QUICKSTART.md](./QUICKSTART.md)** (simplified quick start)

### **I want to understand what's been done**
→ Go to **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** (full feature list and fixes)

### **I want architecture and design details**
→ Go to **[README.md](./README.md)** (full project overview)

---

## 📋 Documentation Overview

| Document | Purpose | Time | Who Should Read |
|----------|---------|------|-----------------|
| **RUN_LOCALLY.md** | Complete step-by-step local setup | 5 min | Everyone starting out |
| **QUICKSTART.md** | Condensed quick start | 2 min | Experienced developers |
| **SETUP_CLERK.md** | Clerk authentication setup | 10 min | Need to configure auth |
| **DEPLOYMENT.md** | Deploy to Railway | 10 min | Want to go live |
| **COMPLETION_SUMMARY.md** | What's been implemented | 5 min | Want to see what's done |
| **README.md** | Project overview & architecture | 10 min | Want full context |

---

## ⚡ The 5-Minute Path

1. **Create API keys** (2 min)
   - [Clerk](https://clerk.com/sign-up) → Get `pk_test_` and `sk_test_`
   - [Liveblocks](https://liveblocks.io) → Get `pk_dev_`

2. **Create `.env.local` files** (1 min)
   - `client/.env.local` with Clerk and Liveblocks keys
   - `server/.env.local` with Clerk secret and Liveblocks key

3. **Install & Run** (2 min)
   ```bash
   npm install --prefix client
   npm install --prefix server
   npm --prefix server run dev  # Terminal 1
   npm --prefix client run dev  # Terminal 2
   ```

4. **Open browser** → http://localhost:5173
5. **Sign in with Clerk** → Create board → Make sticky notes!

See **[RUN_LOCALLY.md](./RUN_LOCALLY.md)** for detailed walkthrough.

---

## ✅ What's Included

### Core Features ✅
- ✅ **Sticky Notes**: Create, edit (double-click), delete
- ✅ **Real-time Collaboration**: Multiple users see changes instantly
- ✅ **User Authentication**: Mandatory Clerk login
- ✅ **Presence Awareness**: See who's online and their cursor
- ✅ **Pan & Zoom**: Navigate the canvas
- ✅ **Multi-select**: Shift+click to select multiple objects

### Production Ready ✅
- ✅ **Docker**: Multi-stage containerized build
- ✅ **Railway**: One-click deployment from GitHub
- ✅ **HTTPS**: Automatic SSL certificates
- ✅ **Environment Management**: .env templates

### Documentation ✅
- ✅ **Local Development**: RUN_LOCALLY.md
- ✅ **Authentication Setup**: SETUP_CLERK.md
- ✅ **Deployment Guide**: DEPLOYMENT.md
- ✅ **Quick Start**: QUICKSTART.md
- ✅ **Feature Summary**: COMPLETION_SUMMARY.md

---

## 🎯 Typical User Journeys

### Journey 1: I'm a Developer Who Wants to Contribute
1. Read [README.md](./README.md) for architecture
2. Follow [RUN_LOCALLY.md](./RUN_LOCALLY.md) for setup
3. Make changes to `client/src/` or `server/src/`
4. Test locally with hot-reload
5. Commit and push

### Journey 2: I Want to Deploy to Production
1. Have app running locally (see [RUN_LOCALLY.md](./RUN_LOCALLY.md))
2. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway setup
3. Get production API keys from Clerk and Liveblocks
4. Commit `.env` files to environment variables (not git)
5. App auto-deploys on git push!

### Journey 3: I'm Just Testing It Out
1. Read [QUICKSTART.md](./QUICKSTART.md) (2 min read)
2. Follow [RUN_LOCALLY.md](./RUN_LOCALLY.md) (5 min setup)
3. Open http://localhost:5173
4. Sign in and create a board
5. Open in another browser to test multiplayer

### Journey 4: I Need to Understand Clerk Setup
1. Have Clerk account? No → [SETUP_CLERK.md](./SETUP_CLERK.md)
2. Have keys? → Add to `.env.local`
3. Still issues? → See SETUP_CLERK.md troubleshooting

---

## 🔧 Technology Stack

**Frontend**
- React 19 + Vite + TypeScript + Tailwind CSS
- Konva.js for canvas rendering
- Clerk for authentication
- Liveblocks for real-time sync

**Backend**
- Express + Node.js + TypeScript
- Clerk for JWT verification
- Liveblocks for real-time data

**Deployment**
- Docker (multi-stage build)
- Railway (one-click from GitHub)

---

## ❓ FAQ

### Q: Do I need to buy anything?
**A:** No! All services have free tiers:
- Clerk: Free tier covers up to 10,000 users
- Liveblocks: Free tier for development
- Railway: Free tier for testing ($5/month production)

### Q: How does real-time sync work?
**A:** Liveblocks handles all synchronization. Changes sync instantly across all users.

### Q: Can I run without Clerk?
**A:** No. Clerk is mandatory for authentication. See [SETUP_CLERK.md](./SETUP_CLERK.md).

### Q: How do I test multiplayer?
**A:** Open http://localhost:5173 in two different browser windows/tabs, sign in with different Clerk accounts, and open the same board. All changes sync in real-time!

### Q: What if I want to use a different auth provider?
**A:** Clerk supports many OAuth providers (Google, GitHub, Facebook, etc.). Configure in [SETUP_CLERK.md](./SETUP_CLERK.md).

### Q: Can I add a database?
**A:** Yes! The app is designed to support optional PostgreSQL. See [README.md](./README.md) for details.

### Q: How do I deploy?
**A:** Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway (5 minutes) or Docker locally.

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "Missing VITE_CLERK_PUBLISHABLE_KEY" | Check `.env.local` in `client/` directory |
| Can't see other users | Make sure you signed in with different Clerk accounts |
| Sticky note edit won't work | Double-click (not single-click) to enter edit mode |
| Port 3001 in use | Kill the process: `lsof -ti:3001 \| xargs kill -9` |
| Build failing | Delete `node_modules/` and run `npm install` again |

See [RUN_LOCALLY.md](./RUN_LOCALLY.md) **Troubleshooting** section for more.

---

## 📞 Getting Help

- **Clerk Issues**: https://support.clerk.com
- **Liveblocks Issues**: https://docs.liveblocks.io
- **Express Issues**: https://expressjs.com
- **React Issues**: https://react.dev

---

## 🎉 You're Ready!

Pick your path above and get started. Most people start with [RUN_LOCALLY.md](./RUN_LOCALLY.md).

**Happy building!** 🚀

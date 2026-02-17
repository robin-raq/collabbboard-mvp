# Running CollabBoard MVP Locally

Complete step-by-step guide to get CollabBoard running on your machine.

## Prerequisites

- **Node.js 20+**: [Download](https://nodejs.org/)
- **npm 11+**: Comes with Node.js
- **Git**: [Download](https://git-scm.com/)
- **Two separate browser windows or tabs** (for testing multiplayer)

Check your versions:
```bash
node --version  # Should be v20+
npm --version   # Should be 11+
```

## Setup (5 minutes total)

### 1. Get API Keys (2 minutes)

#### Clerk Authentication Key
1. Go to https://clerk.com/sign-up
2. Create a free account
3. Create a new application
4. Go to **API Keys** page (left sidebar)
5. Copy your **Publishable Key** (`pk_test_...`)
6. Copy your **Secret Key** (`sk_test_...`)

#### Liveblocks Real-time Sync Key
1. Go to https://liveblocks.io
2. Create a free account
3. Create an application
4. Go to **API Keys**
5. Copy your public key (`pk_dev_...`)

### 2. Create Environment Files (1 minute)

**Create `client/.env.local`:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_PASTE_YOUR_CLERK_KEY_HERE
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_PASTE_YOUR_LIVEBLOCKS_KEY_HERE
VITE_API_URL=http://localhost:3001
```

**Create `server/.env.local`:**
```bash
CLERK_SECRET_KEY=sk_test_PASTE_YOUR_CLERK_SECRET_HERE
PORT=3001
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_PASTE_YOUR_LIVEBLOCKS_KEY_HERE
```

**Important**: Never commit these files (they're in `.gitignore`)

### 3. Install Dependencies (1 minute)

```bash
npm install --prefix client
npm install --prefix server
```

This installs all Node modules for both frontend and backend.

### 4. Start the Backend Server (Terminal 1)

```bash
npm --prefix server run dev
```

Expected output:
```
HTTP API server running on port 3001
```

### 5. Start the Frontend Server (Terminal 2)

```bash
npm --prefix client run dev
```

Expected output:
```
VITE v7.3.1  ready in 803 ms

  ➜  Local:   http://localhost:5173
  ➜  press h + enter to show help
```

### 6. Open in Browser

Click the link or go to: **http://localhost:5173**

You should see the Clerk login page.

## Using the App (1 minute)

### Sign In
1. Click **Sign up** on the Clerk login page
2. Enter your email address
3. Check your email for a verification link (or use test mode)
4. Click the link to verify
5. Create a password

### Create Your First Board
1. After signing in, click **+ New Board**
2. You should see an empty canvas

### Test Sticky Notes
1. Click the **sticky note icon** in the toolbar (top left)
2. Click anywhere on the canvas to create a sticky note
3. **Double-click** the sticky note to edit the text
4. Type some text
5. Click away or press Ctrl+Enter to save

### Test Multiplayer (2 windows)

**Window 1:**
- Already signed in with your account
- Create a sticky note

**Window 2:**
- Go to http://localhost:5173
- Sign in with a **different email**
- Open the **same board** (same URL)
- You should see the sticky note from Window 1 appear in real-time!
- Create a sticky note in Window 2
- You should see it appear in Window 1 instantly!

### See Presence Awareness
- Look at the **top right corner** (Presence Bar)
- You should see both user names
- Move your cursor around
- See your cursor appear in the other window!

## Features to Explore

### Canvas Controls
- **Pan**: Middle-click drag or scroll to pan
- **Zoom**: Ctrl + Scroll (or Cmd + Scroll on Mac)
- **Reset**: Double-click to reset view (in future)

### Object Operations
- **Create**: Click tool → click canvas
- **Select**: Click to select, Shift+click for multi-select
- **Edit text**: Double-click sticky notes
- **Move**: Drag selected objects
- **Delete**: Select → press Delete or Backspace

### Multiplayer
- **See other users**: Check Presence Bar (top right)
- **See their cursors**: Watch cursor labels move in real-time
- **See their edits**: All changes sync instantly

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY"
```
Error: Missing VITE_CLERK_PUBLISHABLE_KEY
```
**Solution:**
- Check `client/.env.local` exists
- Verify the key starts with `pk_test_`
- Make sure there's no leading/trailing whitespace
- Restart the dev server

### "CLERK_SECRET_KEY Error" (Backend)
```
Error: Missing CLERK_SECRET_KEY
```
**Solution:**
- Check `server/.env.local` exists
- Verify the key starts with `sk_test_`
- Make sure there's no leading/trailing whitespace
- Restart the dev server

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Solution:**
- Kill the process using port 3001:
  ```bash
  # macOS/Linux
  lsof -ti:3001 | xargs kill -9

  # Windows
  netstat -ano | findstr :3001
  taskkill /PID <PID> /F
  ```

### Can't See Other Users
**Problem:** Other users don't appear in Presence Bar

**Solution:**
1. Make sure both are signed in with **different Clerk accounts**
2. Both are opening the **same board** (same URL)
3. Wait 2-3 seconds for Liveblocks to sync

### Sticky Note Edits Not Saving
**Problem:** Double-click doesn't open edit mode, or edits don't save

**Solution:**
1. Make sure you **double-click** (not single-click)
2. Type your text
3. Click away or press **Ctrl+Enter**
4. Changes sync to all users automatically

### "Loading..." Never Finishes
**Problem:** Clerk login page shows "Loading..." and never completes

**Solution:**
1. Check browser console (F12 → Console tab)
2. Look for Clerk errors
3. Verify `VITE_CLERK_PUBLISHABLE_KEY` is correct
4. Clear browser cookies and cache
5. Hard reload (Ctrl+Shift+R)

### Browser Console Errors
**Solution:**
1. Open DevTools: F12
2. Click **Console** tab
3. Look for any red error messages
4. Most common: Auth errors or Liveblocks connection issues
5. Check that all environment variables are set correctly

## Development Tips

### Hot Module Replacement
- Edit `client/src/` files → browser auto-updates
- Edit `server/src/` files → server auto-restarts

### Checking Logs
- **Frontend logs**: Open browser DevTools (F12)
- **Backend logs**: Check Terminal 1 output
- **Network logs**: DevTools → Network tab

### Testing Production Build

To test the production Docker build locally:

```bash
# Build both frontend and backend
npm run build --prefix client
npm run build --prefix server

# Build Docker image
docker build -t collabboard-mvp .

# Run Docker container
docker run -p 3001:3001 \
  -e CLERK_SECRET_KEY=sk_test_YOUR_KEY \
  -e VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_YOUR_KEY \
  collabboard-mvp

# Open http://localhost:3001
```

## Next Steps

### Continue Development
- See [README.md](./README.md) for architecture
- Check [COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md) for what's done

### Deploy to Production
- Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for Railway deployment
- Takes 5 minutes with automatic git sync

### Add More Features
- Implement undo/redo
- Add persistent storage (PostgreSQL)
- Add more drawing tools
- Implement AI chat panel

## Getting Help

- **Clerk Issues**: https://support.clerk.com
- **Liveblocks Issues**: https://docs.liveblocks.io
- **Express Issues**: https://expressjs.com
- **React Issues**: https://react.dev

## Environment Variables Summary

| Variable | Where | Value | Required |
|----------|-------|-------|----------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `client/.env.local` | `pk_test_...` | ✅ Yes |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `client/.env.local` | `pk_dev_...` | ✅ Yes |
| `VITE_API_URL` | `client/.env.local` | `http://localhost:3001` | ✅ Yes |
| `CLERK_SECRET_KEY` | `server/.env.local` | `sk_test_...` | ✅ Yes |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `server/.env.local` | `pk_dev_...` | ✅ Yes |
| `PORT` | `server/.env.local` | `3001` | ✅ Yes |

---

**You're ready to go!** 🚀

If you run into any issues, check the troubleshooting section above or review the guides in the repository.

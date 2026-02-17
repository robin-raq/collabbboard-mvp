# CollabBoard MVP - Quick Start Guide

Get CollabBoard running in 5 minutes!

## Prerequisites
- Node.js 20+
- npm 11+
- Clerk account (free at https://clerk.com)

## Step 1: Clone & Install (1 minute)

```bash
# Clone the repository
git clone https://github.com/robin-raq/collabbboard-mvp.git
cd collabbboard-mvp

# Install dependencies
npm install --prefix client
npm install --prefix server
```

## Step 2: Set Up Clerk (2 minutes)

1. Go to https://clerk.com and sign up
2. Create a new application
3. Copy these keys from **API Keys** page:
   - `pk_test_...` (Publishable Key)
   - `sk_test_...` (Secret Key)

## Step 3: Add Environment Variables (1 minute)

**Create `client/.env.local`:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_YOUR_KEY_HERE
VITE_API_URL=http://localhost:3001
```

**Create `server/.env.local`:**
```bash
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
PORT=3001
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_YOUR_KEY_HERE
```

**To get your keys:**
- **Clerk**: https://dashboard.clerk.com → API Keys (get `pk_test_` and `sk_test_`)
- **Liveblocks**: https://liveblocks.io/dashboard → API Keys (get `pk_dev_`)

## Step 4: Start Development Servers (1 minute)

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
# Should show: "HTTP API server running on port 3001"
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
# Should show: "http://localhost:5174" or "http://localhost:5173"
```

## Step 5: Open in Browser

Click the link from Terminal 2 output or go to **http://localhost:5173**

You'll see the Clerk login page → Sign in → Start collaborating!

## Test Multiplayer (Optional)

1. **Open two browsers** (or one regular + one incognito)
2. **Sign in with different emails**
3. **Create a board** in one window
4. **Create the same board** in the other (same URL/boardId)
5. **See real-time sync**: Create a sticky note in one window, see it appear in the other instantly!

## Features to Try

- ✏️ **Create sticky note**: Click the sticky icon in toolbar
- 📝 **Edit text**: Double-click any sticky note
- 🗑️ **Delete**: Select note and press Delete
- 👥 **See who's online**: Check top-right corner (Presence Bar)
- 👀 **Watch cursors**: See other users' cursor movements in real-time
- 🔍 **Pan & Zoom**: Scroll to pan, Ctrl+Scroll to zoom

## What's Working

✅ Real-time collaborative editing
✅ User authentication with Clerk
✅ Multiple users on same board
✅ Sticky note creation and editing
✅ Presence awareness (see who's online)
✅ Cursor tracking
✅ Pan & zoom canvas

## Troubleshooting

**"Missing VITE_CLERK_PUBLISHABLE_KEY"**
→ Check your `.env.local` file has the correct key

**"App won't start"**
→ Make sure you have Node 20+: `node --version`

**"Can't edit sticky notes"**
→ Double-click to enter edit mode

**"Don't see other users"**
→ Make sure you're signed in with different Clerk accounts in each browser

**"Build failing"**
→ Delete `node_modules` and run `npm install` again

## Next Steps

- 📖 Read [SETUP_CLERK.md](./SETUP_CLERK.md) for more Clerk options
- 🚀 Deploy to Railway using [DEPLOYMENT.md](./DEPLOYMENT.md)
- 📚 See full docs in [README.md](./README.md)

## Get Help

**Clerk Documentation**: https://clerk.com/docs
**Liveblocks Documentation**: https://docs.liveblocks.io

---

**You're all set!** Happy collaborating! 🎉

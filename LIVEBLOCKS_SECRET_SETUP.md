# Setting Liveblocks Secret Key in Railway

## The Issue
Liveblocks requires **two keys** for proper operation:
1. **Public Key** (already set) - Used by frontend to initialize Liveblocks
2. **Secret Key** (NEW - needs to be added) - Used by backend to authenticate users and generate tokens

Without the secret key, the backend cannot authenticate users with Liveblocks, and rooms won't work.

## Step 1: Get Your Liveblocks Secret Key

1. Go to https://liveblocks.io/dashboard
2. Click on your project
3. Click **"API Keys"** or **"Settings"**
4. Look for **"Secret key"** (NOT the public key)
5. Copy it (starts with `sk_` or `sk_prod_`)

## Step 2: Add to Railway

1. Go to https://railway.app
2. Click your **collabbboard-mvp** project
3. Click the service
4. Click **"Variables"** tab
5. Click **"+ New Variable"**
6. **Name**: `LIVEBLOCKS_SECRET_KEY`
7. **Value**: Paste your secret key
8. Click **Add**

## Step 3: Wait for Redeploy

Railway will automatically redeploy with the new secret key.

Once deployed, the app should now:
- ✓ Authenticate with Liveblocks
- ✓ Create rooms successfully
- ✓ Allow you to create stickies and shapes
- ✓ Sync changes across users in real-time

## Verification

After deployment, try this:
1. Go to https://raqdrobinson.com
2. Open browser console (F12)
3. Create a sticky note
4. Check console for error messages
5. The sticky should appear and persist

If you still see "Connection to Liveblocks websocket server closed", the secret key might be missing or incorrect.

## Summary of Required Environment Variables

Your Railway Variables should now include:

| Name | Value | Where to Get |
|------|-------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Dashboard |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_prod_...` | Liveblocks Dashboard → API Keys |
| `LIVEBLOCKS_SECRET_KEY` | `sk_prod_...` | Liveblocks Dashboard → API Keys (Secret) |
| `VITE_API_URL` | `https://raqdrobinson.com` | Your domain |
| `PORT` | `3001` | (Already set by Railway) |
| `NODE_ENV` | `production` | (Already set by Railway) |

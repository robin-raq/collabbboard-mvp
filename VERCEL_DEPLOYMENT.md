# Vercel Deployment Guide for CollabBoard MVP

This guide will help you deploy CollabBoard to Vercel with Clerk authentication and real-time multiplayer features.

## Architecture Overview

- **Frontend**: React + Vite deployed on Vercel
- **Backend**: Express + Node.js running on Railway
- **Real-time Sync**: Liveblocks (websockets)
- **Authentication**: Clerk (with Vercel domain)

This split deployment allows you to:
- Get a Vercel domain that Clerk accepts for production
- Keep the backend on Railway (already working)
- Easy separation of concerns

## Step 1: Prepare Your GitHub Repository

Make sure your CollabBoard MVP is pushed to GitHub:

```bash
cd /Users/raqdominique/Documents/Web_Development/gfa/collabbboard-mvp
git status
git push origin main
```

Your repository should be public or you need a GitHub account connected to Vercel.

## Step 2: Create a Vercel Account & Project

1. Go to https://vercel.com
2. Click "Sign Up" and choose "Continue with GitHub"
3. Authorize Vercel to access your GitHub account
4. Click "Import Project"
5. Search for and select your `collabbboard-mvp` repository
6. Click "Import"

## Step 3: Configure Build Settings in Vercel

In the Vercel import dialog, configure:

**Framework**: Other
**Build Command**: `cd client && npm install && npm run build`
**Output Directory**: `client/dist`
**Root Directory**: `.` (leave empty)

Then click "Deploy"

**Note**: The build will likely fail on first attempt because environment variables are missing. This is expected.

## Step 4: Get Your Vercel Domain

Once the project is imported in Vercel:

1. Go to your project dashboard
2. Look for the **Deployments** tab
3. You'll see a domain like `collabbboard-mvp.vercel.app`
4. Note this domain - you'll need it for Clerk

## Step 5: Set Up Clerk for Production

### 5a. Create a New Clerk Application (Production)

1. Go to https://dashboard.clerk.com
2. Click "Add application" or "+ New Application"
3. Name it "CollabBoard MVP - Vercel"
4. Choose Sign-in method (Email, Google, GitHub, etc.)
5. Click "Create application"
6. Go to **API Keys** section
7. Copy the **Publishable Key** (starts with `pk_live_`)

### 5b. Configure Clerk Application Domain

1. In Clerk dashboard, go to **Instances** → **Settings** (or your application settings)
2. Find the "Allowed Origins" or "Domains" section
3. Add your Vercel domain: `https://collabbboard-mvp.vercel.app`
4. Save changes

**Important**: Use your actual Vercel domain (you'll find it in Vercel dashboard under Deployments)

## Step 6: Get Liveblocks API Key

1. Go to https://liveblocks.io/dashboard
2. If you don't have an API key yet:
   - Create a new project
   - Go to **API Keys** section
   - Copy the public API key (starts with `pk_`)

## Step 7: Set Environment Variables in Vercel

1. In Vercel dashboard, go to your project
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

| Variable Name | Value | Source |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_xxx...` | Clerk dashboard (API Keys) |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_xxx...` | Liveblocks dashboard |
| `VITE_API_URL` | `https://collabbboard-mvp.railway.app` | Your Railway app URL |

**Get your Railway app URL**:
1. Go to https://railway.app
2. Select your CollabBoard MVP project
3. Click on the **Deployments** tab
4. Look for the **URL** field - it should be something like `https://collabbboard-mvp.railway.app`

## Step 8: Trigger Redeployment

1. In Vercel dashboard, go to **Deployments**
2. Find the latest failed deployment
3. Click the **...** menu and select "Redeploy"
4. Or push a new commit to GitHub to trigger a new build

## Step 9: Test Your Deployment

1. Visit your Vercel domain: `https://collabbboard-mvp.vercel.app`
2. You should be redirected to Clerk login
3. Sign in or create an account
4. Create a new board
5. Verify all features work:
   - Create sticky notes
   - Create shapes
   - Real-time presence (open in another browser/incognito window)
   - See user cursors and names
   - Text editing

## Troubleshooting

### "Environment variables not found" error
- Make sure all three `VITE_*` variables are set in Vercel settings
- Redeploy after adding variables

### "Failed to connect to API" or "Cannot reach backend"
- Check your `VITE_API_URL` in Vercel environment variables
- Make sure Railway backend is running and publicly accessible
- Verify the exact URL by visiting it in a browser

### "Clerk authentication not working"
- Verify your Vercel domain is added to Clerk's allowed origins
- Make sure you're using a `pk_live_*` key (not `pk_test_*`)
- Check that the domain in Clerk dashboard matches your Vercel domain exactly

### "Real-time sync not working"
- Verify `VITE_LIVEBLOCKS_PUBLIC_KEY` is set in Vercel
- Check that Liveblocks backend is configured correctly
- Open browser developer tools and look for websocket connection errors

### Build fails with "Cannot find module"
- This usually means tsconfig files are missing
- Check that Dockerfile (if you were using Docker locally) is correct
- Make sure all source files are committed to git

## Next Steps

After successful Vercel deployment:

1. **Custom Domain** (Optional):
   - In Vercel dashboard, go to **Settings** → **Domains**
   - Add a custom domain
   - Update Clerk settings to use your custom domain

2. **Monitor Performance**:
   - Vercel provides analytics dashboard
   - Check deployment logs for any errors
   - Monitor real-time sync latency via Liveblocks dashboard

3. **Continuous Deployment**:
   - Every push to `main` branch will auto-deploy to Vercel
   - Review deployment logs if something breaks

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    User's Browser                        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  CollabBoard MVP Frontend (React + Vite)           │ │
│  │  (Deployed to Vercel at yourapp.vercel.app)       │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │      Authentication & Presence       │
        │                                      │
        │  ┌──────────────────────────────┐   │
        │  │  Clerk Authentication        │   │
        │  │  (Vercel domain)             │   │
        │  └──────────────────────────────┘   │
        │                                      │
        │  ┌──────────────────────────────┐   │
        │  │  Liveblocks Sync             │   │
        │  │  (WebSocket connection)      │   │
        │  └──────────────────────────────┘   │
        └──────────────────────────────────────┘
                           ↓
        ┌──────────────────────────────────────┐
        │    CollabBoard Backend                │
        │  (Deployed to Railway)                │
        │                                      │
        │  ┌──────────────────────────────┐   │
        │  │  Express.js Server           │   │
        │  │  REST API Endpoints          │   │
        │  │  WebSocket Handler           │   │
        │  └──────────────────────────────┘   │
        │                                      │
        │  ┌──────────────────────────────┐   │
        │  │  Liveblocks Integration      │   │
        │  │  Real-time Storage           │   │
        │  └──────────────────────────────┘   │
        └──────────────────────────────────────┘
```

## Environment Variables Reference

### Development (.env.local)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_xxx...
VITE_API_URL=http://localhost:3001
```

### Production (Vercel Dashboard)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxx...
VITE_API_URL=https://collabbboard-mvp.railway.app
```

## Support

If you encounter issues:

1. Check Vercel deployment logs: Dashboard → Deployments → Click failed build
2. Check Clerk documentation: https://clerk.com/docs
3. Check Liveblocks documentation: https://docs.liveblocks.io
4. Check Railway logs: Railway dashboard → Select project → View logs

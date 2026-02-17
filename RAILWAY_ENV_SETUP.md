# Setting Environment Variables in Railway

## Problem
The app is deployed but showing "Missing VITE_CLERK_PUBLISHABLE_KEY" because the environment variables aren't configured in Railway.

## Solution: Configure Variables in Railway Dashboard

### Step 1: Go to Your Railway Project
1. Visit https://railway.app
2. Click on your **collabbboard-mvp** project
3. Click on the **collabbboard-mvp** service

### Step 2: Navigate to Variables Tab
1. Click the **"Variables"** tab at the top
2. You should see existing variables like `PORT` and `NODE_ENV`

### Step 3: Add Your Clerk Key
1. Click **"+ New Variable"** button
2. In the **Name** field, enter: `VITE_CLERK_PUBLISHABLE_KEY`
3. In the **Value** field, paste your Clerk publishable key (starts with `pk_live_`)
   - Get this from: https://dashboard.clerk.com → Your Application → API Keys → Publishable Key
4. Click **Add**

### Step 4: Add Your Liveblocks Key
1. Click **"+ New Variable"** button again
2. In the **Name** field, enter: `VITE_LIVEBLOCKS_PUBLIC_KEY`
3. In the **Value** field, paste your Liveblocks public API key (starts with `pk_`)
   - Get this from: https://liveblocks.io/dashboard → Your project → API Keys → Public key
4. Click **Add**

### Step 5: (Optional) Add Custom Domain API URL
If you want the frontend to use your custom domain for API calls:
1. Click **"+ New Variable"** button
2. In the **Name** field, enter: `VITE_API_URL`
3. In the **Value** field, enter: `https://raqdrobinson.com`
4. Click **Add**

### Step 6: Trigger Redeploy
After adding variables, Railway should automatically redeploy. You can:
1. Watch the **Deployments** tab to see the new deployment in progress
2. Or manually trigger by clicking **Deploy** button

### Step 7: Verify
Once deployment completes:
1. Visit https://raqdrobinson.com
2. Open browser console (F12 → Console)
3. You should now see:
   - `Clerk Key: ✓ Set`
   - `Liveblocks Key: ✓ Set`
4. The login screen should appear

## Troubleshooting

### Still seeing "Missing VITE_CLERK_PUBLISHABLE_KEY"?
- **Check 1**: Are the variable names spelled correctly? (case-sensitive)
  - `VITE_CLERK_PUBLISHABLE_KEY` ✓
  - `VITE_LIVEBLOCKS_PUBLIC_KEY` ✓
- **Check 2**: Did Railway redeploy after you added variables? Check Deployments tab
- **Check 3**: Is the value pasted correctly without extra spaces?
- **Check 4**: Does the value start with `pk_live_` (Clerk) or `pk_` (Liveblocks)?

### The `/api/config` endpoint returns empty?
This means the environment variables aren't being read by the Node.js server. Make sure they're added to Railway's Variables tab, not just in the Dockerfile or local .env files.

### Getting SSL errors when trying to login?
This is usually a Clerk domain setup issue. Verify that all 5 DNS records are verified in Clerk dashboard:
1. `clk._domainkey`
2. `clk2._domainkey`
3. `clkmail`
4. `_domainverify`
5. `default._domainkey` (or similar)

## Environment Variables Reference

| Variable | Where to Get | Example |
|----------|-------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | https://dashboard.clerk.com → API Keys | `pk_live_2a4b...` |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | https://liveblocks.io/dashboard | `pk_prod_ab12...` |
| `VITE_API_URL` | Optional, your domain | `https://raqdrobinson.com` |
| `PORT` | Already set by Railway | `3001` |
| `NODE_ENV` | Already set by Railway | `production` |

## How It Works Now

1. **Backend receives env vars from Railway**
   - Node.js process reads `process.env.VITE_CLERK_PUBLISHABLE_KEY` etc.
2. **Frontend fetches via `/api/config`**
   - When page loads, React calls `fetch('/api/config')`
   - Backend returns the values from `process.env`
3. **Frontend initializes with keys**
   - ClerkProvider and LiveblocksProvider are initialized with the keys
   - App is ready to use

This approach avoids build-time variable issues and HTML injection complexity!

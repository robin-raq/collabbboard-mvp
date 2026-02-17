# Environment Variables Setup Checklist

Use this checklist to gather all required environment variables for your Vercel deployment.

## ✅ Step 1: Clerk Production Application

### Create New Clerk App for Vercel Domain
- [ ] Go to https://dashboard.clerk.com
- [ ] Click "Add Application"
- [ ] Name: "CollabBoard MVP - Vercel"
- [ ] Choose authentication methods (Email, Google, GitHub, etc.)
- [ ] Click "Create Application"

### Get Clerk Publishable Key
- [ ] In Clerk dashboard, go to **API Keys**
- [ ] Copy the **Publishable Key** (starts with `pk_live_`)
- [ ] Save it: `VITE_CLERK_PUBLISHABLE_KEY = pk_live_xxxxxxxxxxxxx`

### Configure Clerk Domain
- [ ] In Clerk dashboard, go to **Instances** or **Settings**
- [ ] Find "Allowed Origins" or "Domains" section
- [ ] Add your Vercel domain: `https://collabbboard-mvp.vercel.app`
  - (Replace `collabbboard-mvp` with your actual Vercel project name)
- [ ] Save changes

**⚠️ Important**: Your Vercel domain will be created in Step 2. If you haven't created the Vercel project yet, you can come back and update this after creating it.

---

## ✅ Step 2: Liveblocks API Key

### Get Liveblocks Public Key
- [ ] Go to https://liveblocks.io/dashboard
- [ ] Select your project (or create a new one)
- [ ] Go to **API Keys**
- [ ] Copy the **public API key** (starts with `pk_`)
- [ ] Save it: `VITE_LIVEBLOCKS_PUBLIC_KEY = pk_xxxxxxxxxxxxx`

---

## ✅ Step 3: Railway Backend URL

### Get Railway App URL
- [ ] Go to https://railway.app
- [ ] Log in with your Railway account
- [ ] Select your CollabBoard MVP project
- [ ] Click on the **Deployments** tab
- [ ] Look for the **URL** field (should look like `https://collabbboard-mvp.railway.app`)
- [ ] Save it: `VITE_API_URL = https://collabbboard-mvp.railway.app`

**Note**: If Railway URL is not showing:
1. Click on the project
2. Look for a domain/URL section
3. It might be under "Production" or "Live" deployment

---

## ✅ Step 4: Vercel Project Setup

### Create Vercel Project
- [ ] Go to https://vercel.com
- [ ] Click "Add New" → "Project"
- [ ] Select your GitHub repository (`collabbboard-mvp`)
- [ ] Framework: `Other`
- [ ] Build Command: `cd client && npm install && npm run build`
- [ ] Output Directory: `client/dist`
- [ ] Click "Deploy"

### Get Vercel Domain
- [ ] In Vercel dashboard, go to **Deployments**
- [ ] Look for your domain (will be something like `collabbboard-mvp.vercel.app`)
- [ ] Save it: `VERCEL_DOMAIN = collabbboard-mvp.vercel.app`
- [ ] Update Clerk domain in Step 1 with this domain

---

## ✅ Step 5: Add Environment Variables to Vercel

In Vercel dashboard:
1. Go to your project
2. Click **Settings** → **Environment Variables**
3. Add each variable below

| Variable Name | Value | Obtained From |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_live_xxx...` | Clerk dashboard - API Keys section |
| `VITE_LIVEBLOCKS_PUBLIC_KEY` | `pk_xxx...` | Liveblocks dashboard - API Keys |
| `VITE_API_URL` | `https://collabbboard-mvp.railway.app` | Railway app URL |

- [ ] Added all 3 environment variables to Vercel
- [ ] Verified each value is correct (no extra spaces)
- [ ] Clicked "Save"

---

## ✅ Step 6: Test Deployment

### Verify Build
- [ ] In Vercel dashboard, go to **Deployments**
- [ ] Find the latest deployment
- [ ] If failed, click to view logs and troubleshoot
- [ ] If not there yet, click "Redeploy" on the last successful deployment

### Test in Browser
- [ ] Visit your Vercel domain: `https://collabbboard-mvp.vercel.app`
- [ ] You should see a Clerk login page
- [ ] Sign up or log in with an account
- [ ] Create a new board
- [ ] Test features:
  - [ ] Create sticky notes
  - [ ] Create shapes
  - [ ] Edit text
  - [ ] Real-time sync (open in another browser tab/window)
  - [ ] See other user's cursor and name

---

## Summary of All Environment Variables

Keep this for reference:

```
Production (Vercel Environment Variables):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VITE_CLERK_PUBLISHABLE_KEY = pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_LIVEBLOCKS_PUBLIC_KEY = pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_URL = https://collabbboard-mvp.railway.app

Local Development (.env.local in /client folder):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VITE_CLERK_PUBLISHABLE_KEY = pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_LIVEBLOCKS_PUBLIC_KEY = pk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_URL = http://localhost:3001
```

---

## Troubleshooting

### "Missing environment variable" error on Vercel
→ Check that all three variables are set in Vercel Settings → Environment Variables

### "Cannot reach backend" error
→ Verify VITE_API_URL is correct and Railway backend is running

### "Clerk not working"
→ Make sure Vercel domain is added to Clerk's allowed origins
→ Make sure you're using `pk_live_` key (not `pk_test_`)

### Build fails with "Cannot find module"
→ Check Vercel deployment logs for details
→ Make sure all source code is committed to GitHub

---

## Need Help?

- **Vercel Docs**: https://vercel.com/docs
- **Clerk Docs**: https://clerk.com/docs
- **Liveblocks Docs**: https://docs.liveblocks.io
- **Railway Docs**: https://docs.railway.app

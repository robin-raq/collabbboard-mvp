# Vercel Quick Start (5 Minutes)

Fast track to deploying CollabBoard to Vercel with authenticated users.

## Prerequisites
- GitHub account (repository already there)
- Clerk account (https://clerk.com)
- Liveblocks API key (you should have one)
- Railway backend running (should already be deployed)

## The Plan
1. **Get required credentials** (Clerk, Liveblocks, Railway URL)
2. **Create Vercel project** from GitHub
3. **Set environment variables** in Vercel
4. **Test deployment**

---

## 1️⃣ Gather Credentials (5 min)

### A. Clerk Publishable Key

```
1. Go to https://dashboard.clerk.com
2. Create new application: "CollabBoard MVP - Vercel"
3. Go to API Keys
4. Copy Publishable Key (pk_live_...)
5. Save: VITE_CLERK_PUBLISHABLE_KEY
```

**Also update Clerk**:
- Go to Instances/Settings
- Add allowed origin: `https://collabbboard-mvp.vercel.app`
  (You'll get actual domain after creating Vercel project)

### B. Liveblocks Public Key

```
1. Go to https://liveblocks.io/dashboard
2. Copy public API key (pk_...)
3. Save: VITE_LIVEBLOCKS_PUBLIC_KEY
```

### C. Railway Backend URL

```
1. Go to https://railway.app
2. Select CollabBoard MVP project
3. Find Deployments → URL
4. Save: VITE_API_URL = https://your-railway-app.railway.app
```

---

## 2️⃣ Create Vercel Project (2 min)

```
1. Go to https://vercel.com
2. "New Project" → Select collabbboard-mvp repo
3. Configure:
   - Framework: Other
   - Build: cd client && npm install && npm run build
   - Output: client/dist
   - Root: (leave blank)
4. Deploy
```

**First build will fail** — this is OK! (Missing env vars)

---

## 3️⃣ Set Environment Variables (2 min)

In Vercel Dashboard → Your Project → Settings → Environment Variables:

```
Add three variables:

1. VITE_CLERK_PUBLISHABLE_KEY = pk_live_xxx...
2. VITE_LIVEBLOCKS_PUBLIC_KEY = pk_xxx...
3. VITE_API_URL = https://your-railway-app.railway.app
```

Then:
- Go to Deployments
- Click the failed build's "..." menu
- Select "Redeploy"

---

## 4️⃣ Test It Works (1 min)

```
1. Wait for build to complete (green checkmark)
2. Visit: https://collabbboard-mvp.vercel.app
3. Should see Clerk login page
4. Sign up/in → Create board → Test features
```

✅ **Done!** Your app is now live with authenticated users.

---

## Troubleshooting

**Build fails?**
→ Click deployment → view logs → check errors

**Can't login?**
→ Verify Vercel domain is in Clerk's allowed origins

**Can't reach API?**
→ Check VITE_API_URL is correct Railway domain

**Real-time features broken?**
→ Check VITE_LIVEBLOCKS_PUBLIC_KEY is set

---

## What You've Built

```
🌐 Browser
    ↓
🔐 Vercel Frontend (your app)
    ↓ (REST API calls)
🚀 Railway Backend
    ↓
🔄 Liveblocks Real-time sync
    ↓ (presence, cursors, storage)
🌐 Browser (another user)
```

Every time a user opens the app:
- ✅ Clerk authenticates them (Vercel domain)
- ✅ Frontend loads from Vercel
- ✅ Backend serves from Railway
- ✅ Real-time sync via Liveblocks
- ✅ Multiplayer features work!

---

## Reference

For detailed guide: See `VERCEL_DEPLOYMENT.md`
For full checklist: See `ENV_SETUP_CHECKLIST.md`
For environment vars: See `client/.env.example`

Happy deploying! 🚀

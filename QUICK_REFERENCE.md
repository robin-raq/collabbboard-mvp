# ⚡ Quick Reference Card

Keep this handy for quick lookups while deploying.

## 🎯 3-Step Deployment (Simplified)

```
STEP 1: Create Vercel Project (2 min)
├─ Go to vercel.com
├─ Click "Add New" → "Project"
├─ Select collabbboard-mvp repo
├─ Build: cd client && npm install && npm run build
├─ Output: client/dist
└─ Click Deploy

STEP 2: Add Environment Variables (2 min)
├─ Vercel Dashboard → Settings → Environment Variables
├─ VITE_CLERK_PUBLISHABLE_KEY = pk_live_xxx...
├─ VITE_LIVEBLOCKS_PUBLIC_KEY = pk_xxx...
├─ VITE_API_URL = https://your-railway-app.railway.app
└─ Save

STEP 3: Redeploy (1 min)
├─ Deployments → Click failed build
├─ Click "..." menu → "Redeploy"
├─ Wait for green checkmark
└─ Visit your domain and sign up!
```

## 🔑 Credentials to Gather

| Credential | Get From | Format | Into |
|---|---|---|---|
| **Clerk Key** | clerk.com/dashboard → API Keys | pk_live_xxx | VITE_CLERK_PUBLISHABLE_KEY |
| **Liveblocks Key** | liveblocks.io/dashboard | pk_xxx | VITE_LIVEBLOCKS_PUBLIC_KEY |
| **Railway URL** | railway.app → Project → Deployments | https://app.railway.app | VITE_API_URL |

## 📚 Documentation Quick Links

| Document | Time | When |
|---|---|---|
| **VERCEL_QUICK_START.md** | 5 min | Want to deploy ASAP |
| **VERCEL_DEPLOYMENT.md** | 20 min | Want step-by-step |
| **ENV_SETUP_CHECKLIST.md** | 10 min | Need to gather credentials |
| **PRODUCTION_CHECKLIST.md** | 15 min | Before going live |
| **DEPLOYMENT_ARCHITECTURE.md** | 15 min | Want to understand system |
| **DEPLOYMENT_FILES_GUIDE.md** | 5 min | Need navigation help |
| **DEPLOYMENT_SUMMARY.md** | 3 min | Quick overview |

## 🔧 Environment Variables

### Local Development (.env.local)
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxx...
VITE_API_URL=http://localhost:3001
```

### Vercel Production
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxx...
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxx...
VITE_API_URL=https://your-railway-app.railway.app
```

## ✅ Verification Checklist

```
Before Deploying:
☐ Vercel account created
☐ GitHub repo connected to Vercel
☐ All 3 credentials gathered
☐ Clerk domain updated with Vercel domain
☐ Railway backend verified running

After Deploying:
☐ Build succeeded (green checkmark)
☐ Can visit yourapp.vercel.app
☐ Redirects to Clerk login
☐ Can sign up with account
☐ Can create board
☐ Real-time sync works (test in 2 windows)
☐ User names show correctly
☐ Cursors sync in real-time
```

## 🚨 Common Issues & Fixes

| Issue | Cause | Fix |
|---|---|---|
| Build fails | Missing env vars | Add to Vercel Settings |
| Can't log in | Domain not in Clerk | Add to Clerk allowed origins |
| Backend unreachable | Wrong URL | Check VITE_API_URL spelling |
| Real-time not working | Wrong Liveblocks key | Verify key in Vercel |
| Build times out | Dependencies not cached | Clear Vercel cache, rebuild |

## 🌐 Key Domains

| Service | Domain | What |
|---|---|---|
| **Frontend** | collabbboard-mvp.vercel.app | Your app (Vercel) |
| **Backend** | your-app.railway.app | API server (Railway) |
| **Clerk** | accounts.clerk.com | Auth service |
| **Liveblocks** | liveblocks.io | Real-time sync |

## 📋 File Structure

```
collabbboard-mvp/
├── client/                    (React frontend)
│   ├── .env.example          (template - copy to .env.local)
│   ├── src/
│   └── package.json
├── server/                    (Express backend)
│   ├── .env.example          (template - for local dev)
│   ├── src/
│   └── package.json
├── shared/                    (TypeScript types)
├── Dockerfile                (for Docker/Railway)
├── vercel.json               (Vercel config - NO EDIT)
├── railway.json              (Railway config - NO EDIT)
├── VERCEL_QUICK_START.md     ← START HERE (5 min)
└── DEPLOYMENT_SUMMARY.md     (overview)
```

## 💾 Build & Test Commands

```bash
# Test build works
cd client && npm run build

# Run locally (dev)
cd server && npm run dev        # Terminal 1
cd client && npm run dev        # Terminal 2

# Run tests
cd client && npm test
cd server && npm test
```

## 🔗 Useful Links

- **Vercel**: https://vercel.com
- **Clerk**: https://clerk.com/docs
- **Liveblocks**: https://docs.liveblocks.io
- **Railway**: https://docs.railway.app
- **Your Repo**: https://github.com/YOUR_USERNAME/collabbboard-mvp

## 📱 Testing Script (After Deploy)

```
1. Open Window 1 (User A):
   ✓ Sign up with email
   ✓ Create board
   ✓ Create sticky note

2. Open Window 2 (User B, incognito):
   ✓ Sign up with different email
   ✓ Open same board
   ✓ See User A's sticky note instantly

3. Both Windows:
   ✓ Create shapes
   ✓ Move mouse (see cursors)
   ✓ See each other's names
   ✓ Verify no lag/conflicts
```

## 🎓 Learning Paths

**Path A: Quick (15 min total)**
1. VERCEL_QUICK_START.md
2. ENV_SETUP_CHECKLIST.md
3. Deploy!

**Path B: Thorough (45 min total)**
1. DEPLOYMENT_FILES_GUIDE.md
2. VERCEL_DEPLOYMENT.md
3. ENV_SETUP_CHECKLIST.md
4. PRODUCTION_CHECKLIST.md
5. Deploy!

**Path C: Expert (60+ min)**
1. DEPLOYMENT_ARCHITECTURE.md
2. VERCEL_DEPLOYMENT.md
3. All checklists
4. Deploy!

## 🆘 Quick Troubleshooting

**"Cannot find module" error?**
→ Check Vercel build log, install missing dependency

**"401 Unauthorized" on backend?**
→ Check Clerk is configured on server, token being sent

**"WebSocket connection failed"?**
→ Check browser console, verify backend URL correct

**"Clerk login not working"?**
→ Check:
  - Using pk_live_ key (not pk_test_)
  - Vercel domain in Clerk allowed origins
  - Correct domain spelling (case-sensitive)

**Need more help?**
→ See "Troubleshooting" section in VERCEL_DEPLOYMENT.md

## ⚡ Speed Stats

| Task | Time | Tool |
|---|---|---|
| Gather credentials | 10 min | ENV_SETUP_CHECKLIST.md |
| Create Vercel project | 2 min | vercel.com |
| Add env variables | 2 min | Vercel dashboard |
| First deploy | 5 min | automatic |
| Full setup | 30 min | all files |

## 📊 Success Indicators

✅ You're good when:
- Build shows green checkmark on Vercel
- You can visit the domain without 404
- Clerk login page appears
- You can sign up successfully
- You can create a board
- Create sticky note and see instant sync

✅ You're really good when:
- All from above +
- Second user sees your sticky note immediately
- User names show correctly
- Cursor movements sync
- No console errors
- Multiple users can collaborate

## 🎉 Final Checklist

```
Before telling users about your app:
☐ Tested with 2+ users simultaneously
☐ Created test boards
☐ Verified all features work
☐ Checked performance is good
☐ Read PRODUCTION_CHECKLIST.md
☐ Ran security check
☐ Set up monitoring (optional)
☐ Have backup plan if needed
☐ Ready to support users

THEN: Launch! 🚀
```

---

**Print this page or bookmark for reference while deploying!**

Good luck! 🎯

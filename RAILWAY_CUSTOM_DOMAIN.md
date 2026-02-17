# Railway Custom Domain Setup Guide

Deploy CollabBoard fully to Railway with a custom domain that Clerk accepts for production authentication.

## The Problem We're Solving

- ❌ `railway.app` domains not accepted by Clerk for `pk_live_` keys
- ❌ `vercel.app` domains not accepted by Clerk for `pk_live_` keys
- ✅ Custom domains ARE accepted by Clerk

**Solution**: Use a cheap custom domain ($2-5/year) pointed to Railway.

## Architecture

```
┌──────────────────────┐
│  Your Custom Domain  │
│  myapp.com           │
└──────────┬───────────┘
           │ (HTTPS)
           ↓
┌──────────────────────┐
│  Railway Backend     │
│  + Frontend (static) │
│  + Express API       │
│  + WebSocket server  │
└──────────┬───────────┘
           │
    ┌──────┼──────┐
    ↓      ↓      ↓
 Clerk  Liveblocks Data
```

## Step 1: Get a Custom Domain ($2-5)

### Buy from Budget Domain Registrars

**Namecheap** (Recommended - cheapest)
```
1. Go to namecheap.com
2. Search for a domain
3. Choose .com, .io, or .dev (~$3-5/year)
4. Add to cart, checkout
5. Get domain nameservers (usually ns1.namecheap.com, etc.)
```

**GoDaddy**
```
1. Go to godaddy.com
2. Search for domain
3. Similar process
4. Note: Slightly more expensive but good support
```

**Cloudflare Registrar**
```
1. Go to cloudflare.com
2. Search domain
3. Transfer or register
4. Very transparent pricing
```

### Cheapest Options
- `.com` new domain: $3-5/year
- `.io` new domain: $5-9/year
- `.dev` new domain: $12/year first year, $13/year renewal
- `.xyz` new domain: $1.99 first year (some registrars)

## Step 2: Configure Domain DNS (Point to Railway)

### Get Railway's DNS Information

1. Go to **https://railway.app**
2. Log in and select your CollabBoard project
3. Go to **Settings** → **Domain**
4. Click **+ Add Custom Domain**
5. Enter your domain (e.g., `myapp.com`)
6. Railway will show DNS records to add

**Railway will provide:**
```
CNAME: your-app.railway.app
Or
A Record: IP address (varies)
```

### Update Domain DNS Records

**In Namecheap** (example):
1. Log in to namecheap.com
2. Go to **Dashboard** → Your Domain
3. Click **Manage**
4. Go to **Advanced DNS**
5. Add CNAME record:
   - **Host**: `@` (or leave blank for root)
   - **Value**: `your-app.railway.app` (from Railway)
   - **TTL**: 3600
6. Save changes

**Wait 15-30 minutes** for DNS to propagate.

### Verify Domain Setup

```bash
# Check if domain points to Railway
nslookup myapp.com

# Should show Railway's IP or CNAME
```

## Step 3: Enable HTTPS on Railway

Once domain is configured:

1. Go to Railway **Settings** → **Domain**
2. Your custom domain should appear
3. Railway **automatically generates SSL certificate**
4. You should see "Connected" with HTTPS enabled

Your domain is now: `https://myapp.com` with SSL ✅

## Step 4: Update Clerk for Production

### Create New Clerk Application (Production)

1. Go to **https://dashboard.clerk.com**
2. Click **+ Add Application**
3. Name: "CollabBoard - Production"
4. Choose authentication methods (Email, Google, GitHub, etc.)
5. Click **Create**

### Configure Clerk Application Domain

1. In Clerk dashboard, go to **Instances** or **Settings**
2. Find **Allowed Origins** or **Domains** section
3. Add your custom domain: `https://myapp.com`
4. Save changes

### Get Production Clerk Keys

1. In Clerk dashboard, go to **API Keys**
2. Copy **Publishable Key** (starts with `pk_live_`)
3. **Save securely** - this is your production key

## Step 5: Update Railway Environment Variables

Your app is already running on Railway. Just update the environment variables:

### In Railway Dashboard:

1. Select your CollabBoard project
2. Go to **Variables** section
3. Update these environment variables:

```env
# Keep these the same:
NODE_ENV=production
PORT=3001

# Add if not present:
VITE_API_URL=https://myapp.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxxxxxxxxxxxx
```

**Save changes** - Railway will automatically restart your app with new variables.

## Step 6: Test Your Deployment

### 1. Visit Your Domain
```
Open: https://myapp.com
```

You should see:
- ✅ HTTPS (padlock icon)
- ✅ No SSL errors
- ✅ App loads
- ✅ Clerk login page

### 2. Test Authentication
```
1. Click Sign Up
2. Sign up with email or OAuth
3. Should redirect to dashboard
4. Should show authenticated user
```

### 3. Test Multiplayer
```
1. Create a board
2. Open in another browser/incognito window
3. Sign in as different user
4. Both users should see:
   ✓ Same board
   ✓ Real-time sync
   ✓ Each other's cursors
   ✓ User names in presence
```

### 4. Check Console for Errors
```
Open DevTools (F12)
Console tab should be clear (no red errors)
Network tab should show:
  ✓ API calls succeeding
  ✓ WebSocket connected
```

## Complete Environment Variables Reference

### What Railway Serves

Railway now serves BOTH frontend and backend:

```
https://myapp.com/           ← React app (built from client/dist)
https://myapp.com/api/       ← Express API
https://myapp.com/ws         ← WebSocket
https://myapp.com/health     ← Health check
```

### Environment Variables to Set

**In Railway Dashboard → Variables:**

```env
NODE_ENV=production
PORT=3001
VITE_API_URL=https://myapp.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxx
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_xxxxxxxxxxxxxxxxxx
```

## Troubleshooting

### Domain Not Working
**Check:**
1. DNS records are correct (nslookup myapp.com)
2. Railway shows domain as connected
3. Wait 30+ minutes for DNS propagation
4. Clear browser cache (Ctrl+Shift+Del)

### SSL Certificate Error
**Check:**
1. Railway has auto-generated certificate
2. Try visiting domain after 5 minutes
3. Check Railway settings for certificate status

### Clerk Login Not Working
**Check:**
1. Domain is in Clerk's allowed origins (exactly: `https://myapp.com`)
2. Using `pk_live_` key (not `pk_test_`)
3. Domain spelling is exact match
4. Environment variable is set in Railway

### API Calls Failing
**Check:**
1. `VITE_API_URL` matches your domain exactly
2. Railway backend is running (check deployments)
3. Check Railway logs for errors
4. Verify Liveblocks key is correct

### WebSocket Connection Failed
**Check:**
1. Domain is correct
2. Railway backend running
3. Browser console for error messages
4. Network tab to see WebSocket handshake

## Cost Breakdown

| Item | Cost | Duration |
|---|---|---|
| Domain (.com) | $3-5 | 1 year |
| Railway Free Tier | $0 | Unlimited |
| Clerk Free Tier | $0 | Unlimited |
| Liveblocks Free Tier | $0 | Up to 10 documents |
| **Total** | **$3-5** | **1 year** |

## What You Now Have

✅ Public domain with HTTPS
✅ Clerk production authentication (`pk_live_` keys)
✅ Real-time collaboration (Liveblocks)
✅ Multiplayer awareness (cursors, names)
✅ Everything on one service (Railway) = simpler
✅ Production-ready app
✅ 99.9% uptime SLA
✅ Easy deployment (git push)

## Next Steps

1. **Buy domain** (5 minutes)
2. **Point to Railway** (5 minutes, ~30 min DNS propagation)
3. **Update Clerk** (5 minutes)
4. **Update Railway variables** (2 minutes)
5. **Test** (10 minutes)
6. **Launch!** 🎉

## Summary

Your complete production setup:
```
myapp.com → Railway → Clerk Auth + Liveblocks Sync
↓
Authenticated multiplayer app
```

**Total cost**: $3-5/year for domain
**Total time**: ~1 hour (plus 30 min DNS wait)
**Result**: Production-ready authenticated app! ✅

## References

- **Railway Docs**: https://docs.railway.app/deploy/config
- **Clerk Docs**: https://clerk.com/docs/deployments/overview
- **Liveblocks Docs**: https://docs.liveblocks.io/rooms/collaborative
- **Namecheap**: https://www.namecheap.com

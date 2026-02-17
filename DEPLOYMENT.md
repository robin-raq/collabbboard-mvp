# CollabBoard MVP Deployment Guide

This guide explains how to deploy CollabBoard MVP to Railway, a modern cloud platform with automatic deployments from GitHub.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Create Railway Account](#create-railway-account)
3. [Connect GitHub Repository](#connect-github-repository)
4. [Deploy to Railway](#deploy-to-railway)
5. [Configure Environment Variables](#configure-environment-variables)
6. [Set Up Custom Domain](#set-up-custom-domain)
7. [Monitor Your Deployment](#monitor-your-deployment)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before deploying, you need:

- [ ] GitHub account with CollabBoard repository
- [ ] Railway account (free at https://railway.app)
- [ ] Clerk API keys (see SETUP_CLERK.md)
- [ ] Liveblocks API keys (https://liveblocks.io)
- [ ] Anthropic API key (optional, for AI features)

## Create Railway Account

1. Visit [Railway.app](https://railway.app)
2. Click **Sign Up** in the top right
3. Choose **Sign up with GitHub** (recommended)
4. Authorize Railway to access your GitHub account
5. Complete onboarding and you're ready to deploy

## Connect GitHub Repository

1. Go to Railway dashboard (https://railway.app/dashboard)
2. Click **+ New Project**
3. Select **Deploy from GitHub repo**
4. Click **Connect with GitHub**
5. Authorize Railway to access your repositories
6. Search for `collabbboard-mvp`
7. Click to select the repository
8. Railway will automatically detect the Dockerfile
9. Click **Deploy Now**

The initial deployment will start building from your Dockerfile. This takes 2-5 minutes.

## Deploy to Railway

### Automatic Deployments (Recommended)

By default, Railway auto-deploys on every push to `main`:

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main

# Railway automatically builds and deploys within 1-2 minutes
```

Watch deployment progress:
1. Go to Railway dashboard
2. Click your CollabBoard project
3. Click the **Deployments** tab
4. Watch the build progress in real-time

### Manual Deployments

If you need to redeploy without pushing code:

1. Go to your project in Railway
2. Click the **Deployments** tab
3. Click the three dots (⋯) next to a previous deployment
4. Click **Redeploy**

## Configure Environment Variables

### In Railway Dashboard

1. Go to your CollabBoard project
2. Click the **Variables** tab
3. Add the following variables:

```env
NODE_ENV=production
PORT=3001
VITE_API_URL=https://your-app-domain.railway.app
CLERK_SECRET_KEY=sk_prod_YOUR_KEY
VITE_CLERK_PUBLISHABLE_KEY=pk_prod_YOUR_KEY
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_prod_YOUR_KEY
ANTHROPIC_API_KEY=sk_ant_YOUR_KEY (optional)
```

### Getting Production Keys

**Clerk Production Keys:**
1. Go to Clerk dashboard (https://dashboard.clerk.com)
2. Click your application
3. Go to **Instances & domains**
4. Switch from "Development" to "Production"
5. Go to **API Keys**
6. Copy `pk_prod_...` and `sk_prod_...` keys
7. Add to Railway Variables

**Liveblocks Production Keys:**
1. Go to Liveblocks dashboard (https://liveblocks.io/dashboard)
2. If needed, create a production API key
3. Copy the public key starting with `pk_prod_`
4. Add to Railway Variables

**Anthropic Production Key:**
1. Go to Anthropic console (https://console.anthropic.com)
2. Get your production API key
3. Add to Railway Variables (optional)

### Important Notes

- Railway shows variables in plaintext in the dashboard, but they're encrypted at rest
- Variables are only visible to project members
- Never commit `.env` files to git
- Use production keys for Railway (not test keys)

## Set Up Custom Domain

### Option 1: Railway Provided Domain

Every Railway project gets a free domain:
- Format: `your-app-name.railway.app`
- Automatically assigned with HTTPS
- No configuration needed

### Option 2: Custom Domain

To use your own domain (e.g., `collabboard.com`):

1. **Update Domain:**
   - Go to Railway project settings
   - Click **Domains**
   - Click **+ Add Domain**
   - Enter your domain name
   - Click **Add**

2. **Update DNS Records:**
   - Go to your domain registrar (GoDaddy, Namecheap, etc.)
   - Add a CNAME record pointing to Railway's domain:
     ```
     Type: CNAME
     Name: collabboard (or subdomain)
     Value: (provided by Railway)
     ```
   - Wait for DNS to propagate (5-30 minutes)

3. **Verify in Railway:**
   - Railway will automatically verify your domain
   - HTTPS certificate is auto-generated (no additional setup needed)

4. **Update Clerk:**
   - Go to Clerk dashboard
   - Add your custom domain to "Allowed domains"
   - This allows Clerk to authenticate users from your domain

## Monitor Your Deployment

### Check Status

1. Go to Railway dashboard
2. Select your CollabBoard project
3. Status indicators show:
   - **Green**: Running and healthy
   - **Yellow**: Starting up
   - **Red**: Failed (check logs)

### View Logs

```bash
# Using Railway CLI
railway login
railway projects
railway logs

# Or in dashboard:
# Click project → View logs
```

### Performance Monitoring

Railway provides built-in monitoring:
1. Click your project
2. Go to **Metrics** tab
3. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Health Checks

The app includes automatic health checks:
- Endpoint: `GET /health`
- Runs every 10 seconds
- If it fails 3+ times, Railway assumes app is down
- Automatic restart is triggered

## Application URLs

After deployment, access your app:

**Default Railroad URL:**
```
https://collabboard-mvp-production.railway.app
```

**With Custom Domain:**
```
https://your-custom-domain.com
```

## Update Clerk Settings for Production

After deploying with custom domain:

1. Go to Clerk dashboard
2. Click your application
3. Go to **Instances & domains**
4. Click **Add domain** under Production
5. Add your Railway domain/custom domain
6. Clerk will provide DNS records if needed
7. Wait for verification

## Rollback to Previous Version

If deployment has issues:

1. Go to Railway dashboard
2. Click **Deployments** tab
3. Find the previous working deployment
4. Click the three dots (⋯)
5. Click **Redeploy**
6. Railway rolls back to that version

## Update Application Code

Deploying updates is simple:

```bash
# Make your changes locally
nano client/src/pages/HomePage.tsx

# Commit and push
git add .
git commit -m "Add new feature"
git push origin main

# Railway automatically builds and deploys within 1-2 minutes
# Check deployment progress in Railway dashboard
```

## Database (Optional)

If you need persistent storage:

1. Go to Railway dashboard
2. Click your project
3. Click **+ Add Service**
4. Select **PostgreSQL**
5. Add these variables:
   ```
   DATABASE_URL=<auto-generated by Railway>
   ```
6. Update your app code to use DATABASE_URL

## Cost Considerations

Railway's free tier includes:
- 5GB of resource credits per month (enough for small apps)
- After free tier: $5 per 100GB of resources/month
- Custom domains: Free
- SSL certificates: Free

Monitor your usage in Railway dashboard:
1. Click your account name
2. Go to **Account → Usage**
3. See current month's resource consumption

## Troubleshooting

### Build Fails

**Problem:** Build stops with error

**Solution:**
1. Check **Build Logs** in Railway
2. Common issues:
   - Missing environment variables
   - TypeScript compilation errors
   - Missing dependencies
3. Fix locally, commit, and push to re-trigger build

### App Crashes on Startup

**Problem:** Build succeeds but app won't start

**Solution:**
1. Check **Runtime Logs** in Railway
2. Look for errors from `server/dist/index.js`
3. Check if all required environment variables are set
4. Verify Clerk and Liveblocks keys are correct

### Can't Access App

**Problem:** Domain shows "Connection refused"

**Solution:**
1. Check if app is running (green indicator in Railway)
2. Try the default Railway URL: `https://your-project.railway.app`
3. If that works, DNS issue with custom domain:
   - Verify CNAME record is correct
   - Wait for DNS propagation (can take 30 minutes)
   - Use `nslookup` to check: `nslookup your-domain.com`

### Authentication Not Working

**Problem:** Users see Clerk login loop or auth errors

**Solution:**
1. Verify `VITE_CLERK_PUBLISHABLE_KEY` is set to **production** key
2. Verify `CLERK_SECRET_KEY` is set to **production** key
3. In Clerk dashboard, add your domain to allowed domains:
   - Go to Instances & domains → Production
   - Click Add domain
   - Add your Railway domain or custom domain

### Users Can't See Each Other

**Problem:** Real-time sync not working

**Solution:**
1. Check `VITE_LIVEBLOCKS_PUBLIC_KEY` is production key
2. Verify Liveblocks API key is correct
3. Check browser console for errors (F12)
4. Verify all users can connect at same time

### Slow Performance

**Problem:** App loads slowly or feels sluggish

**Solution:**
1. Check Railway metrics (CPU/memory usage)
2. If high usage, upgrade Railway plan
3. Check network tab in browser DevTools (F12)
4. Verify API responses are fast

## Getting Help

- **Railway Support:** https://docs.railway.app
- **Railway Discord:** https://discord.gg/railway
- **Clerk Support:** https://support.clerk.com
- **Liveblocks Docs:** https://docs.liveblocks.io

## Next Steps

1. ✅ Deploy to Railway
2. ✅ Configure environment variables
3. ✅ Set up custom domain (optional)
4. Share your app URL with collaborators
5. Monitor logs and metrics
6. Make improvements based on user feedback

Congratulations! Your CollabBoard MVP is now live! 🚀

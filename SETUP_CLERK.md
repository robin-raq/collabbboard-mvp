# Clerk Authentication Setup Guide

CollabBoard MVP uses Clerk for user authentication. This guide will help you set up Clerk and integrate it with the application.

## Table of Contents
1. [Create a Clerk Account](#create-a-clerk-account)
2. [Create an Application](#create-an-application)
3. [Get Your API Keys](#get-your-api-keys)
4. [Configure Environment Variables](#configure-environment-variables)
5. [Set Up OAuth/Email Providers](#set-up-oauthemail-providers)
6. [Test Your Setup](#test-your-setup)
7. [Troubleshooting](#troubleshooting)

## Create a Clerk Account

1. Visit [clerk.com](https://clerk.com)
2. Click **Sign Up** in the top right
3. Enter your email and password
4. Verify your email address
5. You'll be redirected to the Clerk dashboard

## Create an Application

1. In the Clerk dashboard, click **Create Application**
2. Choose your authentication methods:
   - ✅ **Email** (recommended for initial testing)
   - ✅ **Google OAuth** (optional, for Google sign-in)
   - ✅ **GitHub OAuth** (optional, for GitHub sign-in)
3. Click **Create Application**
4. Wait for the application to be created (usually a few seconds)

## Get Your API Keys

### Frontend Publishable Key (VITE_CLERK_PUBLISHABLE_KEY)

1. In the Clerk dashboard, go to **API Keys** (left sidebar)
2. Look for **Publishable Key** under "API Key"
3. Click the copy icon to copy the key
4. It will look like: `pk_test_XXXXXXXXXXXXXXXXXXXXXX`
5. Save this for later

### Backend Secret Key (CLERK_SECRET_KEY)

1. In the Clerk dashboard, go to **API Keys** (left sidebar)
2. Look for **Secret Key** under "API Key"
3. Click the copy icon to copy the key
   - ⚠️ **Important**: This key is sensitive! Never commit it to git or share it publicly
4. It will look like: `sk_test_XXXXXXXXXXXXXXXXXXXXXX`
5. Save this for later

## Configure Environment Variables

### Frontend (.env.local)

Add to `/client/.env.local`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
VITE_API_URL=http://localhost:3001
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_YOUR_LIVEBLOCKS_KEY
```

### Backend (.env.local)

Add to `/server/.env.local`:

```env
CLERK_SECRET_KEY=sk_test_YOUR_KEY_HERE
PORT=3001
VITE_LIVEBLOCKS_PUBLIC_KEY=pk_dev_YOUR_LIVEBLOCKS_KEY
ANTHROPIC_API_KEY=sk_YOUR_ANTHROPIC_KEY_IF_AVAILABLE
```

## Set Up OAuth/Email Providers

### Email Provider (Default)

Email authentication is enabled by default. Users can:
- Sign up with email and password
- Or continue without password (email link authentication)

### Google OAuth (Optional)

To enable Google sign-in:

1. In Clerk dashboard, go to **Social Connections** (left sidebar)
2. Find **Google** and click **Add Google OAuth**
3. Clerk will provide Google Client ID and Secret
4. Follow the prompts to connect your Google OAuth credentials
5. Click **Save** and **Activate**

### GitHub OAuth (Optional)

To enable GitHub sign-in:

1. In Clerk dashboard, go to **Social Connections**
2. Find **GitHub** and click **Add GitHub OAuth**
3. Clerk will provide GitHub App Client ID and Secret
4. Follow the prompts to connect your GitHub OAuth credentials
5. Click **Save** and **Activate**

## Test Your Setup

### Check Environment Variables

```bash
# From the root directory
cat client/.env.local | grep CLERK
cat server/.env.local | grep CLERK
```

You should see:
- `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...` (frontend)
- `CLERK_SECRET_KEY=sk_test_...` (backend)

### Start Development Servers

```bash
# Terminal 1: Start backend
cd server
npm install
npm run dev

# Terminal 2: Start frontend
cd client
npm install
npm run dev
```

### Test Authentication Flow

1. Open http://localhost:5173 in your browser
2. You should be redirected to a Clerk login page
3. Try signing up with:
   - Email only (if email link enabled)
   - Email + password
   - Google (if configured)
   - GitHub (if configured)
4. After authentication, you should see the CollabBoard dashboard
5. Create a board and verify your name appears in the presence bar

### Test Multiplayer

1. Open http://localhost:5173 in two different browsers
2. Sign in with different email addresses
3. Create/open the same board in both browsers
4. Verify both user names appear in the presence bar (top right)
5. Move cursor and verify both users see each other's cursors

## Troubleshooting

### "Missing VITE_CLERK_PUBLISHABLE_KEY" Error

**Problem**: Page shows error about missing Clerk publishable key

**Solution**:
1. Check `.env.local` file in `/client` directory
2. Verify `VITE_CLERK_PUBLISHABLE_KEY=pk_test_...` is present
3. Make sure it's not empty
4. Restart dev server after updating .env

### "Missing CLERK_SECRET_KEY" Error (Backend)

**Problem**: Backend returns 401 Unauthorized for all API requests

**Solution**:
1. Check `.env.local` file in `/server` directory
2. Verify `CLERK_SECRET_KEY=sk_test_...` is present
3. Make sure it's not empty
4. Restart backend server after updating .env

### Keys Show as "pk_live_" or "sk_live_"

**Problem**: You have production keys instead of test keys

**Explanation**:
- `pk_test_` and `sk_test_` are test/development keys (safe for local dev)
- `pk_live_` and `sk_live_` are production keys (should never be in .env.local)

**Solution**:
1. Get test keys from Clerk dashboard
2. Make sure you're in "Development" environment setting
3. Use only test keys locally

### Authentication Page Shows Blank

**Problem**: Clerk login component doesn't render

**Troubleshooting**:
1. Open browser DevTools (F12)
2. Check Console tab for errors
3. Check if `VITE_CLERK_PUBLISHABLE_KEY` is correctly set
4. Verify Clerk domain is correct
5. Clear browser cache and reload

### "Sign up is disabled" Error

**Problem**: Users get error when trying to sign up

**Solution**:
1. Go to Clerk dashboard
2. Go to **Authentication** → **Sign up options**
3. Make sure "Allowed sign-up identifiers" includes email
4. Check that "Sign-up enabled" is toggled ON

### Users Can't Sign In After Sign Up

**Problem**: Sign up works but sign-in fails with invalid credentials

**Solution**:
1. Verify email authentication is enabled in Clerk dashboard
2. Check that user actually confirmed their email (if email verification required)
3. Try resetting user in Clerk dashboard
4. Clear browser cookies and try again

## Next Steps

Once Clerk is set up and working:

1. **Local Testing**: Open two browser windows and sign in as different users
2. **Invite Others**: Share `http://localhost:5173` with someone on your local network
   - Get your machine's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - They can access: `http://YOUR_IP:5173`
3. **Production Deployment**: When ready to deploy, get production Clerk keys
   - Update environment variables in your deployment platform
   - Update allowed domains in Clerk dashboard

## Security Reminders

- ✅ **ALWAYS** use test keys locally (pk_test_, sk_test_)
- ✅ **NEVER** commit `.env.local` to git (it's in `.gitignore`)
- ✅ **NEVER** share secret keys (sk_*) with anyone
- ✅ Use environment variables for all sensitive data
- ✅ Create separate Clerk applications for dev/staging/production

## Getting Help

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Support](https://support.clerk.com)
- [Clerk Community Discord](https://discord.gg/b5soQXSq)

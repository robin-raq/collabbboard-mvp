# Production Deployment Checklist

Use this checklist to ensure CollabBoard MVP is production-ready before going live.

## Phase 1: Code Verification ✅

- [ ] All code committed to GitHub `main` branch
- [ ] No console errors in development build
- [ ] No API keys or secrets in codebase
- [ ] Environment variables use `.env.example` templates
- [ ] Build succeeds locally: `cd client && npm run build`
- [ ] No TypeScript compilation errors
- [ ] All required environment variables documented

## Phase 2: Clerk Setup ✅

### Development Keys
- [ ] Created Clerk application for local development
- [ ] Have `pk_test_*` publishable key
- [ ] `.env.local` has development key set

### Production Keys
- [ ] Created separate Clerk application for production
- [ ] Have `pk_live_*` publishable key for Vercel domain
- [ ] Have `sk_live_*` secret key for backend (if needed)
- [ ] Configured Vercel domain in Clerk allowed origins
- [ ] Tested Clerk login flow in production

## Phase 3: Liveblocks Setup ✅

- [ ] Created Liveblocks project
- [ ] Have public API key (`pk_*`)
- [ ] API key works in production
- [ ] Real-time sync tested with multiple users

## Phase 4: Railway Backend ✅

- [ ] Backend deployed and running on Railway
- [ ] Backend is publicly accessible with HTTPS
- [ ] Health check endpoint working: `https://your-railway-url/health`
- [ ] All database connections configured
- [ ] Liveblocks integration working on backend
- [ ] CORS properly configured for Vercel domain
- [ ] Backend logs show no errors

## Phase 5: Vercel Frontend ✅

- [ ] Vercel project created and linked to GitHub
- [ ] All environment variables set in Vercel Settings:
  - [ ] `VITE_CLERK_PUBLISHABLE_KEY` (pk_live_*)
  - [ ] `VITE_LIVEBLOCKS_PUBLIC_KEY` (pk_*)
  - [ ] `VITE_API_URL` (Railway app URL)
- [ ] Build succeeds on Vercel
- [ ] Site is accessible at vercel domain
- [ ] No 404 errors on page load

## Phase 6: Feature Testing ✅

### Authentication
- [ ] Users must log in to access boards
- [ ] Clerk login flow works
- [ ] Logout works correctly
- [ ] Session persists after page reload

### Boards & Persistence
- [ ] Can create new boards
- [ ] Boards list shows all created boards
- [ ] Can open and view boards
- [ ] Board data persists after refresh

### Collaboration Features
- [ ] Can create sticky notes
- [ ] Can create shapes
- [ ] Can edit text in sticky notes
- [ ] Objects sync in real-time to other users
- [ ] No race conditions or conflicts

### Multiplayer Awareness
- [ ] User presence shows in presence bar
- [ ] Multiple users show with different colors/avatars
- [ ] User names display correctly from Clerk
- [ ] Presence updates when users join/leave
- [ ] User cursors visible to others
- [ ] Cursor positions sync in real-time
- [ ] "You" label shows for current user's cursor

### Performance
- [ ] Page loads in under 3 seconds
- [ ] No lag when creating objects
- [ ] Smooth cursor tracking
- [ ] No memory leaks (check DevTools)
- [ ] Real-time sync latency is acceptable

## Phase 7: Error Handling ✅

- [ ] Network errors gracefully handled
- [ ] Clerk errors properly displayed
- [ ] Backend connection loss shows error message
- [ ] Liveblocks sync failures don't crash app
- [ ] Can retry operations after errors
- [ ] Error messages are user-friendly

## Phase 8: Security ✅

- [ ] No hardcoded secrets in code
- [ ] API calls use HTTPS
- [ ] Clerk authentication enforced on all routes
- [ ] CORS headers properly configured
- [ ] Liveblocks security rules set up (if applicable)
- [ ] No sensitive data in localStorage
- [ ] Authentication tokens handled securely

## Phase 9: Monitoring & Logs ✅

- [ ] Can view Vercel deployment logs
- [ ] Can view Railway backend logs
- [ ] Liveblocks dashboard accessible
- [ ] Clerk dashboard accessible
- [ ] No critical errors in production logs
- [ ] Error tracking set up (optional)

## Phase 10: Documentation ✅

- [ ] README updated with deployment info
- [ ] Environment variables documented
- [ ] Setup instructions clear for team members
- [ ] Troubleshooting guide created
- [ ] Architecture documentation complete

---

## Pre-Launch Testing Script

Run through this sequence to verify everything:

```
1. Open Browser Incognito Window #1
   → Go to https://your-vercel-domain.vercel.app
   → Should redirect to Clerk login
   → Sign up as User A
   → Create board named "Test Board"
   → Create sticky note with text "User A's note"

2. Open Browser Incognito Window #2 (Different Identity)
   → Go to https://your-vercel-domain.vercel.app
   → Sign up as User B
   → Open "Test Board"
   → Should see User A's sticky note
   → Create sticky note "User B's note"
   → Should see it appear instantly

3. Back in Window #1
   → Should see User B's note appear
   → Should see User B's cursor when they move mouse
   → Should see "User B" name in presence bar

4. Both windows
   → Create shapes, edit text, move objects
   → Verify all changes sync in real-time
   → Verify no lag or conflicts

5. Browser DevTools (Both windows)
   → Open Console
   → Should be no errors
   → Check Network tab for failed requests
   → Check WebSocket connections to Liveblocks

6. Close one window and reopen
   → Verify board state persists
   → Verify you can still sign in
   → Verify other user still appears online
```

✅ **If all steps pass, you're production-ready!**

---

## Post-Launch Monitoring

**First Week:**
- [ ] Monitor error logs daily
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Fix any critical bugs immediately

**Ongoing:**
- [ ] Weekly log review
- [ ] Performance trend analysis
- [ ] User feedback integration
- [ ] Security updates applied
- [ ] Feature improvements planned

---

## Rollback Plan

If critical issues occur:

1. **Vercel rollback**:
   - Go to Deployments tab
   - Select previous stable deployment
   - Click "Promote to Production"

2. **Notify users**:
   - Explain issue and timeline for fix
   - Provide workaround if possible

3. **Investigate**:
   - Check logs for errors
   - Review recent changes
   - Fix issue locally first

4. **Redeploy**:
   - Fix code locally
   - Push to GitHub
   - Vercel auto-deploys
   - Monitor deployment

---

## Success Criteria

✅ App is live and accessible
✅ Users can authenticate with Clerk
✅ Real-time collaboration works
✅ No critical errors in logs
✅ Performance is acceptable
✅ Users report positive experience

---

## Support Resources

- **Vercel Status**: https://vercel.com/status
- **Clerk Status**: https://status.clerk.com
- **Liveblocks Status**: https://status.liveblocks.io
- **Railway Status**: https://railway.app/status

---

## Sign-Off

- [ ] QA/Testing: All tests passed
- [ ] Code Review: Code reviewed and approved
- [ ] Product: Feature complete and working
- [ ] Ready for Production: Yes ✅

**Date**: ____________
**Tested By**: ____________
**Approved By**: ____________

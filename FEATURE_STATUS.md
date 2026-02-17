# CollabBoard MVP - Feature Status Checklist

## Core Features

### ✅ Single User Features
- [x] Create sticky notes
- [x] Edit sticky note text (double-click to edit, modal appears, can type)
- [x] Delete sticky notes (select + Delete key)
- [x] Pan canvas (scroll to move around)
- [x] Zoom canvas (Ctrl+Scroll to zoom in/out)
- [x] Select sticky notes (click to select)
- [x] Deselect (click empty area)
- [x] Sticky note visual feedback (blue border when selected)

### ❓ Real-time Sync Between 2+ Users
- [ ] User A creates sticky note → User B sees it instantly
- [ ] User A edits sticky note → User B sees text update
- [ ] User A deletes sticky note → User B sees it disappear
- [ ] Changes persist and sync in real-time

### ❓ Multiplayer Cursors with Name Labels
- [ ] User B sees User A's cursor moving
- [ ] Cursor has a label showing User A's name
- [ ] Presence bar shows both users' names
- [ ] Real-time cursor movement visible

### ❓ Deployed and Publicly Accessible
- [ ] App deployed to Railway
- [ ] Publicly accessible URL (not localhost)
- [ ] Multiple users can access same URL
- [ ] Features work on deployed version

---

## Testing Plan

### Test 1: Real-time Sync Between 2 Users
1. **Setup**: Open 2 browser windows (or tabs)
2. **Window 1**: Sign in with user A, create a sticky note with text "User A Note"
3. **Window 2**: Sign in with user B, open same board
4. **Check**: Can user B see the sticky note created by user A?
   - [ ] YES - Real-time sync is working ✅
   - [ ] NO - Real-time sync is NOT working ❌

5. **Window 2**: User B creates a sticky note "User B Note"
6. **Check**: Can user A see it in Window 1?
   - [ ] YES - Real-time sync is working ✅
   - [ ] NO - Real-time sync is NOT working ❌

7. **Window 2**: User B double-clicks their note and changes text to "Updated by B"
8. **Check**: Does user A see the update in Window 1?
   - [ ] YES - Real-time sync is working ✅
   - [ ] NO - Real-time sync is NOT working ❌

### Test 2: Multiplayer Cursors
1. **Setup**: Both windows on same board
2. **Window 1**: Move cursor around on the board
3. **Check**: Does cursor appear in Window 2?
   - [ ] YES - Cursor sync is working ✅
   - [ ] NO - Cursor sync is NOT working ❌

4. **Check**: Does the cursor have a label showing "User A"?
   - [ ] YES - Cursor labels working ✅
   - [ ] NO - Cursor labels NOT working ❌

5. **Check**: Does Presence Bar (top right) show both user names?
   - [ ] YES - Presence display working ✅
   - [ ] NO - Presence display NOT working ❌

### Test 3: Deployment
1. Do you have Railway deployed?
   - [ ] YES - Proceed to Test 3.2
   - [ ] NO - See DEPLOYMENT.md to deploy

2. Is it publicly accessible?
   - [ ] YES - Can access from https://your-app.railway.app
   - [ ] NO - Check Railway logs for errors

3. Do features work on deployed version?
   - [ ] YES - All working in production ✅
   - [ ] NO - Deployed version has issues ❌

---

## Quick Check (5 minutes)

**Run this now to test:**

```bash
# Terminal 1
npm --prefix client run dev

# Terminal 2
npm --prefix server run dev
```

**Then in browser:**

1. Open http://localhost:5173
2. Sign in with User A
3. Create sticky note "TEST"
4. Open new browser window/tab (incognito)
5. Go to http://localhost:5173
6. Sign in with User B
7. Look for the "TEST" note from User A
   - See it? → Real-time sync is working ✅
   - Don't see it? → Real-time sync is broken ❌

---

## Debugging Steps

### If Real-time Sync NOT Working

**Check 1: Liveblocks Connected?**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for any red errors about Liveblocks
4. If errors, check:
   - Is `VITE_LIVEBLOCKS_PUBLIC_KEY` set correctly?
   - Is server `.env.local` updated?
   - Restart dev servers

**Check 2: Same Room?**
1. Both users on same board URL?
2. If URL different, they're in different "rooms" (won't sync)
3. Copy exact URL from one window to the other

**Check 3: Signed In?**
1. Both users properly signed in with Clerk?
2. If one user not signed in, they see different data
3. Check if Clerk login page appeared for both

### If Cursors NOT Working

**Same checks as above** - if Liveblocks not connected, cursors won't work either.

---

## Known Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Can't edit sticky notes | Textarea not appearing | Restart dev server, check console for errors |
| Changes not syncing | Liveblocks not connected | Check API keys in .env.local |
| Can't see other user | Different "room"/board | Use exact same URL in both windows |
| Not signed in | Clerk issue | Check SETUP_CLERK.md |

---

## What to Report

When testing, please tell me:

1. **Real-time Sync:**
   - Can User B see User A's sticky note? YES / NO
   - Can User A see User B's sticky note? YES / NO
   - Do edits appear in real-time? YES / NO

2. **Multiplayer Cursors:**
   - Can you see other user's cursor? YES / NO
   - Does it show their name? YES / NO
   - Is Presence Bar showing both users? YES / NO

3. **Deployment:**
   - Have you deployed to Railway? YES / NO
   - If yes, is it publicly accessible? YES / NO

4. **Any Errors:**
   - Browser console errors? (Screenshot or text)
   - Server errors? (Copy from terminal)

---

## Summary

This checklist helps identify exactly which features are working and which need fixes. Follow the testing plan and let me know the results!

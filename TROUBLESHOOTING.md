# CollabBoard Troubleshooting Guide

## Issue: Shapes and Stickies Not Appearing

### Symptoms
- ✓ You can log in with Clerk
- ✗ Clicking on canvas to create shapes/stickies does nothing
- ✗ No visual feedback when trying to add objects
- ✗ Console shows no errors

### Root Cause Analysis

The issue is likely related to **Liveblocks storage not being initialized or connected**. Here's how to diagnose:

#### Step 1: Check Browser Console

1. Go to https://raqdrobinson.com
2. Open Developer Console (F12 → Console tab)
3. Look for these logs:

```
Liveblocks storage objects: { ... }
createObjectMutation - objects before: { ... }
createObjectMutation - creating object: { ... }
```

**If you see these logs**: The mutation is being called! The issue is likely rendering.

**If you DON'T see these logs**: The mutation isn't being called. The problem is in the click handler or tool selection.

#### Step 2: Check Liveblocks Connection

In the console, run:
```javascript
// Check if Liveblocks is connected
console.log(window.__LIVEBLOCKS__)
```

You should see Liveblocks connection info. If undefined, Liveblocks didn't initialize.

### Common Fixes

#### Fix 1: Verify RoomProvider is Working

The `BoardPageWrapper` component wraps the board in a `RoomProvider`. This must be present for Liveblocks to work.

**Check**: Does your URL look like `/board/[something]`? The board ID is critical.

#### Fix 2: Check Active Tool Selection

Shapes only create if the active tool is NOT "select".

**Test**:
1. Open browser console
2. Find the toolbar at top of screen
3. Try clicking on "Sticky" or "Rectangle" tools
4. Then click on canvas

If shapes still don't appear, the tool selection isn't working.

#### Fix 3: Check for Liveblocks Errors

In browser console, run:
```javascript
// Search for any Liveblocks errors
console.log('Searching for liveblocks errors...')
```

Look for messages like:
- "Failed to connect to Liveblocks"
- "Invalid API key"
- "Room not authorized"

#### Fix 4: Check Network Requests

1. Open Network tab (F12 → Network)
2. Look for requests to `liveblocks.io` or `lbx.io`
3. Check the status:
   - **200**: Working ✓
   - **401/403**: Authorization error ✗
   - **Failed**: Connection error ✗

### Detailed Debugging Steps

#### Step A: Enable Full Logging

Add this to browser console:
```javascript
// Enable Liveblocks debug mode
localStorage.setItem('liveblocks-debug', 'true')
// Reload page
location.reload()
```

This will show all Liveblocks operations in console.

#### Step B: Test Object Creation Directly

Try this in console (after page is fully loaded):
```javascript
// This should show the createObject function
const boardPage = document.querySelector('[data-testid="board-page"]')
console.log('Board page found:', !!boardPage)

// Try creating object via mutation
// (This requires access to the Liveblocks context, which is complex)
```

#### Step C: Check Liveblocks Storage Structure

The expected storage structure should be:
```javascript
{
  objects: {
    "uuid-1": { type: 'sticky', x: 0, y: 0, ... },
    "uuid-2": { type: 'rectangle', x: 100, y: 100, ... }
  }
}
```

If `objects` is undefined or empty when you try to create something, that's the problem.

### Solutions by Diagnosis

#### Diagnosis: Storage is empty but mutation is called

**Problem**: The `useStorage` hook isn't reading the initialized storage.

**Solution**:
1. Check `BoardPageWrapper.tsx` - the `initialStorage` prop should be:
```typescript
initialStorage={{
  objects: {},
}}
```

2. If incorrect, that needs to be fixed in the code.

#### Diagnosis: Mutation isn't called

**Problem**: Either the tool isn't selected, or the click handler isn't working.

**Solution**:
1. Check `useUiStore` - does `activeTool` change when you click toolbar buttons?
2. Test in console:
```javascript
// Check active tool
fetch('/api/config').then(r => r.json()).then(console.log)
```

3. If toolbar buttons don't respond, there's a UI state issue.

#### Diagnosis: Liveblocks isn't connecting

**Problem**: The LiveblocksProvider didn't initialize, or API key is wrong.

**Solution**:
1. Verify in `/api/config` endpoint:
```bash
curl https://raqdrobinson.com/api/config
```

Should show both keys:
```json
{
  "clerkPublishableKey": "pk_live_...",
  "liveblocksPublicKey": "pk_prod_...",
  "apiUrl": "https://raqdrobinson.com"
}
```

2. If keys are missing, Railway environment variables weren't set. See `RAILWAY_ENV_SETUP.md`.

### Quick Checklist

- [ ] Can you log in? (Clerk working)
- [ ] Do console logs show "Liveblocks storage objects"?
- [ ] Are you selecting a tool (Sticky, Rectangle, etc.)?
- [ ] Are you clicking on the canvas (not the toolbar)?
- [ ] Is `/api/config` returning both keys?
- [ ] Are there any console errors (red messages)?
- [ ] Is the Network tab showing requests to `liveblocks.io`?

### Still Stuck?

If you've gone through all these steps, the issue is likely one of:

1. **Liveblocks authentication**: Room creation failed
   - Check Liveblocks dashboard at https://liveblocks.io/dashboard
   - Verify your public key in settings

2. **Race condition**: React rendered before Liveblocks initialized
   - This is handled by LiveblocksProvider, but could occur if there's a timing issue

3. **TypeScript/Build issue**: Objects type isn't matching
   - Would show errors in console
   - Check that `shared/types.ts` is up to date

### Getting Help

If you encounter an error message, please provide:
1. The exact error text from console
2. Screenshot of the console
3. Your browser (Chrome, Firefox, Safari)
4. What action triggered the issue (e.g., "clicked Sticky tool then canvas")

This information helps identify the exact cause.

# CollabBoard — AI Development Log

## Project Overview

**Project:** CollabBoard — Real-time Collaborative Whiteboard with AI Agent
**Timeline:** February 16–22, 2026 (7 days)
**Commits:** 169 across the project
**Tests:** 415 (190 server + 225 client)
**Source lines:** ~7,100 (source) + ~6,800 (tests) = ~13,900 total
**Live URL:** [collabboard.raqdrobinson.com](https://collabboard.raqdrobinson.com)

---

## 1. Tools & Workflow

### Primary Tool: Claude Code CLI
The entire codebase was developed using Claude Code (Anthropic's CLI agent). Claude Code ran as an interactive terminal session where I described features in natural language and it generated code, ran tests, and made commits.

### Supporting Tool: Chrome MCP (Model Context Protocol)
Claude Code connected to my Chrome browser via the MCP extension to:
- Inject 500 test objects into the live board for performance stress testing
- Measure frame rates (FPS) and render times directly in the browser console
- Take screenshots to verify visual layout after each change
- Navigate to the production URL and verify deploys
- Test real-time AI sync on production (verify objects appear instantly)
- Debug production issues by inspecting live board state

### Development Loop
```
1. Describe feature in plain English
2. Claude Code writes failing tests (TDD red phase)
3. Claude Code implements minimum code to pass tests (green phase)
4. Claude Code runs full test suite to catch regressions
5. I review the output, test locally, then approve push
6. Verify production after deploy
```

---

## 2. Effective Prompts

### Prompt 1: Architecture scaffolding
> "Build a real-time collaborative whiteboard. React + Konva.js frontend, Node.js WebSocket server, Yjs for CRDT sync. Clerk for auth. Start with sticky notes and rectangles on an infinite canvas."

**Result:** Full monorepo scaffold with working real-time sync in ~2 hours. Generated the WebSocket binary protocol, Yjs integration hook, and Konva canvas setup.

### Prompt 2: AI agent with TDD
> "Add an AI chat panel. The server should use Anthropic's Claude with tool calling — 3 tools: createObject, updateObject, moveObject. Write TDD tests first. Also add a local regex parser as a fallback when no API key is configured."

**Result:** 73 TDD tests written first (20 for AI handler, 53 for local parser), then implementation. The local parser handles all 12 command patterns without any API calls — a graceful degradation I wouldn't have thought to build proactively.

### Prompt 3: Performance investigation
> "Test by adding the 500 objects again" / "The performance with the 500 objects was still degraded"

**Result:** Claude Code used Chrome MCP to inject 500 objects, measured FPS at 29 (degraded), identified Konva's canvas draw loop as the bottleneck (not React re-renders), and implemented a render budget that caps rendered objects at 150 sorted by distance to viewport center. P95 frame time dropped from 50ms+ to 45ms.

### Prompt 4: Server hardening
> "Commit and push everything minus the 500 objects and then address the server side improvements"

**Result:** Three server improvements in one session: WebSocket perMessageDeflate compression (~70% bandwidth reduction), preemptive object count validation (reject BEFORE applying Yjs update instead of warning after), and idle room eviction (save to Supabase and destroy Y.Doc after 1 hour of inactivity).

### Prompt 5: Code cleanup
> "Finish the code cleanup first"

**Result:** Claude Code explored the codebase, identified 2 dead component files (StickyNote.tsx, Rectangle.tsx superseded by BoardShape.tsx), an `as any` type assertion, and production console.log statements. Deleted 196 lines, fixed all issues, verified build and tests pass.

### Prompt 6: Undo/redo implementation (TDD plan-first)
> "Let's do undo/redo next. Enter plan mode."

**Result:** Claude Code entered plan mode, explored the codebase, designed a 3-step TDD plan leveraging Yjs's built-in UndoManager. The plan specified `trackedOrigins: new Set([null])` to exclude remote changes and `captureTimeout: 500` to group rapid mutations. Wrote 15+ failing tests first, then implemented in useYjs.ts and wired keyboard shortcuts. Also added a HelpPanel and undo/redo toolbar buttons.

### Prompt 7: AI flowchart/line support
> "Add a line/arrow object type so the AI can draw flowcharts with connectors between objects."

**Result:** 9 new TDD tests covering line creation (points, fromId/toId, arrowEnd, collision skip), then implementation: added 'line' to createObject tool enum, line-specific properties, system prompt flowchart guidance (8 new rules), and updated COMPLEX_PATTERNS regex to catch 'flowchart', 'connect', and 'arrow'. Verified locally with curl — AI created 6 colored boxes + 2 connecting arrows.

### Prompt 8: Production debugging
> (Investigating why AI-created objects didn't appear in real-time on production)

**Result:** Claude Code added diagnostic logging to the WebSocket broadcast function, used Chrome MCP to test on production, identified that a Railway redeployment was needed. After push + redeploy, real-time AI sync confirmed working — objects appeared instantly on the live canvas.

### Prompt 9: Rubber-band selection fix (4-iteration debugging)
> "rubber band select for multiple objects does not work"

**Result:** This required 4 iterations to solve, demonstrating deep Konva event system investigation:

1. **Attempt 1 — `stopDrag()` in onDragStart:** Called `stage.stopDrag()` when rubber-band was active. Didn't work — Konva's drag system had already hijacked mouse events by the time `onDragStart` fires.

2. **Attempt 2 — Imperative `stage.draggable(false)` in mouseDown:** Set `stage.draggable(false)` before Konva could start its drag. Still didn't work — Konva registers drag candidates internally during mousedown processing before custom handlers execute.

3. **Attempt 3 — Remove Stage draggable entirely (nuclear approach):** Removed the `draggable` prop from the Stage completely. Replaced pan with scroll/trackpad (plain scroll = pan, Ctrl+scroll = zoom) and Space+drag for manual pan. This fixed the drag hijacking but revealed a new bug: Konva fires `onClick` after a mousedown→mousemove→mouseup sequence, causing `handleStageClick` to fire after the rubber-band and either clear the selection or create new objects.

4. **Final fix — `didRubberBandRef`:** Added a ref that's set to `true` when rubber-band or pan completes in mouseUp. `handleStageClick` checks this ref and skips if true, preventing the spurious click from undoing the rubber-band selection.

Wrote 11 new TDD tests covering the full lifecycle. Chrome MCP verified multi-select working on production — "2 selected" badge with selection handles on both objects. Board.tsx grew from ~666 to ~872 lines. This was the hardest Konva-specific bug in the project.

---

## 3. Code Analysis

### AI-Generated vs. Hand-Written

| Category | Lines | AI-Generated | Hand-Written |
|----------|-------|-------------|--------------|
| Source code | ~7,100 | ~90% | ~10% |
| Test code | ~6,800 | ~95% | ~5% |
| Config files | ~300 | ~70% | ~30% |
| **Total** | **~14,200** | **~91%** | **~9%** |

**What the AI generated well:**
- WebSocket server with room isolation and binary protocol
- Yjs integration hook with awareness, reconnection, cursor throttling, and undo/redo
- All 415 TDD tests (including edge cases I wouldn't have written)
- Security module with CORS, message size limits, room validation
- Viewport culling with render budget and center-distance sorting
- Component extraction with proper prop interfaces
- AI tool-calling agent with system prompt construction and model routing
- Line/arrow connector support with edge-point attachment
- Copy/paste with stacking offsets
- Multi-board routing with Clerk authentication
- Langfuse observability integration
- Frame grouping with parentId detection
- Rubber-band selection fix (4-iteration deep Konva event system debugging)
- Scroll/trackpad pan and Space+drag pan as Stage draggable replacement

**What required human judgment:**
- Architecture decisions (Yjs over socket.io, Konva over fabric.js)
- Feature prioritization and scope management
- Production environment configuration (Railway, Vercel, Supabase)
- Visual design choices (colors, layout, font selection)
- When to stop optimizing and ship
- Model selection for routing (Haiku vs. Sonnet thresholds)
- Production debugging strategy (where to add diagnostics)

---

## 4. MCP Usage (Browser Automation)

Chrome MCP was essential for tasks that require visual verification:

### Performance Testing
- Injected 500 objects by walking React's fiber tree to find the Y.Doc reference
- Measured frame times using `performance.now()` in the browser console
- Verified render budget worked: 150/552 objects rendered at zoom-out, 118/552 at 100% zoom

### Production Verification
- Navigated to `https://collabboard.raqdrobinson.com` after each deploy
- Took screenshots to confirm the app loaded and WebSocket connected
- Checked the health endpoint (`/health`) for server status
- Tested AI commands on production via the chat panel — verified real-time sync

### Real-Time AI Sync Testing
- Typed AI commands on production board via ChatPanel
- Verified objects appeared instantly on the canvas (not just after refresh)
- Confirmed that previously persisted AI-created objects appeared after page reload
- Diagnosed broadcast issues by checking WebSocket client counts in server logs

### Visual Testing
- Verified AI button didn't overlap zoom controls
- Confirmed DM Sans font rendered correctly across all components
- Checked focus-visible rings on interactive elements
- Verified undo/redo buttons in toolbar
- Confirmed HelpPanel overlay renders correctly

---

## 5. Development Timeline

| Day | Commits | Key Milestones |
|-----|---------|---------------|
| Day 1 (Feb 16) | ~30 | Monorepo scaffold, Yjs sync, canvas with sticky notes + rectangles |
| Day 2 (Feb 17) | ~35 | Multi-select, rotation, circles, text, frames, inline editing |
| Day 3 (Feb 18) | ~35 | Supabase persistence, AI agent + local parser, security hardening |
| Day 4 (Feb 19) | ~25 | Performance optimization, component extraction, code cleanup |
| Day 5 (Feb 20) | ~18 | Multi-board auth, dashboard, Langfuse, model routing |
| Day 6 (Feb 21) | ~15 | Frame grouping, guest sandbox, copy/paste, undo/redo, help panel |
| Day 7 (Feb 22) | ~11 | AI line/arrow support, rubber-band selection fix, scroll/Space pan, production debugging, documentation |

---

## 6. Strengths & Limitations

### Strengths of AI-Assisted Development

1. **TDD becomes effortless.** Writing tests first is tedious for humans but trivial for AI. Claude Code consistently wrote comprehensive test suites covering edge cases I would have skipped. The test count grew from 110 to 404 as features were added.

2. **Exploration is instant.** When I asked "will the production setup handle 500 objects?", Claude Code analyzed WebSocket message sizes, Supabase row limits, and memory usage across the codebase in under a minute.

3. **Refactoring at scale.** Extracting 5 components from a 900-line Board.tsx, updating all imports, and maintaining test coverage took ~15 minutes instead of hours.

4. **Cross-domain knowledge.** The AI seamlessly handled React, Konva, Yjs CRDTs, WebSocket protocols, Supabase, Docker, TypeScript strict mode, Clerk auth, Anthropic SDK, Langfuse, and Vitest — without context switching.

5. **Plan mode for complex features.** The plan-first approach (enter plan mode → explore codebase → design → get approval → implement) produced better architecture for features like undo/redo, where understanding Yjs UndoManager's `trackedOrigins` was critical.

6. **Production debugging.** Using Chrome MCP + diagnostic logging, Claude Code could diagnose production issues (like real-time sync not working) remotely — adding targeted logging, pushing to production, and verifying the fix via browser.

7. **Iterative debugging on hard platform bugs.** The rubber-band selection fix required 4 iterations to solve, each revealing a deeper layer of the Konva event system. Claude Code systematically tried and rejected approaches (stopDrag, imperative draggable toggle), ultimately arriving at a complete architectural solution (remove Stage draggable, add scroll/Space pan, add didRubberBandRef click suppression). This showed AI persistence on complex platform-specific bugs.

### Limitations

1. **Performance intuition is weak.** The AI correctly implemented React.memo but didn't anticipate that Konva's canvas draw loop (not React re-renders) was the real bottleneck with 500 objects. It needed the empirical data from Chrome MCP to diagnose correctly.

2. **Overbuilds when unconstrained.** Without clear scope, the AI tends to add features beyond what's needed. Strict prompting ("minimum code to pass tests") kept this in check.

3. **Context window pressure.** Multi-session projects require careful summarization. The session compaction process loses nuance about why certain decisions were made. Sessions had to be continued across context boundaries 2-3 times.

4. **Can't do visual design.** The AI can implement CSS properties but can't judge whether a design looks good. Font choices, color palettes, and layout decisions required human input.

5. **Production environment blind spots.** The AI couldn't directly access Railway env vars or Vercel dashboard settings. Diagnosing "production uses local parser" required manual investigation of whether `ANTHROPIC_API_KEY` was set on Railway.

---

## 7. Key Learnings

1. **TDD + AI = highest confidence shipping.** Every feature was green before merging. Zero production bugs from code changes (415 tests across the full stack).

2. **Chrome MCP closes the visual gap.** AI can't see, but with MCP screenshots and console access, it can diagnose visual and performance issues effectively. It was critical for production verification.

3. **Small commits save time.** The "commit often" approach (169 commits over 7 days = ~24/day) meant rolling back a bad change was trivial. Larger atomic changes occasionally required debugging that smaller commits would have avoided.

4. **The AI is a force multiplier, not a replacement.** The 169 commits over 7 days represent work that would have taken 3-4 weeks solo. But every commit still needed human review, approval, and architectural judgment.

5. **Fallback patterns are undervalued.** The local parser fallback (12 regex patterns for AI commands when no API key is set) was suggested by the AI and turned out to be essential for development, testing, and production resilience.

6. **Model routing pays off immediately.** Switching simple commands to Haiku ($0.80/$4.00 per 1M tokens) from Sonnet ($3/$15 per 1M tokens) reduced per-command costs by ~82% for 70% of traffic — a quick win with no UX degradation.

7. **Plan mode prevents rework.** For non-trivial features (undo/redo, multi-board auth), entering plan mode first and getting the architecture right saved significant refactoring time. The AI explored the codebase, identified constraints (like Yjs UndoManager's origin tracking), and designed the approach before writing any code.

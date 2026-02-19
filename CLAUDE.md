# CollabBoard — Claude Code Rules

## TDD Required
**Always use Test-Driven Development.** For every new feature or module:
1. Write failing tests FIRST that define the expected behavior
2. Implement the minimum code to make the tests pass
3. Refactor if needed while keeping tests green

Never write implementation code before its corresponding tests. If you catch yourself writing code first, stop and write the tests.

## Testing
- Server tests: `cd server && npm test` (Vitest)
- Client tests: `cd client && npm test` (Vitest + jsdom)
- All tests must pass before considering a task complete
- Aim for tests that cover core logic, edge cases, and error paths

## Code Style
- TypeScript strict mode
- ESM modules (`"type": "module"`)
- No unused variables (Vercel build will fail on TS6133)
- Prefix intentionally unused params with `_` (e.g., `_event`)

## Project Structure
- `client/` — React + Vite frontend
- `server/` — Node.js WebSocket + HTTP server
- `planning-docs/` — gitignored, planning documents only

## Environment
- Server env vars loaded via `--env-file=.env` (Node 20+)
- Never commit `.env` files (already in .gitignore)
- Supabase for persistence, Anthropic SDK for AI agent

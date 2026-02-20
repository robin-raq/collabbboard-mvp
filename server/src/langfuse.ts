/**
 * Langfuse Observability Module
 *
 * Provides a conditional Langfuse client singleton and null-safe helper
 * wrappers for tracing. When LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY
 * are not set, all tracing calls become no-ops — zero overhead, no errors.
 *
 * Usage:
 *   import { createTrace, flushTraces, isLangfuseEnabled } from './langfuse.js'
 *
 *   const trace = createTrace({ name: 'ai-command', metadata: { boardId } })
 *   const gen = trace.generation({ name: 'claude-call', model: 'claude-sonnet-4-...' })
 *   gen.update({ output: response, usage: { input: 100, output: 50 } })
 *   gen.end()
 */

import Langfuse from 'langfuse'

// ---------------------------------------------------------------------------
// Types for the null-safe wrappers
// ---------------------------------------------------------------------------

/** Minimal interface matching Langfuse generation/span objects. */
export interface TracingObservation {
  update: (data: Record<string, unknown>) => void
  end: () => void
}

/** Minimal interface matching Langfuse trace objects. */
export interface TracingTrace {
  generation: (data: Record<string, unknown>) => TracingObservation
  span: (data: Record<string, unknown>) => TracingObservation
  update: (data: Record<string, unknown>) => void
}

// ---------------------------------------------------------------------------
// No-op stubs (used when Langfuse is disabled)
// ---------------------------------------------------------------------------

const noopObservation: TracingObservation = {
  update: () => {},
  end: () => {},
}

const noopTrace: TracingTrace = {
  generation: () => ({ ...noopObservation }),
  span: () => ({ ...noopObservation }),
  update: () => {},
}

// ---------------------------------------------------------------------------
// Langfuse Client (conditional — null when env vars are not set)
// ---------------------------------------------------------------------------

const secretKey = process.env.LANGFUSE_SECRET_KEY
const publicKey = process.env.LANGFUSE_PUBLIC_KEY

const langfuse = (secretKey && publicKey)
  ? new Langfuse({
      secretKey,
      publicKey,
      baseUrl: process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com',
    })
  : null

if (!langfuse) {
  console.log('[Langfuse] No LANGFUSE keys — tracing disabled (no-op mode)')
} else {
  console.log('[Langfuse] Tracing enabled — sending to', process.env.LANGFUSE_HOST ?? 'https://cloud.langfuse.com')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the raw Langfuse client, or null if not configured.
 */
export function getLangfuse(): Langfuse | null {
  return langfuse
}

/**
 * Returns true if Langfuse tracing is enabled (keys are configured).
 */
export function isLangfuseEnabled(): boolean {
  return langfuse !== null
}

/**
 * Create a new trace. Returns a null-safe wrapper — safe to call
 * .generation(), .span(), .update() even when Langfuse is disabled.
 */
export function createTrace(opts: {
  name: string
  userId?: string
  sessionId?: string
  input?: unknown
  metadata?: Record<string, unknown>
}): TracingTrace {
  if (!langfuse) return { ...noopTrace }

  const trace = langfuse.trace({
    name: opts.name,
    userId: opts.userId,
    sessionId: opts.sessionId,
    input: opts.input,
    metadata: opts.metadata,
  })

  return trace
}

/**
 * Flush all pending traces to Langfuse. Call this on shutdown to
 * ensure no traces are lost. No-ops when Langfuse is disabled.
 */
export async function flushTraces(): Promise<void> {
  if (!langfuse) return
  await langfuse.flushAsync()
}

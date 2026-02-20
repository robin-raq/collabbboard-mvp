/**
 * Langfuse Tracing Module Tests (TDD)
 *
 * Tests the Langfuse client singleton and null-safe helper wrappers.
 * Verifies graceful degradation when Langfuse env vars are not set.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// We test the module by dynamically importing it with controlled env vars.
// vitest isolateModules ensures each test gets a fresh module evaluation.
// ---------------------------------------------------------------------------

describe('langfuse module', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // -------------------------------------------------------------------------
  // getLangfuse
  // -------------------------------------------------------------------------

  describe('getLangfuse', () => {
    it('returns null when LANGFUSE_SECRET_KEY is missing', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { getLangfuse } = await import('../langfuse.js')
      expect(getLangfuse()).toBeNull()
    })

    it('returns null when LANGFUSE_PUBLIC_KEY is missing', async () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test'
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { getLangfuse } = await import('../langfuse.js')
      expect(getLangfuse()).toBeNull()
    })

    it('returns a Langfuse instance when both keys are set', async () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test'
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test'
      process.env.LANGFUSE_HOST = 'http://localhost:3000'
      const { getLangfuse } = await import('../langfuse.js')
      const client = getLangfuse()
      expect(client).not.toBeNull()
      expect(client).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // createTrace — null-safe wrapper
  // -------------------------------------------------------------------------

  describe('createTrace', () => {
    it('returns a no-op trace when Langfuse is disabled', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { createTrace } = await import('../langfuse.js')

      const trace = createTrace({ name: 'test-trace' })
      expect(trace).toBeDefined()

      // No-op trace should have the same API surface but do nothing
      expect(typeof trace.generation).toBe('function')
      expect(typeof trace.span).toBe('function')
      expect(typeof trace.update).toBe('function')
    })

    it('no-op trace generation returns an object with update and end methods', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { createTrace } = await import('../langfuse.js')

      const trace = createTrace({ name: 'test-trace' })
      const gen = trace.generation({ name: 'gen-1' })
      expect(typeof gen.update).toBe('function')
      expect(typeof gen.end).toBe('function')
    })

    it('no-op trace span returns an object with update and end methods', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { createTrace } = await import('../langfuse.js')

      const trace = createTrace({ name: 'test-trace' })
      const span = trace.span({ name: 'span-1' })
      expect(typeof span.update).toBe('function')
      expect(typeof span.end).toBe('function')
    })

    it('returns a real trace when Langfuse is enabled', async () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test'
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test'
      process.env.LANGFUSE_HOST = 'http://localhost:3000'
      const { createTrace } = await import('../langfuse.js')

      const trace = createTrace({
        name: 'test-trace',
        userId: 'user-1',
        sessionId: 'session-1',
        metadata: { boardId: 'board-1' },
      })

      expect(trace).toBeDefined()
      expect(typeof trace.generation).toBe('function')
      expect(typeof trace.span).toBe('function')
      expect(typeof trace.update).toBe('function')
    })
  })

  // -------------------------------------------------------------------------
  // flushTraces
  // -------------------------------------------------------------------------

  describe('flushTraces', () => {
    it('resolves without error when Langfuse is disabled', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { flushTraces } = await import('../langfuse.js')

      // Should not throw
      await expect(flushTraces()).resolves.toBeUndefined()
    })

    it('calls flushAsync when Langfuse is enabled', async () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test'
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test'
      process.env.LANGFUSE_HOST = 'http://localhost:3000'
      const { getLangfuse, flushTraces } = await import('../langfuse.js')

      const client = getLangfuse()
      // Mock flushAsync to avoid real network calls
      if (client) {
        client.flushAsync = vi.fn().mockResolvedValue(undefined)
      }

      await flushTraces()

      if (client) {
        expect(client.flushAsync).toHaveBeenCalled()
      }
    })
  })

  // -------------------------------------------------------------------------
  // isLangfuseEnabled
  // -------------------------------------------------------------------------

  describe('isLangfuseEnabled', () => {
    it('returns false when Langfuse is not configured', async () => {
      delete process.env.LANGFUSE_SECRET_KEY
      delete process.env.LANGFUSE_PUBLIC_KEY
      const { isLangfuseEnabled } = await import('../langfuse.js')
      expect(isLangfuseEnabled()).toBe(false)
    })

    it('returns true when Langfuse is configured', async () => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-lf-test'
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-lf-test'
      process.env.LANGFUSE_HOST = 'http://localhost:3000'
      const { isLangfuseEnabled } = await import('../langfuse.js')
      expect(isLangfuseEnabled()).toBe(true)
    })
  })
})

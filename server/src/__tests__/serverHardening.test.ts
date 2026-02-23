/**
 * Server Hardening Tests
 *
 * Tests for production-readiness improvements:
 *  1. Preemptive object count validation (reject BEFORE applying to Y.Doc)
 */

import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import {
  shouldRejectUpdate,
  MAX_OBJECTS_PER_BOARD,
} from '../security.js'

// ============================================================================
// Preemptive object count validation
// ============================================================================

describe('shouldRejectUpdate — preemptive object limit check', () => {
  it('returns false when object count is well under the limit', () => {
    const doc = new Y.Doc()
    doc.getMap('objects').set('a', { id: 'a' })
    expect(shouldRejectUpdate(doc)).toBe(false)
    doc.destroy()
  })

  it('returns false when object count is exactly at limit - 1', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('objects')
    for (let i = 0; i < MAX_OBJECTS_PER_BOARD - 1; i++) {
      map.set(`obj-${i}`, { id: `obj-${i}` })
    }
    expect(shouldRejectUpdate(doc)).toBe(false)
    doc.destroy()
  })

  it('returns true when object count is at the limit', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('objects')
    for (let i = 0; i < MAX_OBJECTS_PER_BOARD; i++) {
      map.set(`obj-${i}`, { id: `obj-${i}` })
    }
    expect(shouldRejectUpdate(doc)).toBe(true)
    doc.destroy()
  })

  it('returns true when object count exceeds the limit', () => {
    const doc = new Y.Doc()
    const map = doc.getMap('objects')
    for (let i = 0; i < MAX_OBJECTS_PER_BOARD + 10; i++) {
      map.set(`obj-${i}`, { id: `obj-${i}` })
    }
    expect(shouldRejectUpdate(doc)).toBe(true)
    doc.destroy()
  })
})

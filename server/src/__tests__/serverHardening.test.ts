/**
 * Server Hardening Tests
 *
 * Tests for production-readiness improvements:
 *  1. Preemptive object count validation (reject BEFORE applying to Y.Doc)
 *  2. Room eviction (clean up idle rooms to prevent memory leaks)
 *  3. WS compression config verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Y from 'yjs'
import {
  shouldRejectUpdate,
  MAX_OBJECTS_PER_BOARD,
} from '../security.js'
import {
  createRoomManager,
} from '../roomManager.js'

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

// ============================================================================
// Room eviction — idle room cleanup
// ============================================================================

describe('Room eviction', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a new room and tracks it', () => {
    const rm = createRoomManager()
    const doc = rm.getOrCreateRoom('test-room')
    expect(doc).toBeInstanceOf(Y.Doc)
    expect(rm.getRoomCount()).toBe(1)
    rm.destroy()
  })

  it('returns existing room on second call', () => {
    const rm = createRoomManager()
    const doc1 = rm.getOrCreateRoom('test-room')
    const doc2 = rm.getOrCreateRoom('test-room')
    expect(doc1).toBe(doc2)
    expect(rm.getRoomCount()).toBe(1)
    rm.destroy()
  })

  it('does NOT evict rooms that have been touched recently', () => {
    const rm = createRoomManager({ idleTimeoutMs: 60_000 })
    rm.getOrCreateRoom('active-room')
    rm.touchRoom('active-room')

    // Advance only 30 seconds (half the timeout)
    vi.advanceTimersByTime(30_000)
    rm.evictIdleRooms()

    expect(rm.getRoomCount()).toBe(1)
    rm.destroy()
  })

  it('evicts rooms idle longer than the timeout', () => {
    const rm = createRoomManager({ idleTimeoutMs: 60_000 })
    rm.getOrCreateRoom('idle-room')
    rm.touchRoom('idle-room')

    // Advance past the timeout
    vi.advanceTimersByTime(61_000)
    rm.evictIdleRooms()

    expect(rm.getRoomCount()).toBe(0)
    rm.destroy()
  })

  it('keeps active rooms while evicting idle ones', () => {
    const rm = createRoomManager({ idleTimeoutMs: 60_000 })
    rm.getOrCreateRoom('active-room')
    rm.getOrCreateRoom('idle-room')

    // Touch both initially
    rm.touchRoom('active-room')
    rm.touchRoom('idle-room')

    // Advance 30s, touch only active-room
    vi.advanceTimersByTime(30_000)
    rm.touchRoom('active-room')

    // Advance another 31s (idle-room is now 61s idle, active-room is 31s)
    vi.advanceTimersByTime(31_000)
    rm.evictIdleRooms()

    expect(rm.getRoomCount()).toBe(1)
    expect(rm.hasRoom('active-room')).toBe(true)
    expect(rm.hasRoom('idle-room')).toBe(false)
    rm.destroy()
  })

  it('calls onEvict callback when evicting a room', () => {
    const onEvict = vi.fn()
    const rm = createRoomManager({ idleTimeoutMs: 60_000, onEvict })
    rm.getOrCreateRoom('evict-me')
    rm.touchRoom('evict-me')

    vi.advanceTimersByTime(61_000)
    rm.evictIdleRooms()

    expect(onEvict).toHaveBeenCalledOnce()
    expect(onEvict).toHaveBeenCalledWith('evict-me', expect.any(Y.Doc))
    rm.destroy()
  })

  it('destroy cleans up all rooms', () => {
    const rm = createRoomManager()
    rm.getOrCreateRoom('room-a')
    rm.getOrCreateRoom('room-b')
    expect(rm.getRoomCount()).toBe(2)

    rm.destroy()
    expect(rm.getRoomCount()).toBe(0)
  })
})

/**
 * Security Tests
 *
 * Tests the minimal security hardening:
 *  - CORS: only allowed origins get proper headers
 *  - Max WebSocket message size: reject messages > 1MB
 *  - Max objects per board: reject updates pushing past 5000
 *  - Room name validation: reject invalid characters
 *  - AI message length validation
 */

import { describe, it, expect } from 'vitest'
import {
  isOriginAllowed,
  getCorsOrigin,
  isMessageSizeValid,
  canAddObject,
  isValidRoomName,
  isAIMessageValid,
  MAX_WS_MESSAGE_SIZE,
  MAX_OBJECTS_PER_BOARD,
  MAX_AI_MESSAGE_LENGTH,
} from '../security.js'

// ---------------------------------------------------------------------------
// CORS origin validation
// ---------------------------------------------------------------------------

describe('CORS origin validation', () => {
  it('allows all origins when ALLOWED_ORIGINS is empty (dev mode)', () => {
    expect(isOriginAllowed('http://localhost:3000', '')).toBe(true)
    expect(isOriginAllowed('https://evil.com', '')).toBe(true)
  })

  it('allows listed origins when ALLOWED_ORIGINS is set', () => {
    const allowed = 'https://collabboard.raqdrobinson.com, http://localhost:3000'
    expect(isOriginAllowed('https://collabboard.raqdrobinson.com', allowed)).toBe(true)
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(true)
  })

  it('rejects unlisted origins', () => {
    const allowed = 'https://collabboard.raqdrobinson.com'
    expect(isOriginAllowed('https://evil.com', allowed)).toBe(false)
    expect(isOriginAllowed('http://localhost:3000', allowed)).toBe(false)
  })

  it('allows requests with no origin header (server-to-server)', () => {
    const allowed = 'https://collabboard.raqdrobinson.com'
    expect(isOriginAllowed(undefined, allowed)).toBe(true)
  })
})

describe('getCorsOrigin', () => {
  it('returns * when no restriction configured', () => {
    expect(getCorsOrigin('http://anything.com', '')).toBe('*')
  })

  it('returns the origin when it is allowed', () => {
    const allowed = 'https://collabboard.raqdrobinson.com'
    expect(getCorsOrigin('https://collabboard.raqdrobinson.com', allowed)).toBe(
      'https://collabboard.raqdrobinson.com'
    )
  })

  it('returns empty string for disallowed origins', () => {
    const allowed = 'https://collabboard.raqdrobinson.com'
    expect(getCorsOrigin('https://evil.com', allowed)).toBe('')
  })
})

// ---------------------------------------------------------------------------
// WebSocket message size validation
// ---------------------------------------------------------------------------

describe('WebSocket message size validation', () => {
  it('accepts messages under 1MB', () => {
    const small = new Uint8Array(1000)
    expect(isMessageSizeValid(small)).toBe(true)
  })

  it('accepts messages exactly at 1MB', () => {
    const exact = new Uint8Array(MAX_WS_MESSAGE_SIZE)
    expect(isMessageSizeValid(exact)).toBe(true)
  })

  it('rejects messages over 1MB', () => {
    const large = new Uint8Array(MAX_WS_MESSAGE_SIZE + 1)
    expect(isMessageSizeValid(large)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Max objects per board
// ---------------------------------------------------------------------------

describe('Max objects per board', () => {
  it('allows adding objects when under limit', () => {
    expect(canAddObject(0)).toBe(true)
    expect(canAddObject(100)).toBe(true)
    expect(canAddObject(MAX_OBJECTS_PER_BOARD - 1)).toBe(true)
  })

  it('rejects adding objects at or over limit', () => {
    expect(canAddObject(MAX_OBJECTS_PER_BOARD)).toBe(false)
    expect(canAddObject(MAX_OBJECTS_PER_BOARD + 5000)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Room name validation
// ---------------------------------------------------------------------------

describe('Room name validation', () => {
  it('accepts valid room names', () => {
    expect(isValidRoomName('mvp-board-1')).toBe(true)
    expect(isValidRoomName('my_board')).toBe(true)
    expect(isValidRoomName('Board123')).toBe(true)
    expect(isValidRoomName('a')).toBe(true)
  })

  it('rejects empty room names', () => {
    expect(isValidRoomName('')).toBe(false)
  })

  it('rejects room names with special characters', () => {
    expect(isValidRoomName('../etc/passwd')).toBe(false)
    expect(isValidRoomName('room name with spaces')).toBe(false)
    expect(isValidRoomName('room/with/slashes')).toBe(false)
    expect(isValidRoomName('<script>alert(1)</script>')).toBe(false)
  })

  it('rejects room names over 100 characters', () => {
    const longName = 'a'.repeat(101)
    expect(isValidRoomName(longName)).toBe(false)
  })

  it('accepts room names exactly at 100 characters', () => {
    const maxName = 'a'.repeat(100)
    expect(isValidRoomName(maxName)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// AI message length validation
// ---------------------------------------------------------------------------

describe('AI message validation', () => {
  it('accepts normal messages', () => {
    expect(isAIMessageValid('Add a yellow sticky note')).toBe(true)
    expect(isAIMessageValid('Create a 2x3 grid')).toBe(true)
  })

  it('rejects empty messages', () => {
    expect(isAIMessageValid('')).toBe(false)
  })

  it('rejects messages over limit', () => {
    const longMessage = 'a'.repeat(MAX_AI_MESSAGE_LENGTH + 1)
    expect(isAIMessageValid(longMessage)).toBe(false)
  })

  it('accepts messages exactly at limit', () => {
    const maxMessage = 'a'.repeat(MAX_AI_MESSAGE_LENGTH)
    expect(isAIMessageValid(maxMessage)).toBe(true)
  })
})

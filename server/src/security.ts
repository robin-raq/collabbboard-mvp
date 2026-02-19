/**
 * Security Module
 *
 * Validation functions for hardening the CollabBoard server:
 *  - CORS origin validation
 *  - WebSocket message size limits
 *  - Max objects per board
 *  - Room name sanitization
 *  - AI message length limits
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const MAX_WS_MESSAGE_SIZE = 1_048_576 // 1MB
export const MAX_OBJECTS_PER_BOARD = 5_000
export const MAX_AI_MESSAGE_LENGTH = 2_000

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

/**
 * Check whether an origin is allowed.
 * If ALLOWED_ORIGINS is not set, allow all (development mode).
 * If set, only allow origins in the comma-separated list.
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string
): boolean {
  // No restriction configured — allow all (dev mode)
  if (!allowedOrigins) return true

  // No origin header (e.g. server-to-server) — allow
  if (!origin) return true

  const allowed = allowedOrigins.split(',').map((o) => o.trim())
  return allowed.includes(origin)
}

/**
 * Get the CORS origin header value.
 * Returns the origin if allowed, or empty string to deny.
 */
export function getCorsOrigin(
  origin: string | undefined,
  allowedOrigins: string
): string {
  if (!allowedOrigins) return '*'
  if (isOriginAllowed(origin, allowedOrigins)) return origin || '*'
  return ''
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

/**
 * Check if a WebSocket message is within the size limit.
 */
export function isMessageSizeValid(data: Uint8Array): boolean {
  return data.byteLength <= MAX_WS_MESSAGE_SIZE
}

// ---------------------------------------------------------------------------
// Board limits
// ---------------------------------------------------------------------------

/**
 * Check if a board can accept more objects.
 */
export function canAddObject(currentCount: number): boolean {
  return currentCount < MAX_OBJECTS_PER_BOARD
}

// ---------------------------------------------------------------------------
// Room name validation
// ---------------------------------------------------------------------------

/**
 * Room names must be 1-100 chars, alphanumeric + hyphens + underscores only.
 * This prevents path traversal and other injection attacks.
 */
export function isValidRoomName(room: string): boolean {
  if (!room || room.length > 100) return false
  return /^[a-zA-Z0-9_-]+$/.test(room)
}

// ---------------------------------------------------------------------------
// AI message validation
// ---------------------------------------------------------------------------

/**
 * Validate an AI chat message.
 */
export function isAIMessageValid(message: string): boolean {
  return (
    typeof message === 'string' &&
    message.length > 0 &&
    message.length <= MAX_AI_MESSAGE_LENGTH
  )
}

/**
 * Room Manager — manages Y.Doc lifecycle with idle room eviction.
 *
 * Tracks last-active timestamps per room and evicts rooms that have
 * been idle longer than the configured timeout to prevent memory leaks
 * when many boards accumulate on the server.
 */

import * as Y from 'yjs'

export interface RoomManagerOptions {
  /** How long a room can be idle before eviction (ms). Default: 1 hour. */
  idleTimeoutMs?: number
  /** Called when a room is evicted (for snapshot saving). */
  onEvict?: (room: string, doc: Y.Doc) => void
}

export interface RoomManager {
  getOrCreateRoom(room: string): Y.Doc
  touchRoom(room: string): void
  evictIdleRooms(): void
  hasRoom(room: string): boolean
  getRoomCount(): number
  getDoc(room: string): Y.Doc | undefined
  destroy(): void
}

export function createRoomManager(options: RoomManagerOptions = {}): RoomManager {
  const { idleTimeoutMs = 3_600_000, onEvict } = options
  const docs = new Map<string, Y.Doc>()
  const lastActive = new Map<string, number>()

  return {
    getOrCreateRoom(room: string): Y.Doc {
      if (!docs.has(room)) {
        docs.set(room, new Y.Doc())
        lastActive.set(room, Date.now())
      }
      return docs.get(room)!
    },

    touchRoom(room: string): void {
      if (docs.has(room)) {
        lastActive.set(room, Date.now())
      }
    },

    evictIdleRooms(): void {
      const now = Date.now()
      for (const [room, lastTime] of lastActive) {
        if (now - lastTime > idleTimeoutMs) {
          const doc = docs.get(room)
          if (doc) {
            if (onEvict) onEvict(room, doc)
            doc.destroy()
          }
          docs.delete(room)
          lastActive.delete(room)
        }
      }
    },

    hasRoom(room: string): boolean {
      return docs.has(room)
    },

    getRoomCount(): number {
      return docs.size
    },

    getDoc(room: string): Y.Doc | undefined {
      return docs.get(room)
    },

    destroy(): void {
      for (const doc of docs.values()) {
        doc.destroy()
      }
      docs.clear()
      lastActive.clear()
    },
  }
}

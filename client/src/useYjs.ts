/**
 * useYjs — Real-time collaborative state via Yjs CRDT over WebSocket.
 *
 * This hook manages the entire sync lifecycle:
 *  1. Creates a Y.Doc with a shared Y.Map<BoardObject>
 *  2. Connects to the WebSocket relay server
 *  3. Sends/receives binary Yjs updates + JSON awareness messages
 *  4. Exposes CRUD operations that mutate the Y.Map (auto-synced)
 *  5. Tracks remote cursors via the awareness protocol
 *
 * Performance optimizations:
 *  - Cursor updates throttled to 50ms (20 updates/sec) — target: <50ms latency
 *  - Map-based object state — only changed objects trigger re-renders
 *  - Remote cursor updates batched via requestAnimationFrame
 *  - Console logs gated behind import.meta.env.DEV
 *
 * Presence awareness:
 *  - Periodic heartbeat (every 2s) so remote users know we're online
 *  - Stale cursor cleanup (remove after 8s of no updates)
 *  - Awareness messages include timestamp for staleness detection
 *
 * Wire protocol (binary):
 *   byte[0]  = message type (0 = Yjs update, 1 = awareness)
 *   byte[1:] = payload (Yjs binary update OR UTF-8 JSON)
 *
 * IMPORTANT: All remote updates are applied with origin='remote' so
 * the update handler doesn't echo them back to the server.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import * as Y from 'yjs'
import type { BoardObject } from './types'
import { throttle } from './utils/throttle'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Derive the WebSocket URL:
 * 1. Explicit env var wins (VITE_WS_URL)
 * 2. In production, derive from VITE_API_URL or known production host
 * 3. Fallback to localhost for dev
 */
function getWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  if (import.meta.env.VITE_API_URL) {
    // Convert https://foo.com → wss://foo.com
    return import.meta.env.VITE_API_URL
      .replace(/^https:/, 'wss:')
      .replace(/^http:/, 'ws:')
  }
  // Auto-detect: if served from a non-localhost origin, use same-origin WS
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//raqdrobinson.com`
  }
  return 'ws://localhost:1234'
}

const WS_URL = getWsUrl()
const MSG_YJS = 0       // Yjs document update
const MSG_AWARENESS = 1 // Cursor / presence info
const REMOTE = 'remote' // Origin tag to prevent echo loops
const DEBUG = import.meta.env.DEV // Gate all logs behind dev mode
const CURSOR_THROTTLE_MS = 50 // Throttle cursor sends to 20/sec
const HEARTBEAT_MS = 2000     // Send presence heartbeat every 2s
const STALE_TIMEOUT_MS = 8000 // Remove cursors not heard from in 8s

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteCursor {
  clientId: string
  cursor: { x: number; y: number } | null
  name: string
  color: string
  /** Timestamp of last update — used for stale detection */
  lastSeen?: number
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYjs(roomId: string, userName: string, userColor: string) {
  // Map-based state: only changed objects cause re-renders when used with React.memo
  const [objectMap, setObjectMap] = useState<Map<string, BoardObject>>(new Map())
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const [connected, setConnected] = useState(false)

  const yDocRef = useRef<Y.Doc | null>(null)
  const yMapRef = useRef<Y.Map<BoardObject> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef(crypto.randomUUID())
  const remoteCursorsRef = useRef<Map<string, RemoteCursor>>(new Map())

  // Track last known cursor position for heartbeat resends
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null)

  // Batch remote cursor updates via requestAnimationFrame
  const cursorRafRef = useRef<number | null>(null)
  const cursorDirtyRef = useRef(false)

  function flushCursors() {
    if (cursorDirtyRef.current) {
      cursorDirtyRef.current = false
      setRemoteCursors(Array.from(remoteCursorsRef.current.values()))
    }
    cursorRafRef.current = null
  }

  function scheduleCursorFlush() {
    cursorDirtyRef.current = true
    if (!cursorRafRef.current) {
      cursorRafRef.current = requestAnimationFrame(flushCursors)
    }
  }

  // Derive objects array from Map (stable references for unchanged objects)
  const objects = useMemo(() => Array.from(objectMap.values()), [objectMap])

  // ---- WebSocket + Yjs sync lifecycle ------------------------------------

  useEffect(() => {
    const yDoc = new Y.Doc()
    const yMap = yDoc.getMap<BoardObject>('objects')
    yDocRef.current = yDoc
    yMapRef.current = yMap

    const wsUrl = `${WS_URL}/${roomId}`
    if (DEBUG) console.log('[YJS] Connecting to', wsUrl)

    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>
    let heartbeatTimer: ReturnType<typeof setInterval>
    let staleCleanupTimer: ReturnType<typeof setInterval>

    function connect() {
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        if (DEBUG) console.log('[YJS STATUS] connected')
        setConnected(true)
        sendAwareness(ws, clientIdRef.current, userName, userColor, null)

        // Send our current state to the server so it can merge
        const localState = Y.encodeStateAsUpdate(yDoc)
        if (localState.length > 2) {
          const msg = new Uint8Array(1 + localState.length)
          msg[0] = MSG_YJS
          msg.set(localState, 1)
          ws.send(msg)
          if (DEBUG) console.log(`[YJS] Sent local state to server (${localState.byteLength} bytes)`)
        }

        // Start periodic heartbeat — keeps our presence visible even when
        // the user isn't moving their mouse
        heartbeatTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            sendAwareness(ws, clientIdRef.current, userName, userColor, lastCursorRef.current)
          }
        }, HEARTBEAT_MS)
      }

      ws.onmessage = (event) => {
        const data = new Uint8Array(event.data)
        if (data.length < 2) return

        const msgType = data[0]
        const payload = data.slice(1)

        if (msgType === MSG_YJS) {
          // CRITICAL: Tag with 'remote' origin so updateHandler won't echo it back
          Y.applyUpdate(yDoc, payload, REMOTE)
          if (DEBUG) console.log(`[YJS] Applied remote update (${payload.byteLength} bytes)`)
        } else if (msgType === MSG_AWARENESS) {
          try {
            const info = JSON.parse(new TextDecoder().decode(payload)) as RemoteCursor
            if (info.clientId !== clientIdRef.current) {
              // Stamp with local receive time for stale detection
              info.lastSeen = Date.now()
              remoteCursorsRef.current.set(info.clientId, info)
              // Batch cursor updates — flush at most once per animation frame
              scheduleCursorFlush()
            }
          } catch {
            // Silently ignore malformed awareness messages
          }
        }
      }

      ws.onclose = () => {
        if (DEBUG) console.log('[YJS STATUS] disconnected')
        setConnected(false)
        wsRef.current = null
        clearInterval(heartbeatTimer)
        reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = (err) => {
        if (DEBUG) console.error('[YJS] WebSocket error:', err)
      }
    }

    connect()

    // Periodically clean up stale remote cursors (users who disconnected
    // without a clean close — their last awareness message goes stale)
    staleCleanupTimer = setInterval(() => {
      const now = Date.now()
      let removed = false
      for (const [id, cursor] of remoteCursorsRef.current) {
        if (cursor.lastSeen && now - cursor.lastSeen > STALE_TIMEOUT_MS) {
          remoteCursorsRef.current.delete(id)
          removed = true
          if (DEBUG) console.log('[YJS] Removed stale cursor:', cursor.name)
        }
      }
      if (removed) scheduleCursorFlush()
    }, STALE_TIMEOUT_MS / 2)

    // Observe Y.Map changes — only update the keys that changed (Map-based)
    // IMPORTANT: Read event.changes.keys eagerly (synchronously) because
    // Yjs invalidates event data after the observer returns. React's
    // setObjectMap callback may fire asynchronously, so we must capture
    // the changes before passing them into the state updater.
    const observer = (event: Y.YMapEvent<BoardObject>) => {
      const changes: Array<[string, { action: 'add' | 'update' | 'delete' }]> = []
      for (const [key, change] of event.changes.keys) {
        changes.push([key, { action: change.action as 'add' | 'update' | 'delete' }])
      }

      // Snapshot current values for added/updated keys (also must be read synchronously)
      const snapshots = new Map<string, BoardObject>()
      for (const [key, change] of changes) {
        if (change.action !== 'delete') {
          const val = yMap.get(key)
          if (val) snapshots.set(key, val)
        }
      }

      setObjectMap((prev) => {
        const next = new Map(prev)
        for (const [key, change] of changes) {
          if (change.action === 'delete') {
            next.delete(key)
          } else {
            const val = snapshots.get(key)
            if (val) next.set(key, val)
          }
        }
        if (DEBUG) console.log('[YJS OBSERVE] Objects count:', next.size)
        return next
      })
    }
    yMap.observe(observer)

    // Set initial objects from server state
    const initial = new Map<string, BoardObject>()
    for (const [key, val] of yMap.entries()) {
      initial.set(key, val)
    }
    setObjectMap(initial)

    // Broadcast LOCAL mutations to the server (skip remote-origin updates)
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === REMOTE) return
      const currentWs = wsRef.current
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return

      const msg = new Uint8Array(1 + update.length)
      msg[0] = MSG_YJS
      msg.set(update, 1)
      currentWs.send(msg)
      if (DEBUG) console.log(`[YJS] Sent local update (${update.byteLength} bytes)`)
    }
    yDoc.on('update', updateHandler)

    return () => {
      if (DEBUG) console.log('[YJS] Disconnecting from room:', roomId)
      clearTimeout(reconnectTimer)
      clearInterval(heartbeatTimer)
      clearInterval(staleCleanupTimer)
      if (cursorRafRef.current) cancelAnimationFrame(cursorRafRef.current)
      yMap.unobserve(observer)
      yDoc.off('update', updateHandler)
      ws?.close()
      yDoc.destroy()
      yDocRef.current = null
      yMapRef.current = null
      wsRef.current = null
    }
  }, [roomId, userName, userColor])

  // ---- CRUD operations (mutate Y.Map → auto-synced) ----------------------

  const createObject = useCallback((obj: BoardObject) => {
    if (!yMapRef.current) return
    if (DEBUG) console.log('[YJS CREATE]', obj.id, obj.type)
    yMapRef.current.set(obj.id, obj)
  }, [])

  const updateObject = useCallback((id: string, updates: Partial<BoardObject>) => {
    if (!yMapRef.current) return
    const existing = yMapRef.current.get(id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    yMapRef.current.set(id, updated)
  }, [])

  const deleteObject = useCallback((id: string) => {
    if (!yMapRef.current) return
    if (DEBUG) console.log('[YJS DELETE]', id)
    yMapRef.current.delete(id)
  }, [])

  // ---- Cursor awareness (throttled to 50ms) --------------------------------

  const throttledSend = useMemo(
    () =>
      throttle((x: number, y: number) => {
        const ws = wsRef.current
        if (!ws || ws.readyState !== WebSocket.OPEN) return
        lastCursorRef.current = { x, y }
        sendAwareness(ws, clientIdRef.current, userName, userColor, { x, y })
      }, CURSOR_THROTTLE_MS),
    [userName, userColor],
  )

  // Clean up throttle timer on unmount
  useEffect(() => () => throttledSend.cancel(), [throttledSend])

  const setCursor = useCallback(
    (x: number, y: number) => {
      throttledSend(x, y)
    },
    [throttledSend],
  )

  return { objects, objectMap, remoteCursors, connected, createObject, updateObject, deleteObject, setCursor }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode and send an awareness message (cursor + user info). */
function sendAwareness(
  ws: WebSocket,
  clientId: string,
  name: string,
  color: string,
  cursor: { x: number; y: number } | null,
) {
  const payload = JSON.stringify({ clientId, name, color, cursor })
  const encoded = new TextEncoder().encode(payload)
  const msg = new Uint8Array(1 + encoded.length)
  msg[0] = MSG_AWARENESS
  msg.set(encoded, 1)
  ws.send(msg)
}

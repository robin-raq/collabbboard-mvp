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
 * Wire protocol (binary):
 *   byte[0]  = message type (0 = Yjs update, 1 = awareness)
 *   byte[1:] = payload (Yjs binary update OR UTF-8 JSON)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import type { BoardObject } from './types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:1234'
const MSG_YJS = 0       // Yjs document update
const MSG_AWARENESS = 1 // Cursor / presence info

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RemoteCursor {
  clientId: string
  cursor: { x: number; y: number } | null
  name: string
  color: string
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useYjs(roomId: string, userName: string, userColor: string) {
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const [connected, setConnected] = useState(false)

  const yDocRef = useRef<Y.Doc | null>(null)
  const yMapRef = useRef<Y.Map<BoardObject> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef(crypto.randomUUID())
  const remoteCursorsRef = useRef<Map<string, RemoteCursor>>(new Map())

  // ---- WebSocket + Yjs sync lifecycle ------------------------------------

  useEffect(() => {
    const yDoc = new Y.Doc()
    const yMap = yDoc.getMap<BoardObject>('objects')
    yDocRef.current = yDoc
    yMapRef.current = yMap

    const wsUrl = `${WS_URL}/${roomId}`
    console.log('[YJS] Connecting to', wsUrl)

    let ws: WebSocket
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      ws = new WebSocket(wsUrl)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[YJS STATUS] connected')
        setConnected(true)
        sendAwareness(ws, clientIdRef.current, userName, userColor, null)
      }

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data)
          if (data.length < 2) return

          const msgType = data[0]
          const payload = data.slice(1)

          if (msgType === MSG_YJS) {
            Y.applyUpdate(yDoc, payload)
            console.log(`[YJS] Applied remote update (${payload.byteLength} bytes)`)
          } else if (msgType === MSG_AWARENESS) {
            const info = JSON.parse(new TextDecoder().decode(payload)) as RemoteCursor
            if (info.clientId !== clientIdRef.current) {
              remoteCursorsRef.current.set(info.clientId, info)
              setRemoteCursors(Array.from(remoteCursorsRef.current.values()))
              console.log('[AWARENESS] Remote users:', remoteCursorsRef.current.size)
            }
          }
        } catch {
          // Fallback: the server sends initial state without a type prefix
          try {
            Y.applyUpdate(yDoc, new Uint8Array(event.data))
            console.log('[YJS SYNC] Applied initial state')
          } catch (err) {
            console.error('[YJS] Failed to process message:', err)
          }
        }
      }

      ws.onclose = () => {
        console.log('[YJS STATUS] disconnected')
        setConnected(false)
        wsRef.current = null
        reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = (err) => console.error('[YJS] WebSocket error:', err)
    }

    connect()

    // Observe Y.Map → update React state
    const observer = (event: Y.YMapEvent<BoardObject>) => {
      console.log('[YJS OBSERVE] Changes received:', event.changes.keys.size)
      event.changes.keys.forEach((change, key) => {
        console.log(`  ${key}: ${change.action}`, yMap.get(key))
      })
      setObjects(Array.from(yMap.values()))
    }
    yMap.observe(observer)

    // Broadcast local mutations to the server
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return
      const currentWs = wsRef.current
      if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return

      const msg = new Uint8Array(1 + update.length)
      msg[0] = MSG_YJS
      msg.set(update, 1)
      currentWs.send(msg)
      console.log(`[YJS] Sent update (${update.byteLength} bytes)`)
    }
    yDoc.on('update', updateHandler)

    return () => {
      console.log('[YJS] Disconnecting from room:', roomId)
      clearTimeout(reconnectTimer)
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
    console.log('[YJS CREATE]', obj.id, obj.type, { x: obj.x, y: obj.y })
    yMapRef.current.set(obj.id, obj)
  }, [])

  const updateObject = useCallback((id: string, updates: Partial<BoardObject>) => {
    if (!yMapRef.current) return
    const existing = yMapRef.current.get(id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    console.log('[YJS UPDATE]', id, 'BEFORE:', existing, 'AFTER:', updated)
    yMapRef.current.set(id, updated)
  }, [])

  const deleteObject = useCallback((id: string) => {
    if (!yMapRef.current) return
    console.log('[YJS DELETE]', id)
    yMapRef.current.delete(id)
  }, [])

  // ---- Cursor awareness ---------------------------------------------------

  const setCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    sendAwareness(ws, clientIdRef.current, userName, userColor, { x, y })
  }, [userName, userColor])

  return { objects, remoteCursors, connected, createObject, updateObject, deleteObject, setCursor }
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

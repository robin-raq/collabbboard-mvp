import { useEffect, useState, useCallback, useRef } from 'react'
import * as Y from 'yjs'
import type { BoardObject } from './types'

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:1234'

// Message types: 0 = yjs update, 1 = awareness
const MSG_YJS = 0
const MSG_AWARENESS = 1

export interface RemoteCursor {
  clientId: string
  cursor: { x: number; y: number } | null
  name: string
  color: string
}

export function useYjs(roomId: string, userName: string, userColor: string) {
  const [objects, setObjects] = useState<BoardObject[]>([])
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([])
  const [connected, setConnected] = useState(false)

  const yDocRef = useRef<Y.Doc | null>(null)
  const yMapRef = useRef<Y.Map<BoardObject> | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef(crypto.randomUUID())
  const remoteCursorsRef = useRef<Map<string, RemoteCursor>>(new Map())

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
        // Send our awareness info
        sendAwareness(ws, clientIdRef.current, userName, userColor, null)
      }

      ws.onmessage = (event) => {
        try {
          const data = new Uint8Array(event.data)

          if (data.length < 2) return

          const msgType = data[0]
          const payload = data.slice(1)

          if (msgType === MSG_YJS) {
            // Yjs document update
            Y.applyUpdate(yDoc, payload)
            console.log(`[YJS] Applied remote update (${payload.byteLength} bytes)`)
          } else if (msgType === MSG_AWARENESS) {
            // Awareness / cursor update from another client
            const text = new TextDecoder().decode(payload)
            const info = JSON.parse(text) as RemoteCursor
            if (info.clientId !== clientIdRef.current) {
              remoteCursorsRef.current.set(info.clientId, info)
              setRemoteCursors(Array.from(remoteCursorsRef.current.values()))
              console.log('[AWARENESS] Remote users:', remoteCursorsRef.current.size)
            }
          }
        } catch (err) {
          // Could be initial raw Yjs state (no prefix byte) from server
          try {
            const data = new Uint8Array(event.data)
            Y.applyUpdate(yDoc, data)
            console.log('[YJS SYNC] Applied initial state')
          } catch {
            console.error('[YJS] Failed to process message:', err)
          }
        }
      }

      ws.onclose = () => {
        console.log('[YJS STATUS] disconnected')
        setConnected(false)
        wsRef.current = null
        // Reconnect after 1s
        reconnectTimer = setTimeout(connect, 1000)
      }

      ws.onerror = (err) => {
        console.error('[YJS] WebSocket error:', err)
      }
    }

    connect()

    // Observe Y.Map changes and update React state
    const observer = (event: Y.YMapEvent<BoardObject>) => {
      console.log('[YJS OBSERVE] Changes received:', event.changes.keys.size)
      event.changes.keys.forEach((change, key) => {
        console.log(`  ${key}: ${change.action}`, yMap.get(key))
      })
      setObjects(Array.from(yMap.values()))
    }
    yMap.observe(observer)

    // Send Yjs updates to server when local doc changes
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote') return // Don't echo back remote updates
      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return

      const msg = new Uint8Array(1 + update.length)
      msg[0] = MSG_YJS
      msg.set(update, 1)
      ws.send(msg)
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

  const createObject = useCallback((obj: BoardObject) => {
    const yMap = yMapRef.current
    if (!yMap) return
    console.log('[YJS CREATE]', obj.id, obj.type, { x: obj.x, y: obj.y })
    yMap.set(obj.id, obj)
  }, [])

  const updateObject = useCallback((id: string, updates: Partial<BoardObject>) => {
    const yMap = yMapRef.current
    if (!yMap) return
    const existing = yMap.get(id)
    if (!existing) return
    const updated = { ...existing, ...updates }
    console.log('[YJS UPDATE]', id, 'BEFORE:', existing, 'AFTER:', updated)
    yMap.set(id, updated)
  }, [])

  const deleteObject = useCallback((id: string) => {
    const yMap = yMapRef.current
    if (!yMap) return
    console.log('[YJS DELETE]', id)
    yMap.delete(id)
  }, [])

  const setCursor = useCallback((x: number, y: number) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    sendAwareness(ws, clientIdRef.current, userName, userColor, { x, y })
  }, [userName, userColor])

  return {
    objects,
    remoteCursors,
    connected,
    createObject,
    updateObject,
    deleteObject,
    setCursor,
  }
}

function sendAwareness(
  ws: WebSocket,
  clientId: string,
  name: string,
  color: string,
  cursor: { x: number; y: number } | null
) {
  const payload = JSON.stringify({ clientId, name, color, cursor })
  const encoded = new TextEncoder().encode(payload)
  const msg = new Uint8Array(1 + encoded.length)
  msg[0] = MSG_AWARENESS
  msg.set(encoded, 1)
  ws.send(msg)
}

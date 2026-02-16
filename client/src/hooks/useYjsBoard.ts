import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { createYjsConnection } from '../lib/yjs'
import type { BoardObject } from '../../../shared/types'

interface UseYjsBoardReturn {
  doc: Y.Doc | null
  objects: Map<string, BoardObject>
  connected: boolean
  undoManager: Y.UndoManager | null
  undo: () => void
  redo: () => void
}

export function useYjsBoard(boardId: string | undefined, token: string | null): UseYjsBoardReturn {
  const [objects, setObjects] = useState<Map<string, BoardObject>>(new Map())
  const [connected, setConnected] = useState(false)
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<ReturnType<typeof createYjsConnection>['provider'] | null>(null)
  const undoRef = useRef<Y.UndoManager | null>(null)

  useEffect(() => {
    if (!boardId || !token) return

    const { doc, provider, undoManager } = createYjsConnection(boardId, token)
    docRef.current = doc
    providerRef.current = provider
    undoRef.current = undoManager

    const objectsMap = doc.getMap<BoardObject>('objects')

    // Sync initial state + observe changes
    const updateObjects = () => {
      const next = new Map<string, BoardObject>()
      objectsMap.forEach((val, key) => {
        next.set(key, val)
      })
      setObjects(next)
    }

    objectsMap.observe(updateObjects)
    updateObjects()

    provider.on('status', ({ status }: { status: string }) => {
      setConnected(status === 'connected')
    })

    return () => {
      objectsMap.unobserve(updateObjects)
      provider.disconnect()
      doc.destroy()
      docRef.current = null
      providerRef.current = null
      undoRef.current = null
    }
  }, [boardId, token])

  const undo = useCallback(() => undoRef.current?.undo(), [])
  const redo = useCallback(() => undoRef.current?.redo(), [])

  return {
    doc: docRef.current,
    objects,
    connected,
    undoManager: undoRef.current,
    undo,
    redo,
  }
}

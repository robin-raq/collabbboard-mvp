import { useStorage, useOthers, useMutation, useMyPresence } from '@liveblocks/react'
import { useEffect } from 'react'
import type { BoardObject } from '../../../shared/types'

interface RemoteUser {
  userId: string
  userName: string
  userColor: string
  cursor?: { x: number; y: number }
}

interface UseLiveboardsReturn {
  objects: Map<string, BoardObject>
  remoteUsers: RemoteUser[]
  createObject: (params: Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number }, userId: string) => void
  updateObject: (id: string, fields: Partial<BoardObject>) => void
  deleteObject: (id: string) => void
  setCursor: (x: number, y: number) => void
}

export function useLiveblocks(userId: string): UseLiveboardsReturn {
  const objectsStorage = useStorage((root) => {
    const objects = root.objects
    return objects instanceof Map ? objects : new Map()
  })
  const othersPresence = useOthers()
  const [_myPresence, updateMyPresence] = useMyPresence()

  const createObjectMutation = useMutation(
    ({ storage }, params: Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number }, creatorId: string) => {
      const objects = storage.get('objects')
      if (!(objects instanceof Map)) return

      const id = crypto.randomUUID()
      const obj: BoardObject = {
        id,
        type: params.type,
        x: params.x,
        y: params.y,
        width: params.width ?? (params.type === 'sticky' ? 200 : 100),
        height: params.height ?? (params.type === 'sticky' ? 200 : 100),
        text: params.text,
        fill: params.fill ?? (params.type === 'sticky' ? '#FBBF24' : '#3B82F6'),
        stroke: params.stroke ?? '#000000',
        strokeWidth: params.strokeWidth ?? 1,
        points: params.points,
        fontSize: params.fontSize,
        zIndex: objects.size,
        createdBy: creatorId,
        createdAt: Date.now(),
      }

      objects.set(id, obj)
    },
    []
  )

  const updateObjectMutation = useMutation(
    ({ storage }, id: string, fields: Partial<BoardObject>) => {
      const objects = storage.get('objects')
      if (!(objects instanceof Map)) return

      const obj = objects.get(id)
      if (!obj) return

      Object.assign(obj, fields)
    },
    []
  )

  const deleteObjectMutation = useMutation(
    ({ storage }, id: string) => {
      const objects = storage.get('objects')
      if (!(objects instanceof Map)) return
      objects.delete(id)
    },
    []
  )

  const setCursorMutation = useMutation(
    ({ setMyPresence }, x: number, y: number) => {
      setMyPresence({ cursor: { x, y }, userId, userName: 'User', userColor: '#3B82F6' })
    },
    [userId]
  )

  // Initialize presence with user info when component mounts
  useEffect(() => {
    if (userId && userId !== 'anonymous') {
      updateMyPresence({
        userId,
        userName: 'User',
        userColor: '#3B82F6',
      })
    }
  }, [userId, updateMyPresence])

  const objects = objectsStorage ?? new Map()

  const remoteUsers: RemoteUser[] = othersPresence.map((other) => {
    const presence = other.presence as Record<string, unknown> | null
    return {
      userId: (presence?.userId as string) ?? other.connectionId,
      userName: (presence?.userName as string) ?? 'Anonymous',
      userColor: (presence?.userColor as string) ?? '#3B82F6',
      cursor: (presence?.cursor as { x: number; y: number } | undefined) ?? undefined,
    }
  })

  return {
    objects,
    remoteUsers,
    createObject: (params, userId) => createObjectMutation(params, userId),
    updateObject: updateObjectMutation,
    deleteObject: deleteObjectMutation,
    setCursor: setCursorMutation,
  }
}

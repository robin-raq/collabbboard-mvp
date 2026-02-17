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
  objects: Record<string, BoardObject>
  remoteUsers: RemoteUser[]
  createObject: (params: Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number }, userId: string) => void
  updateObject: (id: string, fields: Partial<BoardObject>) => void
  deleteObject: (id: string) => void
  setCursor: (x: number, y: number) => void
}

interface UseLiveblocksDeps {
  userId: string
  userName: string
  userColor: string
}

export function useLiveblocks(deps: UseLiveblocksDeps | string): UseLiveboardsReturn {
  // Support both old (string) and new (object) parameter formats
  const { userId, userName, userColor } =
    typeof deps === 'string'
      ? { userId: deps, userName: 'User', userColor: '#3B82F6' }
      : deps

  const objectsStorage = useStorage((root) => {
    const objects = root.objects as Record<string, BoardObject> | undefined
    return objects || {}
  })
  const othersPresence = useOthers()
  const [_myPresence, updateMyPresence] = useMyPresence()

  const createObjectMutation = useMutation(
    ({ storage }, params: Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number }, creatorId: string) => {
      const objects = storage.get('objects') as unknown as Record<string, BoardObject>
      if (!objects) return

      const id = crypto.randomUUID()
      const objectCount = Object.keys(objects).length
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
        zIndex: objectCount,
        createdBy: creatorId,
        createdAt: Date.now(),
      }

      objects[id] = obj
    },
    []
  )

  const updateObjectMutation = useMutation(
    ({ storage }, id: string, fields: Partial<BoardObject>) => {
      const objects = storage.get('objects') as unknown as Record<string, BoardObject>
      if (!objects || !objects[id]) return

      Object.assign(objects[id], fields)
    },
    []
  )

  const deleteObjectMutation = useMutation(
    ({ storage }, id: string) => {
      const objects = storage.get('objects') as unknown as Record<string, BoardObject>
      if (!objects) return
      delete objects[id]
    },
    []
  )

  const setCursorMutation = useMutation(
    ({ setMyPresence }, x: number, y: number) => {
      setMyPresence({ cursor: { x, y }, userId, userName, userColor })
    },
    [userId, userName, userColor]
  )

  // Initialize presence with authenticated user info
  useEffect(() => {
    updateMyPresence({
      userId,
      userName,
      userColor,
    })
  }, [userId, userName, userColor, updateMyPresence])

  const objects = objectsStorage ?? {}

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

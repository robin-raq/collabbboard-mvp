import * as Y from 'yjs'
import type { BoardObject, BoardObjectType } from '../../../shared/types'

/**
 * Create a new board object in the Yjs doc.
 */
export function createObject(
  doc: Y.Doc,
  params: {
    type: BoardObjectType
    x: number
    y: number
    width?: number
    height?: number
    text?: string
    fill?: string
    stroke?: string
    points?: number[]
  },
  userId: string
): BoardObject {
  const objects = doc.getMap('objects')
  const id = crypto.randomUUID()

  const defaults: Record<BoardObjectType, { width: number; height: number; fill: string }> = {
    sticky: { width: 200, height: 200, fill: '#FBBF24' },
    rect: { width: 150, height: 100, fill: '#3B82F6' },
    circle: { width: 100, height: 100, fill: '#10B981' },
    line: { width: 0, height: 0, fill: 'transparent' },
    text: { width: 200, height: 40, fill: 'transparent' },
  }

  const d = defaults[params.type]

  const obj: BoardObject = {
    id,
    type: params.type,
    x: params.x,
    y: params.y,
    width: params.width ?? d.width,
    height: params.height ?? d.height,
    text: params.text ?? (params.type === 'sticky' ? '' : undefined),
    fill: params.fill ?? d.fill,
    stroke: params.stroke ?? '#1E293B',
    strokeWidth: 1,
    points: params.points,
    zIndex: objects.size,
    createdBy: userId,
    createdAt: Date.now(),
  }

  doc.transact(() => {
    objects.set(id, obj)
  })

  return obj
}

/**
 * Update an existing object's properties.
 */
export function updateObject(
  doc: Y.Doc,
  id: string,
  fields: Partial<BoardObject>
): void {
  const objects = doc.getMap('objects')
  const existing = objects.get(id) as BoardObject | undefined
  if (!existing) return

  doc.transact(() => {
    objects.set(id, { ...existing, ...fields, id })
  })
}

/**
 * Delete an object from the board.
 */
export function deleteObject(doc: Y.Doc, id: string): void {
  const objects = doc.getMap('objects')
  doc.transact(() => {
    objects.delete(id)
  })
}

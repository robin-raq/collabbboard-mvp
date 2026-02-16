import * as Y from 'yjs'
import type { BoardObject } from '../../../shared/types.js'

/**
 * Apply AI agent tool calls to a Y.Doc server-side.
 * Changes propagate to all clients via y-websocket broadcast.
 */

export function createObject(
  doc: Y.Doc,
  params: Partial<BoardObject> & { type: BoardObject['type']; x: number; y: number },
  userId: string
): BoardObject {
  const objects = doc.getMap<BoardObject>('objects')
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
    createdBy: userId,
    createdAt: Date.now(),
  }

  doc.transact(() => {
    objects.set(id, obj)
  })

  return obj
}

export function updateObject(
  doc: Y.Doc,
  id: string,
  fields: Partial<BoardObject>
): void {
  const objects = doc.getMap<BoardObject>('objects')
  const existing = objects.get(id)
  if (!existing) throw new Error(`Object ${id} not found`)

  doc.transact(() => {
    objects.set(id, { ...existing, ...fields, id })
  })
}

export function deleteObject(doc: Y.Doc, id: string): void {
  const objects = doc.getMap<BoardObject>('objects')
  if (!objects.has(id)) throw new Error(`Object ${id} not found`)

  doc.transact(() => {
    objects.delete(id)
  })
}

export function clearBoard(doc: Y.Doc): void {
  const objects = doc.getMap<BoardObject>('objects')

  doc.transact(() => {
    for (const key of objects.keys()) {
      objects.delete(key)
    }
  })
}

export function queryBoard(
  doc: Y.Doc,
  filter?: { type?: string; text?: string }
): BoardObject[] {
  const objects = doc.getMap<BoardObject>('objects')
  const results: BoardObject[] = []

  for (const [, obj] of objects) {
    if (filter?.type && obj.type !== filter.type) continue
    if (filter?.text && !obj.text?.toLowerCase().includes(filter.text.toLowerCase())) continue
    results.push(obj)
  }

  return results
}

export function getBoardSnapshot(doc: Y.Doc): BoardObject[] {
  const objects = doc.getMap<BoardObject>('objects')
  return Array.from(objects.values())
}

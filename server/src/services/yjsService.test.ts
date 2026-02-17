import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { createObject, updateObject, deleteObject, clearBoard, getBoardSnapshot } from './yjsService'
import type { BoardObject } from '../../../shared/types'

describe('yjsService', () => {
  let doc: Y.Doc

  beforeEach(() => {
    doc = new Y.Doc()
  })

  describe('createObject', () => {
    it('creates and stores an object', () => {
      const obj = createObject(doc, { type: 'sticky', x: 100, y: 200 }, 'user-1')

      expect(obj.id).toBeDefined()
      expect(obj.type).toBe('sticky')
      expect(obj.x).toBe(100)
      expect(obj.y).toBe(200)
      expect(obj.createdBy).toBe('user-1')

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.get(obj.id)).toBeDefined()
    })
  })

  describe('updateObject', () => {
    it('updates object fields', () => {
      const obj = createObject(doc, { type: 'rect', x: 0, y: 0 }, 'user-1')

      updateObject(doc, obj.id, { x: 150, y: 250, fill: '#FF0000' })

      const objects = doc.getMap<BoardObject>('objects')
      const updated = objects.get(obj.id)

      expect(updated?.x).toBe(150)
      expect(updated?.y).toBe(250)
      expect(updated?.fill).toBe('#FF0000')
      expect(updated?.type).toBe('rect')
    })
  })

  describe('deleteObject', () => {
    it('removes object from doc', () => {
      const obj = createObject(doc, { type: 'circle', x: 0, y: 0 }, 'user-1')

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.size).toBe(1)

      deleteObject(doc, obj.id)

      expect(objects.size).toBe(0)
    })
  })

  describe('clearBoard', () => {
    it('removes all objects', () => {
      createObject(doc, { type: 'sticky', x: 0, y: 0 }, 'user-1')
      createObject(doc, { type: 'rect', x: 100, y: 100 }, 'user-1')
      createObject(doc, { type: 'circle', x: 200, y: 200 }, 'user-1')

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.size).toBe(3)

      clearBoard(doc)

      expect(objects.size).toBe(0)
    })
  })

  describe('getBoardSnapshot', () => {
    it('returns array of all objects', () => {
      const obj1 = createObject(doc, { type: 'sticky', x: 0, y: 0, text: 'Note 1' }, 'user-1')
      const obj2 = createObject(doc, { type: 'rect', x: 100, y: 100 }, 'user-1')

      const snapshot = getBoardSnapshot(doc)

      expect(snapshot).toHaveLength(2)
      expect(snapshot).toContainEqual(expect.objectContaining({ id: obj1.id, text: 'Note 1' }))
      expect(snapshot).toContainEqual(expect.objectContaining({ id: obj2.id, type: 'rect' }))
    })

    it('returns empty array for empty board', () => {
      const snapshot = getBoardSnapshot(doc)
      expect(snapshot).toEqual([])
    })
  })
})

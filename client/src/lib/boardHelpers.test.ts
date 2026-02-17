import { describe, it, expect, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { createObject, updateObject, deleteObject } from './boardHelpers'
import type { BoardObject } from '../../../shared/types'

describe('boardHelpers', () => {
  let doc: Y.Doc

  beforeEach(() => {
    doc = new Y.Doc()
  })

  describe('createObject', () => {
    it('creates a sticky note with default dimensions', () => {
      const obj = createObject(
        doc,
        { type: 'sticky', x: 100, y: 200 },
        'user-1'
      )

      expect(obj.type).toBe('sticky')
      expect(obj.x).toBe(100)
      expect(obj.y).toBe(200)
      expect(obj.width).toBe(200) // default width for sticky
      expect(obj.height).toBe(200) // default height for sticky
      expect(obj.fill).toBe('#FBBF24') // yellow
      expect(obj.createdBy).toBe('user-1')
      expect(obj.createdAt).toBeGreaterThan(0)
    })

    it('creates a rectangle with custom fill', () => {
      const obj = createObject(
        doc,
        { type: 'rect', x: 50, y: 50, fill: '#FF0000' },
        'user-1'
      )

      expect(obj.type).toBe('rect')
      expect(obj.fill).toBe('#FF0000')
      expect(obj.width).toBe(150) // default width for rect
    })

    it('stores object in Yjs doc', () => {
      const obj = createObject(
        doc,
        { type: 'circle', x: 300, y: 300 },
        'user-1'
      )

      const objects = doc.getMap<BoardObject>('objects')
      const stored = objects.get(obj.id)

      expect(stored).toBeDefined()
      expect(stored?.type).toBe('circle')
      expect(stored?.x).toBe(300)
    })
  })

  describe('updateObject', () => {
    it('updates object position', () => {
      const obj = createObject(
        doc,
        { type: 'sticky', x: 100, y: 100 },
        'user-1'
      )

      updateObject(doc, obj.id, { x: 200, y: 300 })

      const objects = doc.getMap<BoardObject>('objects')
      const updated = objects.get(obj.id)

      expect(updated?.x).toBe(200)
      expect(updated?.y).toBe(300)
      expect(updated?.type).toBe('sticky') // unchanged
    })

    it('updates object text', () => {
      const obj = createObject(
        doc,
        { type: 'sticky', x: 0, y: 0, text: 'Old' },
        'user-1'
      )

      updateObject(doc, obj.id, { text: 'New text' })

      const objects = doc.getMap<BoardObject>('objects')
      const updated = objects.get(obj.id)

      expect(updated?.text).toBe('New text')
    })

    it('ignores nonexistent object', () => {
      // Should not throw
      updateObject(doc, 'nonexistent-id', { x: 500, y: 500 })

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.size).toBe(0)
    })
  })

  describe('deleteObject', () => {
    it('removes object from doc', () => {
      const obj = createObject(
        doc,
        { type: 'rect', x: 0, y: 0 },
        'user-1'
      )

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.has(obj.id)).toBe(true)

      deleteObject(doc, obj.id)

      expect(objects.has(obj.id)).toBe(false)
    })

    it('ignores nonexistent object', () => {
      // Should not throw
      deleteObject(doc, 'nonexistent-id')

      const objects = doc.getMap<BoardObject>('objects')
      expect(objects.size).toBe(0)
    })
  })
})

/**
 * BoardShape Memo Optimization Tests
 *
 * Verifies that BoardShape uses memo-friendly primitive props instead of
 * reference types (Set, objects) that defeat React.memo's shallow comparison.
 *
 * The key optimization:
 *   - `selectedIds: Set<string>` → `isMultiSelected: boolean`
 *   - `stagePos: { x: number; y: number }` → `stagePosX: number; stagePosY: number`
 *
 * Primitives (boolean, number) survive shallow comparison, preventing
 * all 500 shapes from re-rendering on every click/pan.
 */

import { describe, it, expect } from 'vitest'
import * as ts from 'typescript'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Parse the Props interface from BoardShape.tsx and extract property names + types.
 * This is a structural test that verifies the interface shape at the source level.
 */
function parseBoardShapeProps(): Map<string, string> {
  const filePath = resolve(__dirname, '../BoardShape.tsx')
  const source = readFileSync(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile('BoardShape.tsx', source, ts.ScriptTarget.Latest, true)

  const props = new Map<string, string>()

  function visit(node: ts.Node) {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'Props') {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
          const name = member.name.text
          const type = member.type ? source.substring(member.type.pos, member.type.end).trim() : 'unknown'
          props.set(name, type)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return props
}

describe('BoardShape memo optimization', () => {
  const props = parseBoardShapeProps()

  // ---- Props that should NOT exist (reference types that defeat memo) ----

  it('should NOT have a selectedIds prop (Set defeats shallow compare)', () => {
    expect(props.has('selectedIds')).toBe(false)
  })

  it('should NOT have a stagePos object prop (object defeats shallow compare)', () => {
    expect(props.has('stagePos')).toBe(false)
  })

  // ---- Props that SHOULD exist (primitive replacements) ----

  it('should have an isMultiSelected boolean prop', () => {
    expect(props.has('isMultiSelected')).toBe(true)
    expect(props.get('isMultiSelected')).toContain('boolean')
  })

  it('should have stagePosX number prop', () => {
    expect(props.has('stagePosX')).toBe(true)
    expect(props.get('stagePosX')).toContain('number')
  })

  it('should have stagePosY number prop', () => {
    expect(props.has('stagePosY')).toBe(true)
    expect(props.get('stagePosY')).toContain('number')
  })

  // ---- Verify Board.tsx passes the correct props ----

  it('Board.tsx should pass isMultiSelected instead of selectedIds to BoardShape', () => {
    const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8')

    // Should NOT pass selectedIds={...} to BoardShape
    expect(boardSource).not.toMatch(/BoardShape[\s\S]*?selectedIds=\{/)

    // Should pass isMultiSelected={...}
    expect(boardSource).toMatch(/isMultiSelected=\{/)
  })

  it('Board.tsx should pass stagePosX and stagePosY instead of stagePos to BoardShape', () => {
    const boardSource = readFileSync(resolve(__dirname, '../Board.tsx'), 'utf-8')

    // Should NOT pass stagePos={...} to BoardShape
    // (we check specifically in the BoardShape JSX, not elsewhere)
    const boardShapeJsx = boardSource.match(/<BoardShape[\s\S]*?\/>/)?.[0] ?? ''
    expect(boardShapeJsx).not.toContain('stagePos={')

    // Should pass individual numbers
    expect(boardShapeJsx).toContain('stagePosX={')
    expect(boardShapeJsx).toContain('stagePosY={')
  })
})

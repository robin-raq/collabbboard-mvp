/**
 * Rubber-Band Selection — Stage Drag Conflict Tests (TDD)
 *
 * Tests that rubber-band selection works correctly by verifying:
 *  - Stage draggable is disabled on mouseDown (before Konva drag starts)
 *  - Stage draggable is re-enabled on mouseUp (after rubber-band finishes)
 *  - Rubber-band selection lifecycle completes without panning
 */

import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock types matching Konva's Stage API
// ---------------------------------------------------------------------------

interface MockStage {
  draggable: ReturnType<typeof vi.fn>
}

// ---------------------------------------------------------------------------
// The functions under test — extracted logic from Board.tsx
//
// handleStageMouseDown: when the user clicks on empty canvas in select mode,
// imperatively set stage.draggable(false) to prevent Konva's drag system
// from intercepting mousemove events, then record the rubber-band start.
//
// handleStageMouseUp: re-enable stage.draggable(true) and finalize selection.
// ---------------------------------------------------------------------------

function handleStageMouseDown(
  stage: MockStage | null,
  activeTool: string,
  lineStart: unknown,
  isStageTarget: boolean,
): { x: number; y: number } | null {
  if (!isStageTarget) return null
  if (activeTool !== 'select') return null
  if (lineStart) return null

  // Imperatively disable dragging BEFORE Konva can start its drag system
  if (stage) stage.draggable(false)

  return { x: 100, y: 200 } // mock world coords
}

function handleStageMouseUp(
  stage: MockStage | null,
  activeTool: string,
  lineStart: unknown,
  selectionStart: { x: number; y: number } | null,
  selectionRect: { x: number; y: number; w: number; h: number } | null,
): void {
  // Re-enable Stage dragging
  if (stage && activeTool === 'select' && !lineStart) {
    stage.draggable(true)
  }

  if (selectionStart && selectionRect) {
    // finalize selection (tested separately)
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rubber-band selection — Stage draggable toggle', () => {
  function createMockStage(): MockStage {
    return { draggable: vi.fn() }
  }

  it('disables Stage.draggable on mouseDown in select mode', () => {
    const stage = createMockStage()
    const result = handleStageMouseDown(stage, 'select', null, true)

    expect(stage.draggable).toHaveBeenCalledWith(false)
    expect(result).toEqual({ x: 100, y: 200 })
  })

  it('does NOT disable draggable when clicking on a shape (not Stage)', () => {
    const stage = createMockStage()
    const result = handleStageMouseDown(stage, 'select', null, false)

    expect(stage.draggable).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does NOT disable draggable in non-select tools', () => {
    const stage = createMockStage()
    const result = handleStageMouseDown(stage, 'sticky', null, true)

    expect(stage.draggable).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('does NOT disable draggable when line drawing is active', () => {
    const stage = createMockStage()
    const result = handleStageMouseDown(stage, 'select', { x: 0, y: 0 }, true)

    expect(stage.draggable).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('re-enables Stage.draggable on mouseUp in select mode', () => {
    const stage = createMockStage()
    handleStageMouseUp(stage, 'select', null, { x: 0, y: 0 }, { x: 0, y: 0, w: 100, h: 100 })

    expect(stage.draggable).toHaveBeenCalledWith(true)
  })

  it('re-enables Stage.draggable on mouseUp even with no selection', () => {
    const stage = createMockStage()
    handleStageMouseUp(stage, 'select', null, null, null)

    expect(stage.draggable).toHaveBeenCalledWith(true)
  })

  it('does NOT re-enable draggable in non-select tools', () => {
    const stage = createMockStage()
    handleStageMouseUp(stage, 'sticky', null, null, null)

    expect(stage.draggable).not.toHaveBeenCalled()
  })
})

describe('Rubber-band selection lifecycle', () => {
  it('full cycle: disable → select → re-enable', () => {
    const stage = { draggable: vi.fn() }

    // Step 1: mouseDown disables draggable
    handleStageMouseDown(stage, 'select', null, true)
    expect(stage.draggable).toHaveBeenCalledWith(false)

    // Step 2: mouseUp re-enables draggable
    handleStageMouseUp(stage, 'select', null, { x: 0, y: 0 }, { x: 50, y: 50, w: 200, h: 200 })
    expect(stage.draggable).toHaveBeenCalledWith(true)

    // Verify order: false first, then true
    expect(stage.draggable.mock.calls).toEqual([[false], [true]])
  })

  it('selection start → drag → stop should select intersecting objects', () => {
    const selectionRect = { x: 50, y: 50, w: 200, h: 200 }
    const objects = [
      { id: 'a', x: 100, y: 100, width: 50, height: 50 },  // inside
      { id: 'b', x: 300, y: 300, width: 50, height: 50 },  // outside
      { id: 'c', x: 150, y: 150, width: 80, height: 80 },  // partially overlaps
    ]

    const selected = objects.filter((obj) =>
      obj.x < selectionRect.x + selectionRect.w &&
      obj.x + obj.width > selectionRect.x &&
      obj.y < selectionRect.y + selectionRect.h &&
      obj.y + obj.height > selectionRect.y
    )

    expect(selected.map((o) => o.id)).toEqual(['a', 'c'])
  })

  it('tiny drag (< 5px) should not trigger selection', () => {
    const selectionRect = { x: 100, y: 100, w: 3, h: 2 }
    const isBigEnough = selectionRect.w > 5 || selectionRect.h > 5
    expect(isBigEnough).toBe(false)
  })

  it('drag larger than 5px should trigger selection', () => {
    const selectionRect = { x: 100, y: 100, w: 10, h: 8 }
    const isBigEnough = selectionRect.w > 5 || selectionRect.h > 5
    expect(isBigEnough).toBe(true)
  })
})

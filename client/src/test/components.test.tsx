/**
 * Component Tests — Toolbar, ColorPicker, PresenceBar, ZoomControls
 *
 * Verifies that extracted components render correctly and fire callbacks.
 * CursorBadge is a Konva component (canvas-based) so it's tested separately
 * via a simple import/instantiation check rather than DOM rendering.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Toolbar from '../components/Toolbar'
import ColorPicker from '../components/ColorPicker'
import PresenceBar from '../components/PresenceBar'
import ZoomControls from '../components/ZoomControls'
import { SHAPE_COLORS } from '../constants'

// ============================================================================
// Toolbar
// ============================================================================

describe('Toolbar', () => {
  const defaultProps = {
    activeTool: 'select' as const,
    onToolChange: vi.fn(),
    hasSelection: false,
    onDelete: vi.fn(),
    onColorToggle: vi.fn(),
    selectedFill: null,
  }

  it('renders all 8 tool buttons', () => {
    render(<Toolbar {...defaultProps} />)
    expect(screen.getByLabelText('Select tool')).toBeTruthy()
    expect(screen.getByLabelText('Sticky tool')).toBeTruthy()
    expect(screen.getByLabelText('Rect tool')).toBeTruthy()
    expect(screen.getByLabelText('Circle tool')).toBeTruthy()
    expect(screen.getByLabelText('Text tool')).toBeTruthy()
    expect(screen.getByLabelText('Frame tool')).toBeTruthy()
    expect(screen.getByLabelText('Line tool')).toBeTruthy()
    expect(screen.getByLabelText('Arrow tool')).toBeTruthy()
  })

  it('renders delete and color buttons', () => {
    render(<Toolbar {...defaultProps} />)
    expect(screen.getByLabelText('Delete selected objects')).toBeTruthy()
    expect(screen.getByLabelText('Change color')).toBeTruthy()
  })

  it('calls onToolChange when a tool button is clicked', () => {
    const onToolChange = vi.fn()
    render(<Toolbar {...defaultProps} onToolChange={onToolChange} />)
    fireEvent.click(screen.getByLabelText('Sticky tool'))
    expect(onToolChange).toHaveBeenCalledWith('sticky')
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(<Toolbar {...defaultProps} hasSelection={true} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Delete selected objects'))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('disables delete button when nothing is selected', () => {
    render(<Toolbar {...defaultProps} hasSelection={false} />)
    const btn = screen.getByLabelText('Delete selected objects')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('calls onColorToggle when color button is clicked', () => {
    const onColorToggle = vi.fn()
    render(<Toolbar {...defaultProps} hasSelection={true} onColorToggle={onColorToggle} />)
    fireEvent.click(screen.getByLabelText('Change color'))
    expect(onColorToggle).toHaveBeenCalledOnce()
  })

  it('disables color button when nothing is selected', () => {
    render(<Toolbar {...defaultProps} hasSelection={false} />)
    const btn = screen.getByLabelText('Change color')
    expect(btn).toHaveProperty('disabled', true)
  })

  it('highlights the active tool', () => {
    render(<Toolbar {...defaultProps} activeTool="rect" />)
    const rectBtn = screen.getByLabelText('Rect tool')
    // jsdom converts hex to rgb: #EBF5FF → rgb(235, 245, 255)
    expect(rectBtn.style.background).toContain('rgb(235, 245, 255)')
  })
})

// ============================================================================
// ColorPicker
// ============================================================================

describe('ColorPicker', () => {
  it('renders all color swatches', () => {
    const onColorChange = vi.fn()
    render(<ColorPicker currentFill="#FFEB3B" onColorChange={onColorChange} />)
    // Should render one button per SHAPE_COLORS entry
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBe(SHAPE_COLORS.length)
  })

  it('calls onColorChange with the clicked color', () => {
    const onColorChange = vi.fn()
    render(<ColorPicker currentFill="#FFEB3B" onColorChange={onColorChange} />)
    fireEvent.click(screen.getByLabelText('Set color to #42A5F5'))
    expect(onColorChange).toHaveBeenCalledWith('#42A5F5')
  })

  it('highlights the current fill color', () => {
    const onColorChange = vi.fn()
    render(<ColorPicker currentFill="#42A5F5" onColorChange={onColorChange} />)
    const activeBtn = screen.getByLabelText('Set color to #42A5F5')
    // jsdom converts hex to rgb: #2563EB → rgb(37, 99, 235)
    expect(activeBtn.style.border).toContain('rgb(37, 99, 235)')
  })

  it('does not highlight non-current colors', () => {
    const onColorChange = vi.fn()
    render(<ColorPicker currentFill="#42A5F5" onColorChange={onColorChange} />)
    const otherBtn = screen.getByLabelText('Set color to #FFEB3B')
    // jsdom converts hex to rgb: #e5e7eb → rgb(229, 231, 235)
    expect(otherBtn.style.border).toContain('rgb(229, 231, 235)')
  })
})

// ============================================================================
// PresenceBar
// ============================================================================

describe('PresenceBar', () => {
  it('shows Connected when connected', () => {
    render(
      <PresenceBar connected={true} userName="Alice" userColor="#EF4444" remoteCursors={[]} />,
    )
    expect(screen.getByText('Connected')).toBeTruthy()
  })

  it('shows Connecting... when disconnected', () => {
    render(
      <PresenceBar connected={false} userName="Alice" userColor="#EF4444" remoteCursors={[]} />,
    )
    expect(screen.getByText('Connecting...')).toBeTruthy()
  })

  it('renders local user avatar with first letter', () => {
    render(
      <PresenceBar connected={true} userName="Alice" userColor="#EF4444" remoteCursors={[]} />,
    )
    expect(screen.getByTitle('Alice (You)')).toBeTruthy()
    expect(screen.getByTitle('Alice (You)').textContent).toBe('A')
  })

  it('renders remote user avatars', () => {
    const cursors = [
      { clientId: '1', name: 'Bob', color: '#3B82F6', cursor: { x: 0, y: 0 } },
      { clientId: '2', name: 'Charlie', color: '#10B981', cursor: { x: 10, y: 10 } },
    ]
    render(
      <PresenceBar connected={true} userName="Alice" userColor="#EF4444" remoteCursors={cursors} />,
    )
    expect(screen.getByTitle('Bob')).toBeTruthy()
    expect(screen.getByTitle('Charlie')).toBeTruthy()
  })

  it('shows overflow count when more than 5 remote users', () => {
    const cursors = Array.from({ length: 7 }, (_, i) => ({
      clientId: String(i),
      name: `User${i}`,
      color: '#000',
      cursor: { x: 0, y: 0 },
    }))
    render(
      <PresenceBar connected={true} userName="Alice" userColor="#EF4444" remoteCursors={cursors} />,
    )
    expect(screen.getByText('+2')).toBeTruthy()
  })

  it('does not show overflow when 5 or fewer remote users', () => {
    const cursors = Array.from({ length: 3 }, (_, i) => ({
      clientId: String(i),
      name: `User${i}`,
      color: '#000',
      cursor: { x: 0, y: 0 },
    }))
    render(
      <PresenceBar connected={true} userName="Alice" userColor="#EF4444" remoteCursors={cursors} />,
    )
    expect(screen.queryByText(/^\+/)).toBeNull()
  })
})

// ============================================================================
// ZoomControls
// ============================================================================

describe('ZoomControls', () => {
  const defaultProps = {
    scale: 1,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onZoomReset: vi.fn(),
  }

  it('displays the current zoom percentage', () => {
    render(<ZoomControls {...defaultProps} scale={1.5} />)
    expect(screen.getByText('150%')).toBeTruthy()
  })

  it('displays 100% at default zoom', () => {
    render(<ZoomControls {...defaultProps} scale={1} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })

  it('rounds zoom percentage', () => {
    render(<ZoomControls {...defaultProps} scale={0.333} />)
    expect(screen.getByText('33%')).toBeTruthy()
  })

  it('calls onZoomIn when + is clicked', () => {
    const onZoomIn = vi.fn()
    render(<ZoomControls {...defaultProps} onZoomIn={onZoomIn} />)
    fireEvent.click(screen.getByLabelText('Zoom in'))
    expect(onZoomIn).toHaveBeenCalledOnce()
  })

  it('calls onZoomOut when - is clicked', () => {
    const onZoomOut = vi.fn()
    render(<ZoomControls {...defaultProps} onZoomOut={onZoomOut} />)
    fireEvent.click(screen.getByLabelText('Zoom out'))
    expect(onZoomOut).toHaveBeenCalledOnce()
  })

  it('calls onZoomReset when percentage is clicked', () => {
    const onZoomReset = vi.fn()
    render(<ZoomControls {...defaultProps} onZoomReset={onZoomReset} />)
    fireEvent.click(screen.getByText('100%'))
    expect(onZoomReset).toHaveBeenCalledOnce()
  })
})

// ============================================================================
// CursorBadge (Konva component — import check only)
// ============================================================================

describe('CursorBadge', () => {
  it('can be imported without errors', async () => {
    const module = await import('../components/CursorBadge')
    expect(module.default).toBeDefined()
    expect(typeof module.default).toBe('function')
  })
})

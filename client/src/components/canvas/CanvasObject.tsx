import { memo } from 'react'
import type { BoardObject } from '../../../../shared/types'
import { StickyNote } from './StickyNote'
import { ShapeRect } from './ShapeRect'
import { ShapeCircle } from './ShapeCircle'
import { BoardLine } from './BoardLine'
import { BoardText } from './BoardText'

interface CanvasObjectProps {
  object: BoardObject
  onUpdate: (fields: Partial<BoardObject>) => void
}

export const CanvasObject = memo(function CanvasObject({ object, onUpdate }: CanvasObjectProps) {
  switch (object.type) {
    case 'sticky':
      return <StickyNote object={object} onUpdate={onUpdate} />
    case 'rect':
      return <ShapeRect object={object} onUpdate={onUpdate} />
    case 'circle':
      return <ShapeCircle object={object} onUpdate={onUpdate} />
    case 'line':
      return <BoardLine object={object} onUpdate={onUpdate} />
    case 'text':
      return <BoardText object={object} onUpdate={onUpdate} />
    default:
      return null
  }
})

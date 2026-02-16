import { create } from 'zustand'
import type { BoardObjectType } from '../../../shared/types'

type ToolType = 'select' | BoardObjectType

interface UiState {
  activeTool: ToolType
  chatOpen: boolean
  selectedIds: Set<string>
  viewport: { x: number; y: number; scale: number }

  setActiveTool: (tool: ToolType) => void
  toggleChat: () => void
  setChatOpen: (open: boolean) => void
  setSelectedIds: (ids: Set<string>) => void
  addToSelection: (id: string) => void
  clearSelection: () => void
  setViewport: (viewport: { x: number; y: number; scale: number }) => void
}

export const useUiStore = create<UiState>((set) => ({
  activeTool: 'select',
  chatOpen: false,
  selectedIds: new Set(),
  viewport: { x: 0, y: 0, scale: 1 },

  setActiveTool: (tool) => set({ activeTool: tool }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),
  setChatOpen: (open) => set({ chatOpen: open }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addToSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds)
      next.add(id)
      return { selectedIds: next }
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  setViewport: (viewport) => set({ viewport }),
}))

// CollabBoard AI — Shared Types
// Used by both client and server

export type BoardObjectType = 'sticky' | 'rect' | 'circle' | 'line' | 'text'

export interface BoardObject {
  id: string                  // UUID v4
  type: BoardObjectType
  x: number                   // board-space coords
  y: number
  width?: number
  height?: number
  text?: string               // sticky notes, text objects
  fill?: string
  stroke?: string
  strokeWidth?: number
  points?: number[]           // lines only: [x1,y1,x2,y2,...]
  fontSize?: number
  zIndex: number              // render order
  createdBy: string           // user ID
  createdAt: number           // epoch ms
}

export interface AwarenessState {
  userId: string
  userName: string
  userColor: string
  cursor: { x: number; y: number } | null
  lastSeen: number            // epoch ms
}

export interface AiCommandRequest {
  message: string
  boardSnapshot: BoardObject[]
}

export interface AiCommandResponse {
  reply: string
  toolCalls: ToolCall[]
}

export interface ToolCall {
  tool: string
  params: Record<string, unknown>
}

export interface BoardMetadata {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  createdAt: string
  updatedAt: string
}

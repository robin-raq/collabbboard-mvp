export type BoardObjectType = 'sticky' | 'rect' | 'circle' | 'line' | 'text';
export interface BoardObject {
    id: string;
    type: BoardObjectType;
    x: number;
    y: number;
    width?: number;
    height?: number;
    text?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    points?: number[];
    fontSize?: number;
    zIndex: number;
    createdBy: string;
    createdAt: number;
}
export interface AwarenessState {
    userId: string;
    userName: string;
    userColor: string;
    cursor: {
        x: number;
        y: number;
    } | null;
    lastSeen: number;
}
export interface AiCommandRequest {
    message: string;
    boardSnapshot: BoardObject[];
}
export interface AiCommandResponse {
    reply: string;
    toolCalls: ToolCall[];
}
export interface ToolCall {
    tool: string;
    params: Record<string, unknown>;
}
export interface BoardMetadata {
    id: string;
    name: string;
    ownerId: string;
    inviteCode: string;
    createdAt: string;
    updatedAt: string;
}

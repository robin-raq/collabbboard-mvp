import Anthropic from '@anthropic-ai/sdk'
import type { BoardObject, ToolCall } from '../../../shared/types.js'

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null

const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'createObject',
    description: 'Create any board object at specified position',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['sticky', 'rect', 'circle', 'line', 'text'] },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        text: { type: 'string' },
        fill: { type: 'string' },
        stroke: { type: 'string' },
      },
      required: ['type', 'x', 'y'],
    },
  },
  {
    name: 'updateObject',
    description: 'Update properties of an existing object by ID',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
        width: { type: 'number' },
        height: { type: 'number' },
        text: { type: 'string' },
        fill: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Remove an object from the board',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'moveObject',
    description: 'Reposition an object (shortcut for updateObject)',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        x: { type: 'number' },
        y: { type: 'number' },
      },
      required: ['id', 'x', 'y'],
    },
  },
  {
    name: 'clearBoard',
    description: 'Delete all objects from the board',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
]

function buildSystemPrompt(boardSnapshot: BoardObject[], userName: string): string {
  return `You are an AI assistant for a collaborative whiteboard called CollabBoard.
You can manipulate the board by calling the provided tools.

Current board state:
${JSON.stringify(boardSnapshot, null, 2)}

Board dimensions: 1920 x 1080 (in board-space units).
Active user: ${userName}.

Rules:
- Always call a tool. Never respond with only text unless the user asked a question.
- For clearBoard, always confirm intent before executing.
- Prefer spatial language: "top-left" means x<300, y<300 in a 1920x1080 board.`
}

export async function processAiCommand(
  message: string,
  boardSnapshot: BoardObject[],
  userName: string
): Promise<{ reply: string; toolCalls: ToolCall[] }> {
  if (!anthropic) {
    return {
      reply: 'AI agent not configured — set ANTHROPIC_API_KEY.',
      toolCalls: [],
    }
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: buildSystemPrompt(boardSnapshot, userName),
    tools: TOOL_DEFINITIONS,
    messages: [{ role: 'user', content: message }],
  })

  const toolCalls: ToolCall[] = []
  let reply = ''

  for (const block of response.content) {
    if (block.type === 'text') {
      reply += block.text
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        tool: block.name,
        params: block.input as Record<string, unknown>,
      })
    }
  }

  return { reply, toolCalls }
}

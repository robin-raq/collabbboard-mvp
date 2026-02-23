/**
 * AI Stream Event Types for SSE (Server-Sent Events)
 *
 * Defines the event protocol between the server's streaming AI handler
 * and the client's SSE consumer. Events are sent as JSON-encoded SSE data.
 *
 * Event flow:
 *   status("thinking") → [tool_result]* → text_delta* → done
 *   status("thinking") → error  (on failure)
 *   [tool_result]* → done(cached: true)  (on cache hit, instant)
 */

import type { ToolAction } from './types.js'

/** AI processing status indicator. */
export interface AIStreamStatusEvent {
  type: 'status'
  status: 'thinking' | 'executing'
}

/** A single tool call was executed (object created/updated/moved). */
export interface AIStreamToolResultEvent {
  type: 'tool_result'
  action: ToolAction
}

/** Incremental text from Claude's response. */
export interface AIStreamTextDeltaEvent {
  type: 'text_delta'
  content: string
}

/** AI processing completed successfully. */
export interface AIStreamDoneEvent {
  type: 'done'
  message: string
  actions: ToolAction[]
  /** True when the result came from the command cache (instant, no API call). */
  cached?: boolean
}

/** AI processing failed. */
export interface AIStreamErrorEvent {
  type: 'error'
  error: string
}

/** Union type for all possible stream events. */
export type AIStreamEvent =
  | AIStreamStatusEvent
  | AIStreamToolResultEvent
  | AIStreamTextDeltaEvent
  | AIStreamDoneEvent
  | AIStreamErrorEvent

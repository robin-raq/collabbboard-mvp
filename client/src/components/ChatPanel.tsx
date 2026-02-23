/**
 * ChatPanel — AI Chat Side Panel (SSE Streaming)
 *
 * Slide-in panel from the right edge for sending AI commands.
 * Streams responses from POST /api/ai/stream via Server-Sent Events
 * so users see progress in real-time (status → tool results → done).
 *
 * Features:
 *  - Incremental action badges as tool_result events arrive
 *  - Status text updates (Thinking... → Creating objects...)
 *  - Cancel button to abort in-progress requests
 *  - "(instant)" badge for cache-hit responses
 *  - Auto-pan to created/moved objects on done
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { PRODUCTION_HOST } from '../constants'
import { extractPanTarget } from '../utils/panTarget'
import type { ToolAction } from '../../../shared/types'
import type { AIStreamEvent } from '../../../shared/aiStreamTypes'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ToolAction[]
  cached?: boolean
}

interface ChatPanelProps {
  boardId: string
  onClose: () => void
  onPanTo?: (x: number, y: number) => void
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Derive the API URL:
 * 1. Explicit env var wins (VITE_API_URL)
 * 2. Auto-detect production from window.location
 * 3. Fallback to localhost for dev
 */
function getApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
    return `https://${PRODUCTION_HOST}`
  }
  return 'http://localhost:1234'
}

const API_URL = getApiUrl()

// ---------------------------------------------------------------------------
// SSE Stream Consumer
// ---------------------------------------------------------------------------

/**
 * Parse SSE events from a streaming Response body.
 * Calls `onEvent` for each parsed AIStreamEvent.
 */
async function consumeSSEStream(
  response: Response,
  onEvent: (event: AIStreamEvent) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Response body is not readable')

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete SSE lines (data: {...}\n\n)
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? '' // Keep incomplete last line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6)) as AIStreamEvent
            onEvent(event)
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    // Process any remaining data in buffer
    if (buffer.startsWith('data: ')) {
      try {
        const event = JSON.parse(buffer.slice(6)) as AIStreamEvent
        onEvent(event)
      } catch {
        // Skip malformed
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChatPanel({ boardId, onClose, onPanTo }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I can help you work with the board. Try commands like:\n\n\u2022 "Add a yellow sticky note that says User Research"\n\u2022 "Create a blue rectangle at position 100, 200"\n\u2022 "Create a 2x3 grid of sticky notes for pros and cons"\n\u2022 "Set up a retrospective board"',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamStatus, setStreamStatus] = useState<string>('')
  const [streamActions, setStreamActions] = useState<ToolAction[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamActions, streamStatus])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setStreamStatus('Thinking...')
    setStreamActions([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${API_URL}/api/ai/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, boardId }),
        signal: controller.signal,
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      // Collect streamed events
      const collectedActions: ToolAction[] = []
      let finalMessage = ''
      let isCached = false

      await consumeSSEStream(res, (event) => {
        switch (event.type) {
          case 'status':
            setStreamStatus(event.status === 'thinking' ? 'Thinking...' : 'Creating objects...')
            break

          case 'tool_result':
            collectedActions.push(event.action)
            setStreamActions([...collectedActions])
            setStreamStatus('Creating objects...')
            break

          case 'text_delta':
            // Accumulate response text
            finalMessage += event.content
            break

          case 'done':
            finalMessage = event.message || finalMessage || 'Done!'
            isCached = !!event.cached
            // Use actions from done event if present, otherwise collected tool_results
            if (event.actions?.length) {
              collectedActions.push(...event.actions.filter(
                (a) => !collectedActions.some((c) => c.result === a.result)
              ))
            }
            break

          case 'error':
            throw new Error(event.error)
        }
      })

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: finalMessage,
        actions: collectedActions,
        cached: isCached,
      }

      setMessages((prev) => [...prev, assistantMsg])

      // Auto-pan viewport to where AI created/moved objects
      const target = extractPanTarget(collectedActions)
      if (target && onPanTo) onPanTo(target.x, target.y)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User cancelled — add a cancelled message
        const cancelMsg: Message = {
          id: `cancel-${Date.now()}`,
          role: 'assistant',
          content: 'Request cancelled.',
        }
        setMessages((prev) => [...prev, cancelMsg])
      } else {
        const errorMsg: Message = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } finally {
      setLoading(false)
      setStreamStatus('')
      setStreamActions([])
      abortRef.current = null
    }
  }, [input, loading, boardId, onPanTo])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>AI Assistant</span>
        <button onClick={onClose} style={closeBtnStyle} title="Close" aria-label="Close AI Assistant">
          &times;
        </button>
      </div>

      {/* Messages */}
      <div style={messagesContainerStyle} role="log" aria-live="polite" aria-label="Chat messages">
        {messages.map((msg) => (
          <div key={msg.id} style={msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
              {msg.content}
            </div>
            {msg.cached && (
              <span style={instantBadgeStyle}>(instant)</span>
            )}
            {msg.actions && msg.actions.length > 0 && (
              <div style={actionsContainerStyle}>
                {msg.actions.map((action, i) => (
                  <span key={i} style={actionBadgeStyle}>
                    {formatAction(action)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={assistantBubbleStyle}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Status text */}
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {streamStatus || 'Thinking...'}
              </div>
              {/* Incremental action badges */}
              {streamActions.length > 0 && (
                <div style={actionsContainerStyle}>
                  {streamActions.map((action, i) => (
                    <span key={i} style={streamingBadgeStyle}>
                      {formatAction(action)}
                    </span>
                  ))}
                </div>
              )}
              {/* Cancel button */}
              <button
                onClick={cancelRequest}
                style={cancelBtnStyle}
                aria-label="Cancel AI request"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={inputContainerStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask the AI to create or modify objects…"
          aria-label="AI command input"
          style={textareaStyle}
          rows={2}
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          aria-label="Send message"
          style={{
            ...sendBtnStyle,
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAction(action: ToolAction): string {
  const parsed = JSON.parse(action.result)
  if (action.tool === 'createObject') {
    const type = (action.input.type as string) || 'object'
    const text = action.input.text ? ` "${action.input.text}"` : ''
    return `Created ${type}${text}`
  }
  if (action.tool === 'updateObject') {
    const fields = parsed.updated?.join(', ') || 'properties'
    return `Updated ${fields}`
  }
  if (action.tool === 'moveObject') {
    return `Moved to (${parsed.x}, ${parsed.y})`
  }
  return action.tool
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  width: 350,
  height: '100vh',
  background: '#ffffff',
  borderLeft: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 100,
  boxShadow: '-4px 0 20px rgba(0,0,0,0.1)',
  fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: 'none',
  background: '#1E293B',
  color: '#fff',
}

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 22,
  cursor: 'pointer',
  color: 'rgba(255,255,255,0.7)',
  padding: '0 4px',
  lineHeight: 1,
  transition: 'color 0.15s',
}

const messagesContainerStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

const bubbleBase: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 12,
  maxWidth: '90%',
  wordWrap: 'break-word',
}

const userBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: 'flex-end',
  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  color: '#fff',
}

const assistantBubbleStyle: React.CSSProperties = {
  ...bubbleBase,
  alignSelf: 'flex-start',
  background: '#f3f4f6',
  color: '#1f2937',
}

const actionsContainerStyle: React.CSSProperties = {
  marginTop: 8,
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
}

const actionBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'rgba(0,0,0,0.08)',
  borderRadius: 6,
  fontSize: 11,
  color: '#4b5563',
}

const streamingBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  background: 'rgba(59, 130, 246, 0.1)',
  borderRadius: 6,
  fontSize: 11,
  color: '#3B82F6',
}

const instantBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  marginTop: 4,
  padding: '1px 6px',
  background: 'rgba(16, 185, 129, 0.1)',
  borderRadius: 4,
  fontSize: 10,
  color: '#059669',
  fontWeight: 500,
}

const cancelBtnStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  padding: '3px 10px',
  background: 'transparent',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  fontSize: 11,
  color: '#6b7280',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
}

const inputContainerStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid #e5e7eb',
  display: 'flex',
  gap: 8,
  alignItems: 'flex-end',
}

const textareaStyle: React.CSSProperties = {
  flex: 1,
  resize: 'none',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  lineHeight: 1.4,
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const sendBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s, transform 0.1s',
}

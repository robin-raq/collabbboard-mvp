/**
 * ChatPanel — AI Chat Side Panel
 *
 * Slide-in panel from the right edge for sending AI commands.
 * Communicates with POST /api/ai on the server, which uses
 * Claude tool-calling to mutate the board Y.Doc.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { PRODUCTION_HOST } from '../constants'
import { extractPanTarget } from '../utils/panTarget'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolAction {
  tool: string
  input: Record<string, unknown>
  result: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: ToolAction[]
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
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

    try {
      const res = await fetch(`${API_URL}/api/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, boardId }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Done!',
        actions: data.actions,
      }

      setMessages((prev) => [...prev, assistantMsg])

      // Auto-pan viewport to where AI created/moved objects
      const target = extractPanTarget(data.actions ?? [])
      if (target && onPanTo) onPanTo(target.x, target.y)
    } catch (err) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, something went wrong: ${err instanceof Error ? err.message : 'Unknown error'}`,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
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
            <div style={spinnerStyle} aria-label="Loading\u2026">
              <span style={dotStyle}>&#9679;</span>
              <span style={{ ...dotStyle, animationDelay: '0.2s' }}>&#9679;</span>
              <span style={{ ...dotStyle, animationDelay: '0.4s' }}>&#9679;</span>
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
  background: 'rgba(255,255,255,0.2)',
  borderRadius: 6,
  fontSize: 11,
  color: 'rgba(255,255,255,0.85)',
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

const spinnerStyle: React.CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'center',
}

const dotStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  color: '#9ca3af',
  animation: 'pulse 1.4s ease-in-out infinite',
}

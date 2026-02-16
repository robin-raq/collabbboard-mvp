import { useState, useRef, useEffect } from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useAgentChat } from '../../hooks/useAgentChat'

interface ChatPanelProps {
  boardId: string | undefined
}

export function ChatPanel({ boardId }: ChatPanelProps) {
  const { chatOpen, setChatOpen } = useUiStore()
  const { messages, loading, error, sendMessage } = useAgentChat(boardId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!chatOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    sendMessage(input.trim())
    setInput('')
  }

  return (
    <div className="absolute right-0 top-0 flex h-full w-80 flex-col border-l border-gray-200 bg-white shadow-lg z-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-800">AI Assistant</h3>
        <button
          onClick={() => setChatOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Ask the AI to manipulate the board. Try "Add a sticky note saying Hello"
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`text-sm rounded-lg px-3 py-2 ${
              msg.role === 'user'
                ? 'ml-8 bg-blue-500 text-white'
                : 'mr-8 bg-gray-100 text-gray-800'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="mr-8 text-sm text-gray-400 animate-pulse">
            Thinking...
          </div>
        )}
        {error && (
          <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to edit the board..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

import { useState, useCallback } from 'react'
import api from '../lib/api'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface UseAgentChatReturn {
  messages: ChatMessage[]
  loading: boolean
  error: string | null
  sendMessage: (message: string) => Promise<void>
  clearMessages: () => void
}

export function useAgentChat(boardId: string | undefined): UseAgentChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (message: string) => {
      if (!boardId || !message.trim()) return

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, userMsg])
      setLoading(true)
      setError(null)

      try {
        const response = await api
          .post('api/ai/command', { json: { message, boardId } })
          .json<{ reply: string; results: string[] }>()

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.reply || response.results?.join('\n') || 'Done.',
          timestamp: Date.now(),
        }
        setMessages((prev) => [...prev, assistantMsg])
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send message'
        setError(errorMsg)
      } finally {
        setLoading(false)
      }
    },
    [boardId]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  return { messages, loading, error, sendMessage, clearMessages }
}

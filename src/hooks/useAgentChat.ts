import { useCallback, useRef, useState } from 'react'
import { getFirebaseIdToken } from '@/integrations/supabase/client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  streaming?: boolean
}

interface ToolCallEvent {
  name: string
  input?: Record<string, unknown>
  data?: unknown
}

export function useAgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCallEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    setError(null)
    setToolCalls([])

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    }
    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    let aborted = false

    try {
      const token = await getFirebaseIdToken()
      if (!token) throw new Error('Not authenticated')

      const url = `${API_BASE_URL}/api/agent/chat`
      console.log('[Agent Chat] URL:', url)
      console.log('[Agent Chat] API_BASE_URL:', API_BASE_URL)
      console.log('[Agent Chat] Token:', token ? `${token.slice(0, 20)}...` : 'null')

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          conversation_id: conversationId || undefined,
        }),
      })

      if (!response.ok || !response.body) {
        throw new Error(`Request failed (${response.status})`)
      }

      abortRef.current = () => {
        aborted = true
        response.body?.cancel()
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done || aborted) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let eventType = ''
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6))
              if (eventType === 'delta') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + (payload.text || '') }
                      : m,
                  ),
                )
              } else if (eventType === 'done') {
                setConversationId(payload.conversation_id || null)
              } else if (eventType === 'tool_call') {
                setToolCalls((prev) => [...prev, { name: payload.name, input: payload.input }])
              } else if (eventType === 'tool_result') {
                setToolCalls((prev) =>
                  prev.map((t) =>
                    t.name === payload.name ? { ...t, data: payload.data } : t,
                  ),
                )
              } else if (eventType === 'error') {
                throw new Error(payload.message)
              }
            } catch {
              // skip malformed SSE line
            }
          }
        }
      }
    } catch (err) {
      if (!aborted) {
        const msg = err instanceof Error ? err.message : 'Agent error'
        setError(msg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${msg}`, streaming: false }
              : m,
          ),
        )
      }
    } finally {
      abortRef.current = null
      setIsStreaming(false)
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      )
    }
  }, [isStreaming, conversationId])

  const stop = useCallback(() => {
    abortRef.current?.()
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setToolCalls([])
    setError(null)
    setIsStreaming(false)
  }, [])

  return { messages, isStreaming, toolCalls, error, conversationId, sendMessage, stop, reset }
}

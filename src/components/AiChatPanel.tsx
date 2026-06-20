import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAgentChat } from '@/hooks/useAgentChat'
import { useAuth } from '@/hooks/useAuth'

interface AiChatPanelProps {
  isOpen: boolean
  onClose: () => void
}

function TypingDots() {
  return (
    <span className='inline-flex items-center gap-0.5'>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className='h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce'
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  )
}

function ToolBadge({ name }: { name: string }) {
  return (
    <span className='inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5'>
      <svg className='h-2.5 w-2.5' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
        <path strokeLinecap='round' strokeLinejoin='round' d='M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z' />
        <path strokeLinecap='round' strokeLinejoin='round' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
      </svg>
      {name.replace(/_/g, ' ')}
    </span>
  )
}

export default function AiChatPanel({ isOpen, onClose }: AiChatPanelProps) {
  const { profile } = useAuth()
  const { messages, isStreaming, toolCalls, error, sendMessage, stop, reset } = useAgentChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, toolCalls])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    void sendMessage(text)
  }

  const quickPrompts = [
    "How many test drives today?",
    "Any no-shows this week?",
    "Which vehicles are available now?",
    "Who are today's customers?",
  ]

  return (
    <div className='fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end pointer-events-none'>
      {/* Backdrop */}
      <div
        className='absolute inset-0 bg-black/30 pointer-events-auto'
        onClick={onClose}
      />

      {/* Panel */}
      <div className='relative w-full sm:w-[420px] h-[85vh] sm:h-[600px] sm:mr-4 sm:mb-4 bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col pointer-events-auto overflow-hidden'>
        {/* Header */}
        <div className='flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-background shrink-0'>
          <div className='h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center'>
            <svg className='h-4 w-4 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' />
            </svg>
          </div>
          <div className='flex-1 min-w-0'>
            <p className='font-semibold text-sm text-foreground'>AutoAdvant AI</p>
            <p className='text-xs text-muted-foreground truncate'>
              {isStreaming ? 'Thinking…' : 'Ask about test drives, customers, vehicles'}
            </p>
          </div>
          <button
            type='button'
            onClick={reset}
            className='text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted'
          >
            New chat
          </button>
          <button
            type='button'
            onClick={onClose}
            className='h-7 w-7 flex items-center justify-center rounded hover:bg-muted'
          >
            <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
              <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className='flex-1 overflow-y-auto px-4 py-3 space-y-4'>
          {messages.length === 0 && (
            <div className='space-y-4 pt-4'>
              <div className='text-center'>
                <div className='inline-flex h-14 w-14 rounded-full bg-primary/10 items-center justify-center mb-3'>
                  <svg className='h-7 w-7 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' />
                  </svg>
                </div>
                <p className='font-semibold text-foreground'>Hi{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}!</p>
                <p className='text-sm text-muted-foreground mt-1'>
                  I can look up live dealership data to help you right now.
                </p>
              </div>

              <div className='grid grid-cols-1 gap-2'>
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type='button'
                    onClick={() => { setInput(prompt); void sendMessage(prompt) }}
                    className='text-left px-3 py-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-sm text-foreground transition-colors'
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {msg.role === 'assistant' && (
                <div className='h-6 w-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5'>
                  <svg className='h-3 w-3 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z' />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                }`}
              >
                {msg.content || (msg.streaming ? <TypingDots /> : null)}
              </div>
            </div>
          ))}

          {/* Tool usage indicator */}
          {toolCalls.length > 0 && isStreaming && (
            <div className='flex flex-wrap gap-1.5 pl-8'>
              {toolCalls.map((t, i) => (
                <ToolBadge key={i} name={t.name} />
              ))}
            </div>
          )}

          {error && (
            <div className='rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-xs'>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className='shrink-0 border-t border-border p-3'>
          <div className='flex items-end gap-2'>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSubmit(e as unknown as React.FormEvent)
                }
              }}
              placeholder='Ask about test drives, customers, vehicles…'
              rows={1}
              disabled={isStreaming}
              className='flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 max-h-[100px]'
            />
            {isStreaming ? (
              <Button
                type='button'
                onClick={stop}
                variant='destructive'
                size='sm'
                className='rounded-xl h-9 w-9 p-0 shrink-0'
              >
                <svg className='h-4 w-4' fill='currentColor' viewBox='0 0 24 24'>
                  <rect x='6' y='6' width='12' height='12' rx='2' />
                </svg>
              </Button>
            ) : (
              <Button
                type='submit'
                disabled={!input.trim()}
                size='sm'
                className='rounded-xl h-9 w-9 p-0 shrink-0'
              >
                <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={2}>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.269 20.876L5.999 12zm0 0h7.5' />
                </svg>
              </Button>
            )}
          </div>
          <p className='text-[10px] text-muted-foreground mt-1.5 text-center'>
            Powered by Claude · Data pulled live from your showroom
          </p>
        </form>
      </div>
    </div>
  )
}

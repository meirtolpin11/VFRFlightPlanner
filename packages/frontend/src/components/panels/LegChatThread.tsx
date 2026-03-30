import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../services/api'

interface Props { legId: string }

export default function LegChatThread({ legId }: Props) {
  const queryClient = useQueryClient()
  const [author, setAuthor] = useState(localStorage.getItem('fp-author') || '')
  const [body, setBody] = useState('')

  const { data: messages } = useQuery({
    queryKey: ['messages', legId],
    queryFn: () => api.getMessages(legId),
    refetchInterval: 30_000,
  })

  const sendMutation = useMutation({
    mutationFn: () => api.postMessage(legId, author, body),
    onSuccess: () => {
      setBody('')
      queryClient.invalidateQueries({ queryKey: ['messages', legId] })
    },
  })

  const handleSend = () => {
    if (!author.trim() || !body.trim()) return
    localStorage.setItem('fp-author', author)
    sendMutation.mutate()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 text-xs text-fp-muted border-b border-fp-border">Chat</div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages?.map(msg => (
          <div key={msg.id} className="text-xs">
            <span className="font-semibold text-fp-accent">{msg.authorName}</span>
            <span className="text-fp-muted ml-1">{new Date(msg.createdAt).toLocaleTimeString()}</span>
            <div className="text-fp-text mt-0.5">{msg.body}</div>
          </div>
        ))}
        {(!messages || messages.length === 0) && (
          <div className="text-fp-muted text-xs">No messages yet</div>
        )}
      </div>
      <div className="p-2 border-t border-fp-border space-y-1">
        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          className="w-full bg-fp-bg border border-fp-border rounded px-2 py-1 text-xs text-fp-text focus:outline-none focus:border-fp-accent"
          placeholder="Your name"
        />
        <div className="flex gap-1">
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            className="flex-1 bg-fp-bg border border-fp-border rounded px-2 py-1 text-xs text-fp-text resize-none h-14 focus:outline-none focus:border-fp-accent"
            placeholder="Message... (Enter to send)"
          />
          <button
            onClick={handleSend}
            disabled={sendMutation.isPending}
            className="px-2 bg-fp-accent text-white rounded text-xs hover:bg-blue-500 disabled:opacity-50"
          >Send</button>
        </div>
      </div>
    </div>
  )
}

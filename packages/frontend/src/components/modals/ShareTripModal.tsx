import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../services/api'

interface Collaborator {
  userId: string
  email: string
  username: string
}

interface Props {
  tripId: string
  tripName: string
  onClose: () => void
}

export default function ShareTripModal({ tripId, tripName, onClose }: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    api.getTripShares(tripId)
      .then(setCollaborators)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [tripId])

  async function handleAdd() {
    const trimmed = email.trim()
    if (!trimmed) return
    setAddError(null)
    setAdding(true)
    try {
      const collab = await api.addTripShare(tripId, trimmed)
      setCollaborators(prev => [...prev, collab])
      setEmail('')
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(userId: string) {
    try {
      await api.removeTripShare(tripId, userId)
      setCollaborators(prev => prev.filter(c => c.userId !== userId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove')
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div
        className="bg-fp-panel border border-fp-border rounded-lg shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-fp-text">Share "{tripName}"</h2>
          <button onClick={onClose} className="text-fp-muted hover:text-fp-danger text-lg leading-none">×</button>
        </div>

        {/* Add collaborator */}
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            placeholder="Add by email…"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="flex-1 bg-fp-bg border border-fp-border rounded px-3 py-1.5 text-xs text-fp-text placeholder:text-fp-muted focus:outline-none focus:border-fp-accent"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !email.trim()}
            className="px-3 py-1.5 bg-fp-accent text-white rounded text-xs font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-xs text-fp-danger mb-3">{addError}</p>}

        {/* Collaborator list */}
        {loading ? (
          <p className="text-xs text-fp-muted py-4 text-center">Loading…</p>
        ) : error ? (
          <p className="text-xs text-fp-danger py-4 text-center">{error}</p>
        ) : collaborators.length === 0 ? (
          <p className="text-xs text-fp-muted py-4 text-center">No collaborators yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {collaborators.map(c => (
              <li key={c.userId} className="flex items-center gap-2 px-2 py-1.5 rounded bg-fp-bg border border-fp-border/50">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-fp-text truncate">{c.username}</div>
                  <div className="text-xs text-fp-muted truncate">{c.email}</div>
                </div>
                <button
                  onClick={() => handleRemove(c.userId)}
                  className="text-fp-muted hover:text-fp-danger text-sm leading-none flex-shrink-0 transition-colors"
                  title="Remove access"
                >×</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  )
}

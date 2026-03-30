import { useEffect, useState } from 'react'
import { useAuthStore } from '../../store/authStore'

interface AdminUser {
  id: string
  email: string
  username: string
  role: 'admin' | 'user'
  approved: boolean
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AdminUsersModal({ isOpen, onClose }: Props) {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/admin/users', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) fetchUsers()
  }, [isOpen])

  if (!isOpen) return null

  const handleApprove = async (id: string) => {
    await fetch(`/api/v1/admin/users/${id}/approve`, { method: 'PUT', credentials: 'include' })
    fetchUsers()
  }

  const handleUnapprove = async (id: string) => {
    await fetch(`/api/v1/admin/users/${id}/unapprove`, { method: 'PUT', credentials: 'include' })
    fetchUsers()
  }

  const handleRoleToggle = async (id: string, currentRole: 'admin' | 'user') => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin'
    await fetch(`/api/v1/admin/users/${id}/role`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    fetchUsers()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user? This cannot be undone.')) return
    await fetch(`/api/v1/admin/users/${id}`, { method: 'DELETE', credentials: 'include' })
    fetchUsers()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-fp-panel border border-fp-border rounded-lg p-6 w-[700px] max-w-[95vw] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <h2 className="text-lg font-semibold text-fp-text">User Management</h2>
          <button onClick={onClose} className="text-fp-muted hover:text-fp-text text-lg leading-none">✕</button>
        </div>

        {loading && (
          <div className="text-center py-8 text-fp-muted text-sm animate-pulse">Loading users…</div>
        )}

        {error && (
          <div className="text-fp-danger text-sm text-center py-4">{error}</div>
        )}

        {!loading && !error && (
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fp-muted text-xs border-b border-fp-border">
                  <th className="text-left pb-2 pr-3 font-medium">Username</th>
                  <th className="text-left pb-2 pr-3 font-medium">Email</th>
                  <th className="text-left pb-2 pr-3 font-medium">Role</th>
                  <th className="text-left pb-2 pr-3 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="border-b border-fp-border/50 hover:bg-fp-panel-2/40 transition-colors">
                      <td className="py-2 pr-3 text-fp-text font-medium">
                        {u.username}
                        {isSelf && <span className="ml-1 text-xs text-fp-muted">(you)</span>}
                      </td>
                      <td className="py-2 pr-3 text-fp-muted-2 text-xs">{u.email}</td>
                      <td className="py-2 pr-3">
                        <button
                          onClick={() => !isSelf && handleRoleToggle(u.id, u.role)}
                          disabled={isSelf}
                          title={isSelf ? 'Cannot change your own role' : `Switch to ${u.role === 'admin' ? 'user' : 'admin'}`}
                          className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                            u.role === 'admin'
                              ? 'bg-fp-accent/20 text-fp-accent border-fp-accent/30 hover:bg-fp-accent/30'
                              : 'bg-fp-panel-2 text-fp-muted-2 border-fp-border-2 hover:border-fp-accent hover:text-fp-text'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {u.role}
                        </button>
                      </td>
                      <td className="py-2 pr-3">
                        {u.approved ? (
                          <span className="text-fp-success text-xs font-medium">Approved</span>
                        ) : (
                          <span className="text-fp-warn text-xs font-medium">Pending</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          {u.approved ? (
                            <button
                              onClick={() => handleUnapprove(u.id)}
                              disabled={isSelf}
                              className="px-2 py-0.5 bg-fp-panel-2 border border-fp-border-2 text-fp-muted-2 rounded text-xs hover:border-fp-accent hover:text-fp-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => handleApprove(u.id)}
                              className="px-2 py-0.5 bg-fp-success/20 border border-fp-success/30 text-fp-success rounded text-xs hover:bg-fp-success/30 transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(u.id)}
                            disabled={isSelf}
                            title={isSelf ? 'Cannot delete yourself' : 'Delete user'}
                            className="px-2 py-0.5 bg-fp-danger/20 border border-fp-danger/30 text-fp-danger rounded text-xs hover:bg-fp-danger/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-fp-muted text-sm">No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

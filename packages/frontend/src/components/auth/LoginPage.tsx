import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const login = useAuthStore(s => s.login)
  const register = useAuthStore(s => s.register)
  const init = useAuthStore(s => s.init)

  const switchMode = (m: Mode) => {
    setMode(m)
    setError(null)
    setPendingMessage(null)
    setEmail('')
    setUsername('')
    setPassword('')
  }

  const handleLogin = async () => {
    if (!email.trim() || !password) return
    setError(null)
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      // user is now set in the store; AuthGate will re-render
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed'
      if (msg.toLowerCase().includes('pending')) {
        setError('__pending__')
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !password) return
    setError(null)
    setSubmitting(true)
    try {
      const { pending } = await register(email.trim(), username.trim(), password)
      if (pending) {
        setPendingMessage('Registration successful! Your account is pending admin approval.')
      } else {
        // auto-approved — re-init to load user and let AuthGate show the app
        await init()
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full bg-fp-panel border border-fp-border rounded px-3 py-1.5 text-fp-text text-sm focus:outline-none focus:border-fp-accent'

  return (
    <div className="fixed inset-0 bg-fp-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-fp-accent tracking-tight">✈ VFR Planner</span>
        </div>

        <div className="bg-fp-panel border border-fp-border rounded-lg p-8 shadow-xl">
          <h2 className="text-lg font-semibold text-fp-text mb-6">
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </h2>

          {pendingMessage ? (
            <div className="text-sm text-fp-success text-center py-4">{pendingMessage}</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-fp-muted mb-1">Email</label>
                <input
                  type="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-xs text-fp-muted mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRegister()}
                    className={inputClass}
                    placeholder="callsign"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-fp-muted mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? handleLogin() : handleRegister())}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              {error === '__pending__' ? (
                <p className="text-xs text-fp-warn">
                  Your account is pending admin approval.
                </p>
              ) : error ? (
                <p className="text-xs text-fp-danger">{error}</p>
              ) : null}

              <button
                onClick={mode === 'login' ? handleLogin : handleRegister}
                disabled={submitting}
                className="w-full py-2 bg-fp-accent text-white rounded text-sm font-semibold hover:bg-blue-500 transition-colors disabled:opacity-50"
              >
                {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}
              </button>
            </div>
          )}

          <div className="mt-5 text-center text-xs text-fp-muted">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button
                  onClick={() => switchMode('register')}
                  className="text-fp-accent hover:underline"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => switchMode('login')}
                  className="text-fp-accent hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

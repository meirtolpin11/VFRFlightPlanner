import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import LoginPage from './LoginPage'

interface Props {
  children: React.ReactNode
}

export default function AuthGate({ children }: Props) {
  const init = useAuthStore(s => s.init)
  const loading = useAuthStore(s => s.loading)
  const user = useAuthStore(s => s.user)

  useEffect(() => {
    init()
  }, [init])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-fp-bg flex items-center justify-center">
        <div className="text-fp-muted text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <>{children}</>
}

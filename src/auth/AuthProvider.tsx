import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase, supabaseConfigurationError } from '../lib/supabase'

type AuthStatus = 'loading' | 'authorizing' | 'authenticated' | 'unauthenticated'

type AuthContextValue = {
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  status: AuthStatus
  user: User | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

function friendlyAuthError(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes('invalid login credentials')) return 'Incorrect email or password.'
  if (normalized.includes('email not confirmed')) return 'This email address has not been confirmed.'
  return 'Authentication failed. Please try again.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(supabaseConfigurationError)

  useEffect(() => {
    if (!supabase) {
      setSession(null)
      setStatus('unauthenticated')
      return
    }

    let active = true

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError('Your saved session could not be restored. Please sign in again.')
      setSession(sessionError ? null : data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session === undefined) return
    if (!session || !supabase) {
      setStatus('unauthenticated')
      return
    }

    const client = supabase
    let active = true
    let verifying = false
    setStatus('authorizing')

    const verifyAdmin = async () => {
      if (verifying) return
      verifying = true
      const { data, error: authorizationError } = await client.rpc('is_admin')
      verifying = false
      if (!active) return
      if (!authorizationError && data === true) {
        setError(null)
        setStatus('authenticated')
        return
      }

      setError(authorizationError
        ? 'Administrator access could not be verified. Your session was cleared.'
        : 'This account is not authorized to access the Admin CMS.')
      setSession(null)
      setStatus('unauthenticated')
      void client.auth.signOut({ scope: 'local' })
    }

    const verifyWhenVisible = () => { if (document.visibilityState === 'visible') void verifyAdmin() }
    void verifyAdmin()
    const interval = window.setInterval(() => void verifyAdmin(), 60_000)
    document.addEventListener('visibilitychange', verifyWhenVisible)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', verifyWhenVisible)
    }
  }, [session])

  const signInWithPassword = async (email: string, password: string) => {
    if (!supabase) return
    setError(null)
    setStatus('loading')
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.session) {
      setError(friendlyAuthError(signInError?.message ?? 'No session returned'))
      setStatus('unauthenticated')
      return
    }
    setSession(data.session)
  }

  const signInWithGoogle = async () => {
    if (!supabase) return
    setError(null)
    setStatus('loading')
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (signInError) {
      setError(friendlyAuthError(signInError.message))
      setStatus('unauthenticated')
    }
  }

  const signOut = async () => {
    setError(null)
    setStatus('loading')
    if (supabase) await supabase.auth.signOut({ scope: 'local' })
    setSession(null)
    setStatus('unauthenticated')
  }

  return (
    <AuthContext.Provider value={{ error, signInWithGoogle, signInWithPassword, signOut, status, user: session?.user ?? null }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}

function AuthLoading({ message = 'Checking administrator access…' }: { message?: string }) {
  return <div className="auth-loading" role="status"><span className="auth-spinner" />{message}</div>
}

export function RequireAdmin() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading' || auth.status === 'authorizing') return <AuthLoading />
  if (auth.status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function AuthCallback() {
  const auth = useAuth()
  const params = new URLSearchParams(window.location.search)
  const oauthError = params.get('error_description') ?? params.get('error')

  if (auth.status === 'authenticated') return <Navigate to="/" replace />
  if (auth.status === 'loading' || auth.status === 'authorizing') return <AuthLoading message="Completing Google sign-in…" />
  return <Navigate to="/login" replace state={{ message: oauthError ? `Google sign-in failed: ${oauthError}` : null }} />
}

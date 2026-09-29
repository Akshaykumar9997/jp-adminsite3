import { LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { logoUrl } from '../data/mockData'

type LoginLocationState = {
  from?: { pathname?: string }
  message?: string | null
}

export function LoginPage() {
  const auth = useAuth()
  const location = useLocation()
  const state = location.state as LoginLocationState | null
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const busy = auth.status === 'loading' || auth.status === 'authorizing'

  if (auth.status === 'authenticated') return <Navigate to={state?.from?.pathname || '/'} replace />

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void auth.signInWithPassword(email.trim(), password)
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="JP Aluminium Interior Works">
        <img src={logoUrl} alt="JP Aluminium" />
        <span className="eyebrow">JP Aluminium • Administration</span>
        <h1>Showcase content,<br />managed with precision.</h1>
        <p>Authorized administrators can manage the portfolio, media, materials, collaborators, and publishing workflow.</p>
        <small>Site 3 • Internal Admin CMS</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__heading">
            <span className="login-mark"><LockKeyhole size={20} /></span>
            <div><span className="eyebrow">Secure workspace</span><h2>Administrator sign in</h2></div>
          </div>
          <p>Use an existing authorized JP Aluminium administrator account.</p>

          {(auth.error || state?.message) && <div className="auth-error" role="alert">{auth.error || state?.message}</div>}

          <button className="google-button" type="button" onClick={() => void auth.signInWithGoogle()} disabled={busy}>
            <span aria-hidden="true">G</span>{busy ? 'Please wait…' : 'Continue with Google'}
          </button>

          <div className="login-divider"><span>or sign in with email</span></div>

          <form className="login-form" onSubmit={submit}>
            <label><span>Email address</span><div><Mail size={16} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required disabled={busy} /></div></label>
            <label><span>Password</span><div><LockKeyhole size={16} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /></div></label>
            <button className="login-submit" type="submit" disabled={busy}>{busy ? 'Verifying access…' : 'Sign in to CMS'}</button>
          </form>

          <p className="login-note">Authentication alone does not grant access. Every session is verified against the existing administrator authorization policy.</p>
        </div>
      </section>
    </main>
  )
}

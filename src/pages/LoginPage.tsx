import { LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { logoUrl } from '../data/mockData'
import { Button } from '../components/ui'

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
  const [errors, setErrors] = useState({ email: '', password: '' })
  const busy = auth.status === 'loading' || auth.status === 'authorizing'

  if (auth.status === 'authenticated')
    return <Navigate to={state?.from?.pathname || '/'} replace />

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return
    const emailError = !email.trim()
      ? 'Please enter your email address.'
      : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? 'Please enter a valid email address.'
        : ''
    const passwordError = !password ? 'Please enter your password.' : ''
    setErrors({ email: emailError, password: passwordError })
    if (emailError || passwordError) {
      event.currentTarget
        .querySelector<HTMLInputElement>(
          emailError ? '[type="email"]' : '[type="password"]',
        )
        ?.focus()
      return
    }
    void auth.signInWithPassword(email.trim(), password)
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="JP Aluminium Interior Works">
        <img src={logoUrl} alt="JP Aluminium" />
        <span className="eyebrow">JP Aluminium • Administration</span>
        <h1>
          Showcase content,
          <br />
          managed with precision.
        </h1>
        <p>
          Authorized administrators can manage the portfolio, media, materials,
          collaborators, and publishing workflow.
        </p>
        <small>Site 3 • Internal Admin CMS</small>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__heading">
            <span className="login-mark">
              <LockKeyhole size={20} />
            </span>
            <div>
              <span className="eyebrow">Secure workspace</span>
              <h2>Administrator sign in</h2>
            </div>
          </div>
          <p>Use an existing authorized JP Aluminium administrator account.</p>

          {(auth.error || state?.message) && (
            <div className="auth-error" role="alert">
              {auth.error || state?.message}
            </div>
          )}

          <Button
            className="google-button"
            onClick={() => void auth.signInWithGoogle()}
            busy={busy}
          >
            <span aria-hidden="true">G</span>
            {busy ? 'Please wait…' : 'Continue with Google'}
          </Button>

          <div className="login-divider">
            <span>or sign in with email</span>
          </div>

          <form className="login-form" noValidate onSubmit={submit}>
            <label>
              <span>Email address</span>
              <div>
                <Mail size={16} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  aria-invalid={!!errors.email}
                  aria-describedby={
                    errors.email ? 'login-email-error' : undefined
                  }
                  onBlur={(event) => {
                    const message = !email.trim()
                      ? 'Please enter your email address.'
                      : !event.currentTarget.validity.valid
                        ? 'Please enter a valid email address.'
                        : ''
                    setErrors((current) => ({ ...current, email: message }))
                  }}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors((current) => ({ ...current, email: '' }))
                  }}
                  required
                  disabled={busy}
                />
              </div>
              {errors.email && (
                <small className="field-error" id="login-email-error">
                  {errors.email}
                </small>
              )}
            </label>
            <label>
              <span>Password</span>
              <div>
                <LockKeyhole size={16} />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={!!errors.password}
                  aria-describedby={
                    errors.password ? 'login-password-error' : undefined
                  }
                  onBlur={() =>
                    setErrors((current) => ({
                      ...current,
                      password: !password ? 'Please enter your password.' : '',
                    }))
                  }
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setErrors((current) => ({ ...current, password: '' }))
                  }}
                  required
                  disabled={busy}
                />
              </div>
              {errors.password && (
                <small className="field-error" id="login-password-error">
                  {errors.password}
                </small>
              )}
            </label>
            <Button
              className="login-submit"
              variant="primary"
              type="submit"
              busy={busy}
            >
              {busy ? 'Verifying access…' : 'Sign in to CMS'}
            </Button>
          </form>

          <p className="login-note">
            Authentication alone does not grant access. Every session is
            verified against the existing administrator authorization policy.
          </p>
        </div>
      </section>
    </main>
  )
}

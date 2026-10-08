import { useRef, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Shield, KeyRound, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  changeAdminPassword,
  createAdmin,
  loadAdmins,
  removeAdmin,
  type AdminProfile,
} from '../lib/admins'
import { friendlyError } from '../lib/feedback'
import { Button } from '../components/ui'
import {
  Dialog,
  EmptyState,
  useFeedback,
  useUnsaved,
} from '../components/Feedback'
import { ErrorState, LoadingState } from '../components/CmsDialog'

export function AdminsPage() {
  const { data, loading, error, reload } = useAsyncData(loadAdmins)
  const { user } = useAuth()
  const { confirm, notify } = useFeedback()
  const [editor, setEditor] = useState<AdminProfile | 'new' | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const removingLock = useRef(false)
  const activeCount =
    data?.filter((admin) => !admin.access_revoked_at).length ?? 0
  const remove = async (admin: AdminProfile) => {
    if (removingLock.current) return
    removingLock.current = true
    try {
      if (
        !(await confirm({
          title: 'Remove administrator?',
          message: `Remove admin access for ${admin.full_name || admin.email}? This affects both the website and Flutter app. Their sign-in account remains.`,
          confirmLabel: 'Remove admin',
          destructive: true,
        }))
      )
        return
      setRemoving(admin.id)
      await removeAdmin(admin.id)
      notify('Administrator access removed from both applications.')
      await reload()
    } catch (reason) {
      notify(friendlyError(reason, 'remove administrator'), 'error')
    } finally {
      removingLock.current = false
      setRemoving(null)
    }
  }
  return (
    <div className="page cms-page admins-page">
      <div className="page-heading gallery-heading">
        <div>
          <span className="gallery-eyebrow">SHARED ADMINISTRATOR ACCESS</span>
          <h1>Manage Admins</h1>
          <p>
            These administrators are shared with the Flutter app. Changes apply
            to both applications.
          </p>
        </div>
        <div className="admin-actions">
          <Button
            onClick={() => void reload()}
            disabled={loading || !!removing}
          >
            <RefreshCw size={18} /> Refresh
          </Button>
          <Button
            variant="primary"
            onClick={() => setEditor('new')}
            disabled={!!removing}
          >
            <Plus size={18} /> Add Admin
          </Button>
        </div>
      </div>
      {loading && !data ? (
        <LoadingState label="Loading administrators…" />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !data?.length ? (
        <EmptyState
          title="No administrators found"
          illustration={<Shield size={40} />}
        >
          Refresh to check the shared admin records.
        </EmptyState>
      ) : (
        <div className="admin-list">
          {data.map((admin) => (
            <article className="admin-card" key={admin.id}>
              <div className="admin-details">
                <Shield size={24} />
                <div>
                  <h2>
                    {admin.full_name || 'Administrator'}
                    {admin.id === user?.id && <small> (You)</small>}
                  </h2>
                  <p>{admin.email || 'Email unavailable'}</p>
                  <span>
                    {admin.access_revoked_at
                      ? 'Access suspended'
                      : 'Active administrator'}
                  </span>
                </div>
              </div>
              <div className="admin-actions">
                <Button
                  onClick={() => setEditor(admin)}
                  disabled={!!removing || !admin.email || !admin.full_name}
                >
                  <KeyRound size={16} /> Change password
                </Button>
                <Button
                  onClick={() => void remove(admin)}
                  busy={removing === admin.id}
                  disabled={
                    !!removing ||
                    admin.id === user?.id ||
                    (!admin.access_revoked_at && activeCount <= 1)
                  }
                  title={
                    admin.id === user?.id
                      ? 'You cannot remove your own account'
                      : activeCount <= 1 && !admin.access_revoked_at
                        ? 'Cannot remove the last active administrator'
                        : undefined
                  }
                >
                  <Trash2 size={16} /> Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editor && (
        <AdminEditor
          admin={editor}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null)
            await reload()
          }}
        />
      )}
    </div>
  )
}

function AdminEditor({
  admin,
  onClose,
  onSaved,
}: {
  admin: AdminProfile | 'new'
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const creating = admin === 'new'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const { confirm, notify } = useFeedback()
  const dirty = !!(name || email || password || confirmation)
  useUnsaved(dirty)
  const close = async () => {
    if (
      !lock.current &&
      (!dirty ||
        (await confirm({
          title: 'Discard changes?',
          message: 'Close without saving these administrator changes?',
          confirmLabel: 'Discard',
        })))
    )
      onClose()
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lock.current) return
    setError(null)
    if (password.trim().length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmation) {
      setError('Passwords do not match.')
      return
    }
    if (creating && (!name.trim() || !email.trim())) {
      setError('Full name and email are required.')
      return
    }
    lock.current = true
    setBusy(true)
    try {
      if (creating)
        await createAdmin(email.trim().toLowerCase(), name.trim(), password)
      else await changeAdminPassword(admin.id, password)
      setPassword('')
      setConfirmation('')
      setName('')
      setEmail('')
      notify(
        creating
          ? 'Admin created. They can sign in to either application with email/password or Google using this email.'
          : 'Password updated for both applications.',
      )
      await onSaved()
    } catch (reason) {
      setError(
        friendlyError(
          reason,
          creating ? 'create administrator' : 'change password',
        ),
      )
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={creating ? 'Add Admin' : 'Change admin password'}
      onClose={() => void close()}
      busy={busy}
    >
      <form className="admin-form" onSubmit={(event) => void save(event)}>
        <p>
          {creating
            ? 'Authorize an administrator for both applications. Google sign-in uses the same email.'
            : `Set a new password for ${admin.full_name || admin.email}. This changes email/password login in both applications.`}
        </p>
        <fieldset disabled={busy}>
          {creating && (
            <>
              <label>
                Full name
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={200}
                  autoComplete="name"
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  maxLength={254}
                  autoComplete="email"
                />
              </label>
            </>
          )}
          <label>
            {creating ? 'Initial password' : 'New password'}
            <input
              autoFocus={!creating}
              type={visible ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              maxLength={1024}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              type={visible ? 'text' : 'password'}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              minLength={6}
              maxLength={1024}
              autoComplete="new-password"
            />
          </label>
          <label className="admin-password-toggle">
            <input
              type="checkbox"
              checked={visible}
              onChange={(event) => setVisible(event.target.checked)}
            />{' '}
            Show password
          </label>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-actions">
            <Button onClick={() => void close()}>Cancel</Button>
            <Button type="submit" variant="primary" busy={busy}>
              {creating ? 'Create Admin' : 'Save password'}
            </Button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  )
}

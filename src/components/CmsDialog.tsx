import { X } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Button } from './ui'
import { messageFrom } from '../lib/showcase'
import type { ContentStatus } from '../lib/database.types'

export function CmsDialog({ title, eyebrow = 'Showcase CMS', onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dialog cms-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="icon-button dialog__close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        <span className="eyebrow">{eyebrow}</span>
        <h2 id="dialog-title">{title}</h2>
        {children}
      </section>
    </div>
  )
}

export function AsyncForm({ onSubmit, onClose, children, submitLabel = 'Save changes', danger }: {
  onSubmit: (form: FormData) => Promise<void>
  onClose: () => void
  children: ReactNode
  submitLabel?: string
  danger?: { label: string; action: () => Promise<void> }
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(null)
    try { await action(); onClose() } catch (reason) { setError(messageFrom(reason)); setBusy(false) }
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    void run(() => onSubmit(form))
  }
  return (
    <form className="cms-dialog__form" onSubmit={submit}>
      {children}
      {error && <div className="auth-error" role="alert">{error}</div>}
      <div className="cms-dialog__actions">
        {danger && <Button type="button" className="button--danger" disabled={busy} onClick={() => { if (window.confirm(`${danger.label}? This cannot be undone.`)) void run(danger.action) }}>{danger.label}</Button>}
        <span />
        <Button type="button" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  )
}

export function StatusField({ value = 'draft' }: { value?: ContentStatus }) {
  return <label className="field"><span>Publication status</span><select name="status" defaultValue={value}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
}

export function LoadingState({ label = 'Loading showcase content…' }: { label?: string }) {
  return <div className="empty-state" role="status"><h2>{label}</h2><p>Please wait while the secure CMS data is loaded.</p></div>
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <div className="empty-state" role="alert"><h2>Unable to load content</h2><p>{message}</p><Button onClick={retry}>Try again</Button></div>
}

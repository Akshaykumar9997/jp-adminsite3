import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Button } from './ui'
import {
  Dialog,
  EmptyState,
  Loader,
  useFeedback,
  useOperation,
  useUnsaved,
} from './Feedback'
import type { ContentStatus } from '../lib/database.types'

export function CmsDialog({
  title,
  onClose,
  children,
}: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
}) {
  const { confirm, hasUnsaved } = useFeedback()
  const close = async () => {
    if (
      !hasUnsaved() ||
      (await confirm({
        title: 'Unsaved changes',
        message: 'You have unsaved changes. Leave without saving?',
        confirmLabel: 'Leave',
      }))
    )
      onClose()
  }
  return (
    <Dialog title={title} onClose={() => void close()}>
      {children}
    </Dialog>
  )
}
export function AsyncForm({
  onSubmit,
  onClose,
  children,
  submitLabel = 'Save changes',
  danger,
  successMessage = 'Changes saved successfully.',
}: {
  onSubmit: (form: FormData) => Promise<void | boolean>
  onClose: () => void
  children: ReactNode
  submitLabel?: string
  successMessage?: string
  danger?: { label: string; action: () => Promise<void> }
}) {
  const operation = useOperation()
  const { confirm, hasUnsaved } = useFeedback()
  const [action, setAction] = useState<'save' | 'delete' | 'publish'>('save')
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const ref = useRef<HTMLFormElement>(null)
  useUnsaved(dirty)
  const validate = (
    el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) => {
    const error =
      el.required && !el.value.trim()
        ? `Please enter ${el.getAttribute('data-label') || el.name.replaceAll('_', ' ')}.`
        : el.type === 'email' && el.value && !el.validity.valid
          ? 'Please enter a valid email address.'
          : ''
    el.setAttribute('aria-invalid', String(!!error))
    const parent = el.closest('label')
    let message = parent?.querySelector('.field-error')
    if (error && !message) {
      message = document.createElement('small')
      message.className = 'field-error'
      message.id = `error-${el.name}`
      message.setAttribute('role', 'alert')
      parent?.append(message)
      el.setAttribute('aria-describedby', message.id)
    }
    if (message) message.textContent = error
    setErrors((current) => {
      const next = { ...current }
      if (error) next[el.name] = error
      else delete next[el.name]
      return next
    })
    return error
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (operation.pending) return
    const invalid: Record<string, string> = {}
    ref.current
      ?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input,select,textarea')
      .forEach((el) => {
        const error = validate(el)
        if (error) invalid[el.name] = error
      })
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const form = new FormData(event.currentTarget)
    setAction(form.get('status') === 'published' ? 'publish' : 'save')
    void operation.run(
      async () => {
        const saved = await onSubmit(form)
        if (saved === false) return false
        setDirty(false)
        onClose()
        return true
      },
      { action: 'save changes', success: successMessage },
    )
  }
  const cancel = async () => {
    if (
      !hasUnsaved() ||
      (await confirm({
        title: 'Unsaved changes',
        message: 'Your changes have not been saved. Leave without saving?',
        confirmLabel: 'Leave',
      }))
    ) {
      setDirty(false)
      onClose()
    }
  }
  return (
    <form
      ref={ref}
      noValidate
      className="cms-dialog__form"
      onSubmit={submit}
      onChange={() => setDirty(true)}
      onBlur={(event) => {
        const el = event.target
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLTextAreaElement
        )
          validate(el)
      }}
      onInput={(event) => {
        const el = event.target
        if (
          (el instanceof HTMLInputElement ||
            el instanceof HTMLSelectElement ||
            el instanceof HTMLTextAreaElement) &&
          el.getAttribute('aria-invalid') === 'true'
        )
          validate(el)
      }}
    >
      <fieldset disabled={operation.pending}>{children}</fieldset>
      {!!Object.keys(errors).length && (
        <p className="field-error" role="alert">
          Check the highlighted fields before saving.
        </p>
      )}
      {operation.error && (
        <p className="field-error" role="alert">
          {operation.error}
        </p>
      )}
      <div className="cms-dialog__actions">
        {danger && (
          <Button
            className="button--danger"
            busy={operation.pending}
            onClick={() => {
              setAction('delete')
              void operation.run(
                async () => {
                  if (
                    !(await confirm({
                      title: danger.label,
                      message:
                        'This removes the item and its showcase associations. This action cannot be undone.',
                      confirmLabel: 'Delete',
                      destructive: true,
                    }))
                  )
                    return false
                  await danger.action()
                  setDirty(false)
                  onClose()
                },
                {
                  action: 'delete this item',
                  success: 'Item deleted successfully.',
                },
              )
            }}
          >
            {operation.pending && action === 'delete'
              ? 'Deleting…'
              : danger.label}
          </Button>
        )}
        <span />
        <Button disabled={operation.pending} onClick={() => void cancel()}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={operation.pending}>
          {operation.pending
            ? action === 'delete'
              ? 'Deleting…'
              : action === 'publish'
                ? 'Publishing…'
                : 'Saving changes…'
            : operation.state === 'error'
              ? 'Retry save'
              : submitLabel}
        </Button>
      </div>
    </form>
  )
}
export function StatusField({
  value = 'draft',
  onChange,
}: {
  value?: ContentStatus
  onChange?: (status: ContentStatus) => void
}) {
  return (
    <label className="field">
      <span>Visibility</span>
      <select
        name="status"
        defaultValue={value}
        onChange={(e) => onChange?.(e.target.value as ContentStatus)}
      >
        <option value="draft">Draft — only admins</option>
        <option value="published">Published — visible on website</option>
        <option value="archived">Archived — hidden</option>
      </select>
    </label>
  )
}
export function LoadingState({
  label = 'Loading showcase content…',
}: {
  label?: string
}) {
  return <Loader label={label} skeleton />
}
export function ErrorState({
  message,
  retry,
}: {
  message: string
  retry: () => void
}) {
  return (
    <EmptyState
      title="Unable to load content"
      action={<Button onClick={retry}>Retry</Button>}
    >
      {message}
    </EmptyState>
  )
}

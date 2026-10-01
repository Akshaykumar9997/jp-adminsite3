import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Button } from './ui'
import { createPortal } from 'react-dom'
import { useBlocker } from 'react-router-dom'
import { friendlyError, type OperationState } from '../lib/feedback'
import { Toaster, toast } from 'sonner'
import { X } from 'lucide-react'
type Tone = 'success' | 'error' | 'warning' | 'info'
type Confirmation = {
  title: string
  message: string
  confirmLabel?: string
  destructive?: boolean
}
type FeedbackContextValue = {
  notify: (message: string, tone?: Tone) => void
  confirm: (options: Confirmation) => Promise<boolean>
  setUnsaved: (id: string, dirty: boolean) => void
  hasUnsaved: () => boolean
}
const FeedbackContext = createContext<FeedbackContextValue | null>(null)
export function Loader({
  label,
  skeleton = false,
}: {
  label: string
  skeleton?: boolean
}) {
  return (
    <div
      className={skeleton ? 'page-loader' : 'inline-loader'}
      role="status"
      aria-live="polite"
    >
      <span className="ui-spinner" aria-hidden="true" />
      <span>{label}</span>
      {skeleton && (
        <div className="skeleton-grid" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}
    </div>
  )
}
export function Progress({ value, label }: { value?: number; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span
        className={value === undefined ? 'indeterminate' : ''}
        style={value === undefined ? undefined : { width: `${value}%` }}
      />
    </div>
  )
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
      {action}
    </div>
  )
}
export function Dialog({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [formBusy, setFormBusy] = useState(false)
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setFormBusy(!!ref.current?.querySelector('fieldset:disabled')),
    )
    if (ref.current)
      observer.observe(ref.current, {
        attributes: true,
        attributeFilter: ['disabled'],
        subtree: true,
      })
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const el = ref.current
    const previous = document.activeElement as HTMLElement | null
    el?.showModal()
    return () => {
      el?.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="native-dialog"
      aria-labelledby={titleId}
      aria-busy={busy || formBusy}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy && !formBusy) onClose()
      }}
    >
      <div className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <Button
          disabled={busy || formBusy}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notificationLayer] = useState(() => {
    const layer = document.createElement('div')
    layer.className = 'notification-layer'
    layer.popover = 'manual'
    return layer
  })
  useEffect(() => {
    const update = () => {
      // A modal makes outside DOM inert. Host beneath the active modal, but use
      // a separate viewport-positioned top-layer popover, never the form layout.
      const parent =
        Array.from(document.querySelectorAll('dialog[open]')).at(-1) ??
        document.body
      if (notificationLayer.parentElement !== parent)
        parent.append(notificationLayer)
      if (notificationLayer.matches(':popover-open'))
        notificationLayer.hidePopover()
      notificationLayer.showPopover()
    }
    const observer = new MutationObserver(update)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    update()
    return () => {
      observer.disconnect()
      notificationLayer.remove()
    }
  }, [notificationLayer])
  const [request, setRequest] = useState<
    (Confirmation & { resolve: (value: boolean) => void }) | null
  >(null)
  const requests = useRef<
    Array<Confirmation & { resolve: (value: boolean) => void }>
  >([])
  const dirty = useRef(new Set<string>())
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current.size) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('beforeunload', warn)
    }
  }, [])
  const notify = useCallback((message: string, tone: Tone = 'success') => {
    toast[tone](message, { duration: tone === 'error' ? Infinity : 3500 })
  }, [])
  const confirm = useCallback(
    (options: Confirmation) =>
      new Promise<boolean>((resolve) => {
        const next = { ...options, resolve }
        requests.current.push(next)
        if (requests.current.length === 1) setRequest(next)
      }),
    [],
  )
  const answer = (value: boolean) => {
    request?.resolve(value)
    requests.current.shift()
    setRequest(requests.current[0] ?? null)
  }
  const setUnsaved = useCallback((id: string, value: boolean) => {
    if (value) dirty.current.add(id)
    else dirty.current.delete(id)
  }, [])
  return (
    <FeedbackContext.Provider
      value={{
        notify,
        confirm,
        setUnsaved,
        hasUnsaved: () => dirty.current.size > 0,
      }}
    >
      {!online && (
        <div className="offline-banner" role="status">
          Connection lost. Unsaved changes and uploads are kept for retry.
        </div>
      )}
      {children}
      {createPortal(
        <Toaster
          position="top-center"
          richColors
          closeButton
          visibleToasts={2}
          offset={20}
          mobileOffset={12}
          toastOptions={{ style: { fontFamily: 'inherit' } }}
        />,
        notificationLayer,
      )}
      {request && (
        <Dialog title={request.title} onClose={() => answer(false)}>
          <p>{request.message}</p>
          <div className="cms-dialog__actions">
            <Button onClick={() => answer(false)}>Cancel</Button>
            <Button
              variant="primary"
              className={request.destructive ? 'button--danger' : ''}
              onClick={() => answer(true)}
            >
              {request.confirmLabel ?? 'Continue'}
            </Button>
          </div>
        </Dialog>
      )}
    </FeedbackContext.Provider>
  )
}
export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('FeedbackProvider missing')
  return value
}
export function NavigationGuard() {
  const { hasUnsaved, confirm } = useFeedback()
  const blocker = useBlocker(() => hasUnsaved())
  const showing = useRef(false)
  useEffect(() => {
    if (blocker.state !== 'blocked' || showing.current) return
    showing.current = true
    void confirm({
      title: 'Unsaved changes',
      message: 'You have unsaved changes. Leave this page?',
      confirmLabel: 'Leave',
    }).then((leave) => {
      if (leave) blocker.proceed()
      else blocker.reset()
      showing.current = false
    })
  }, [blocker, confirm])
  return null
}
export function useUnsaved(dirty: boolean) {
  const id = useId()
  const { setUnsaved } = useFeedback()
  useEffect(() => {
    setUnsaved(id, dirty)
    return () => setUnsaved(id, false)
  }, [dirty, id, setUnsaved])
}
export function useOperation() {
  const [state, setState] = useState<OperationState>('idle')
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)
  const { notify } = useFeedback()
  const run = async <T,>(
    action: () => Promise<T>,
    options: { action: string; success?: string },
  ): Promise<T | undefined> => {
    if (lock.current) return undefined
    lock.current = true
    setState('pending')
    setError(null)
    try {
      const result = await action()
      setState('success')
      if (options.success && result !== false) notify(options.success)
      return result
    } catch (reason) {
      const message = friendlyError(reason, options.action)
      setError(message)
      setState('error')
      notify(message, 'error')
      return undefined
    } finally {
      lock.current = false
    }
  }
  return { state, error, pending: state === 'pending', run }
}

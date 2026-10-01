import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  ChevronDown,
  ChevronUp,
  FileImage,
  Check,
  Box,
  XCircle,
  X,
} from 'lucide-react'
import { Button } from './ui'
import { useFeedback } from './Feedback'
import { client, cmsDb, check, type ContentKind } from '../lib/cms'
import type { MediaAsset } from '../lib/database.types'
import { prepareMedia, validateFile } from '../lib/media-processing'
import { friendlyError } from '../lib/feedback'
import {
  cleanupStorage,
  forgetCleanup,
  reserveUploadPath,
  releaseUploadPath,
  DELETED_EVENT,
  type DeletedRecord,
} from '../lib/deletion'
import { useAuth } from '../auth/AuthProvider'
import { dataCache } from '../lib/cache'
export type UploadState =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
export type UploadItem = {
  id: string
  file: File
  scope: string
  kind: ContentKind | 'library' | 'homepage'
  state: UploadState
  progress?: number
  transferred?: number
  transferTotal?: number
  startedAt?: number
  error?: string
  asset?: MediaAsset
  cancellable: boolean
  dismissed?: boolean
}
type UploadContextValue = {
  items: UploadItem[]
  enqueue: (files: File[], scope: string, kind: UploadItem['kind']) => string[]
  cancel: (id: string) => void
  retry: (id: string) => void
  remove: (id: string) => void
}
const UploadContext = createContext<UploadContextValue | null>(null)

function UploadRing({ item }: { item: UploadItem }) {
  const value =
    item.state === 'uploading' && item.progress !== undefined
      ? Math.max(0, Math.min(99, item.progress))
      : undefined
  return (
    <span
      className={`upload-ring ${item.state === 'queued' ? 'is-waiting' : value === undefined ? 'is-indeterminate' : ''}`}
      role="progressbar"
      aria-label={`${item.file.name} ${item.state}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={item.state === 'queued' ? 0 : value}
      aria-valuetext={
        item.state === 'queued'
          ? 'Waiting to upload'
          : item.state === 'processing'
            ? 'Preparing or finishing file'
            : value === undefined
              ? 'Uploading'
              : `${value}% uploaded`
      }
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle className="upload-ring-track" cx="12" cy="12" r="9" />
        {item.state !== 'queued' && (
          <circle
            className="upload-ring-value"
            cx="12"
            cy="12"
            r="9"
            pathLength="100"
            strokeDasharray={`${value ?? 22} 100`}
          />
        )}
      </svg>
    </span>
  )
}

function transfer(
  file: File,
  path: string,
  token: string,
  signal: AbortSignal,
  progress: (loaded: number, total?: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    xhr.open(
      'POST',
      `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/showcase-media/${path.split('/').map(encodeURIComponent).join('/')}`,
    )
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader(
      'apikey',
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.timeout = 15 * 60 * 1000
    xhr.upload.onprogress = (e) =>
      progress(e.loaded, e.lengthComputable ? e.total : undefined)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else
        reject(
          new Error(
            xhr.status === 401 || xhr.status === 403
              ? 'permission denied'
              : `Storage transfer failed (${xhr.status})`,
          ),
        )
    }
    xhr.onerror = () => reject(new Error('Network interruption'))
    xhr.ontimeout = () => reject(new Error('Network timeout'))
    xhr.onabort = () => reject(new DOMException('Cancelled', 'AbortError'))
    xhr.onloadend = () => signal.removeEventListener('abort', abort)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) {
      signal.removeEventListener('abort', abort)
      reject(new DOMException('Cancelled', 'AbortError'))
      return
    }
    xhr.send(file)
  })
}
export function UploadProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([])
  const current = useRef(items)
  current.current = items
  const [container] = useState(() => {
    const layer = document.createElement('div')
    layer.className = 'upload-layer'
    layer.popover = 'manual'
    return layer
  })
  useEffect(() => {
    const updateContainer = () => {
      const parent =
        Array.from(document.querySelectorAll('.native-dialog[open]')).at(-1) ??
        document.body
      if (container.parentElement !== parent) {
        parent.append(container)
        if (container.matches(':popover-open')) container.hidePopover()
      }
      if (!container.matches(':popover-open')) container.showPopover()
    }
    const observer = new MutationObserver(updateContainer)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    updateContainer()
    return () => {
      observer.disconnect()
      container.remove()
    }
  }, [container])
  useEffect(() => {
    const forgetDeleted = (event: Event) => {
      const { table, id } = (event as CustomEvent<DeletedRecord>).detail
      if (table === 'media_assets')
        setItems((previous) => previous.filter((item) => item.asset?.id !== id))
    }
    window.addEventListener(DELETED_EVENT, forgetDeleted)
    return () => window.removeEventListener(DELETED_EVENT, forgetDeleted)
  }, [])
  const running = useRef(new Map<string, AbortController>())
  const { status } = useAuth()
  useEffect(() => {
    if (status === 'unauthenticated') {
      running.current.forEach((controller) => controller.abort())
      setItems([])
    }
  }, [status])
  const [expanded, setExpanded] = useState(true)
  const { notify } = useFeedback()
  const update = (id: string, patch: Partial<UploadItem>) =>
    setItems((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  const active = items.filter((item) =>
    ['queued', 'uploading', 'processing'].includes(item.state),
  )
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (active.length) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active.length])
  const start = async (item: UploadItem) => {
    const controller = new AbortController()
    let path: string | undefined
    running.current.set(item.id, controller)
    update(item.id, {
      state: 'processing',
      error: undefined,
      progress: undefined,
      cancellable: true,
    })
    try {
      const prepared = await prepareMedia(
        item.file,
        controller.signal,
        item.kind === 'partner',
      )
      const session = await client().auth.getSession()
      check(session.error)
      if (!session.data.session) throw new Error('session expired')
      controller.signal.throwIfAborted()
      const prefix =
        item.kind === 'partner'
          ? 'partners'
          : item.kind === 'material'
            ? 'materials'
            : item.kind === 'homepage'
              ? 'landing'
              : 'works'
      path = `${prefix}/${item.scope}/${item.id}/${prepared.file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-')}`
      await reserveUploadPath(path)
      controller.signal.throwIfAborted()
      update(item.id, {
        state: 'uploading',
        progress: 0,
        transferred: 0,
        transferTotal: prepared.file.size,
        startedAt: Date.now(),
      })
      await transfer(
        prepared.file,
        path,
        session.data.session.access_token,
        controller.signal,
        (loaded, total) =>
          update(item.id, {
            progress: total ? Math.round((loaded / total) * 100) : undefined,
            transferred: loaded,
            transferTotal: total ?? prepared.file.size,
          }),
      )
      controller.signal.throwIfAborted()
      update(item.id, {
        state: 'processing',
        progress: 100,
        cancellable: false,
      })
      const result = await cmsDb()
        .from('media_assets')
        .upsert({
          id: item.id,
          storage_path: path,
          title: item.file.name.replace(/\.[^.]+$/, ''),
          kind: prepared.kind,
          mime_type: prepared.file.type,
          original_filename: item.file.name,
          byte_size: prepared.file.size,
          width: prepared.width ?? null,
          height: prepared.height ?? null,
          processing_status: 'ready',
          status: 'archived',
          is_publicly_deliverable: false,
          uploaded_by: session.data.session.user.id,
          updated_by: session.data.session.user.id,
          created_by: session.data.session.user.id,
        })
        .select()
        .single()
      check(result.error)
      forgetCleanup(path)
      dataCache.clear()
      update(item.id, {
        state: 'completed',
        asset: result.data as MediaAsset,
        file: new File([], item.file.name, { type: item.file.type }),
        progress: 100,
        transferred: prepared.file.size,
        cancellable: false,
      })
    } catch (error) {
      const cancelled = controller.signal.aborted
      // A lost metadata response may still have committed. Preserve the file
      // unless a successful read confirms there is no asset referencing it.
      if (path) {
        try {
          const existing = await cmsDb()
            .from('media_assets')
            .select('*')
            .eq('id', item.id)
            .maybeSingle()
          if (!existing.error && existing.data) {
            dataCache.clear()
            update(item.id, {
              state: 'completed',
              asset: existing.data as MediaAsset,
              file: new File([], item.file.name, { type: item.file.type }),
              transferTotal: (existing.data as MediaAsset).byte_size,
              progress: 100,
              cancellable: false,
            })
            return
          }
          if (!existing.error) {
            const warning = await cleanupStorage(path)
            if (warning) notify(warning, 'warning')
          }
        } catch {
          /* An uncertain commit is safe to retry with the same asset ID. */
        }
      }
      const message = cancelled
        ? undefined
        : friendlyError(error, `upload ${item.file.name}`)
      update(item.id, {
        state: cancelled ? 'cancelled' : 'failed',
        error: message,
        cancellable: false,
      })
      if (!cancelled) notify(`${item.file.name}: ${message}`, 'error')
    } finally {
      if (path) releaseUploadPath(path)
      running.current.delete(item.id)
      setItems((previous) => [...previous])
    }
  }
  useEffect(() => {
    for (const item of items) {
      if (running.current.size >= 2) break
      if (item.state === 'queued' && !running.current.has(item.id))
        void start(item)
    }
  }, [items])
  useEffect(
    () => () => running.current.forEach((controller) => controller.abort()),
    [],
  )
  const enqueue = (files: File[], scope: string, kind: UploadItem['kind']) => {
    const rows = files.map((file) => {
      let error: string | undefined
      try {
        validateFile(file, kind === 'partner')
      } catch (reason) {
        error = friendlyError(reason, 'upload this file')
      }
      return {
        id: crypto.randomUUID(),
        file,
        scope,
        kind,
        state: error ? ('failed' as const) : ('queued' as const),
        error,
        cancellable: !error,
      }
    })
    setItems((previous) => [...previous, ...rows])
    setExpanded(true)
    return rows.map((row) => row.id)
  }
  const cancel = (id: string) => {
    const item = current.current.find((row) => row.id === id)
    if (!item?.cancellable) return
    const controller = running.current.get(id)
    if (controller) controller.abort()
    else update(id, { state: 'cancelled', cancellable: false })
  }
  const retry = (id: string) => {
    const item = current.current.find((row) => row.id === id)
    if (item && ['failed', 'cancelled'].includes(item.state))
      update(id, {
        state: 'queued',
        error: undefined,
        progress: undefined,
        transferred: 0,
        transferTotal: undefined,
        startedAt: undefined,
        cancellable: true,
      })
  }
  const remove = (id: string) => {
    const item = current.current.find((row) => row.id === id)
    if (item?.state === 'completed') update(id, { dismissed: true })
    else
      setItems((previous) =>
        previous.filter(
          (row) =>
            row.id !== id ||
            ['queued', 'uploading', 'processing'].includes(row.state),
        ),
      )
  }
  const notified = useRef(new Set<string>())
  useEffect(() => {
    if (active.length) return
    const ready = items.filter(
      (item) => item.state === 'completed' && !notified.current.has(item.id),
    )
    if (ready.length) {
      ready.forEach((item) => notified.current.add(item.id))
      notify(
        `${ready.length} ${ready.length === 1 ? 'file is' : 'files are'} ready.`,
      )
    }
  }, [items, active.length, notify])
  const visibleItems = items.filter((item) => !item.dismissed)
  const failed = visibleItems.filter((item) => item.state === 'failed').length
  const completed = visibleItems.filter(
    (item) => item.state === 'completed',
  ).length
  const transferItems = visibleItems.filter(
    (item) => !['failed', 'cancelled'].includes(item.state),
  )
  const totalBytes = transferItems.reduce(
    (sum, item) => sum + (item.transferTotal ?? item.file.size),
    0,
  )
  const uploadedBytes = transferItems.reduce(
    (sum, item) =>
      sum +
      (item.state === 'completed'
        ? (item.transferTotal ?? item.file.size)
        : (item.transferred ?? 0)),
    0,
  )
  const rate = active.reduce(
    (sum, item) =>
      sum +
      (item.state === 'uploading' && item.startedAt
        ? (item.transferred ?? 0) /
          Math.max(1, (Date.now() - item.startedAt) / 1000)
        : 0),
    0,
  )
  const seconds =
    rate > 0 ? Math.ceil((totalBytes - uploadedBytes) / rate) : undefined
  const dismiss = () => {
    if (active.length) {
      setExpanded(false)
      return
    }
    setItems((previous) =>
      previous
        .filter((item) => item.state === 'completed')
        .map((item) => ({ ...item, dismissed: true })),
    )
  }
  return (
    <UploadContext.Provider value={{ items, enqueue, cancel, retry, remove }}>
      {children}
      {visibleItems.length > 0 &&
        createPortal(
          <aside className="upload-center" aria-label="Upload Center">
            <div className="upload-center-header">
              <span role="status">
                {active.length
                  ? `Uploading ${active.length} ${active.length === 1 ? 'item' : 'items'}`
                  : failed
                    ? `${failed} ${failed === 1 ? 'upload needs' : 'uploads need'} attention`
                    : completed
                      ? `${completed} ${completed === 1 ? 'upload complete' : 'uploads complete'}`
                      : 'Uploads cancelled'}
              </span>
              <button
                className="upload-center-heading"
                aria-expanded={expanded}
                aria-label={expanded ? 'Collapse uploads' : 'Expand uploads'}
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
              </button>
              <button
                className="upload-icon-button"
                aria-label={
                  active.length ? 'Minimize uploads' : 'Dismiss uploads'
                }
                onClick={dismiss}
              >
                <X size={20} />
              </button>
            </div>
            {expanded && (
              <div className="upload-center-body">
                {active.length > 0 && (
                  <div className="upload-summary">
                    <span>
                      {active.length
                        ? seconds !== undefined
                          ? seconds < 60
                            ? 'Less than a minute left'
                            : `${Math.ceil(seconds / 60)} min left…`
                          : active.some((item) => item.state === 'uploading')
                            ? 'Estimating time left…'
                            : 'Preparing / finishing files…'
                        : ''}
                    </span>
                    {active.some((item) => item.cancellable) && (
                      <button
                        onClick={() =>
                          active.forEach((item) => cancel(item.id))
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}
                <ul>
                  {visibleItems.map((item) => (
                    <li key={item.id} data-state={item.state}>
                      <div className="upload-file-heading">
                        <span
                          className={`upload-file-icon ${item.state !== 'completed' ? 'is-pending' : ''}`}
                          aria-hidden="true"
                        >
                          {item.file.name.toLowerCase().endsWith('.mp4') ? (
                            <svg width="18" height="18" viewBox="0 0 20 20">
                              <path fill="currentColor" d="M2 4h16v13H2z" />
                              <path
                                stroke="#fff"
                                strokeWidth="1.6"
                                d="m4 4 2 4m3-4 2 4m3-4 2 4"
                              />
                            </svg>
                          ) : item.file.name.toLowerCase().endsWith('.glb') ? (
                            <Box size={18} />
                          ) : (
                            <FileImage size={18} />
                          )}
                        </span>
                        <strong title={item.file.name}>{item.file.name}</strong>
                        {item.state === 'completed' ? (
                          <span
                            className="upload-complete-icon"
                            role="img"
                            aria-label="Upload complete"
                          >
                            <Check size={15} strokeWidth={3} />
                          </span>
                        ) : ['failed', 'cancelled'].includes(item.state) ? (
                          <XCircle
                            className={
                              item.state === 'failed'
                                ? 'upload-state--failed'
                                : 'upload-cancelled-icon'
                            }
                            size={20}
                          />
                        ) : item.cancellable ? (
                          <button
                            type="button"
                            className="upload-cancel-file"
                            aria-label={`Cancel upload ${item.file.name}`}
                            title="Cancel upload"
                            onClick={() => cancel(item.id)}
                          >
                            <UploadRing item={item} />
                            <XCircle
                              className="upload-cancel-hover"
                              size={20}
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <UploadRing item={item} />
                        )}
                      </div>
                      <span
                        className={`upload-state sr-only upload-state--${item.state}`}
                      >
                        {
                          {
                            queued: 'Waiting…',
                            uploading:
                              item.progress === undefined
                                ? 'Uploading…'
                                : `Uploading ${item.progress}%`,
                            processing:
                              item.progress === 100
                                ? 'Finishing media metadata…'
                                : 'Preparing and validating media…',
                            completed: '✓ Ready',
                            failed: '✕ Failed',
                            cancelled: 'Cancelled',
                          }[item.state]
                        }
                      </span>
                      {item.error && (
                        <p className="field-error">{item.error}</p>
                      )}
                      {['failed', 'cancelled'].includes(item.state) && (
                        <div className="upload-actions">
                          {['failed', 'cancelled'].includes(item.state) && (
                            <Button onClick={() => retry(item.id)}>
                              Retry upload
                            </Button>
                          )}
                          {!active.includes(item) && (
                            <Button onClick={() => remove(item.id)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>,
          container,
        )}
    </UploadContext.Provider>
  )
}
export function useUploads() {
  const value = useContext(UploadContext)
  if (!value) throw new Error('UploadProvider missing')
  return value
}

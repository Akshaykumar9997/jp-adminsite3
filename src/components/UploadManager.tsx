import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { Button } from './ui'
import { Progress, useFeedback } from './Feedback'
import { client, cmsDb, check, type ContentKind } from '../lib/cms'
import type { MediaAsset } from '../lib/database.types'
import { prepareMedia, validateFile } from '../lib/media-processing'
import { friendlyError } from '../lib/feedback'
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
  const [container, setContainer] = useState<Element>(document.body)
  useEffect(() => {
    const updateContainer = () =>
      setContainer(
        Array.from(document.querySelectorAll('.native-dialog[open]')).at(-1) ??
          document.body,
      )
    const observer = new MutationObserver(updateContainer)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    })
    return () => observer.disconnect()
  }, [])
  const running = useRef(new Map<string, AbortController>())
  const [expanded, setExpanded] = useState(true)
  const { notify } = useFeedback()
  const location = useLocation()
  useEffect(() => setExpanded(false), [location.pathname])
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
      const path = `${prefix}/${item.scope}/${item.id}/${prepared.file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-')}`
      update(item.id, {
        state: 'uploading',
        progress: 0,
        transferred: 0,
        transferTotal: prepared.file.size,
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
          status: 'draft',
          is_publicly_deliverable: false,
          uploaded_by: session.data.session.user.id,
          updated_by: session.data.session.user.id,
          created_by: session.data.session.user.id,
        })
        .select()
        .single()
      check(result.error)
      update(item.id, {
        state: 'completed',
        asset: result.data as MediaAsset,
        progress: 100,
        transferred: prepared.file.size,
        cancellable: false,
      })
    } catch (error) {
      const cancelled = controller.signal.aborted
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
      running.current.delete(item.id)
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
      if (!items.some((item) => item.state === 'failed')) setExpanded(false)
    }
  }, [items, active.length, notify])
  const visibleItems = items.filter(
    (item) =>
      !item.dismissed && !['completed', 'cancelled'].includes(item.state),
  )
  const failed = visibleItems.filter((item) => item.state === 'failed').length
  const measurable = visibleItems.every(
    (item) =>
      item.transferTotal !== undefined ||
      ['failed', 'cancelled'].includes(item.state),
  )
  const totalBytes = visibleItems.reduce(
    (sum, item) => sum + (item.transferTotal ?? 0),
    0,
  )
  const uploadedBytes = visibleItems.reduce(
    (sum, item) => sum + (item.transferred ?? 0),
    0,
  )
  return (
    <UploadContext.Provider value={{ items, enqueue, cancel, retry, remove }}>
      {children}
      {visibleItems.length > 0 &&
        createPortal(
          <aside className="upload-center" aria-label="Upload Center">
            <button
              className="upload-center-heading"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              Uploads · {active.length} active
              {failed > 0 ? ` · ${failed} need attention` : ''}{' '}
              <span>{expanded ? '−' : '+'}</span>
            </button>
            {expanded && (
              <div className="upload-center-body">
                <Progress
                  value={
                    measurable && totalBytes
                      ? Math.min(
                          100,
                          Math.round((uploadedBytes / totalBytes) * 100),
                        )
                      : undefined
                  }
                  label="Overall file transfer progress"
                />
                <p className="muted">
                  Keep this tab open. You can navigate the CMS during uploads.
                </p>
                <ul>
                  {visibleItems.map((item) => (
                    <li key={item.id}>
                      <strong>{item.file.name}</strong>
                      <span
                        className={`upload-state upload-state--${item.state}`}
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
                      {['uploading', 'processing'].includes(item.state) && (
                        <Progress
                          value={
                            item.state === 'uploading'
                              ? item.progress
                              : undefined
                          }
                          label={`${item.file.name} ${item.state}`}
                        />
                      )}
                      {item.error && (
                        <p className="field-error">{item.error}</p>
                      )}
                      <div>
                        {item.cancellable && (
                          <Button onClick={() => cancel(item.id)}>
                            Cancel
                          </Button>
                        )}
                        {['failed', 'cancelled'].includes(item.state) && (
                          <Button onClick={() => retry(item.id)}>
                            Retry upload
                          </Button>
                        )}
                        {!active.includes(item) && (
                          <Button onClick={() => remove(item.id)}>
                            {item.state === 'completed' ? 'Dismiss' : 'Remove'}
                          </Button>
                        )}
                      </div>
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

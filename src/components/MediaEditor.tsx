import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { Button } from './ui'
import {
  ArrowLeft,
  ArrowRight,
  Box,
  Check,
  Eye,
  GripVertical,
  X,
} from 'lucide-react'
import { Dialog, EmptyState, Loader, useOperation } from './Feedback'
import {
  cmsDb,
  check,
  mediaUrl,
  reorderMedia,
  type ContentKind,
} from '../lib/cms'
import type { MediaAsset } from '../lib/database.types'
import { LOGO_ACCEPT, MEDIA_ACCEPT } from '../lib/media-processing'
import { moveItem } from '../lib/feedback'
import { useUploads } from './UploadManager'

export function MediaPreview({
  asset,
  controls = false,
}: {
  asset: MediaAsset
  controls?: boolean
}) {
  const [url, setUrl] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [poster, setPoster] = useState<string>()
  useEffect(() => {
    let active = true
    setUrl(undefined)
    setFailed(false)
    void mediaUrl(asset)
      .then((value) => {
        if (active) setUrl(value)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
    }
  }, [asset.id, asset.storage_path, attempt])
  useEffect(() => {
    let active = true
    setPoster(undefined)
    if (asset.poster_asset_id)
      void Promise.resolve(
        cmsDb()
          .from('media_assets')
          .select('*')
          .eq('id', asset.poster_asset_id)
          .single(),
      )
        .then(async (result) => {
          check(result.error)
          const value = await mediaUrl(result.data as MediaAsset)
          if (active) setPoster(value)
        })
        .catch(() => {
          /* Optional poster; preserve the native first-frame fallback. */
        })
    return () => {
      active = false
    }
  }, [asset.poster_asset_id])
  if (failed)
    return (
      <div className="media-placeholder">
        Preview unavailable
        <Button onClick={() => setAttempt((value) => value + 1)}>
          Retry preview
        </Button>
      </div>
    )
  if (!url) return <Loader label="Loading media preview…" />
  if (asset.kind === 'image')
    return (
      <img
        src={url}
        alt={asset.alt_text || asset.title}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    )
  if (asset.kind === 'video')
    return (
      <video
        src={url}
        poster={poster}
        controls={controls}
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    )
  return controls ? (
    <ModelPreview url={url} title={asset.title} />
  ) : (
    <div className="media-placeholder">
      <Box size={28} /> 3D model
    </div>
  )
}

function ModelPreview({ url, title }: { url: string; title: string }) {
  const container = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState('loading')
    const element = document.createElement('model-viewer')
    element.setAttribute('src', url)
    element.setAttribute('alt', title)
    element.setAttribute('camera-controls', '')
    element.setAttribute('touch-action', 'pan-y')
    const failed = () => {
      clearTimeout(timeout)
      if (active) setState('error')
    }
    const ready = () => {
      clearTimeout(timeout)
      if (active) setState('ready')
    }
    element.addEventListener('error', failed)
    element.addEventListener('load', ready)
    const timeout = setTimeout(failed, 30000)
    let script = document.querySelector<HTMLScriptElement>(
      '#model-viewer-script',
    )
    if (!script && !customElements.get('model-viewer')) {
      script = document.createElement('script')
      script.id = 'model-viewer-script'
      script.type = 'module'
      script.src =
        'https://ajax.googleapis.com/ajax/libs/model-viewer/4.1.0/model-viewer.min.js'
      document.head.append(script)
    }
    script?.addEventListener('error', failed)
    container.current?.replaceChildren(element)
    return () => {
      active = false
      clearTimeout(timeout)
      script?.removeEventListener('error', failed)
      element.remove()
    }
  }, [url, title, attempt])
  return (
    <>
      <div ref={container} className="model-preview" />
      {state === 'loading' && (
        <Loader label="Loading interactive 3D preview…" />
      )}
      {state === 'error' && (
        <p className="field-error">
          The 3D preview could not load.{' '}
          <Button
            onClick={() => {
              const script = document.querySelector('#model-viewer-script')
              if (!customElements.get('model-viewer')) script?.remove()
              setAttempt((value) => value + 1)
            }}
          >
            Retry preview
          </Button>
        </p>
      )}
    </>
  )
}

export function MediaEditor({
  scope,
  kind,
  available,
  ids,
  onChange,
  cover,
  onCover,
  coverOptions = [],
  persistOrder = false,
  disabled = false,
  imageOnly = false,
}: {
  scope: string
  kind: ContentKind | 'homepage'
  available: MediaAsset[]
  ids: string[]
  onChange: (ids: string[]) => void
  cover: string | null
  onCover: (id: string | null) => void
  coverOptions?: MediaAsset[]
  persistOrder?: boolean
  disabled?: boolean
  imageOnly?: boolean
}) {
  const uploads = useUploads()
  const operation = useOperation()
  const [library, setLibrary] = useState(false)
  const [preview, setPreview] = useState<MediaAsset | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const seen = useRef(new Set<string>())
  const source = useRef<number | null>(null)
  const queued = useRef(new Set<string>())
  const grid = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const next = new Map<string, DOMRect>()
    grid.current
      ?.querySelectorAll<HTMLElement>('[data-media-id]')
      .forEach((card) => {
        const id = card.dataset.mediaId!
        const bounds = card.getBoundingClientRect()
        const before = positions.current.get(id)
        next.set(id, bounds)
        if (
          before &&
          !matchMedia('(prefers-reduced-motion: reduce)').matches &&
          (before.x !== bounds.x || before.y !== bounds.y)
        )
          card.animate(
            [
              {
                transform: `translate(${before.x - bounds.x}px, ${before.y - bounds.y}px)`,
              },
              { transform: 'none' },
            ],
            { duration: 160, easing: 'ease-out' },
          )
      })
    positions.current = next
  }, [ids])
  useEffect(() => {
    const detached = ids.filter(
      (id) =>
        queued.current.has(id) &&
        !uploads.items.some(
          (item) => item.id === id && item.state !== 'cancelled',
        ),
    )
    if (detached.length) onChange(ids.filter((id) => !detached.includes(id)))
  }, [uploads.items, ids, onChange])
  const all = [...available]
  for (const item of uploads.items)
    if (item.asset && !all.some((a) => a.id === item.asset!.id))
      all.push(item.asset)
  useEffect(() => {
    const additions = uploads.items.filter(
      (item) =>
        item.scope === scope &&
        queued.current.has(item.id) &&
        item.asset &&
        ids.includes(item.id) &&
        !seen.current.has(item.id),
    )
    if (!additions.length) return
    additions.forEach((item) => seen.current.add(item.id))
    onChange([...new Set([...ids, ...additions.map((item) => item.asset!.id)])])
  }, [uploads.items, scope, ids, onChange])
  const assets = ids
    .map((id) => all.find((a) => a.id === id))
    .filter((a): a is MediaAsset => !!a)
  const images = [...assets, ...coverOptions].filter(
    (a, i, array) =>
      a.kind === 'image' && array.findIndex((b) => b.id === a.id) === i,
  )
  const move = async (from: number, to: number) => {
    if (disabled || operation.pending) return
    const next = moveItem(ids, from, to)
    if (next === ids) return
    onChange(next)
    setDragging(null)
    if (persistOrder && kind !== 'homepage' && kind !== 'partner')
      await operation.run(
        async () => {
          try {
            await reorderMedia(kind, scope, next)
          } catch (error) {
            onChange(ids)
            throw error
          }
        },
        { action: 'save media order' },
      )
  }
  const fileChange = (files: FileList | null) => {
    if (files) {
      const pending = uploads.enqueue(Array.from(files), scope, kind)
      pending.forEach((id) => queued.current.add(id))
      onChange([...ids, ...pending])
    }
  }
  return (
    <section className="media-editor" aria-label="Mixed media collection">
      <div className="media-editor-heading">
        <div>
          <h3>
            {kind === 'partner' ? 'Logo' : imageOnly ? 'Cover image' : 'Media'}
          </h3>
          <p>
            {kind === 'partner'
              ? 'SVG logos use a safe WebP fallback.'
              : imageOnly
                ? 'Choose an image for this section.'
                : 'Arrange images, videos and GLB models together. Drag the handle or use the arrow buttons.'}
          </p>
        </div>
        <label className="button button--secondary upload-label">
          Upload {kind === 'partner' ? 'logo' : 'files'}
          <input
            type="file"
            multiple={kind !== 'partner'}
            accept={
              kind === 'partner'
                ? LOGO_ACCEPT
                : imageOnly
                  ? '.jpg,.jpeg,.png,.webp'
                  : MEDIA_ACCEPT
            }
            disabled={disabled}
            onChange={(e) => {
              fileChange(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <Button disabled={disabled} onClick={() => setLibrary(true)}>
          Choose existing
        </Button>
      </div>
      {operation.pending && <Loader label="Saving media order…" />}
      {!assets.length && (
        <EmptyState
          title={kind === 'partner' ? 'No logo selected' : 'No media yet'}
        >
          Upload files or choose existing showcase media.
        </EmptyState>
      )}
      <div ref={grid} className="mixed-grid">
        {assets.map((asset, index) => (
          <article
            key={asset.id}
            data-media-index={index}
            data-media-id={asset.id}
            className={`mixed-card ${dragging === asset.id ? 'dragging' : ''}`}
            style={{ '--media-index': index } as CSSProperties}
          >
            <div className="mixed-preview">
              <MediaPreview asset={asset} />
              <span className="media-kind">
                {asset.kind === 'model_3d' ? '3D' : asset.kind}
              </span>
            </div>
            <strong>{asset.title}</strong>
            <div className="mixed-actions">
              <button
                type="button"
                className="drag-handle"
                draggable={false}
                aria-label={`Drag ${asset.title}`}
                onPointerDown={(e) => {
                  if (disabled || operation.pending) return
                  e.preventDefault()
                  e.currentTarget.focus()
                  source.current = index
                  setDragging(asset.id)
                  e.currentTarget.setPointerCapture(e.pointerId)
                }}
                onPointerUp={(e) => {
                  const target = document
                    .elementFromPoint(e.clientX, e.clientY)
                    ?.closest<HTMLElement>('[data-media-index]')
                  if (target && source.current !== null)
                    void move(source.current, Number(target.dataset.mediaIndex))
                  setDragging(null)
                  source.current = null
                }}
                onPointerCancel={() => {
                  setDragging(null)
                  source.current = null
                }}
              >
                <GripVertical size={18} />
              </button>
              <Button
                disabled={disabled || index === 0 || operation.pending}
                aria-label={`Move ${asset.title} earlier`}
                onClick={() => void move(index, index - 1)}
              >
                <ArrowLeft size={18} />
              </Button>
              <Button
                disabled={
                  disabled || index === assets.length - 1 || operation.pending
                }
                aria-label={`Move ${asset.title} later`}
                onClick={() => void move(index, index + 1)}
              >
                <ArrowRight size={18} />
              </Button>
              <Button
                onClick={() => setPreview(asset)}
                aria-label={`Preview ${asset.title}`}
              >
                <Eye size={18} />
              </Button>
              <Button
                disabled={disabled}
                aria-label={`Detach ${asset.title}`}
                onClick={() => {
                  onChange(ids.filter((id) => id !== asset.id))
                  if (cover === asset.id) onCover(null)
                }}
              >
                <X size={18} />
              </Button>
            </div>
            {asset.kind === 'image' && (
              <Button
                disabled={disabled}
                className={cover === asset.id ? 'cover-selected' : ''}
                onClick={() => onCover(asset.id)}
              >
                {cover === asset.id ? (
                  <>
                    <Check size={16} /> Cover image
                  </>
                ) : (
                  'Use as cover'
                )}
              </Button>
            )}
          </article>
        ))}
      </div>
      {images.length > 0 && (kind === 'room' || kind === 'partner') && (
        <label className="field">
          <span>{kind === 'partner' ? 'Selected logo' : 'Cover image'}</span>
          <select
            aria-label={kind === 'partner' ? 'Selected logo' : 'Cover image'}
            value={cover ?? ''}
            disabled={disabled}
            onChange={(e) => onCover(e.target.value || null)}
          >
            <option value="">Use first available image</option>
            {images.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.title}
              </option>
            ))}
          </select>
        </label>
      )}
      {library && (
        <Dialog title="Choose showcase media" onClose={() => setLibrary(false)}>
          <div className="mixed-grid library-picker">
            {all
              .filter(
                (asset) =>
                  !asset.storage_path.startsWith('internal/') &&
                  asset.processing_status === 'ready' &&
                  (!(kind === 'partner' || imageOnly) ||
                    asset.kind === 'image') &&
                  ['image', 'video', 'model_3d'].includes(asset.kind),
              )
              .map((asset) => (
                <button
                  key={asset.id}
                  className="media-pick"
                  onClick={() => {
                    onChange([...new Set([...ids, asset.id])])
                    if (kind === 'partner') onCover(asset.id)
                    setLibrary(false)
                  }}
                >
                  <MediaPreview asset={asset} />
                  <strong>{asset.title}</strong>
                </button>
              ))}
          </div>
          {!all.length && (
            <EmptyState title="No available files">
              Upload your first file.
            </EmptyState>
          )}
        </Dialog>
      )}
      {preview && (
        <Dialog title={preview.title} onClose={() => setPreview(null)}>
          <div className="large-preview">
            <MediaPreview asset={preview} controls />
          </div>
        </Dialog>
      )}
    </section>
  )
}

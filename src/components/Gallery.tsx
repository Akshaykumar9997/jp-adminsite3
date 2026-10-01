import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type PointerEvent,
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckSquare,
  Info,
  Pencil,
  Trash2,
  X,
  Download,
} from 'lucide-react'
import { Button, Dropdown } from './ui'
import { Dialog, useFeedback } from './Feedback'
import { MediaPreview } from './MediaEditor'
import {
  client,
  saveContent,
  type ContentKind,
  type ContentRecord,
  type loadCms,
} from '../lib/cms'
import type { MediaAsset } from '../lib/database.types'
import { friendlyError } from '../lib/feedback'
import { moveToTrash } from '../lib/trash'
import { CHANGED_EVENT } from '../lib/trash'
import { renameMediaAsset } from '../lib/showcase'

function ImageViewport({
  asset,
  next,
}: {
  asset: MediaAsset
  next: (delta: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const transform = useRef({ scale: 1, x: 0, y: 0 })
  const [view, setView] = useState(transform.current)
  const points = useRef(new Map<number, { x: number; y: number }>())
  const start = useRef({ scale: 1, x: 0, y: 0, px: 0, py: 0, distance: 0 })
  const pinched = useRef(false),
    lastTap = useRef({ time: 0, x: 0, y: 0 })
  const pointerType = useRef('mouse')
  const apply = (scale: number, x: number, y: number) => {
    const img = ref.current?.querySelector('img')
    const width = ref.current?.clientWidth ?? 0,
      height = ref.current?.clientHeight ?? 0
    const fit =
      img?.naturalWidth && img.naturalHeight
        ? Math.min(width / img.naturalWidth, height / img.naturalHeight)
        : 0
    const limitX = Math.max(
        0,
        ((img?.naturalWidth ?? 0) * fit * scale - width) / 2,
      ),
      limitY = Math.max(
        0,
        ((img?.naturalHeight ?? 0) * fit * scale - height) / 2,
      )
    transform.current = {
      scale,
      x: Math.max(-limitX, Math.min(limitX, x)),
      y: Math.max(-limitY, Math.min(limitY, y)),
    }
    setView(transform.current)
  }
  const zoomAt = (scale: number, clientX: number, clientY: number) => {
    const rect = ref.current!.getBoundingClientRect(),
      old = transform.current
    scale = Math.max(1, Math.min(5, scale))
    const x = clientX - rect.left - rect.width / 2,
      y = clientY - rect.top - rect.height / 2
    apply(
      scale,
      x - ((x - old.x) * scale) / old.scale,
      y - ((y - old.y) * scale) / old.scale,
    )
  }
  const baseline = () => {
    const current = [...points.current.values()]
    if (!current.length) return
    const a = current[0],
      b = current[1] ?? a
    start.current = {
      ...transform.current,
      px: (a.x + b.x) / 2,
      py: (a.y + b.y) / 2,
      distance: Math.hypot(a.x - b.x, a.y - b.y),
    }
  }
  useEffect(() => {
    const el = ref.current!
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const delta =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? el.clientHeight
            : 1)
      zoomAt(
        transform.current.scale * Math.exp(-delta * 0.002),
        event.clientX,
        event.clientY,
      )
    }
    const resize = () => apply(1, 0, 0)
    el.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('resize', resize)
    return () => {
      el.removeEventListener('wheel', wheel)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return (
    <div
      ref={ref}
      className={`gallery-viewer-media large-preview gallery-image-stage ${view.scale > 1 ? 'is-magnified' : ''}`}
      tabIndex={0}
      role="region"
      aria-label="Image preview: scroll or pinch to zoom, drag to pan. Plus and minus zoom; zero resets."
      data-zoom={view.scale.toFixed(2)}
      style={
        {
          '--image-scale': view.scale,
          '--image-x': `${view.x}px`,
          '--image-y': `${view.y}px`,
        } as React.CSSProperties
      }
      onDoubleClick={(event) => {
        if (pointerType.current === 'touch') return
        zoomAt(
          transform.current.scale > 1 ? 1 : 2,
          event.clientX,
          event.clientY,
        )
      }}
      onKeyDown={(event) => {
        const rect = ref.current!.getBoundingClientRect()
        if (
          ['+', '=', '-', '0'].includes(event.key) &&
          !event.ctrlKey &&
          !event.metaKey
        ) {
          event.preventDefault()
          zoomAt(
            event.key === '0'
              ? 1
              : transform.current.scale * (event.key === '-' ? 0.8 : 1.25),
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          )
        }
        if (
          transform.current.scale > 1 &&
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
            event.key,
          )
        ) {
          event.preventDefault()
          event.stopPropagation()
          apply(
            transform.current.scale,
            transform.current.x +
              (event.key === 'ArrowLeft'
                ? 40
                : event.key === 'ArrowRight'
                  ? -40
                  : 0),
            transform.current.y +
              (event.key === 'ArrowUp'
                ? 40
                : event.key === 'ArrowDown'
                  ? -40
                  : 0),
          )
        }
      }}
      onPointerDown={(event) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return
        pointerType.current = event.pointerType
        event.currentTarget.setPointerCapture(event.pointerId)
        points.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        if (points.current.size > 1) pinched.current = true
        baseline()
      }}
      onPointerMove={(event) => {
        if (!points.current.has(event.pointerId)) return
        points.current.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        })
        const current = [...points.current.values()],
          initial = start.current
        if (current.length > 1 && initial.distance > 0) {
          const [a, b] = current,
            rect = ref.current!.getBoundingClientRect(),
            scale = Math.max(
              1,
              Math.min(
                5,
                (initial.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
                  initial.distance,
              ),
            )
          const x = initial.px - rect.left - rect.width / 2,
            y = initial.py - rect.top - rect.height / 2
          apply(
            scale,
            (a.x + b.x) / 2 -
              rect.left -
              rect.width / 2 -
              ((x - initial.x) * scale) / initial.scale,
            (a.y + b.y) / 2 -
              rect.top -
              rect.height / 2 -
              ((y - initial.y) * scale) / initial.scale,
          )
        } else if (transform.current.scale > 1)
          apply(
            initial.scale,
            initial.x + event.clientX - initial.px,
            initial.y + event.clientY - initial.py,
          )
      }}
      onPointerUp={(event) => {
        const initial = start.current,
          dx = event.clientX - initial.px,
          dy = event.clientY - initial.py
        if (
          event.pointerType === 'touch' &&
          points.current.size === 1 &&
          !pinched.current
        ) {
          if (
            transform.current.scale === 1 &&
            Math.abs(dx) > 60 &&
            Math.abs(dx) > Math.abs(dy)
          )
            next(dx < 0 ? 1 : -1)
          else if (Math.hypot(dx, dy) < 12) {
            const last = lastTap.current
            if (
              Date.now() - last.time < 300 &&
              Math.hypot(event.clientX - last.x, event.clientY - last.y) < 24
            ) {
              zoomAt(
                transform.current.scale > 1 ? 1 : 2,
                event.clientX,
                event.clientY,
              )
              lastTap.current.time = 0
            } else
              lastTap.current = {
                time: Date.now(),
                x: event.clientX,
                y: event.clientY,
              }
          }
        }
        points.current.delete(event.pointerId)
        baseline()
        if (!points.current.size) pinched.current = false
      }}
      onPointerCancel={(event) => {
        points.current.delete(event.pointerId)
        baseline()
        if (!points.current.size) pinched.current = false
      }}
      onLostPointerCapture={(event) => {
        points.current.delete(event.pointerId)
        baseline()
        if (!points.current.size) pinched.current = false
      }}
    >
      <MediaPreview asset={asset} controls />
      <span className="gallery-zoom-hint" aria-hidden="true">
        {view.scale > 1
          ? `${Math.round(view.scale * 100)}% · Drag to move`
          : 'Scroll or pinch to zoom'}
      </span>
    </div>
  )
}

export function useGallerySelection(
  rows: { id: string; title: string }[],
  reload: () => Promise<void>,
) {
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const lock = useRef(false)
  const anchor = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const held = useRef(false)
  const origin = useRef({ x: 0, y: 0 })
  const { confirm, notify } = useFeedback()
  const ids = rows.map((row) => row.id).join(',')
  useEffect(() => {
    const allowed = new Set(ids.split(','))
    setSelected((previous) =>
      [...previous].some((id) => !allowed.has(id))
        ? new Set([...previous].filter((id) => allowed.has(id)))
        : previous,
    )
  }, [ids])
  useEffect(() => () => clearTimeout(timer.current), [])
  const done = () => {
    if (!lock.current) {
      setSelecting(false)
      setSelected(new Set())
      setErrors([])
    }
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !selecting ||
        lock.current ||
        document.querySelector('dialog[open]') ||
        (event.target as HTMLElement)?.closest('input,textarea,select')
      )
        return
      if (event.key === 'Escape') {
        event.preventDefault()
        done()
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setSelected(new Set(rows.map((row) => row.id)))
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [selecting, ids])
  const toggle = (id: string, range = false) => {
    if (lock.current) return
    setSelecting(true)
    setSelected((previous) => {
      const next = new Set(previous)
      const start = rows.findIndex((row) => row.id === anchor.current)
      const end = rows.findIndex((row) => row.id === id)
      if (range && start >= 0)
        rows
          .slice(Math.min(start, end), Math.max(start, end) + 1)
          .forEach((row) => next.add(row.id))
      else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!range) anchor.current = id
  }
  const bind = (id: string, open: () => void) => ({
    onClick: (event: MouseEvent) => {
      if (held.current) {
        held.current = false
        event.preventDefault()
        return
      }
      if (selecting || event.shiftKey || event.ctrlKey || event.metaKey)
        toggle(id, event.shiftKey)
      else open()
    },
    onContextMenu: (event: MouseEvent) => {
      event.preventDefault()
      toggle(id)
    },
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || lock.current) return
      held.current = false
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => {
        held.current = true
        toggle(id)
      }, 500)
    },
    onPointerMove: (event: PointerEvent) => {
      if (
        Math.hypot(
          event.clientX - origin.current.x,
          event.clientY - origin.current.y,
        ) > 10
      )
        clearTimeout(timer.current)
    },
    onPointerUp: () => clearTimeout(timer.current),
    onPointerCancel: () => {
      clearTimeout(timer.current)
      held.current = false
    },
  })
  const run = async (
    label: string,
    action: (id: string) => Promise<void | string>,
    destructive = false,
  ) => {
    if (lock.current || !selected.size) return
    lock.current = true
    setBusy(true)
    try {
      const chosen = rows.filter((row) => selected.has(row.id))
      if (
        destructive &&
        !(await confirm({
          title: label,
          message: `${label} for ${chosen.length} selected ${chosen.length === 1 ? 'item' : 'items'}? ${label.includes('permanently') ? 'This cannot be undone.' : 'You can restore them from Trash.'}`,
          confirmLabel: label,
          destructive: true,
        }))
      )
        return
      const failures: string[] = [],
        remaining = new Set<string>()
      let succeeded = 0
      for (const row of chosen) {
        try {
          const warning = await action(row.id)
          if (warning) notify(warning, 'warning')
          succeeded++
        } catch (error) {
          remaining.add(row.id)
          failures.push(
            `${row.title}: ${friendlyError(error, label.toLowerCase())}`,
          )
        }
      }
      setSelected(remaining)
      setErrors(failures)
      if (succeeded)
        notify(`${succeeded} ${succeeded === 1 ? 'item' : 'items'} updated.`)
      await reload()
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return {
    selecting,
    selected,
    busy,
    errors,
    toggle,
    bind,
    run,
    done,
    begin: () => setSelecting(true),
    all: () => setSelected(new Set(rows.map((row) => row.id))),
    clear: () => setSelected(new Set()),
  }
}
export type GallerySelection = ReturnType<typeof useGallerySelection>
export function ContentSelectionActions({
  selection,
  rows,
  kind,
  workspace,
  edit,
}: {
  selection: GallerySelection
  rows: ContentRecord[]
  kind: ContentKind
  workspace: Awaited<ReturnType<typeof loadCms>> | null
  edit: (row: ContentRecord) => void
}) {
  const [status, setStatus] = useState('')
  const [tier, setTier] = useState('')
  const table = {
    work: 'works',
    room: 'room_categories',
    material: 'materials',
    partner: 'partners',
  } as const
  return (
    <>
      <Button
        disabled={selection.busy || selection.selected.size !== 1}
        onClick={() => {
          const row = rows.find((row) => selection.selected.has(row.id))
          if (row) edit(row)
        }}
      >
        <Pencil size={17} /> Edit
      </Button>
      <Dropdown
        label="Bulk visibility"
        value={status}
        disabled={selection.busy}
        onChange={setStatus}
        options={[
          { value: '', label: 'Keep visibility' },
          { value: 'published', label: 'Published' },
          { value: 'archived', label: 'Archived' },
        ]}
      />
      {kind === 'material' && (
        <Dropdown
          label="Bulk material category"
          value={tier}
          disabled={selection.busy}
          onChange={setTier}
          options={[
            { value: '', label: 'Keep category' },
            { value: 'low', label: 'Essentials' },
            { value: 'mid', label: 'Signature' },
            { value: 'top', label: 'Premium' },
          ]}
        />
      )}
      <Button
        disabled={
          selection.busy || !selection.selected.size || (!status && !tier)
        }
        onClick={() =>
          void selection.run('Apply changes', async (id) => {
            const row = rows.find((row) => row.id === id)!
            const assets =
              kind === 'partner'
                ? row.logo_asset_id
                  ? [row.logo_asset_id]
                  : []
                : (workspace?.media
                    .filter(
                      (item) =>
                        item.owner_kind === kind && item.owner_id === id,
                    )
                    .map((item) => item.media_asset_id) ?? [])
            await saveContent(
              kind,
              id,
              {
                ...row,
                status: status || row.status,
                ...(kind === 'material' ? { tier: tier || row.tier } : {}),
              },
              assets,
              row.cover_asset_id ?? row.logo_asset_id ?? null,
            )
          })
        }
      >
        Apply
      </Button>
      <Button
        disabled={selection.busy || !selection.selected.size}
        onClick={() =>
          void selection.run(
            'Move to Trash',
            async (id) => {
              await moveToTrash(table[kind], id)
            },
            true,
          )
        }
      >
        <Trash2 size={17} /> Trash
      </Button>
    </>
  )
}
export function SelectionBar({
  selection,
  children,
}: {
  selection: GallerySelection
  children: ReactNode
}) {
  if (!selection.selecting)
    return (
      <Button onClick={selection.begin}>
        <CheckSquare size={18} /> Select
      </Button>
    )
  return (
    <>
      <div
        className="gallery-selection"
        role="region"
        aria-label="Selection actions"
        aria-busy={selection.busy}
      >
        <strong role="status">{selection.selected.size} selected</strong>
        <Button disabled={selection.busy} onClick={selection.all}>
          Select all results
        </Button>
        <Button disabled={selection.busy} onClick={selection.clear}>
          Clear
        </Button>
        <div className="gallery-selection-actions">{children}</div>
        <Button disabled={selection.busy} onClick={selection.done}>
          <X size={16} /> Done
        </Button>
      </div>
      {selection.errors.length > 0 && (
        <div className="gallery-errors" role="alert">
          <strong>Some items need attention. They remain selected.</strong>
          <ul>
            {selection.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
export function GalleryTile({
  id,
  title,
  selection,
  open,
  children,
  subtitle,
  footer,
  badge,
  className = '',
}: {
  id: string
  title: string
  selection: GallerySelection
  open: () => void
  children: ReactNode
  subtitle?: string
  footer?: ReactNode
  badge?: string
  className?: string
}) {
  const checked = selection.selected.has(id)
  return (
    <article
      className={`gallery-tile content-card ${checked ? 'is-selected' : ''} ${className}`}
    >
      <button
        className="gallery-tile-main content-card-main"
        aria-label={`Open ${title}`}
        disabled={selection.busy}
        {...selection.bind(id, open)}
      >
        <div className="gallery-tile-image content-card-image">
          {children}
          {badge && <span className="gallery-kind">{badge}</span>}
        </div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </button>
      {selection.selecting && (
        <label className="gallery-check">
          <input
            aria-label={`Select ${title}`}
            type="checkbox"
            checked={checked}
            disabled={selection.busy}
            onChange={() => selection.toggle(id)}
          />
          <span>
            <Check size={15} />
          </span>
        </label>
      )}
      {!selection.selecting && footer && <footer>{footer}</footer>}
    </article>
  )
}
export function GalleryViewer({
  assets,
  initialId,
  onClose,
  onRename = renameMediaAsset,
  initialEditing = false,
  onTrash = async (asset: MediaAsset) => {
    await moveToTrash('media_assets', asset.id)
  },
}: {
  assets: MediaAsset[]
  initialId: string
  onClose: () => void
  onRename?: (asset: MediaAsset, name: string) => Promise<MediaAsset>
  initialEditing?: boolean
  onTrash?: (asset: MediaAsset) => Promise<void>
}) {
  const [id, setId] = useState(initialId)
  const [renamed, setRenamed] = useState<Record<string, MediaAsset>>({})
  const [details, setDetails] = useState(initialEditing)
  const [editing, setEditing] = useState(initialEditing)
  const [name, setName] = useState(
    assets.find((asset) => asset.id === initialId)?.original_filename ?? '',
  )
  const [nameError, setNameError] = useState('')
  const [actionError, setActionError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const [operation, setOperation] = useState<
    'rename' | 'download' | 'trash' | null
  >(null)
  const busy = operation !== null
  const busyRef = useRef(false)
  const { confirm, notify } = useFeedback()
  const index = assets.findIndex((asset) => asset.id === id)
  const asset = renamed[id] ?? assets[index]
  const move = (delta: number) => {
    const next = assets[index + delta]
    if (next && !busyRef.current && !editing) {
      setId(next.id)
      setName(next.original_filename)
      setNameError('')
    }
  }
  useEffect(() => {
    if (!asset && assets.length) setId(assets[0].id)
    if (!assets.length) onClose()
  }, [id, assets])
  useEffect(() => {
    if (editing && details) {
      nameInput.current?.focus()
      nameInput.current?.select()
    }
  }, [editing, details])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest('input,textarea,select,video'))
        return
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      }
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [index, assets, editing])
  if (!asset) return null
  const close = async () => {
    if (busyRef.current) return
    if (
      editing &&
      name.trim() !== asset.original_filename &&
      !(await confirm({
        title: 'Unsaved name',
        message: 'Discard your unsaved name change?',
        confirmLabel: 'Discard',
      }))
    )
      return
    onClose()
  }
  const rename = async () => {
    if (!onRename || busyRef.current) return
    busyRef.current = true
    setOperation('rename')
    setNameError('')
    try {
      const saved = await onRename(asset, name)
      setRenamed((current) => ({ ...current, [saved.id]: saved }))
      window.dispatchEvent(new Event(CHANGED_EVENT))
      setName(saved.original_filename)
      setEditing(false)
      notify('File name updated.')
    } catch (error) {
      setNameError(friendlyError(error, 'rename this file'))
    } finally {
      busyRef.current = false
      setOperation(null)
    }
  }
  const trash = async () => {
    if (busyRef.current || !onTrash) return
    if (
      !(await confirm({
        title: 'Move to Trash',
        message: `Move “${asset.title}” to Trash? You can restore it later.`,
        confirmLabel: 'Move to Trash',
        destructive: true,
      }))
    )
      return
    busyRef.current = true
    setOperation('trash')
    setActionError('')
    try {
      await onTrash(asset)
      notify('Moved to Trash.')
      onClose()
    } catch (error) {
      const message = friendlyError(error, 'move this file to Trash')
      setActionError(message)
      notify(message, 'error')
    } finally {
      busyRef.current = false
      setOperation(null)
    }
  }
  const download = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setOperation('download')
    setActionError('')
    try {
      const result = await client()
        .storage.from('showcase-media')
        .download(asset.storage_path)
      if (result.error) throw result.error
      const url = URL.createObjectURL(result.data)
      const link = document.createElement('a')
      link.href = url
      link.download = asset.original_filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (error) {
      const message = friendlyError(error, 'download this file')
      setActionError(message)
      notify(message, 'error')
    } finally {
      busyRef.current = false
      setOperation(null)
    }
  }
  return (
    <Dialog
      title={asset.title}
      onClose={() => void close()}
      busy={busy}
      className="gallery-viewer"
    >
      <div className="gallery-viewer-layout">
        {asset.kind === 'image' ? (
          <ImageViewport key={asset.id} asset={asset} next={move} />
        ) : (
          <div className="gallery-viewer-media large-preview">
            <MediaPreview key={asset.id} asset={asset} controls />
          </div>
        )}
        {details && (
          <aside className="gallery-details">
            <h3>File details</h3>
            <dl>
              <dt>Filename</dt>
              <dd>
                {editing ? (
                  <form
                    className="gallery-name-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void rename()
                    }}
                  >
                    <label className="sr-only" htmlFor="gallery-file-name">
                      File name
                    </label>
                    <input
                      id="gallery-file-name"
                      ref={nameInput}
                      value={name}
                      maxLength={240}
                      required
                      disabled={busy}
                      aria-invalid={Boolean(nameError)}
                      aria-describedby={
                        nameError ? 'gallery-name-error' : 'gallery-name-help'
                      }
                      onChange={(event) => setName(event.target.value)}
                    />
                    <small id="gallery-name-help">
                      The file format stays unchanged.
                    </small>
                    {nameError && (
                      <p id="gallery-name-error" role="alert">
                        {nameError}
                      </p>
                    )}
                    <div>
                      <Button
                        type="submit"
                        variant="primary"
                        busy={operation === 'rename'}
                        disabled={busy}
                      >
                        Save name
                      </Button>
                      <Button
                        disabled={busy}
                        onClick={() => {
                          setName(asset.original_filename)
                          setEditing(false)
                          setNameError('')
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <span className="gallery-filename">
                    {asset.original_filename}
                    <Button
                      aria-label="Rename file"
                      disabled={busy}
                      onClick={() => {
                        setName(asset.original_filename)
                        setEditing(true)
                      }}
                    >
                      <Pencil size={16} />
                    </Button>
                  </span>
                )}
              </dd>
              <dt>Type</dt>
              <dd>{asset.kind}</dd>
              <dt>Size</dt>
              <dd>{(asset.byte_size / 1024 / 1024).toFixed(2)} MB</dd>
              {asset.width && (
                <>
                  <dt>Dimensions</dt>
                  <dd>
                    {asset.width} × {asset.height}
                  </dd>
                </>
              )}
              <dt>Uploaded</dt>
              <dd>{new Date(asset.created_at).toLocaleString()}</dd>
              <dt>Alternative text</dt>
              <dd>{asset.alt_text || 'Not provided'}</dd>
            </dl>
          </aside>
        )}
      </div>
      <div className="gallery-viewer-controls">
        <Button
          aria-label="Previous file"
          disabled={busy || editing || index <= 0}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={20} />
        </Button>
        <span>
          {index + 1} / {assets.length}
        </span>
        <Button
          aria-label="Next file"
          disabled={busy || editing || index >= assets.length - 1}
          onClick={() => move(1)}
        >
          <ArrowRight size={20} />
        </Button>
      </div>
      <div className="gallery-viewer-actions">
        <Button
          disabled={busy || editing}
          onClick={() => {
            setDetails(true)
            setName(asset.original_filename)
            setEditing(true)
          }}
        >
          <Pencil size={19} /> Edit name
        </Button>
        <Button
          disabled={busy || editing}
          onClick={() => setDetails(!details)}
          aria-pressed={details}
        >
          <Info size={19} /> Details
        </Button>
        <Button
          busy={operation === 'download'}
          disabled={busy}
          onClick={() => void download()}
        >
          <Download size={19} /> Download
        </Button>
        <Button
          busy={operation === 'trash'}
          disabled={busy || editing}
          onClick={() => void trash()}
        >
          <Trash2 size={19} /> Trash
        </Button>
      </div>
      {actionError && (
        <p className="gallery-action-error" role="alert">
          {actionError}
        </p>
      )}
    </Dialog>
  )
}

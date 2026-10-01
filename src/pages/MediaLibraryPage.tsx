import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2, Upload, Pencil } from 'lucide-react'
import { CLEANUP_EVENT, pendingCleanup, retryCleanup } from '../lib/deletion'
import { moveToTrash } from '../lib/trash'
import { useAsyncData } from '../hooks/useAsyncData'
import { loadCms } from '../lib/cms'
import { renameMediaAsset } from '../lib/showcase'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { Button, Dropdown } from '../components/ui'
import { EmptyState } from '../components/Feedback'
import { MediaPreview } from '../components/MediaEditor'
import {
  GalleryTile,
  GalleryViewer,
  SelectionBar,
  useGallerySelection,
} from '../components/Gallery'
import { useUploads } from '../components/UploadManager'
import { MEDIA_ACCEPT } from '../lib/media-processing'
import type { MediaAsset } from '../lib/database.types'
export function MediaLibraryPage() {
  const { data, error, loading, reload, setData } = useAsyncData(loadCms)
  const uploads = useUploads()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [sort, setSort] = useState('newest')
  const [density, setDensity] = useState('comfortable')
  const [editingName, setEditingName] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [cleanup, setCleanup] = useState(pendingCleanup)
  const [cleaning, setCleaning] = useState(false)
  useEffect(() => {
    const refresh = () => setCleanup(pendingCleanup())
    window.addEventListener(CLEANUP_EVENT, refresh)
    return () => window.removeEventListener(CLEANUP_EVENT, refresh)
  }, [])
  const assets = useMemo(() => {
    const merged = [...(data?.assets ?? [])]
    for (const item of uploads.items)
      if (item.asset && !merged.some((a) => a.id === item.asset!.id))
        merged.unshift(item.asset)
    return merged.filter(
      (a) =>
        !a.deleted_at &&
        !a.storage_path.startsWith('internal/') &&
        ['image', 'video', 'model_3d'].includes(a.kind),
    )
  }, [data, uploads.items])
  const visible = assets
    .filter(
      (a) =>
        (kind === 'all' || a.kind === kind) &&
        `${a.title} ${a.original_filename}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : sort === 'size'
          ? b.byte_size - a.byte_size
          : (sort === 'oldest' ? 1 : -1) *
              (Date.parse(a.created_at) - Date.parse(b.created_at)) ||
            a.id.localeCompare(b.id),
    )
  const selection = useGallerySelection(visible, reload)
  const groups = new Map<string, MediaAsset[]>()
  for (const asset of visible) {
    const label = ['newest', 'oldest'].includes(sort)
      ? new Date(asset.created_at).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : 'All files'
    groups.set(label, [...(groups.get(label) ?? []), asset])
  }
  const close = () => {
    setPreview(null)
    setEditingName(false)
  }
  const edit = (asset: MediaAsset) => {
    setEditingName(true)
    setPreview(asset.id)
  }
  return (
    <div
      className={`page cms-page gallery-page media-library ${selection.selecting ? 'is-selecting' : ''}`}
      data-density={density}
    >
      <div className="page-heading gallery-heading">
        <div>
          <span className="gallery-eyebrow">YOUR COLLECTION</span>
          <h1>Media Library</h1>
          <p>{assets.length} files · Ready to use across your showcase</p>
        </div>
        <div className="gallery-heading-actions">
          <Link className="button" to="/trash">
            <Trash2 size={18} /> Trash
          </Link>
          <label className="button button--primary upload-label">
            <Upload size={18} /> Upload files
            <input
              type="file"
              multiple
              accept={MEDIA_ACCEPT}
              onChange={(e) => {
                if (e.target.files)
                  uploads.enqueue(
                    Array.from(e.target.files),
                    'library',
                    'library',
                  )
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      <div className="gallery-toolbar">
        <input
          aria-label="Search media"
          placeholder="Search your files…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="media-toolbar-options">
          <Dropdown
            label="Sort media"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name', label: 'Name' },
              { value: 'size', label: 'Largest first' },
            ]}
          />
          <Dropdown
            label="Thumbnail size"
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <SelectionBar selection={selection}>
          <Button
            disabled={selection.busy || selection.selected.size !== 1}
            onClick={() => {
              const asset = assets.find((a) => selection.selected.has(a.id))
              if (asset) edit(asset)
            }}
          >
            <Pencil size={18} /> Edit name
          </Button>
          <Button
            disabled={selection.busy || !selection.selected.size}
            onClick={() =>
              void selection.run(
                'Move to Trash',
                (id) => moveToTrash('media_assets', id),
                true,
              )
            }
          >
            <Trash2 size={18} /> Trash
          </Button>
        </SelectionBar>
      </div>
      <div className="gallery-tabs" aria-label="Media filters">
        {[
          ['all', 'All'],
          ['image', 'Photos'],
          ['video', 'Videos'],
          ['model_3d', '3D'],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {cleanup.length > 0 && (
        <div className="cleanup-notice" role="status">
          <span>{cleanup.length} stored files need cleanup.</span>
          <Button
            busy={cleaning}
            onClick={async () => {
              setCleaning(true)
              try {
                await retryCleanup()
              } finally {
                setCleaning(false)
              }
            }}
          >
            Retry cleanup
          </Button>
        </div>
      )}
      {loading && !data ? (
        <LoadingState label="Loading media library…" />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !visible.length ? (
        <EmptyState
          illustration={
            <img
              src="/assets/gallery-empty.svg"
              alt=""
              aria-hidden="true"
              className="gallery-empty-illustration"
            />
          }
          action={
            query || kind !== 'all' ? (
              <Button
                onClick={() => {
                  setQuery('')
                  setKind('all')
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
          title={
            query || kind !== 'all'
              ? 'No matching files'
              : 'Your gallery starts here'
          }
        >
          {query || kind !== 'all'
            ? 'Try a different search or show all your files.'
            : 'Upload your first photos, videos or 3D models. Use them anywhere in your showcase.'}
        </EmptyState>
      ) : (
        [...groups].map(([label, rows]) => (
          <section className="gallery-date-group" key={label}>
            <h2>
              {label}
              <span>{rows.length}</span>
            </h2>
            <div className="gallery-grid">
              {rows.map((asset) => (
                <GalleryTile
                  key={asset.id}
                  id={asset.id}
                  title={asset.title}
                  selection={selection}
                  open={() => {
                    setEditingName(false)
                    setPreview(asset.id)
                  }}
                  badge={
                    asset.kind === 'video'
                      ? 'VIDEO'
                      : asset.kind === 'model_3d'
                        ? '3D'
                        : undefined
                  }
                  footer={<Button onClick={() => edit(asset)}>Edit</Button>}
                >
                  <MediaPreview asset={asset} />
                </GalleryTile>
              ))}
            </div>
          </section>
        ))
      )}
      {preview && (
        <GalleryViewer
          assets={visible}
          initialId={preview}
          onClose={close}
          initialEditing={editingName}
          onRename={async (asset, name) => {
            const saved = await renameMediaAsset(asset, name)
            setData((current) =>
              current
                ? {
                    ...current,
                    assets: [
                      saved,
                      ...current.assets.filter((row) => row.id !== saved.id),
                    ],
                  }
                : current,
            )
            setQuery('')
            return saved
          }}
          onTrash={async (asset) => {
            await moveToTrash('media_assets', asset.id)
            await reload()
          }}
        />
      )}
    </div>
  )
}

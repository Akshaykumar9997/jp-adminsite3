import { useMemo, useState } from 'react'
import { useAsyncData } from '../hooks/useAsyncData'
import { loadCms, setVideoPoster } from '../lib/cms'
import { deleteMedia, saveMediaMetadata } from '../lib/showcase'
import {
  AsyncForm,
  CmsDialog,
  ErrorState,
  LoadingState,
} from '../components/CmsDialog'
import { Button, StatusBadge } from '../components/ui'
import { EmptyState } from '../components/Feedback'
import { MediaPreview } from '../components/MediaEditor'
import { useUploads } from '../components/UploadManager'
import { MEDIA_ACCEPT } from '../lib/media-processing'
import type { MediaAsset } from '../lib/database.types'
export function MediaLibraryPage() {
  const { data, error, loading, reload } = useAsyncData(loadCms)
  const uploads = useUploads()
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const [selected, setSelected] = useState<MediaAsset | null>(null)
  const assets = useMemo(() => {
    const merged = [...(data?.assets ?? [])]
    for (const item of uploads.items)
      if (item.asset && !merged.some((a) => a.id === item.asset!.id))
        merged.unshift(item.asset)
    return merged.filter(
      (a) =>
        !a.storage_path.startsWith('internal/') &&
        ['image', 'video', 'model_3d'].includes(a.kind),
    )
  }, [data, uploads.items])
  const visible = assets.filter(
    (a) =>
      (kind === 'all' || a.kind === kind) &&
      `${a.title} ${a.original_filename}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const close = () => {
    setSelected(null)
    void reload()
  }
  return (
    <div className="page cms-page">
      <div className="page-heading">
        <div>
          <h1>Media Library</h1>
          <p>
            Your reusable files for room galleries, materials and partner logos.
          </p>
        </div>
        <label className="button button--primary upload-label">
          Upload files
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
      <div className="cms-toolbar">
        <input
          aria-label="Search media"
          placeholder="Search media…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Media type"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="model_3d">3D models</option>
        </select>
      </div>
      {loading ? (
        <LoadingState label="Loading media library…" />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !visible.length ? (
        <EmptyState title="No media here yet">
          Upload files or change your search.
        </EmptyState>
      ) : (
        <div className="content-grid">
          {visible.map((asset) => (
            <article key={asset.id} className="content-card">
              <button
                className="content-card-main"
                onClick={() => setSelected(asset)}
              >
                <div className="content-card-image">
                  <MediaPreview asset={asset} />
                </div>
                <h2>{asset.title}</h2>
                <p>
                  {asset.kind === 'model_3d' ? '3D model' : asset.kind} ·{' '}
                  {(asset.byte_size / 1024 / 1024).toFixed(1)} MB
                </p>
              </button>
              <footer>
                <StatusBadge status={asset.status} />
                <Button onClick={() => setSelected(asset)}>Edit</Button>
              </footer>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <CmsDialog title={selected.title} onClose={close}>
          <AsyncForm
            onClose={close}
            danger={{
              label: 'Delete media',
              action: () => deleteMedia(selected),
            }}
            onSubmit={async (form) => {
              await saveMediaMetadata(
                {
                  title: String(form.get('title') ?? '').trim(),
                  alt_text: String(form.get('alt_text') ?? '').trim() || null,
                  caption: selected.caption,
                  status: selected.status,
                  is_publicly_deliverable: selected.is_publicly_deliverable,
                },
                selected,
              )
              if (selected.kind === 'video')
                await setVideoPoster(
                  selected,
                  assets.find((a) => a.id === form.get('poster')) ?? null,
                )
            }}
          >
            <div className="cms-dialog__grid">
              <label className="field field--wide">
                <span>Title *</span>
                <input name="title" required defaultValue={selected.title} />
              </label>
              {selected.kind === 'image' && (
                <label className="field field--wide">
                  <span>Alternative text</span>
                  <input
                    name="alt_text"
                    defaultValue={selected.alt_text ?? ''}
                  />
                  <small>
                    Describe the image for visitors using screen readers.
                  </small>
                </label>
              )}
              {selected.kind === 'video' && (
                <label className="field field--wide">
                  <span>Video cover (optional)</span>
                  <select
                    name="poster"
                    defaultValue={selected.poster_asset_id ?? ''}
                  >
                    <option value="">
                      Use the browser's first-frame preview
                    </option>
                    {assets
                      .filter((a) => a.kind === 'image')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <p className="muted field--wide">
                Visibility is managed by the content using this media. Removing
                media that is still in use may be blocked.
              </p>
            </div>
          </AsyncForm>
        </CmsDialog>
      )}
    </div>
  )
}

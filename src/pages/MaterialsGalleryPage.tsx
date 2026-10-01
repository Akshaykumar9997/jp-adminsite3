import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Images, Plus, Trash2 } from 'lucide-react'
import { useAsyncData } from '../hooks/useAsyncData'
import { loadCms, type ContentRecord } from '../lib/cms'
import { ContentEditor } from './ContentPage'
import { Button, Dropdown, StatusBadge } from '../components/ui'
import { Dialog, EmptyState } from '../components/Feedback'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { MediaPreview } from '../components/MediaEditor'
import {
  ContentSelectionActions,
  GalleryTile,
  GalleryViewer,
  SelectionBar,
  useGallerySelection,
} from '../components/Gallery'
import type { MediaAsset } from '../lib/database.types'
const tiersLabel = (tier: string | undefined) =>
  ({ low: 'Essentials', mid: 'Signature', top: 'Premium' })[tier ?? ''] ?? ''

export function MaterialsGalleryPage({
  kind = 'material',
}: {
  kind?: 'material' | 'partner'
}) {
  const { data, loading, error, reload } = useAsyncData(loadCms)
  const [query, setQuery] = useState('')
  const [tier, setTier] = useState('all')
  const [sort, setSort] = useState('newest')
  const [status, setStatus] = useState('all')
  const [density, setDensity] = useState('comfortable')
  const partners = kind === 'partner'
  const title = partners ? 'Partners' : 'Materials'
  const [editing, setEditing] = useState<ContentRecord | 'new' | null>(null)
  const [album, setAlbum] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const rows = (
    partners ? (data?.partners ?? []) : (data?.materials ?? [])
  ).map((row) => ({
    ...row,
    title: row.name,
    tier: 'tier' in row ? row.tier : undefined,
    cover_asset_id: 'cover_asset_id' in row ? row.cover_asset_id : null,
    logo_asset_id: 'logo_asset_id' in row ? row.logo_asset_id : null,
  }))
  const visible = rows
    .filter(
      (row) =>
        (tier === 'all' || row.tier === tier) &&
        (status === 'all' || row.status === status) &&
        `${row.title} ${'description' in row ? (row.description ?? '') : ''}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.title.localeCompare(b.title)
        : (sort === 'oldest' ? 1 : -1) *
          (Date.parse(a.created_at) - Date.parse(b.created_at)),
    )
  const selection = useGallerySelection(visible, reload)
  const selectedAlbum = rows.find((row) => row.id === album)
  const media = partners
    ? (data?.assets.filter(
        (asset) => asset.id === selectedAlbum?.logo_asset_id,
      ) ?? [])
    : (data?.media ?? [])
        .filter((item) => item.owner_kind === kind && item.owner_id === album)
        .flatMap((item) => {
          const asset = data?.assets.find(
            (asset) => asset.id === item.media_asset_id,
          )
          return asset ? [asset] : []
        })
  const close = () => {
    setEditing(null)
    void reload()
  }
  const edit = (row: ContentRecord) => {
    setAlbum(null)
    setEditing(row)
  }
  return (
    <div
      className={`page cms-page gallery-page album-page ${density === 'compact' ? 'is-compact' : ''} ${selection.selecting ? 'is-selecting' : ''}`}
    >
      <div className="page-heading gallery-heading">
        <div>
          <span className="gallery-eyebrow">
            {partners ? 'YOUR COLLABORATIONS' : 'MATERIAL COLLECTIONS'}
          </span>
          <h1>{title}</h1>
          <p>
            {rows.length}{' '}
            {partners
              ? `${rows.length === 1 ? 'partner' : 'partners'} · Logos and collaborations`
              : `${rows.length === 1 ? 'album' : 'albums'} · Finishes, textures and inspiration`}
          </p>
        </div>
        <div className="gallery-heading-actions">
          <Link className="button" to="/trash">
            <Trash2 size={18} /> Trash
          </Link>
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={18} /> Create {kind}
          </Button>
        </div>
      </div>
      <div className="gallery-toolbar">
        <input
          aria-label={`Search ${title}`}
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="media-toolbar-options">
          <Dropdown
            label={`Sort ${title.toLowerCase()}`}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'name', label: 'Name' },
            ]}
          />
          <Dropdown
            label="Filter visibility"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All visibility' },
                { value: 'published', label: 'Published' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <Dropdown
            label="Gallery density"
            value={density}
            onChange={setDensity}
            options={[
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
            ]}
          />
        </div>
        <SelectionBar selection={selection}>
          <ContentSelectionActions
            selection={selection}
            rows={rows}
            kind={kind}
            workspace={data}
            edit={edit}
          />
        </SelectionBar>
      </div>
      {!partners && (
        <div className="gallery-tabs" aria-label="Material categories">
          {[
            ['all', 'All'],
            ['low', 'Essentials'],
            ['mid', 'Signature'],
            ['top', 'Premium'],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={tier === value}
              onClick={() => setTier(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {loading && !data ? (
        <LoadingState label={`Loading ${title.toLowerCase()}…`} />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !visible.length ? (
        <EmptyState
          title={
            query || tier !== 'all' || status !== 'all'
              ? `No matching ${title.toLowerCase()}`
              : `No ${title.toLowerCase()} here yet`
          }
          action={
            query || tier !== 'all' || status !== 'all' ? (
              <Button
                onClick={() => {
                  setQuery('')
                  setTier('all')
                  setStatus('all')
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setEditing('new')}>Create {kind}</Button>
            )
          }
        >
          {query || tier !== 'all' || status !== 'all'
            ? 'Try a different search or clear the filters.'
            : `Create your first ${kind} to start your collection.`}
        </EmptyState>
      ) : (
        <div className="gallery-grid gallery-albums">
          {visible.map((row) => {
            const items = data!.media.filter(
              (item) => item.owner_kind === kind && item.owner_id === row.id,
            )
            const asset = data!.assets.find(
              (asset) =>
                asset.id ===
                (row.logo_asset_id ??
                  row.cover_asset_id ??
                  items[0]?.media_asset_id),
            )
            return (
              <GalleryTile
                key={row.id}
                id={row.id}
                title={row.title}
                className={partners ? 'partner-album' : ''}
                selection={selection}
                open={() => setAlbum(row.id)}
                subtitle={
                  partners
                    ? asset
                      ? 'Partner logo'
                      : 'No logo selected'
                    : `${items.length} files · ${tiersLabel(row.tier)}`
                }
                footer={
                  <>
                    <StatusBadge status={row.status} />
                    <Button onClick={() => edit(row)}>Edit</Button>
                  </>
                }
              >
                {asset ? (
                  <MediaPreview asset={asset} />
                ) : (
                  <div className="gallery-album-placeholder">
                    <Images size={36} />
                    <span>Add your first file</span>
                  </div>
                )}
              </GalleryTile>
            )
          })}
        </div>
      )}
      {selectedAlbum && !preview && (
        <Dialog
          title={selectedAlbum.title}
          onClose={() => setAlbum(null)}
          className="gallery-album-dialog"
        >
          <div className="gallery-album-heading">
            <p>{media.length} files</p>
            <Button onClick={() => edit(selectedAlbum)}>Edit {kind}</Button>
          </div>
          {media.length ? (
            <div className="gallery-grid">
              {media.map((asset) => (
                <button
                  className="album-tile"
                  key={asset.id}
                  aria-label={`Preview ${asset.title}`}
                  onClick={() => setPreview(asset.id)}
                >
                  <MediaPreview asset={asset} />
                  <span>{asset.title}</span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="Your album starts here">
              Use Edit {kind} to upload files or choose from Media Library.
            </EmptyState>
          )}
        </Dialog>
      )}
      {preview && (
        <GalleryViewer
          assets={media as MediaAsset[]}
          initialId={preview}
          onClose={() => setPreview(null)}
        />
      )}
      {editing && data && (
        <ContentEditor
          key={editing === 'new' ? 'new' : editing.id}
          kind={kind}
          item={editing === 'new' ? undefined : editing}
          workspace={data}
          onClose={close}
        />
      )}
    </div>
  )
}

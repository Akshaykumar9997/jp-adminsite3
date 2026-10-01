import { useState } from 'react'
import { RotateCcw, Trash2, Images } from 'lucide-react'
import { useAsyncData } from '../hooks/useAsyncData'
import { loadCms } from '../lib/cms'
import { permanentlyDelete, restoreFromTrash } from '../lib/trash'
import {
  GalleryTile,
  SelectionBar,
  useGallerySelection,
} from '../components/Gallery'
import { Button, Dropdown } from '../components/ui'
import { EmptyState } from '../components/Feedback'
import { LoadingState, ErrorState } from '../components/CmsDialog'
import { MediaPreview } from '../components/MediaEditor'
import type { MediaAsset } from '../lib/database.types'
export function TrashPage() {
  const { data, loading, error, reload } = useAsyncData(loadCms)
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')
  const rows = (data?.trash ?? [])
    .filter(
      (row) =>
        (kind === 'all' || row.table === kind) &&
        row.title.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => Date.parse(b.deleted_at) - Date.parse(a.deleted_at))
  const selection = useGallerySelection(rows, reload)
  return (
    <div
      className={`page cms-page gallery-page ${selection.selecting ? 'is-selecting' : ''}`}
    >
      <div className="page-heading gallery-heading">
        <div>
          <span className="gallery-eyebrow">RECOVER YOUR ITEMS</span>
          <h1>Trash</h1>
          <p>
            Items stay here until you restore or permanently delete them.
            Restored content returns as Archived (admins only).
          </p>
        </div>
      </div>
      <div className="gallery-toolbar">
        <input
          aria-label="Search Trash"
          placeholder="Search Trash…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Dropdown
          label="Trash type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'All items' },
            ...[
              ['media_assets', 'Media'],
              ['room_categories', 'Rooms'],
              ['works', 'Works'],
              ['materials', 'Materials'],
              ['partners', 'Partners'],
            ].map(([value, label]) => ({ value, label })),
          ]}
        />
        <SelectionBar selection={selection}>
          <Button
            disabled={selection.busy || !selection.selected.size}
            onClick={() =>
              void selection.run('Restore', (id) => {
                const row = rows.find((row) => row.id === id)!
                return restoreFromTrash(row.table, id)
              })
            }
          >
            <RotateCcw size={18} /> Restore
          </Button>
          <Button
            disabled={selection.busy || !selection.selected.size}
            onClick={() =>
              void selection.run(
                'Delete permanently',
                (id) => {
                  const row = rows.find((row) => row.id === id)!
                  return permanentlyDelete(row.table, id)
                },
                true,
              )
            }
          >
            <Trash2 size={18} /> Delete permanently
          </Button>
        </SelectionBar>
      </div>
      {loading && !data ? (
        <LoadingState label="Loading Trash…" />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !rows.length ? (
        <EmptyState
          title={
            query || kind !== 'all' ? 'No matching items' : 'Trash is empty'
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
        >
          {query || kind !== 'all'
            ? 'Try a different search or clear the filters.'
            : 'Items moved to Trash will appear here.'}
        </EmptyState>
      ) : (
        <div className="gallery-grid gallery-albums">
          {rows.map((row) => (
            <GalleryTile
              key={row.id}
              id={row.id}
              title={row.title}
              selection={selection}
              open={() => selection.toggle(row.id)}
              subtitle={`Removed ${new Date(row.deleted_at).toLocaleDateString()}`}
              badge={
                {
                  media_assets: 'MEDIA',
                  room_categories: 'ROOM',
                  works: 'WORK',
                  materials: 'MATERIAL',
                  partners: 'PARTNER',
                }[row.table]
              }
            >
              {row.table === 'media_assets' ? (
                <MediaPreview asset={row.record as MediaAsset} />
              ) : (
                <div className="gallery-album-placeholder">
                  <Images size={36} />
                </div>
              )}
            </GalleryTile>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Images,
  Plus,
  Settings2,
} from 'lucide-react'
import { useAsyncData } from '../hooks/useAsyncData'
import { cmsDb, check, loadCms, type ContentRecord } from '../lib/cms'
import { ContentEditor } from './ContentPage'
import { Button, StatusBadge } from '../components/ui'
import { ErrorState, LoadingState } from '../components/CmsDialog'
import { Dialog, EmptyState, useOperation } from '../components/Feedback'
import { MediaPreview } from '../components/MediaEditor'
import type { MediaAsset } from '../lib/database.types'

export function RoomsGalleryPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { data, loading, error, reload } = useAsyncData(loadCms)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<{
    kind: 'room' | 'work'
    item?: ContentRecord
  } | null>(null)
  const [preview, setPreview] = useState<MediaAsset | null>(null)
  const order = useOperation()
  const room = data?.rooms.find((r) => r.id === roomId)
  const works = (
    data?.works.filter((w) => w.room_category_id === roomId) ?? []
  ).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
  const visible = works.filter((w) =>
    `${w.title} ${w.location ?? ''}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )
  const close = () => {
    setEditing(null)
    void reload()
  }
  const cover = (id: string | null | undefined) =>
    data?.assets.find((a) => a.id === id)
  const move = (from: number, delta: number) => {
    const ids = works.map((w) => w.id)
    const to = from + delta
    if (to < 0 || to >= ids.length || order.pending) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    void order.run(
      async () => {
        const result = await cmsDb().rpc('reorder_works', {
          p_room: roomId!,
          p_ids: ids,
        })
        check(result.error)
        await reload()
      },
      { action: 'save gallery order' },
    )
  }
  const moveRoom = (from: number, delta: number) => {
    if (!data || order.pending) return
    const ids = data.rooms.map((r) => r.id),
      to = from + delta
    if (to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    void order.run(
      async () => {
        const result = await cmsDb().rpc('reorder_rooms', { p_ids: ids })
        check(result.error)
        await reload()
      },
      { action: 'save room order' },
    )
  }
  if (loading && !data)
    return (
      <div className="page">
        <LoadingState label="Loading rooms…" />
      </div>
    )
  if (error || !data)
    return (
      <div className="page">
        <ErrorState
          message={error || 'Rooms unavailable.'}
          retry={() => void reload()}
        />
      </div>
    )
  if (roomId && !room)
    return (
      <div className="page">
        <EmptyState
          title="Room not found"
          action={
            <Button onClick={() => navigate('/rooms')}>Back to rooms</Button>
          }
        >
          This room may have been removed.
        </EmptyState>
      </div>
    )
  return (
    <div className="page cms-page room-workspace">
      <div className="page-heading">
        <div>
          {room && (
            <Button
              className="back-to-rooms"
              onClick={() => {
                setQuery('')
                navigate('/rooms')
              }}
            >
              <ChevronLeft size={18} /> All rooms
            </Button>
          )}
          <h1>{room?.name ?? 'Rooms'}</h1>
          <p>
            {room
              ? `${works.length} ${works.length === 1 ? 'work' : 'works'} · Photos, films and 3D models`
              : 'Choose a room to manage its work and media.'}
          </p>
        </div>
        <div className="page-heading__actions">
          {room && (
            <Button
              onClick={() =>
                setEditing({
                  kind: 'room',
                  item: { ...room, title: room.name },
                })
              }
            >
              <Settings2 size={18} /> Room details
            </Button>
          )}
          <Button
            variant="primary"
            onClick={() => setEditing({ kind: room ? 'work' : 'room' })}
          >
            <Plus size={18} />
            {room ? 'Add work' : 'Add room'}
          </Button>
        </div>
      </div>
      {!room && order.error && (
        <p role="alert" className="field-error">
          {order.error}
        </p>
      )}
      {room ? (
        <>
          {room.status !== 'published' && (
            <p className="room-visibility-note">
              <StatusBadge status={room.status} /> Publish this room in Room
              details before publishing its work.
            </p>
          )}
          <input
            className="gallery-search"
            aria-label="Search room gallery"
            placeholder="Search by title or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {order.error && (
            <p role="alert" className="field-error">
              {order.error}
            </p>
          )}
          {!visible.length ? (
            <EmptyState
              title={
                query ? 'No matching work' : 'Your room gallery starts here'
              }
              action={
                <Button onClick={() => setEditing({ kind: 'work' })}>
                  Add work
                </Button>
              }
            >
              Add a work, then upload its photos, videos or models.
            </EmptyState>
          ) : (
            <div className="room-works">
              {visible.map((work) => {
                const media = data.media
                  .filter(
                    (m) => m.owner_kind === 'work' && m.owner_id === work.id,
                  )
                  .sort((a, b) => a.sort_order - b.sort_order)
                  .flatMap((m) => {
                    const a = cover(m.media_asset_id)
                    return a ? [a] : []
                  })
                const index = works.findIndex((w) => w.id === work.id)
                return (
                  <section className="work-album" key={work.id}>
                    <header>
                      <div>
                        <h2>{work.title}</h2>
                        <p>{work.location}</p>
                      </div>
                      <StatusBadge status={work.status} />
                    </header>
                    <div className="album-gallery">
                      {media.map((asset) => (
                        <button
                          className="album-tile"
                          key={asset.id}
                          aria-label={`Preview ${asset.title}`}
                          onClick={() => setPreview(asset)}
                        >
                          <MediaPreview asset={asset} />
                          <span>
                            {asset.kind === 'model_3d'
                              ? '3D'
                              : asset.kind === 'video'
                                ? 'Video'
                                : 'Photo'}
                          </span>
                        </button>
                      ))}
                      {!media.length && (
                        <button
                          className="album-empty"
                          onClick={() =>
                            setEditing({ kind: 'work', item: work })
                          }
                        >
                          <Images size={24} /> Add media
                        </button>
                      )}
                    </div>
                    <footer>
                      <Button
                        onClick={() => setEditing({ kind: 'work', item: work })}
                      >
                        Edit work
                      </Button>
                      <div className="album-order">
                        <Button
                          aria-label={`Move ${work.title} earlier`}
                          disabled={index === 0 || order.pending || !!query}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowLeft size={18} />
                        </Button>
                        <Button
                          aria-label={`Move ${work.title} later`}
                          disabled={
                            index === works.length - 1 ||
                            order.pending ||
                            !!query
                          }
                          onClick={() => move(index, 1)}
                        >
                          <ArrowRight size={18} />
                        </Button>
                      </div>
                    </footer>
                  </section>
                )
              })}
            </div>
          )}
        </>
      ) : (
        <div className="room-grid">
          {data.rooms.map((r, index) => {
            const contents = data.works.filter(
              (w) => w.room_category_id === r.id,
            )
            const image =
              cover(r.cover_asset_id) ??
              cover(contents.find((w) => w.cover_asset_id)?.cover_asset_id)
            return (
              <article className="room-category" key={r.id}>
                <button
                  className="room-tile"
                  onClick={() => {
                    setQuery('')
                    navigate(`/rooms/${r.id}`)
                  }}
                >
                  <div className="room-tile-image">
                    {image ? (
                      <MediaPreview asset={image} />
                    ) : (
                      <Images size={36} />
                    )}
                  </div>
                  <div className="room-tile-copy">
                    <h2>{r.name}</h2>
                    <p>
                      {contents.length}{' '}
                      {contents.length === 1 ? 'work' : 'works'}
                    </p>
                    <StatusBadge status={r.status} />
                  </div>
                  <ArrowRight size={20} />
                </button>
                <footer className="room-order">
                  <span>Display order</span>
                  <Button
                    aria-label={`Move ${r.name} earlier`}
                    disabled={index === 0 || order.pending}
                    onClick={() => moveRoom(index, -1)}
                  >
                    <ArrowLeft size={18} />
                  </Button>
                  <Button
                    aria-label={`Move ${r.name} later`}
                    disabled={index === data.rooms.length - 1 || order.pending}
                    onClick={() => moveRoom(index, 1)}
                  >
                    <ArrowRight size={18} />
                  </Button>
                </footer>
              </article>
            )
          })}
        </div>
      )}
      {editing && (
        <ContentEditor
          key={editing.item?.id ?? editing.kind}
          kind={editing.kind}
          item={editing.item}
          defaultRoom={
            editing.kind === 'work' && !editing.item ? roomId : undefined
          }
          workspace={data}
          onClose={close}
        />
      )}
      {preview && (
        <Dialog title={preview.title} onClose={() => setPreview(null)}>
          <div className="large-preview">
            <MediaPreview asset={preview} controls />
          </div>
        </Dialog>
      )}
    </div>
  )
}

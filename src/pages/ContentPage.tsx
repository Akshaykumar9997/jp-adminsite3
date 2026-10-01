import { useMemo, useState } from 'react'
import {
  AsyncForm,
  CmsDialog,
  ErrorState,
  LoadingState,
  StatusField,
} from '../components/CmsDialog'
import { Button, Dropdown, StatusBadge } from '../components/ui'
import { EmptyState, useUnsaved } from '../components/Feedback'
import { MediaEditor, MediaPreview } from '../components/MediaEditor'
import { useUploads } from '../components/UploadManager'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  loadCms,
  removeContent,
  saveContent,
  tiers,
  type ContentKind,
  type ContentRecord,
} from '../lib/cms'
import { UserError } from '../lib/feedback'
import type { ContentStatus } from '../lib/database.types'
const plural = {
  work: 'Works',
  room: 'Rooms',
  material: 'Materials',
  partner: 'Partners',
}
const singular = {
  work: 'work',
  room: 'room',
  material: 'material',
  partner: 'partner',
}
type Workspace = Awaited<ReturnType<typeof loadCms>>

export function ContentEditor({
  kind,
  item,
  workspace,
  onClose,
  defaultRoom,
}: {
  kind: ContentKind
  item?: ContentRecord
  workspace: Workspace
  onClose: () => void
  defaultRoom?: string
}) {
  const [scope] = useState(item?.id ?? crypto.randomUUID())
  const initialMedia = workspace.media
    .filter((m) => m.owner_kind === kind && m.owner_id === scope)
    .map((m) => m.media_asset_id)
  const initial =
    kind === 'partner'
      ? item?.logo_asset_id
        ? [item.logo_asset_id]
        : []
      : initialMedia
  const [ids, setIds] = useState(initial)
  const [cover, setCover] = useState<string | null>(
    item?.cover_asset_id ?? item?.logo_asset_id ?? null,
  )
  const [room, setRoom] = useState(item?.room_category_id ?? defaultRoom ?? '')
  const [tier, setTier] = useState(item?.tier ?? 'mid')
  const uploads = useUploads()
  const [visibility, setVisibility] = useState<ContentStatus>(
    item?.status ?? 'archived',
  )
  useUnsaved(
    JSON.stringify(ids) !== JSON.stringify(initial) ||
      cover !== (item?.cover_asset_id ?? item?.logo_asset_id ?? null),
  )
  const chosenRoom = workspace.rooms.find((r) => r.id === room)
  return (
    <CmsDialog
      title={`${item ? 'Edit' : 'Create'} ${singular[kind]}`}
      onClose={onClose}
    >
      <AsyncForm
        submitLabel={
          visibility === 'published' && item?.status !== 'published'
            ? `Publish ${singular[kind]}`
            : 'Save changes'
        }
        onClose={onClose}
        successMessage={`${singular[kind][0].toUpperCase() + singular[kind].slice(1)} ${item ? 'updated' : 'created'} successfully.`}
        danger={
          item
            ? {
                label: 'Move to Trash',
                action: () => removeContent(kind, item.id),
              }
            : undefined
        }
        onSubmit={async (form) => {
          const value = (key: string) => String(form.get(key) ?? '').trim()
          const status = value('status') as ContentStatus
          if (
            uploads.items.some(
              (upload) =>
                upload.scope === scope &&
                ['queued', 'uploading', 'processing', 'failed'].includes(
                  upload.state,
                ),
            )
          )
            throw new UserError(
              'Media is not ready. Finish or remove failed uploads in the Upload Center before saving.',
            )
          const all = [
            ...workspace.assets,
            ...uploads.items.flatMap((upload) =>
              upload.asset ? [upload.asset] : [],
            ),
          ]
          const selectedCover =
            kind === 'room'
              ? null
              : (cover ??
                ids.find((id) =>
                  all.some((a) => a.id === id && a.kind === 'image'),
                ) ??
                null)
          if (kind === 'partner' && status === 'published' && !selectedCover)
            throw new UserError('Choose a logo before publishing this partner.')
          if (
            kind === 'work' &&
            status === 'published' &&
            chosenRoom?.status !== 'published'
          )
            throw new UserError(
              'Publish the selected room before publishing this work.',
            )
          await saveContent(
            kind,
            scope,
            {
              title: value('title'),
              location: value('location'),
              room_category_id: value('room_category_id'),
              tier: value('tier'),
              status,
              create: !item,
            },
            kind === 'room' ? [] : ids,
            selectedCover,
          )
        }}
      >
        <div className="cms-dialog__grid">
          <label className="field field--wide">
            <span>
              {kind === 'room'
                ? 'Room name'
                : kind === 'partner'
                  ? 'Name'
                  : 'Title'}{' '}
              *
            </span>
            <input
              name="title"
              data-label={`${singular[kind]} ${kind === 'partner' ? 'name' : 'title'}`}
              required
              defaultValue={item?.title ?? ''}
            />
          </label>
          {kind === 'work' && (
            <>
              <label className="field" hidden={!!defaultRoom}>
                <span>Room *</span>
                <Dropdown
                  name="room_category_id"
                  label="Room"
                  required
                  value={room}
                  onChange={setRoom}
                  options={[
                    { value: '', label: 'Choose a room' },
                    ...workspace.rooms.map((r) => ({
                      value: r.id,
                      label: r.name,
                    })),
                  ]}
                />
              </label>
              <label className="field">
                <span>Location *</span>
                <input
                  name="location"
                  data-label="a location"
                  required
                  defaultValue={item?.location ?? ''}
                />
              </label>
            </>
          )}
          {kind === 'material' && (
            <label className="field">
              <span>Category *</span>
              <Dropdown
                name="tier"
                label="Category"
                value={tier}
                onChange={setTier}
                options={tiers}
              />
            </label>
          )}
          <StatusField value={item?.status} onChange={setVisibility} />
          <p className="muted field--wide">
            Choosing Published and saving makes this content visible on the
            website.
          </p>
        </div>
        {kind !== 'room' && (
          <MediaEditor
            scope={scope}
            kind={kind}
            available={workspace.assets}
            ids={ids}
            onChange={setIds}
            cover={cover}
            onCover={setCover}
            persistOrder={
              !!item &&
              ids.length === initial.length &&
              ids.every((id) => initial.includes(id))
            }
          />
        )}
      </AsyncForm>
    </CmsDialog>
  )
}

export function ContentPage({ kind }: { kind: ContentKind }) {
  const { data, error, loading, reload } = useAsyncData(loadCms)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState<ContentRecord | 'new' | null>(null)
  const records: ContentRecord[] = useMemo(
    () =>
      !data
        ? []
        : kind === 'work'
          ? data.works
          : kind === 'room'
            ? data.rooms.map((r) => ({ ...r, title: r.name }))
            : kind === 'material'
              ? data.materials.map((r) => ({ ...r, title: r.name }))
              : data.partners.map((r) => ({ ...r, title: r.name })),
    [data, kind],
  )
  const visible = records.filter(
    (item) =>
      (!query ||
        `${item.title} ${item.location ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (status === 'all' || item.status === status) &&
      (filter === 'all' ||
        (kind === 'material' ? item.tier : item.room_category_id) === filter),
  )
  const close = () => {
    setEditing(null)
    void reload()
  }
  return (
    <div className="page cms-page">
      <div className="page-heading">
        <div>
          <h1>{plural[kind]}</h1>
          <p>
            {
              {
                work: 'Room-based work, photography, films and 3D models.',
                room: 'Create rooms, set visibility, then add works and their assets.',
                material:
                  'Three fixed categories. One mixed media collection per material.',
                partner:
                  'Names, logos and visibility for the homepage carousel.',
              }[kind]
            }
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing('new')}>
          {kind === 'room' ? 'Add custom room' : `Create ${singular[kind]}`}
        </Button>
      </div>
      <div className="cms-toolbar cms-toolbar--wrap">
        <label className="filter-search">
          <input
            aria-label={`Search ${plural[kind]}`}
            placeholder={`Search ${plural[kind].toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
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
        {(kind === 'work' || kind === 'material') && (
          <Dropdown
            label={kind === 'work' ? 'Filter room' : 'Filter category'}
            value={filter}
            onChange={setFilter}
            options={[
              {
                value: 'all',
                label: kind === 'work' ? 'All rooms' : 'All categories',
              },
              ...(kind === 'work'
                ? (data?.rooms.map((r) => ({ value: r.id, label: r.name })) ??
                  [])
                : tiers),
            ]}
          />
        )}
      </div>
      {loading ? (
        <LoadingState label={`Loading ${plural[kind].toLowerCase()}…`} />
      ) : error ? (
        <ErrorState message={error} retry={() => void reload()} />
      ) : !visible.length ? (
        <EmptyState
          title={
            records.length
              ? 'No matches'
              : `No ${plural[kind].toLowerCase()} yet`
          }
          action={
            <Button onClick={() => setEditing('new')}>
              Create {singular[kind]}
            </Button>
          }
        >
          {records.length
            ? 'Change the filters to see more content.'
            : `Create your first ${singular[kind]} to build the showcase.`}
        </EmptyState>
      ) : (
        <div className="content-grid">
          {visible.map((item) => {
            const first = data?.media.find(
              (m) => m.owner_kind === kind && m.owner_id === item.id,
            )
            const asset = data?.assets.find(
              (a) =>
                a.id ===
                (item.cover_asset_id ??
                  item.logo_asset_id ??
                  first?.media_asset_id),
            )
            return (
              <article key={item.id} className="content-card">
                <button
                  className="content-card-main"
                  onClick={() => setEditing(item)}
                >
                  <div
                    className={`content-card-image ${kind === 'partner' ? 'logo-image' : ''}`}
                  >
                    {asset ? (
                      <MediaPreview asset={asset} />
                    ) : (
                      <div className="media-placeholder">
                        {kind === 'partner' ? 'No logo' : 'No cover image'}
                      </div>
                    )}
                  </div>
                  {kind === 'work' && (
                    <small>
                      {
                        data?.rooms.find((r) => r.id === item.room_category_id)
                          ?.name
                      }
                    </small>
                  )}
                  <h2>{item.title}</h2>
                  {kind === 'work' && (
                    <p>
                      {item.location || 'Location required before publishing'}
                    </p>
                  )}
                  {kind === 'material' && (
                    <p>{tiers.find((t) => t.value === item.tier)?.label}</p>
                  )}
                </button>
                <footer>
                  <StatusBadge status={item.status} />
                  <Button onClick={() => setEditing(item)}>Edit</Button>
                </footer>
              </article>
            )
          })}
        </div>
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

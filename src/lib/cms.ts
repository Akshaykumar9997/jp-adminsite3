import { supabase } from './supabase'
import type {
  ContentStatus,
  Json,
  Material,
  MediaAsset,
  Partner,
  RoomCategory,
  Work,
} from './database.types'
import { UserError } from './feedback'
import { moveToTrash } from './trash'
import { previewCache } from './cache'
export type ContentKind = 'work' | 'room' | 'material' | 'partner'
export type MediaItem = {
  owner_kind: string
  owner_id: string
  media_asset_id: string
  sort_order: number
}
export type ContentRecord = {
  deleted_at?: string | null
  id: string
  title: string
  status: ContentStatus
  location?: string | null
  room_category_id?: string
  is_custom?: boolean
  tier?: string
  cover_asset_id?: string | null
  logo_asset_id?: string | null
}
export const tiers = [
  { value: 'low', label: 'Low — Essentials' },
  { value: 'mid', label: 'Mid — Signature' },
  { value: 'top', label: 'Top — Premium' },
] as const
export const client = () => {
  if (!supabase)
    throw new UserError(
      'The Admin site connection is not configured. Contact your administrator.',
    )
  return supabase
}
export const cmsDb = () => client().schema('showcase')
export function check(error: { message: string; code?: string } | null) {
  if (!error) return
  if (
    /media_items|processing_status|save_content|publish_homepage/.test(
      error.message,
    ) &&
    /not exist|schema cache|find/.test(error.message)
  )
    throw new UserError(
      'This Admin site version requires the approved showcase backend update. Contact your administrator.',
    )
  const messages: Record<string, string> = {
    'media is private or not ready':
      'A selected file is private or not ready. Remove it or choose a ready showcase file.',
    'cover must be an image from this collection':
      'Choose a ready image from this collection for the cover.',
    'partner logo required for publishing':
      'Choose a logo before publishing this partner.',
    'unassigned media cannot be published':
      'Choose showcase media before publishing. An unassigned file cannot be published.',
    'collection changed; reload before reordering':
      'This collection has changed. Close and reopen it before reordering.',
    'gallery changed; reload before reordering':
      'The gallery has changed. Reload before arranging it again.',
    'item no longer exists':
      'This item was removed. Close the editor and reload the list.',
    'publish the selected room before publishing this work':
      'Publish the selected room before publishing this work.',
  }
  if (messages[error.message]) throw new UserError(messages[error.message])
  throw new Error(error.message)
}
export async function loadCms() {
  const results = await Promise.all([
    cmsDb().from('works').select('*').order('updated_at', { ascending: false }),
    cmsDb()
      .from('room_categories')
      .select('*')
      .order('sort_order')
      .order('name'),
    cmsDb()
      .from('materials')
      .select('*')
      .order('updated_at', { ascending: false }),
    cmsDb()
      .from('partners')
      .select('*')
      .order('updated_at', { ascending: false }),
    cmsDb()
      .from('media_assets')
      .select('*')
      .order('updated_at', { ascending: false }),
    cmsDb().from('media_items').select('*').order('sort_order'),
  ])
  results.forEach((r) => check(r.error))
  const tables = [
    'works',
    'room_categories',
    'materials',
    'partners',
    'media_assets',
  ] as const
  const trash = results.slice(0, 5).flatMap((result, index) =>
    (result.data ?? []).flatMap((raw) => {
      const row = raw as unknown as {
        id: string
        title?: string
        name?: string
        deleted_at?: string
      }
      return row.deleted_at
        ? [
            {
              id: row.id,
              title: row.title ?? row.name ?? 'Untitled',
              deleted_at: row.deleted_at,
              table: tables[index],
              record: raw,
            },
          ]
        : []
    }),
  )
  return {
    works: (results[0].data as Work[]).filter((row) => !row.deleted_at),
    rooms: (results[1].data as RoomCategory[]).filter((row) => !row.deleted_at),
    materials: (results[2].data as Material[]).filter((row) => !row.deleted_at),
    partners: (results[3].data as Partner[]).filter((row) => !row.deleted_at),
    assets: (results[4].data as MediaAsset[]).filter((row) => !row.deleted_at),
    media: results[5].data as MediaItem[],
    trash,
  }
}
export async function saveContent(
  kind: ContentKind,
  id: string | null,
  data: Json,
  assetIds: string[],
  cover: string | null,
) {
  const result = await cmsDb().rpc('save_content', {
    p_kind: kind,
    p_id: id,
    p_data: data,
    p_assets: assetIds,
    p_cover: cover,
  })
  check(result.error)
  return result.data!
}
export async function removeContent(kind: ContentKind, id: string) {
  const table = {
    work: 'works',
    room: 'room_categories',
    material: 'materials',
    partner: 'partners',
  } as const
  await moveToTrash(table[kind], id)
}
export async function reorderMedia(
  kind: ContentKind,
  owner: string,
  ids: string[],
) {
  const result = await cmsDb().rpc('reorder_media', {
    p_kind: kind,
    p_owner: owner,
    p_assets: ids,
  })
  check(result.error)
}
export const previewKey = (asset: MediaAsset) =>
  `${asset.id}:${asset.storage_path}:${asset.updated_at}`
export const cachedMediaUrl = (asset: MediaAsset) =>
  previewCache.peek(previewKey(asset))
export async function mediaUrl(asset: MediaAsset, retry = false) {
  if (retry) previewCache.clear()
  return previewCache.get(previewKey(asset), async () => {
    const result = await client()
      .storage.from('showcase-media')
      .createSignedUrl(asset.storage_path, 300)
    check(result.error)
    return result.data!.signedUrl
  })
}

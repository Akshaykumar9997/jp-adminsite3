import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type {
  AuditEvent,
  ContentStatus,
  Material,
  MaterialCollection,
  MediaAsset,
  MediaKind,
  Partner,
  PartnerPrivateDetails,
  PartnerPrivateDocument,
  Project,
  ProjectRoom,
  RoomCategory,
  Work,
} from './database.types'

const requireClient = () => {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

const db = () => requireClient().schema('showcase')
const publishedAt = (status: ContentStatus, current?: string | null) =>
  status === 'published' ? (current ?? new Date().toISOString()) : null
const throwIfError = (error: PostgrestError | null) => {
  if (error) throw new Error(error.message)
}

async function actorId() {
  const { data, error } = await requireClient().auth.getUser()
  if (error || !data.user)
    throw new Error('Your administrator session is no longer valid.')
  return data.user.id
}

export type ProjectInput = Pick<
  Project,
  | 'slug'
  | 'title'
  | 'summary'
  | 'description'
  | 'location'
  | 'project_type'
  | 'scope'
  | 'status'
  | 'cover_asset_id'
  | 'sort_order'
>
export type RoomCategoryInput = Pick<
  RoomCategory,
  'slug' | 'name' | 'description' | 'zone_label' | 'status' | 'sort_order'
>
export type WorkInput = Pick<
  Work,
  | 'slug'
  | 'title'
  | 'summary'
  | 'specification'
  | 'project_id'
  | 'project_room_id'
  | 'room_category_id'
  | 'status'
  | 'cover_asset_id'
  | 'sort_order'
>
export type MaterialCollectionInput = Pick<
  MaterialCollection,
  'slug' | 'name' | 'range' | 'description' | 'status' | 'sort_order'
>
export type MaterialInput = Pick<
  Material,
  | 'collection_id'
  | 'code'
  | 'name'
  | 'category'
  | 'finish'
  | 'description'
  | 'technical_specifications'
  | 'status'
  | 'cover_asset_id'
>
export type PartnerInput = Pick<
  Partner,
  | 'name'
  | 'studio'
  | 'role'
  | 'public_bio'
  | 'location'
  | 'relationship_status'
  | 'status'
  | 'logo_asset_id'
>

export async function getDashboard() {
  const [projects, works, media, published, events] = await Promise.all([
    db().from('projects').select('*', { count: 'exact', head: true }),
    db().from('works').select('*', { count: 'exact', head: true }),
    db().from('media_assets').select('*', { count: 'exact', head: true }),
    db()
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published'),
    db()
      .from('audit_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(8),
  ])
  ;[
    projects.error,
    works.error,
    media.error,
    published.error,
    events.error,
  ].forEach(throwIfError)
  return {
    counts: {
      projects: projects.count ?? 0,
      works: works.count ?? 0,
      media: media.count ?? 0,
      published: published.count ?? 0,
    },
    events: (events.data ?? []) as AuditEvent[],
  }
}

export async function listProjects() {
  const { data, error } = await db()
    .from('projects')
    .select('*')
    .order('sort_order')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as Project[]
}

export async function saveProject(input: ProjectInput, id?: string) {
  const actor = await actorId()
  const existing = id
    ? await db()
        .from('projects')
        .select('cover_asset_id, published_at')
        .eq('id', id)
        .single()
    : null
  if (existing) throwIfError(existing.error)
  const payload = {
    ...input,
    cover_asset_id:
      input.cover_asset_id ?? existing?.data?.cover_asset_id ?? null,
    published_at: publishedAt(input.status, existing?.data?.published_at),
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('projects').update(payload).eq('id', id)
    : db()
        .from('projects')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as Project
}

export async function deleteProject(id: string) {
  const { error } = await db()
    .from('projects')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function listRoomCategories() {
  const { data, error } = await db()
    .from('room_categories')
    .select('*')
    .order('sort_order')
    .order('name')
  throwIfError(error)
  return (data ?? []) as RoomCategory[]
}

export async function saveRoomCategory(input: RoomCategoryInput, id?: string) {
  const actor = await actorId()
  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('room_categories').update(payload).eq('id', id)
    : db()
        .from('room_categories')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as RoomCategory
}

export async function deleteRoomCategory(id: string) {
  const { error } = await db()
    .from('room_categories')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function listProjectRooms() {
  const { data, error } = await db()
    .from('project_rooms')
    .select('*')
    .order('sort_order')
  throwIfError(error)
  return (data ?? []) as ProjectRoom[]
}

export async function saveProjectRoom(
  input: Pick<
    ProjectRoom,
    'project_id' | 'room_category_id' | 'title' | 'description' | 'sort_order'
  >,
  id?: string,
) {
  const actor = await actorId()
  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('project_rooms').update(payload).eq('id', id)
    : db()
        .from('project_rooms')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as ProjectRoom
}

export async function listWorks() {
  const { data, error } = await db()
    .from('works')
    .select('*')
    .order('sort_order')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as Work[]
}

export async function saveWork(input: WorkInput, id?: string) {
  const actor = await actorId()
  const existing = id
    ? await db()
        .from('works')
        .select('cover_asset_id, published_at')
        .eq('id', id)
        .single()
    : null
  if (existing) throwIfError(existing.error)
  const payload = {
    ...input,
    slug: input.slug || null,
    cover_asset_id:
      input.cover_asset_id ?? existing?.data?.cover_asset_id ?? null,
    published_at: publishedAt(input.status, existing?.data?.published_at),
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('works').update(payload).eq('id', id)
    : db()
        .from('works')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as Work
}

export async function deleteWork(id: string) {
  const { error } = await db()
    .from('works')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function listMediaAssets() {
  const { data, error } = await db()
    .from('media_assets')
    .select('*')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as MediaAsset[]
}

const safeFilename = (name: string) => {
  const sanitized = name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return !sanitized || sanitized === '.' || sanitized === '..'
    ? 'asset'
    : sanitized
}
const mediaKind = (file: File): MediaKind => {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (/\.(glb|gltf|obj|fbx)$/i.test(file.name)) return 'model_3d'
  if (/\.(dwg|dxf)$/i.test(file.name)) return 'cad'
  return 'document'
}

export async function uploadMedia(
  file: File,
  metadata: Pick<
    MediaAsset,
    'title' | 'alt_text' | 'caption' | 'status' | 'is_publicly_deliverable'
  >,
) {
  const client = requireClient()
  const actor = await actorId()
  const id = crypto.randomUUID()
  const storagePath = `unassigned/${id}/${safeFilename(file.name)}`
  const { error: uploadError } = await client.storage
    .from('showcase-media')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (uploadError) throw new Error(uploadError.message)
  const payload = {
    id,
    storage_path: storagePath,
    title: metadata.title,
    kind: mediaKind(file),
    mime_type: file.type || 'application/octet-stream',
    original_filename: file.name,
    byte_size: file.size,
    alt_text: metadata.alt_text,
    caption: metadata.caption,
    status: metadata.status,
    is_publicly_deliverable: metadata.is_publicly_deliverable,
    uploaded_by: actor,
    published_at: publishedAt(metadata.status),
    created_by: actor,
    updated_by: actor,
  }
  const { data, error } = await db()
    .from('media_assets')
    .insert(payload)
    .select()
    .single()
  if (error) {
    await client.storage.from('showcase-media').remove([storagePath])
    throw new Error(error.message)
  }
  return data as MediaAsset
}

export async function saveMediaMetadata(
  input: Pick<
    MediaAsset,
    'title' | 'alt_text' | 'caption' | 'status' | 'is_publicly_deliverable'
  >,
  current: MediaAsset,
) {
  const actor = await actorId()
  const { data, error } = await db()
    .from('media_assets')
    .update({
      ...input,
      published_at: publishedAt(input.status, current.published_at),
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq('id', current.id)
    .select()
    .single()
  throwIfError(error)
  return data as MediaAsset
}

export async function deleteMedia(asset: MediaAsset) {
  const { error } = await db()
    .from('media_assets')
    .delete()
    .eq('id', asset.id)
    .select('id')
    .single()
  throwIfError(error)
  const { error: storageError } = await requireClient()
    .storage.from('showcase-media')
    .remove([asset.storage_path])
  if (storageError)
    throw new Error(
      `Metadata deleted, but Storage cleanup failed: ${storageError.message}`,
    )
}

export async function getAdminMediaUrl(asset: MediaAsset) {
  const { data, error } = await requireClient()
    .storage.from('showcase-media')
    .createSignedUrl(asset.storage_path, 300)
  if (error) throw new Error(error.message)
  return data.signedUrl
}

export async function associateMedia(
  table: 'project_media' | 'project_room_media' | 'work_media',
  ownerId: string,
  mediaAssetId: string,
) {
  const common = {
    media_asset_id: mediaAssetId,
    role: 'gallery',
    sort_order: 0,
  }
  const { error } =
    table === 'project_media'
      ? await db()
          .from('project_media')
          .upsert({ ...common, project_id: ownerId })
          .select('project_id')
          .single()
      : table === 'project_room_media'
        ? await db()
            .from('project_room_media')
            .upsert({ ...common, project_room_id: ownerId })
            .select('project_room_id')
            .single()
        : await db()
            .from('work_media')
            .upsert({ ...common, work_id: ownerId })
            .select('work_id')
            .single()
  throwIfError(error)
}

export async function classifyAndAssociateMedia(
  asset: MediaAsset,
  table: 'project_media' | 'project_room_media' | 'work_media',
  ownerId: string,
) {
  const client = requireClient()
  const prefix = table === 'project_media' ? 'projects' : 'works'
  const filename =
    asset.storage_path.split('/').at(-1) ??
    safeFilename(asset.original_filename)
  const nextPath = `${prefix}/${ownerId}/${asset.id}/${filename}`
  const moved = await client.storage
    .from('showcase-media')
    .move(asset.storage_path, nextPath)
  if (moved.error) throw new Error(moved.error.message)
  const actor = await actorId()
  const updated = await db()
    .from('media_assets')
    .update({
      storage_path: nextPath,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
    .eq('id', asset.id)
  if (updated.error) {
    await client.storage
      .from('showcase-media')
      .move(nextPath, asset.storage_path)
    throw new Error(updated.error.message)
  }
  try {
    await associateMedia(table, ownerId, asset.id)
  } catch (error) {
    await db()
      .from('media_assets')
      .update({ storage_path: asset.storage_path })
      .eq('id', asset.id)
    await client.storage
      .from('showcase-media')
      .move(nextPath, asset.storage_path)
    throw error
  }
}

export async function listMaterialCollections() {
  const { data, error } = await db()
    .from('material_collections')
    .select('*')
    .order('sort_order')
    .order('name')
  throwIfError(error)
  return (data ?? []) as MaterialCollection[]
}

export async function saveMaterialCollection(
  input: MaterialCollectionInput,
  id?: string,
) {
  const actor = await actorId()
  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('material_collections').update(payload).eq('id', id)
    : db()
        .from('material_collections')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as MaterialCollection
}

export async function deleteMaterialCollection(id: string) {
  const { error } = await db()
    .from('material_collections')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function listMaterials() {
  const { data, error } = await db()
    .from('materials')
    .select('*')
    .order('updated_at', { ascending: false })
  throwIfError(error)
  return (data ?? []) as Material[]
}

export async function saveMaterial(input: MaterialInput, id?: string) {
  const actor = await actorId()
  const existing = id
    ? await db()
        .from('materials')
        .select('cover_asset_id, published_at')
        .eq('id', id)
        .single()
    : null
  if (existing) throwIfError(existing.error)
  const payload = {
    ...input,
    cover_asset_id:
      input.cover_asset_id ?? existing?.data?.cover_asset_id ?? null,
    published_at: publishedAt(input.status, existing?.data?.published_at),
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('materials').update(payload).eq('id', id)
    : db()
        .from('materials')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  return data as Material
}

export async function deleteMaterial(id: string) {
  const { error } = await db()
    .from('materials')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function listPartners() {
  const [partners, details, assignments, documents] = await Promise.all([
    db().from('partners').select('*').order('updated_at', { ascending: false }),
    db().from('partner_private_details').select('*'),
    db().from('project_partners').select('*'),
    db()
      .from('partner_private_documents')
      .select('*')
      .order('created_at', { ascending: false }),
  ])
  ;[partners.error, details.error, assignments.error, documents.error].forEach(
    throwIfError,
  )
  return {
    partners: (partners.data ?? []) as Partner[],
    details: (details.data ?? []) as PartnerPrivateDetails[],
    assignments: (assignments.data ?? []) as Array<{
      project_id: string
      partner_id: string
      assignment_role: string | null
      description: string | null
      sort_order: number
    }>,
    documents: (documents.data ?? []) as PartnerPrivateDocument[],
  }
}

export async function savePartner(
  input: PartnerInput,
  privateDetails: Pick<
    PartnerPrivateDetails,
    'email' | 'phone' | 'nda_status' | 'nda_expires_on' | 'internal_notes'
  >,
  id?: string,
) {
  const actor = await actorId()
  const existing = id
    ? await db()
        .from('partners')
        .select('logo_asset_id, published_at')
        .eq('id', id)
        .single()
    : null
  if (existing) throwIfError(existing.error)
  const payload = {
    ...input,
    logo_asset_id: input.logo_asset_id ?? existing?.data?.logo_asset_id ?? null,
    published_at: publishedAt(input.status, existing?.data?.published_at),
    updated_at: new Date().toISOString(),
    updated_by: actor,
  }
  const query = id
    ? db().from('partners').update(payload).eq('id', id)
    : db()
        .from('partners')
        .insert({ ...payload, created_by: actor })
  const { data, error } = await query.select().single()
  throwIfError(error)
  const partner = data as Partner
  const { error: privateError } = await db()
    .from('partner_private_details')
    .upsert({
      partner_id: partner.id,
      ...privateDetails,
      updated_at: new Date().toISOString(),
      updated_by: actor,
    })
  throwIfError(privateError)
  return partner
}

export async function deletePartner(id: string) {
  const { error } = await db()
    .from('partners')
    .delete()
    .eq('id', id)
    .select('id')
    .single()
  throwIfError(error)
}

export async function assignPartner(
  projectId: string,
  partnerId: string,
  assignmentRole: string,
) {
  const { error } = await db()
    .from('project_partners')
    .upsert({
      project_id: projectId,
      partner_id: partnerId,
      assignment_role: assignmentRole,
      sort_order: 0,
    })
    .select('project_id')
    .single()
  throwIfError(error)
}

export async function uploadPrivatePartnerDocument(
  partnerId: string,
  file: File,
  title: string,
  documentKind: string,
  expiresOn: string | null,
) {
  const client = requireClient()
  const actor = await actorId()
  const assetId = crypto.randomUUID()
  const storagePath = `internal/partners/${partnerId}/${assetId}/${safeFilename(file.name)}`
  const uploaded = await client.storage
    .from('showcase-media')
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
    })
  if (uploaded.error) throw new Error(uploaded.error.message)
  const asset = await db()
    .from('media_assets')
    .insert({
      id: assetId,
      storage_path: storagePath,
      title,
      kind: 'document',
      mime_type: file.type || 'application/octet-stream',
      original_filename: file.name,
      byte_size: file.size,
      status: 'draft',
      is_publicly_deliverable: false,
      uploaded_by: actor,
      created_by: actor,
      updated_by: actor,
    })
    .select()
    .single()
  if (asset.error) {
    await client.storage.from('showcase-media').remove([storagePath])
    throw new Error(asset.error.message)
  }
  const document = await db()
    .from('partner_private_documents')
    .insert({
      partner_id: partnerId,
      media_asset_id: assetId,
      document_kind: documentKind,
      title,
      expires_on: expiresOn,
      created_by: actor,
    })
    .select()
    .single()
  if (document.error) {
    await db().from('media_assets').delete().eq('id', assetId)
    await client.storage.from('showcase-media').remove([storagePath])
    throw new Error(document.error.message)
  }
  return document.data as PartnerPrivateDocument
}

export async function deletePrivatePartnerDocument(
  document: PartnerPrivateDocument,
  asset: MediaAsset,
) {
  const removedDocument = await db()
    .from('partner_private_documents')
    .delete()
    .eq('id', document.id)
    .select('id')
    .single()
  throwIfError(removedDocument.error)
  const removedAsset = await db()
    .from('media_assets')
    .delete()
    .eq('id', asset.id)
    .select('id')
    .single()
  throwIfError(removedAsset.error)
  const storage = await requireClient()
    .storage.from('showcase-media')
    .remove([asset.storage_path])
  if (storage.error)
    throw new Error(
      `Database records deleted, but Storage cleanup failed: ${storage.error.message}`,
    )
}

export function messageFrom(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'The operation could not be completed.'
}

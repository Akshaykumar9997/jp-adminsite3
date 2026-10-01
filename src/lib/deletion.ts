import { supabase } from './supabase'
import { UserError } from './feedback'

export const DELETED_EVENT = 'cms:deleted'
export const CLEANUP_EVENT = 'cms:storage-cleanup'
export type DeletedRecord = { table: string; id: string }
const pending = new Map<string, Promise<void>>()

export function removeDeletedRecord<T>(data: T, id: string): T {
  const keep = (row: unknown) =>
    !row || typeof row !== 'object' || !('id' in row) || row.id !== id
  if (Array.isArray(data)) return data.filter(keep) as T
  if (data && typeof data === 'object')
    return Object.fromEntries(
      Object.entries(data).map(([key, rows]) => [
        key,
        Array.isArray(rows) ? rows.filter(keep) : rows,
      ]),
    ) as T
  return data
}

// Confirm the returned row: RLS can make a DELETE affect zero rows without an error.
type DeleteTable =
  | 'projects'
  | 'works'
  | 'room_categories'
  | 'materials'
  | 'partners'
  | 'media_assets'
  | 'material_collections'
  | 'partner_private_documents'
export function deleteRecord(table: DeleteTable, id: string): Promise<void> {
  const key = `${table}:${id}`
  const existing = pending.get(key)
  if (existing) return existing
  const task = (async () => {
    if (!supabase) throw new UserError('The Admin site connection is not configured.')
    const result = await supabase
      .schema('showcase')
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')
      .single()
    if (result.error) throw new Error(result.error.message)
    if ((result.data as { id: string } | null)?.id !== id)
      throw new UserError(
        'Deletion could not be confirmed. Reload and try again.',
      )
    window.dispatchEvent(
      new CustomEvent<DeletedRecord>(DELETED_EVENT, { detail: { table, id } }),
    )
  })().finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}

const cleanupKey = `cms:storage-cleanup:${import.meta.env.VITE_SUPABASE_URL}`
let memoryCleanup: string[] = []
export function pendingCleanup(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(cleanupKey) ?? '[]')
    return [
      ...new Set([
        ...memoryCleanup,
        ...(Array.isArray(value)
          ? value.filter((path): path is string => typeof path === 'string')
          : []),
      ]),
    ]
  } catch {
    return memoryCleanup
  }
}
function saveCleanup(paths: string[]) {
  memoryCleanup = paths
  try {
    localStorage.setItem(cleanupKey, JSON.stringify(paths))
  } catch {
    /* Private browsing may disable storage. */
  }
  window.dispatchEvent(new Event(CLEANUP_EVENT))
}
export function forgetCleanup(path: string) {
  saveCleanup(pendingCleanup().filter((entry) => entry !== path))
}
const cleaning = new Map<string, Promise<string | undefined>>()
const reservedPaths = new Set<string>()
export async function reserveUploadPath(path: string) {
  reservedPaths.add(path)
  await cleaning.get(path)
  forgetCleanup(path)
}
export function releaseUploadPath(path: string) {
  reservedPaths.delete(path)
}
export function cleanupStorage(path: string): Promise<string | undefined> {
  const existing = cleaning.get(path)
  if (existing) return existing
  saveCleanup([...new Set([...pendingCleanup(), path])])
  const task = (async () => {
    try {
      if (!supabase) throw new Error('Connection unavailable')
      const result = await supabase.storage
        .from('showcase-media')
        .remove([path])
      if (result.error) throw result.error
      saveCleanup(pendingCleanup().filter((entry) => entry !== path))
    } catch {
      return 'The item was removed, but its stored file still needs cleanup. Retry cleanup in the Media Library.'
    }
  })().finally(() => cleaning.delete(path))
  cleaning.set(path, task)
  return task
}
export async function retryCleanup() {
  await Promise.all(
    pendingCleanup().map(async (path) => {
      if (!supabase || reservedPaths.has(path)) return
      // A retried upload may now own this path. Never remove a referenced object.
      try {
        const result = await supabase
          .schema('showcase')
          .from('media_assets')
          .select('id')
          .eq('storage_path', path)
          .limit(1)
        if (result.error || reservedPaths.has(path)) return
        if (result.data?.length) forgetCleanup(path)
        else await cleanupStorage(path)
      } catch {
        /* Keep failed cleanup jobs available for another retry. */
      }
    }),
  )
}

import { supabase } from './supabase'
import { DELETED_EVENT, deleteRecord, cleanupStorage } from './deletion'
import { UserError } from './feedback'
import type { MediaAsset } from './database.types'
export type TrashTable =
  'media_assets' | 'works' | 'room_categories' | 'materials' | 'partners'
export const CHANGED_EVENT = 'cms:changed'
const inFlight = new Map<string, Promise<void>>()
function checkTrashError(error: { message: string; code?: string } | null) {
  if (!error) return
  if (/deleted_at|schema cache/i.test(error.message))
    throw new UserError(
      'Trash requires the gallery backend update. Apply the gallery migration before using Trash.',
    )
  const known = [
    'This file is still in use. Remove its associations before moving it to Trash.',
    'Default rooms cannot be moved to Trash.',
    'This room still contains works. Move or trash those works first.',
    'Restore the room before restoring or saving this work.',
    'Restore this item from Trash before editing it.',
    'Restore the selected file from Trash before using it.',
  ]
  if (known.includes(error.message)) throw new UserError(error.message)
  throw new Error(error.message)
}
async function updateTrash(table: TrashTable, id: string, trashed: boolean) {
  const key = `${table}:${id}:${trashed}`
  const existing = inFlight.get(key)
  if (existing) return existing
  const task = (async () => {
    if (!supabase) throw new UserError('The Admin site connection is not configured.')
    const current = await supabase
      .schema('showcase')
      .from(table)
      .select('id,deleted_at')
      .eq('id', id)
      .single()
    checkTrashError(current.error)
    if (!current.data)
      throw new UserError('This item is no longer available. Reload and retry.')
    // A retried request may already have committed before its response was lost.
    if (Boolean(current.data.deleted_at) === trashed) {
      window.dispatchEvent(
        trashed
          ? new CustomEvent(DELETED_EVENT, { detail: { table, id } })
          : new Event(CHANGED_EVENT),
      )
      return
    }
    const result = await supabase
      .schema('showcase')
      .from(table)
      .update({
        deleted_at: trashed ? new Date().toISOString() : null,
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
      .single()
    if (result.error) {
      const recovered = await supabase
        .schema('showcase')
        .from(table)
        .select('id,deleted_at')
        .eq('id', id)
        .single()
      if (
        !recovered.error &&
        recovered.data &&
        Boolean(recovered.data.deleted_at) === trashed
      ) {
        window.dispatchEvent(
          trashed
            ? new CustomEvent(DELETED_EVENT, { detail: { table, id } })
            : new Event(CHANGED_EVENT),
        )
        return
      }
      checkTrashError(result.error)
    }
    if (result.data?.id !== id)
      throw new UserError('This item is no longer available. Reload and retry.')
    window.dispatchEvent(
      trashed
        ? new CustomEvent(DELETED_EVENT, { detail: { table, id } })
        : new Event(CHANGED_EVENT),
    )
  })().finally(() => inFlight.delete(key))
  inFlight.set(key, task)
  return task
}
export const moveToTrash = (table: TrashTable, id: string) =>
  updateTrash(table, id, true)
export const restoreFromTrash = (table: TrashTable, id: string) =>
  updateTrash(table, id, false)
export async function permanentlyDelete(table: TrashTable, id: string) {
  if (!supabase) throw new UserError('The Admin site connection is not configured.')
  const found = await supabase
    .schema('showcase')
    .from(table)
    .select('*')
    .eq('id', id)
    .single()
  if (found.error || !found.data?.deleted_at)
    throw new UserError(
      'Only items in Trash can be permanently deleted. Reload and retry.',
    )
  await deleteRecord(table, id)
  if (table === 'media_assets')
    return cleanupStorage((found.data as MediaAsset).storage_path)
}

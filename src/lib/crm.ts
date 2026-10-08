import { supabase } from './supabase'
import type { CrmRow } from './database.types'

export type CrmKind = 'leads' | 'customer_support'
export async function loadCrm(kind: CrmKind): Promise<CrmRow[]> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data: allowed, error: authError } = await supabase.rpc('is_admin')
  if (authError || allowed !== true) throw new Error('Active administrator access is required.')
  const rows: CrmRow[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.schema('crm').from(kind).select('*')
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + 499)
      .abortSignal(AbortSignal.timeout(20_000))
    if (error) throw new Error('Could not load records. Please refresh and try again.')
    rows.push(...data)
    if (data.length < 500) return rows
  }
}

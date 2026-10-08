import { supabase } from './supabase'
import { UserError } from './feedback'

export type AdminProfile = {
  id: string
  email: string | null
  full_name: string | null
  role: 'admin'
  created_at: string
  access_revoked_at: string | null
}

async function request(body: Record<string, string>) {
  if (!supabase)
    throw new UserError('The admin site connection is not configured.')
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session)
    throw new UserError('Sign in again to manage admins.')
  const response = await fetch('/api/admins', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  let result
  try {
    result = await response.json()
  } catch {
    throw new UserError(
      'The admin management endpoint is unavailable. Check the server deployment.',
    )
  }
  if (!response.ok)
    throw new UserError(
      result.error || 'Admin management failed. Please retry.',
    )
  return result
}

export async function loadAdmins(): Promise<AdminProfile[]> {
  return (await request({ action: 'list' })).admins
}
export async function createAdmin(
  email: string,
  fullName: string,
  password: string,
) {
  await request({ action: 'create', email, full_name: fullName, password })
}
export async function changeAdminPassword(id: string, password: string) {
  await request({ action: 'password', id, password })
}
export async function removeAdmin(id: string) {
  await request({ action: 'remove', id })
}

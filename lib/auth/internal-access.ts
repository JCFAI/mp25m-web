import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type InternalAccess = {
  internal_user_id: string
  auth_user_id: string
  assignment_id: string
  access_role_code: string
  access_role_name: string
  is_administrative: boolean
  access_scope_id: string
  scope_type: string
  scope_key: string | null
  scope_entity_id: string | null
  scope_name: string | null
  valid_from: string
  valid_until: string | null
}

export async function getInternalAccess(
  authUserId: string
): Promise<InternalAccess[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('active_internal_access')
    .select(`
      internal_user_id,
      auth_user_id,
      assignment_id,
      access_role_code,
      access_role_name,
      is_administrative,
      access_scope_id,
      scope_type,
      scope_key,
      scope_entity_id,
      scope_name,
      valid_from,
      valid_until
    `)
    .eq('auth_user_id', authUserId)

  if (error) {
    throw new Error(`Unable to resolve internal access: ${error.message}`)
  }

  return (data ?? []) as InternalAccess[]
}

import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

const PERSON_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

function getGlobalPersonAccess(access: InternalAccess[]) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      PERSON_GLOBAL_ROLES.has(item.access_role_code),
  )
}

export function canManagePeople(access: InternalAccess[]) {
  return Boolean(getGlobalPersonAccess(access))
}

export async function createCanonicalPerson(
  access: InternalAccess[],
  displayName: string,
): Promise<string> {
  const personAccess = getGlobalPersonAccess(access)

  if (!personAccess) {
    throw new Error('The current internal user cannot manage people')
  }

  const normalizedDisplayName = displayName.trim()

  if (
    normalizedDisplayName.length < 2 ||
    normalizedDisplayName.length > 200
  ) {
    throw new Error('Invalid person display name')
  }

  const { data, error } = await createAdminClient().rpc(
    'create_person',
    {
      p_actor_internal_user_id: personAccess.internal_user_id,
      p_display_name: normalizedDisplayName,
    },
  )

  if (error) {
    throw new Error(error.message)
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Person creation did not return an identifier')
  }

  return data
}

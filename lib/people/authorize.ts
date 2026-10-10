import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Fail closed before querying the privileged, full canonical person profile.
 * A global administrator/validator may inspect all records. Node-scoped
 * identities may only inspect records with active participation in their node.
 */
export async function canReadPersonPrivateDetails(
  access: InternalAccess[],
  personId: string,
): Promise<boolean> {
  if (!UUID.test(personId) || access.length === 0) return false

  if (access.some(grant =>
    grant.scope_type === 'global' &&
    ['administrator', 'validator'].includes(grant.access_role_code)
  )) return true

  const nodeIds = [...new Set(access
    .filter(grant => grant.scope_type === 'node' && grant.scope_entity_id)
    .map(grant => grant.scope_entity_id as string))]

  if (nodeIds.length === 0) return false

  const { data, error } = await createAdminClient()
    .from('person_territorial_profile')
    .select('person_id')
    .eq('person_id', personId)
    .eq('participation_status', 'active')
    .in('node_id', nodeIds)
    .limit(1)

  if (error) throw new Error('Unable to verify person territorial authorization')
  return (data?.length ?? 0) > 0
}

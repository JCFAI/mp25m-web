import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** A shared directory does not grant permission to read private organization details. */
export async function canReadOrganizationPrivateDetails(
  access: InternalAccess[],
  organizationId: string,
): Promise<boolean> {
  if (!UUID_PATTERN.test(organizationId) || access.length === 0) return false

  if (access.some(grant =>
    grant.scope_type === 'global' &&
    ['administrator', 'validator'].includes(grant.access_role_code)
  )) return true

  const nodeIds = [...new Set(access
    .filter(grant => grant.scope_type === 'node' && grant.scope_entity_id)
    .map(grant => grant.scope_entity_id as string))]

  if (nodeIds.length === 0) return false

  const { data, error } = await createAdminClient()
    .from('organization_node_list')
    .select('organization_id')
    .eq('organization_id', organizationId)
    .eq('verification_status', 'confirmed')
    .in('node_id', nodeIds)
    .limit(1)

  if (error) throw new Error('Unable to verify organization territorial authorization')
  return (data?.length ?? 0) > 0
}

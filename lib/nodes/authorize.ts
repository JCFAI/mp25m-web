import type { InternalAccess } from '../auth/internal-access'

/**
 * Authorization for private territorial detail pages.
 * The shared node directory is intentionally not filtered here.
 */
export function canReadNodePrivateDetails(access: InternalAccess[], nodeId: string): boolean {
  return access.some(grant =>
    (grant.access_role_code === 'administrator' && grant.scope_type === 'global') ||
    (grant.scope_type === 'node' && grant.scope_entity_id === nodeId)
  )
}

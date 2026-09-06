import 'server-only'

import type { InternalAccess } from '../auth/internal-access'

const SKILL_CATALOG_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

export function getGlobalSkillCatalogAccess(
  access: InternalAccess[]
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      SKILL_CATALOG_GLOBAL_ROLES.has(
        item.access_role_code
      )
  )
}

export function canManageSkillCatalog(
  access: InternalAccess[]
) {
  return Boolean(
    getGlobalSkillCatalogAccess(access)
  )
}

export function getSkillCatalogActorId(
  access: InternalAccess[]
) {
  const catalogAccess =
    getGlobalSkillCatalogAccess(access)

  if (!catalogAccess) {
    throw new Error(
      'The current internal user cannot manage skill catalog'
    )
  }

  return catalogAccess.internal_user_id
}

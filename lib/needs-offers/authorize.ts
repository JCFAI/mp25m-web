import type { InternalAccess } from '../auth/internal-access'

type NeedOfferAuthorizationRecord = {
  responsible_internal_user_id: string
  node_id: string | null
}

function actorId(access: InternalAccess[]): string | null {
  const ids = [
    ...new Set(
      access
        .map((grant) => grant.internal_user_id)
        .filter(Boolean),
    ),
  ]

  return ids.length === 1 ? ids[0] : null
}

function hasGlobalScope(access: InternalAccess[]): boolean {
  return access.some(
    (grant) =>
      grant.scope_type === 'global' &&
      grant.scope_entity_id === null,
  )
}

function hasGlobalAdministration(access: InternalAccess[]): boolean {
  return access.some(
    (grant) =>
      grant.access_role_code === 'administrator' &&
      grant.scope_type === 'global' &&
      grant.scope_entity_id === null,
  )
}

function hasNodeScope(
  access: InternalAccess[],
  nodeId: string,
): boolean {
  return access.some(
    (grant) =>
      grant.scope_type === 'node' &&
      grant.scope_entity_id === nodeId,
  )
}

export function canReadNeedOffer(
  access: InternalAccess[],
  needOffer: NeedOfferAuthorizationRecord,
): boolean {
  if (access.length === 0) return false

  if (hasGlobalScope(access)) return true

  const actor = actorId(access)

  if (
    actor &&
    needOffer.responsible_internal_user_id === actor
  ) {
    return true
  }

  return (
    needOffer.node_id !== null &&
    hasNodeScope(access, needOffer.node_id)
  )
}

export function canChangeNeedOfferNode(
  access: InternalAccess[],
  currentNodeId: string | null,
  nextNodeId: string | null,
): boolean {
  if (currentNodeId === nextNodeId) {
    return true
  }

  return canAssignNeedOfferNode(
    access,
    nextNodeId,
  )
}

export function canAssignNeedOfferNode(
  access: InternalAccess[],
  nodeId: string | null,
): boolean {
  if (hasGlobalAdministration(access)) {
    return true
  }

  if (nodeId === null) {
    return false
  }

  return hasNodeScope(access, nodeId)
}

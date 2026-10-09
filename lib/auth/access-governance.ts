export type AccessGrant = {
  role: string
  scopeType: string
  scopeEntityId: string | null
}

export type GrantDecision = {
  allowed: boolean
  reason: string
}

export function canAssignRole(
  actorGrants: AccessGrant[],
  targetRole: string,
  targetScopeType: string,
  targetScopeEntityId: string | null,
  isSelfAssignment: boolean,
): GrantDecision {
  if (isSelfAssignment) return { allowed: false, reason: 'No se permite asignarse permisos a uno mismo.' }
  const globalAdmin = actorGrants.some(g => g.role === 'administrator' && g.scopeType === 'global')
  if (globalAdmin) return { allowed: true, reason: 'Administrador General autorizado.' }

  if (targetScopeType !== 'node' || !targetScopeEntityId) {
    return { allowed: false, reason: 'La asignación excede el ámbito autorizado.' }
  }

  const scoped = (role: string) => actorGrants.some(g =>
    g.role === role && g.scopeType === 'node' && g.scopeEntityId === targetScopeEntityId
  )

  if (targetRole === 'participant' || targetRole === 'node_referent') {
    if (scoped('local_administrator')) return { allowed: true, reason: 'Administrador Local autorizado.' }
    if (targetRole === 'node_referent' && scoped('founder_access')) {
      return { allowed: true, reason: 'Fundador autorizado.' }
    }
  }
  return { allowed: false, reason: 'No tiene permisos para esta asignación.' }
}

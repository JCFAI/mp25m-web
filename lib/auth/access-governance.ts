export type AccessGrant = {
  role: string
  scopeType: string
  scopeEntityId: string | null
}

export type GrantDecision = {
  allowed: boolean
  reason: string
}

const GLOBAL_ONLY_ROLES = new Set(['administrator'])
const NODE_ONLY_ROLES = new Set(['local_administrator', 'founder_access', 'node_referent'])
const GLOBAL_OR_NODE_ROLES = new Set(['participant', 'validator', 'articulator', 'authority_analyst'])

export function canAssignRole(
  actorGrants: AccessGrant[],
  targetRole: string,
  targetScopeType: string,
  targetScopeEntityId: string | null,
  isSelfAssignment: boolean,
): GrantDecision {
  const denied = (reason: string): GrantDecision => ({ allowed: false, reason })
  if (isSelfAssignment) return denied('No se permite asignarse permisos a uno mismo.')

  const validGlobal = targetScopeType === 'global' && targetScopeEntityId === null
  const validNode = targetScopeType === 'node' && Boolean(targetScopeEntityId)

  if (
    (GLOBAL_ONLY_ROLES.has(targetRole) && !validGlobal) ||
    (NODE_ONLY_ROLES.has(targetRole) && !validNode) ||
    (GLOBAL_OR_NODE_ROLES.has(targetRole) && !validGlobal && !validNode) ||
    (!GLOBAL_ONLY_ROLES.has(targetRole) && !NODE_ONLY_ROLES.has(targetRole) && !GLOBAL_OR_NODE_ROLES.has(targetRole))
  ) {
    return denied('Rol o ámbito de asignación no permitido.')
  }

  const globalAdmin = actorGrants.some(g => g.role === 'administrator' && g.scopeType === 'global' && g.scopeEntityId === null)
  if (globalAdmin) return { allowed: true, reason: 'Administrador General autorizado.' }

  if (!validNode) return denied('La asignación excede el ámbito autorizado.')

  const scoped = (role: string) => actorGrants.some(g =>
    g.role === role && g.scopeType === 'node' && g.scopeEntityId === targetScopeEntityId
  )
  if (targetRole === 'participant' || targetRole === 'node_referent') {
    if (scoped('local_administrator')) return { allowed: true, reason: 'Administrador Local autorizado.' }
    if (targetRole === 'node_referent' && scoped('founder_access')) {
      return { allowed: true, reason: 'Fundador autorizado.' }
    }
  }
  return denied('No tiene permisos para esta asignación.')
}

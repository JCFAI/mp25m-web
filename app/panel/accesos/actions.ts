'use server'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient } from '../../../lib/supabase/server'

type GrantAccessInput = {
  targetInternalUserId: string
  roleCode: string
  scopeId: string
  reason: string
}

type RevokeAccessInput = {
  assignmentId: string
  reason: string
}

/**
 * Resolve the acting internal user from the verified Supabase Auth claims.
 * The caller must never be able to provide or override the actor's UUID.
 */
async function requireAuthenticatedActor(): Promise<string> {
  const sessionClient = await createClient()
  const { data, error } = await sessionClient.auth.getClaims()
  const authUserId = data?.claims?.sub

  if (error || typeof authUserId !== 'string' || !authUserId) {
    throw new Error('Debés iniciar sesión para administrar accesos.')
  }

  const access = await getInternalAccess(authUserId)
  if (access.length === 0) {
    throw new Error('Tu cuenta no tiene permisos internos vigentes.')
  }

  const actorIds = [...new Set(access.map(item => item.internal_user_id))]
  if (actorIds.length !== 1 || !actorIds[0]) {
    throw new Error('No se pudo identificar una cuenta interna única.')
  }

  return actorIds[0]
}

function requireReason(reason: string): string {
  const normalized = reason.trim()
  if (normalized.length < 3 || normalized.length > 2000) {
    throw new Error('Indicá un motivo de entre 3 y 2000 caracteres.')
  }
  return normalized
}

function requireUuid(value: string, field: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Identificador inválido: ${field}.`)
  }
  return value
}

/**
 * Server-only mutation: uses trusted actor identity and service_role-only RPC.
 * It is deliberately not wired into a public form until all DB guards are audited.
 */
export async function grantInternalAccess(input: GrantAccessInput): Promise<string> {
  const actorInternalUserId = await requireAuthenticatedActor()
  const targetInternalUserId = requireUuid(input.targetInternalUserId, 'destinatario')
  const scopeId = requireUuid(input.scopeId, 'ámbito')
  const roleCode = input.roleCode
  const reason = requireReason(input.reason)

  if (actorInternalUserId === targetInternalUserId) {
    throw new Error('No podés asignarte permisos a vos mismo.')
  }
  if (!/^[a-z][a-z_]{1,63}$/.test(roleCode)) {
    throw new Error('Rol de acceso inválido.')
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('grant_internal_access', {
    p_actor_internal_user_id: actorInternalUserId,
    p_target_internal_user_id: targetInternalUserId,
    p_role_code: roleCode,
    p_scope_id: scopeId,
    p_reason: reason,
  })
  if (error) throw new Error(`No se pudo otorgar el acceso: ${error.message}`)
  if (typeof data !== 'string') {
    throw new Error('La base de datos no devolvió una asignación válida.')
  }
  return data
}

/** Only the authoritative SQL routine may authorize and perform revocation. */
export async function revokeInternalAccess(input: RevokeAccessInput): Promise<void> {
  const actorInternalUserId = await requireAuthenticatedActor()
  const assignmentId = requireUuid(input.assignmentId, 'asignación')
  const reason = requireReason(input.reason)

  const admin = createAdminClient()
  const { error } = await admin.rpc('revoke_internal_access', {
    p_actor_internal_user_id: actorInternalUserId,
    p_assignment_id: assignmentId,
    p_reason: reason,
  })
  if (error) throw new Error(`No se pudo revocar el acceso: ${error.message}`)
}

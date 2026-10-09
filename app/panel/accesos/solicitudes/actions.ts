'use server'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createClient } from '../../../../lib/supabase/server'

type ApprovalInput = {
  authUserId: string
  displayName: string
  roleCode: string
  scopeId: string
  reason: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const APPROVABLE_ROLES = new Set([
  'administrator', 'local_administrator', 'founder_access',
  'node_referent', 'participant', 'validator', 'articulator', 'authority_analyst',
])

/**
 * Server-only identity binding; the actor is never supplied by the caller.
 * Keep disabled until review UI and browser integration tests are complete.
 */
export async function approveAccessRequest(input: ApprovalInput): Promise<string> {
  if (process.env.MP25M_ENABLE_ACCESS_APPROVALS !== 'true') {
    throw new Error('Las aprobaciones todavía no están habilitadas.')
  }

  if (!UUID.test(input.authUserId) || !UUID.test(input.scopeId)) {
    throw new Error('Identificador de cuenta o ámbito inválido.')
  }

  const name = input.displayName.trim()
  const reason = input.reason.trim()
  if (name.length < 2 || name.length > 120 || reason.length < 3 || reason.length > 2000) {
    throw new Error('El nombre o el motivo de aprobación no son válidos.')
  }
  if (!APPROVABLE_ROLES.has(input.roleCode)) {
    throw new Error('Rol inválido.')
  }

  const session = await createClient()
  const { data: claims, error: claimsError } = await session.auth.getClaims()
  const currentAuthId = claims?.claims?.sub
  if (claimsError || !currentAuthId) {
    throw new Error('Debés iniciar sesión para aprobar una cuenta.')
  }

  const access = await getInternalAccess(currentAuthId)
  const globalAccess = access.find(row =>
    row.access_role_code === 'administrator' && row.scope_type === 'global'
  )
  if (!globalAccess) {
    throw new Error('Solo el Administrador General puede incorporar usuarios.')
  }
  if (input.authUserId === currentAuthId) {
    throw new Error('No podés aprobar tu propia cuenta.')
  }

  const admin = createAdminClient()
  const { data: authRecord, error: authError } = await admin.auth.admin.getUserById(input.authUserId)
  if (authError || !authRecord.user || !authRecord.user.email_confirmed_at) {
    throw new Error('La cuenta no existe o todavía no confirmó su correo.')
  }

  // All identity creation, first assignment, and audit happen atomically in SQL.
  const { data, error } = await admin.rpc('approve_internal_access_request', {
    p_actor_internal_user_id: globalAccess.internal_user_id,
    p_auth_user_id: input.authUserId,
    p_display_name: name,
    p_role_code: input.roleCode,
    p_scope_id: input.scopeId,
    p_reason: reason,
  })
  if (error || typeof data !== 'string') {
    throw new Error('No se pudo aprobar la cuenta. Revisá su estado y permisos.')
  }
  return data
}

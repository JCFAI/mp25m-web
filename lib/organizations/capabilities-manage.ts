import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OrganizationCapabilityDetailsInput = {
  notes?: string | null
  evidenceText?: string | null
}

export type AddOrganizationCapabilityInput =
  OrganizationCapabilityDetailsInput & {
    organizationId: string
    skillId: string
    nodeId?: string | null
  }

export type AddOrganizationCapabilityResult = {
  organizationCapabilityId: string
  skillId: string
  skillName: string
  organizationName: string
  nodeId: string | null
  nodeName: string | null
  verificationStatus: string
  operation: 'add' | 'reactivate'
}

export type UpdateOrganizationCapabilityInput =
  OrganizationCapabilityDetailsInput & {
    organizationId: string
    organizationCapabilityId: string
  }

export type ResolveOrganizationCapabilityAction =
  | 'confirmed'
  | 'rejected'

export type ResolveOrganizationCapabilityInput = {
  organizationId: string
  organizationCapabilityId: string
  resolutionAction: ResolveOrganizationCapabilityAction
  reason: string
}

export type DeactivateOrganizationCapabilityInput = {
  organizationId: string
  organizationCapabilityId: string
  reason: string
}

const ORGANIZATION_CAPABILITY_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RpcOrganizationCapabilityResult = {
  organization_capability_id: string
  skill_id: string
  skill_name: string
  organization_name: string
  node_id: string | null
  node_name: string | null
  verification_status: string
  operation: string
}

function getGlobalOrganizationCapabilityAccess(
  access: InternalAccess[]
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      ORGANIZATION_CAPABILITY_GLOBAL_ROLES.has(
        item.access_role_code
      )
  )
}

export function canManageOrganizationCapabilities(
  access: InternalAccess[]
) {
  return Boolean(
    getGlobalOrganizationCapabilityAccess(access)
  )
}

function getActorInternalUserId(
  access: InternalAccess[]
) {
  const organizationCapabilityAccess =
    getGlobalOrganizationCapabilityAccess(access)

  if (!organizationCapabilityAccess) {
    throw new Error(
      'The current internal user cannot manage organization capabilities'
    )
  }

  return organizationCapabilityAccess.internal_user_id
}

function normalizeOptionalText(
  value: string | null | undefined
) {
  return value?.trim() || null
}

function validateUuid(
  value: string,
  label: string
) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

function validateOptionalUuid(
  value: string | null,
  label: string
) {
  if (value !== null) {
    validateUuid(value, label)
  }
}

function validateDetails(
  input: OrganizationCapabilityDetailsInput
) {
  const notes =
    normalizeOptionalText(input.notes)
  const evidenceText =
    normalizeOptionalText(
      input.evidenceText
    )

  for (const [label, value] of [
    ['notes', notes],
    ['evidence', evidenceText],
  ] as const) {
    if (value && value.length > 2000) {
      throw new Error(
        `Invalid organization capability ${label}`
      )
    }
  }

  return {
    notes,
    evidenceText,
  }
}

function validateReason(
  reason: string,
  label: string
) {
  const normalizedReason = reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return normalizedReason
}

function mapRpcResult(
  value: RpcOrganizationCapabilityResult
): AddOrganizationCapabilityResult {
  if (
    value.operation !== 'add' &&
    value.operation !== 'reactivate'
  ) {
    throw new Error(
      'Invalid organization capability operation'
    )
  }

  return {
    organizationCapabilityId:
      value.organization_capability_id,
    skillId: value.skill_id,
    skillName: value.skill_name,
    organizationName:
      value.organization_name,
    nodeId: value.node_id,
    nodeName: value.node_name,
    verificationStatus:
      value.verification_status,
    operation: value.operation,
  }
}

export async function addOrganizationCapability(
  access: InternalAccess[],
  input: AddOrganizationCapabilityInput
): Promise<AddOrganizationCapabilityResult> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const skillId = input.skillId.trim()
  const nodeId =
    input.nodeId?.trim() || null

  validateUuid(
    organizationId,
    'organization'
  )
  validateUuid(skillId, 'skill')
  validateOptionalUuid(nodeId, 'node')

  const details = validateDetails(input)

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'add_organization_capability',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_skill_id: skillId,
      p_node_id: nodeId,
      p_notes: details.notes,
      p_evidence_text:
        details.evidenceText,
    }
  )

  if (error) {
    throw new Error(
      `Unable to add organization capability: ${error.message}`
    )
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  if (!row) {
    throw new Error(
      'Organization capability creation did not return a result'
    )
  }

  return mapRpcResult(
    row as RpcOrganizationCapabilityResult
  )
}

export async function updateOrganizationCapability(
  access: InternalAccess[],
  input: UpdateOrganizationCapabilityInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const organizationCapabilityId =
    input.organizationCapabilityId.trim()

  validateUuid(
    organizationId,
    'organization'
  )
  validateUuid(
    organizationCapabilityId,
    'organization capability'
  )

  const details = validateDetails(input)

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_organization_capability',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_organization_capability_id:
        organizationCapabilityId,
      p_notes: details.notes,
      p_evidence_text:
        details.evidenceText,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update organization capability: ${error.message}`
    )
  }
}

export async function resolveOrganizationCapability(
  access: InternalAccess[],
  input: ResolveOrganizationCapabilityInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const organizationCapabilityId =
    input.organizationCapabilityId.trim()
  const reason = validateReason(
    input.reason,
    'organization capability resolution reason'
  )

  validateUuid(
    organizationId,
    'organization'
  )
  validateUuid(
    organizationCapabilityId,
    'organization capability'
  )

  if (
    input.resolutionAction !== 'confirmed' &&
    input.resolutionAction !== 'rejected'
  ) {
    throw new Error(
      'Invalid organization capability resolution action'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'resolve_organization_capability',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_organization_capability_id:
        organizationCapabilityId,
      p_resolution_action:
        input.resolutionAction,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to resolve organization capability: ${error.message}`
    )
  }
}

export async function deactivateOrganizationCapability(
  access: InternalAccess[],
  input: DeactivateOrganizationCapabilityInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const organizationCapabilityId =
    input.organizationCapabilityId.trim()
  const reason = validateReason(
    input.reason,
    'organization capability deactivation reason'
  )

  validateUuid(
    organizationId,
    'organization'
  )
  validateUuid(
    organizationCapabilityId,
    'organization capability'
  )

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'deactivate_organization_capability',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_organization_capability_id:
        organizationCapabilityId,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to deactivate organization capability: ${error.message}`
    )
  }
}

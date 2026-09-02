import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type AddOrganizationActivityInput = {
  organizationId: string
  activityId: string
  notes?: string | null
}

export type AddOrganizationActivityResult = {
  organizationActivityId: string
  activityId: string
  activityName: string
  organizationName: string
  verificationStatus: string
  operation: 'add' | 'reactivate'
}

export type ProposeOrganizationActivityInput = {
  organizationId: string
  proposedName: string
}

const ORGANIZATION_ACTIVITY_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type RpcOrganizationActivityResult = {
  organization_activity_id: string
  activity_id: string
  activity_name: string
  organization_name: string
  verification_status: string
  operation: string
}

function getGlobalOrganizationActivityAccess(
  access: InternalAccess[]
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      ORGANIZATION_ACTIVITY_GLOBAL_ROLES.has(
        item.access_role_code
      )
  )
}

export function canManageOrganizationActivities(
  access: InternalAccess[]
) {
  return Boolean(
    getGlobalOrganizationActivityAccess(access)
  )
}

function getActorInternalUserId(
  access: InternalAccess[]
) {
  const organizationActivityAccess =
    getGlobalOrganizationActivityAccess(access)

  if (!organizationActivityAccess) {
    throw new Error(
      'The current internal user cannot manage organization activities'
    )
  }

  return organizationActivityAccess.internal_user_id
}

function validateUuid(
  value: string,
  label: string
) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

function normalizeOptionalText(
  value: string | null | undefined
) {
  return value?.trim() || null
}

function validateNotes(
  value: string | null | undefined
) {
  const notes =
    normalizeOptionalText(value)

  if (notes && notes.length > 2000) {
    throw new Error(
      'Invalid organization activity notes'
    )
  }

  return notes
}

function mapRpcResult(
  value: RpcOrganizationActivityResult
): AddOrganizationActivityResult {
  if (
    value.operation !== 'add' &&
    value.operation !== 'reactivate'
  ) {
    throw new Error(
      'Invalid organization activity operation'
    )
  }

  return {
    organizationActivityId:
      value.organization_activity_id,
    activityId: value.activity_id,
    activityName: value.activity_name,
    organizationName:
      value.organization_name,
    verificationStatus:
      value.verification_status,
    operation: value.operation,
  }
}

export async function addOrganizationActivity(
  access: InternalAccess[],
  input: AddOrganizationActivityInput
): Promise<AddOrganizationActivityResult> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const activityId =
    input.activityId.trim()
  const notes = validateNotes(input.notes)

  validateUuid(
    organizationId,
    'organization'
  )
  validateUuid(activityId, 'activity')

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'add_organization_activity',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_activity_id: activityId,
      p_notes: notes,
    }
  )

  if (error) {
    throw new Error(
      `Unable to add organization activity: ${error.message}`
    )
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  if (!row) {
    throw new Error(
      'Organization activity creation did not return a result'
    )
  }

  return mapRpcResult(
    row as RpcOrganizationActivityResult
  )
}

export async function proposeOrganizationActivity(
  access: InternalAccess[],
  input: ProposeOrganizationActivityInput
): Promise<string> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId =
    input.organizationId.trim()
  const proposedName =
    input.proposedName.trim()

  validateUuid(
    organizationId,
    'organization'
  )

  if (
    proposedName.length < 2 ||
    proposedName.length > 200
  ) {
    throw new Error(
      'Invalid organization activity proposal name'
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'propose_organization_activity',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_proposed_name:
        proposedName,
    }
  )

  if (error) {
    throw new Error(
      `Unable to propose organization activity: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Organization activity proposal did not return an identifier'
    )
  }

  return data
}

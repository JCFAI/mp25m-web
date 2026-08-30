import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

export type CreateCanonicalOrganizationInput = {
  name: string
  organizationTypeCode: string
  notes?: string | null
}

export type CreateOrganizationWithTypeProposalInput = {
  name: string
  proposedTypeName: string
  notes?: string | null
}

export type CreateOrganizationNodeLinkInput = {
  organizationId: string
  nodeId: string
  evidenceText?: string | null
  startedOn?: string | null
}

export type ResolveOrganizationTypeProposalAction =
  | 'mapped'
  | 'approved'
  | 'approved_override'
  | 'rejected'

export type ResolveOrganizationTypeProposalInput = {
  proposalId: string
  resolutionAction: ResolveOrganizationTypeProposalAction
  existingOrganizationTypeCode?: string | null
  reason: string
}

export type UpdateOrganizationNodeLinkDetailsInput = {
  organizationId: string
  nodeId: string
  evidenceText?: string | null
  startedOn?: string | null
}

const ORGANIZATION_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

function getGlobalOrganizationAccess(
  access: InternalAccess[]
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      ORGANIZATION_GLOBAL_ROLES.has(
        item.access_role_code
      )
  )
}

export function canManageOrganizations(
  access: InternalAccess[]
) {
  return Boolean(
    getGlobalOrganizationAccess(access)
  )
}

export function canValidateOrganizationNodeLinks(
  access: InternalAccess[]
) {
  return canManageOrganizations(access)
}

function getActorInternalUserId(
  access: InternalAccess[]
) {
  const organizationAccess =
    getGlobalOrganizationAccess(access)

  if (!organizationAccess) {
    throw new Error(
      'The current internal user cannot manage organizations'
    )
  }

  return organizationAccess.internal_user_id
}

export async function listOrganizationTypeOptions():
Promise<OrganizationTypeOption[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('organization_type_options')
    .select(`
      code,
      name,
      display_order
    `)
    .order('display_order', {
      ascending: true,
    })
    .order('name', {
      ascending: true,
    })

  if (error) {
    throw new Error(
      `Unable to list organization types: ${error.message}`
    )
  }

  return (data ?? []) as OrganizationTypeOption[]
}

export async function createCanonicalOrganization(
  access: InternalAccess[],
  input: CreateCanonicalOrganizationInput
): Promise<string> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const name = input.name.trim()
  const organizationTypeCode =
    input.organizationTypeCode.trim()
  const notes = input.notes?.trim() || null

  if (name.length < 2 || name.length > 300) {
    throw new Error('Invalid organization name')
  }

  if (!organizationTypeCode) {
    throw new Error('Invalid organization type')
  }

  if (notes && notes.length > 2000) {
    throw new Error('Invalid organization notes')
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'create_organization',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_name:
        name,
      p_organization_type_code:
        organizationTypeCode,
      p_notes:
        notes,
    }
  )

  if (error) {
    throw new Error(
      `Unable to create organization: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Organization creation did not return an identifier'
    )
  }

  return data
}

export async function createOrganizationWithTypeProposal(
  access: InternalAccess[],
  input: CreateOrganizationWithTypeProposalInput
): Promise<string> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const name = input.name.trim()
  const proposedTypeName =
    input.proposedTypeName.trim()
  const notes = input.notes?.trim() || null

  if (name.length < 2 || name.length > 300) {
    throw new Error('Invalid organization name')
  }

  if (
    proposedTypeName.length < 2 ||
    proposedTypeName.length > 120
  ) {
    throw new Error(
      'Invalid organization type proposal name'
    )
  }

  if (notes && notes.length > 2000) {
    throw new Error('Invalid organization notes')
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'create_organization_with_type_proposal',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_name:
        name,
      p_proposed_type_name:
        proposedTypeName,
      p_notes:
        notes,
    }
  )

  if (error) {
    throw new Error(
      `Unable to create organization with type proposal: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Organization creation did not return an identifier'
    )
  }

  return data
}

export async function resolveOrganizationTypeProposal(
  access: InternalAccess[],
  input: ResolveOrganizationTypeProposalInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const proposalId = input.proposalId.trim()
  const existingOrganizationTypeCode =
    input.existingOrganizationTypeCode?.trim() ||
    null
  const reason = input.reason.trim()

  if (!proposalId) {
    throw new Error(
      'Invalid organization type proposal'
    )
  }

  if (
    ![
      'mapped',
      'approved',
      'approved_override',
      'rejected',
    ].includes(input.resolutionAction)
  ) {
    throw new Error(
      'Invalid organization type proposal resolution action'
    )
  }

  if (
    input.resolutionAction === 'mapped' &&
    !existingOrganizationTypeCode
  ) {
    throw new Error(
      'Invalid organization type proposal mapping'
    )
  }

  if (reason.length < 3 || reason.length > 2000) {
    throw new Error(
      'Invalid organization type proposal resolution reason'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'resolve_organization_type_proposal',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_proposal_id:
        proposalId,
      p_resolution_action:
        input.resolutionAction,
      p_existing_organization_type_code:
        existingOrganizationTypeCode,
      p_reason:
        reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to resolve organization type proposal: ${error.message}`
    )
  }
}

export async function createOrganizationNodeLink(
  access: InternalAccess[],
  input: CreateOrganizationNodeLinkInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId = input.organizationId.trim()
  const nodeId = input.nodeId.trim()
  const evidenceText =
    input.evidenceText?.trim() || null
  const startedOn = input.startedOn?.trim() || null

  if (!organizationId || !nodeId) {
    throw new Error('Invalid organization node link')
  }

  if (
    evidenceText &&
    evidenceText.length > 2000
  ) {
    throw new Error(
      'Invalid organization node evidence'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'create_organization_node_link',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_node_id:
        nodeId,
      p_evidence_text:
        evidenceText,
      p_started_on:
        startedOn,
    }
  )

  if (error) {
    throw new Error(
      `Unable to create organization node link: ${error.message}`
    )
  }
}

export async function updateOrganizationNodeLinkDetails(
  access: InternalAccess[],
  input: UpdateOrganizationNodeLinkDetailsInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const organizationId = input.organizationId.trim()
  const nodeId = input.nodeId.trim()
  const evidenceText =
    input.evidenceText?.trim() || null
  const startedOn = input.startedOn?.trim() || null

  if (!organizationId || !nodeId) {
    throw new Error('Invalid organization node link')
  }

  if (
    evidenceText &&
    evidenceText.length > 2000
  ) {
    throw new Error(
      'Invalid organization node evidence'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_organization_node_link_details',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_node_id:
        nodeId,
      p_evidence_text:
        evidenceText,
      p_started_on:
        startedOn,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update organization node link details: ${error.message}`
    )
  }
}

export async function confirmOrganizationNodeLink(
  access: InternalAccess[],
  organizationId: string,
  nodeId: string,
  reason: string
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedReason = reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(
      'Invalid organization node confirmation reason'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'confirm_organization_node_link',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_organization_id:
        organizationId,
      p_node_id:
        nodeId,
      p_reason:
        normalizedReason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to confirm organization node link: ${error.message}`
    )
  }
}

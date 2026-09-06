import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import { getSkillCatalogActorId } from './governance'

export type SkillProposalOrigin =
  | 'person'
  | 'organization'
  | 'skill_directory'

export type ProposeSkillInput = {
  proposedName: string
  description?: string | null
  suggestedCategoryCode?: string | null
  suggestedAppliesToPerson?: boolean | null
  suggestedAppliesToOrganization?: boolean | null
  originKind?: SkillProposalOrigin | null
  originId?: string | null
}

export type ProposeSkillResult = {
  proposalId: string
  proposedName: string
}

export type ResolveSkillProposalAction =
  | 'map'
  | 'create'
  | 'reject'

export type ResolveSkillProposalInput = {
  proposalId: string
  resolutionAction: ResolveSkillProposalAction
  targetSkillId?: string | null
  canonicalName?: string | null
  categoryCode?: string | null
  description?: string | null
  appliesToPerson?: boolean | null
  appliesToOrganization?: boolean | null
  reason: string
}

export type ResolveSkillProposalResult = {
  proposalId: string
  resolvedSkillId: string | null
  resolvedSkillName: string | null
  status: string
}

type RpcProposeSkillResult = {
  proposal_id: string
  proposed_name: string
}

type RpcResolveSkillProposalResult = {
  proposal_id: string
  resolved_skill_id: string | null
  resolved_skill_name: string | null
  status: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CODE_PATTERN = /^[a-z0-9_-]+$/i

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

function normalizeOptionalText(
  value: string | null | undefined
) {
  return value?.trim() || null
}

function normalizeRequiredText(
  value: string,
  label: string,
  minimumLength: number,
  maximumLength: number
) {
  const normalized = value.trim()

  if (
    normalized.length < minimumLength ||
    normalized.length > maximumLength
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return normalized
}

function validateOptionalDescription(
  value: string | null | undefined,
  label: string
) {
  const normalized =
    normalizeOptionalText(value)

  if (
    normalized &&
    normalized.length > 2000
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return normalized
}

function validateOptionalCode(
  value: string | null | undefined,
  label: string
) {
  const normalized =
    normalizeOptionalText(value)

  if (
    normalized &&
    !CODE_PATTERN.test(normalized)
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return normalized
}

function mapProposeResult(
  value: RpcProposeSkillResult
): ProposeSkillResult {
  return {
    proposalId: value.proposal_id,
    proposedName: value.proposed_name,
  }
}

function mapResolveResult(
  value: RpcResolveSkillProposalResult
): ResolveSkillProposalResult {
  return {
    proposalId: value.proposal_id,
    resolvedSkillId:
      value.resolved_skill_id,
    resolvedSkillName:
      value.resolved_skill_name,
    status: value.status,
  }
}

export async function proposeSkill(
  access: InternalAccess[],
  input: ProposeSkillInput
): Promise<ProposeSkillResult> {
  const actorInternalUserId =
    getSkillCatalogActorId(access)

  const proposedName =
    normalizeRequiredText(
      input.proposedName,
      'skill proposal name',
      2,
      200
    )
  const description =
    validateOptionalDescription(
      input.description,
      'skill proposal description'
    )
  const suggestedCategoryCode =
    validateOptionalCode(
      input.suggestedCategoryCode,
      'skill proposal category'
    )
  const originKind =
    input.originKind ?? null
  const originId =
    normalizeOptionalText(input.originId)

  if (
    originKind &&
    ![
      'person',
      'organization',
      'skill_directory',
    ].includes(originKind)
  ) {
    throw new Error(
      'Invalid skill proposal origin kind'
    )
  }

  validateOptionalUuid(
    originId,
    'skill proposal origin'
  )

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'propose_skill',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_proposed_name: proposedName,
      p_description: description,
      p_suggested_category_code:
        suggestedCategoryCode,
      p_suggested_applies_to_person:
        input.suggestedAppliesToPerson ??
        null,
      p_suggested_applies_to_organization:
        input.suggestedAppliesToOrganization ??
        null,
      p_origin_kind: originKind,
      p_origin_id: originId,
    }
  )

  if (error) {
    throw new Error(
      `Unable to propose skill: ${error.message}`
    )
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  if (!row) {
    throw new Error(
      'Skill proposal did not return a result'
    )
  }

  return mapProposeResult(
    row as RpcProposeSkillResult
  )
}

export async function resolveSkillProposal(
  access: InternalAccess[],
  input: ResolveSkillProposalInput
): Promise<ResolveSkillProposalResult> {
  const actorInternalUserId =
    getSkillCatalogActorId(access)

  const proposalId =
    input.proposalId.trim()
  const reason =
    normalizeRequiredText(
      input.reason,
      'skill proposal resolution reason',
      3,
      2000
    )

  validateUuid(
    proposalId,
    'skill proposal'
  )

  if (
    ![
      'map',
      'create',
      'reject',
    ].includes(input.resolutionAction)
  ) {
    throw new Error(
      'Invalid skill proposal resolution action'
    )
  }

  const targetSkillId =
    normalizeOptionalText(
      input.targetSkillId
    )

  if (input.resolutionAction === 'map') {
    validateOptionalUuid(
      targetSkillId,
      'target skill'
    )

    if (!targetSkillId) {
      throw new Error(
        'Invalid target skill'
      )
    }
  }

  const canonicalName =
    input.resolutionAction === 'create'
      ? normalizeRequiredText(
          input.canonicalName ?? '',
          'canonical skill name',
          2,
          160
        )
      : normalizeOptionalText(
          input.canonicalName
        )

  const categoryCode =
    validateOptionalCode(
      input.categoryCode,
      'skill category'
    )
  const description =
    validateOptionalDescription(
      input.description,
      'skill description'
    )

  if (
    input.resolutionAction === 'create' &&
    !(
      input.appliesToPerson ||
      input.appliesToOrganization
    )
  ) {
    throw new Error(
      'Invalid skill applicability'
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'resolve_skill_proposal',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_proposal_id: proposalId,
      p_resolution_action:
        input.resolutionAction,
      p_target_skill_id:
        targetSkillId,
      p_canonical_name: canonicalName,
      p_category_code: categoryCode,
      p_description: description,
      p_applies_to_person:
        input.appliesToPerson ?? null,
      p_applies_to_organization:
        input.appliesToOrganization ??
        null,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to resolve skill proposal: ${error.message}`
    )
  }

  const row = Array.isArray(data)
    ? data[0]
    : data

  if (!row) {
    throw new Error(
      'Skill proposal resolution did not return a result'
    )
  }

  return mapResolveResult(
    row as RpcResolveSkillProposalResult
  )
}

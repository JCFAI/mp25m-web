import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export const RESULT_TYPES = [
  'productive',
  'economic',
  'territorial',
  'organizational',
  'strategic',
  'institutional',
  'communication',
  'learning',
  'other',
] as const

export type ResultType = typeof RESULT_TYPES[number]

export type ResultSourceType =
  | 'articulation'
  | 'project'

export type ResultRecord = {
  result_id: string
  articulation_id: string | null
  project_id: string | null
  source_type: ResultSourceType
  source_id: string
  source_title: string
  result_type: ResultType
  title: string
  description: string
  result_date: string
  evidence_reference: string | null
  created_by_internal_user_id: string
  created_by_display_name: string
  created_at: string
  updated_at: string
  voided_at: string | null
  voided_by_internal_user_id: string | null
  voided_by_display_name: string | null
  void_rationale: string | null
  active_contribution_count: number
}

export type ResultContribution = {
  contribution_id: string
  result_id: string
  person_id: string | null
  organization_id: string | null
  actor_type: 'person' | 'organization'
  actor_id: string
  display_name: string
  contribution_summary: string
  evidence_reference: string | null
  added_by_internal_user_id: string
  added_by_display_name: string
  added_at: string
  updated_at: string
  removed_at: string | null
  removed_by_internal_user_id: string | null
  removed_by_display_name: string | null
  removal_rationale: string | null
}

export type ResultContributorCandidate = {
  source_type: ResultSourceType
  source_id: string
  actor_type: 'person' | 'organization'
  actor_id: string
  display_name: string
  is_current_participant: boolean
  last_participated_at: string
}

function actorId(access: InternalAccess[]) {
  const ids = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id,
      ),
    ),
  ]

  if (ids.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user',
    )
  }

  return ids[0]
}

export async function canManageResultSource(
  access: InternalAccess[],
  sourceType: ResultSourceType,
  sourceId: string,
): Promise<boolean> {
  if (access.length === 0) {
    return false
  }

  const supabase = createAdminClient()

  const { data, error } =
    sourceType === 'articulation'
      ? await supabase.rpc(
          'can_manage_articulation',
          {
            p_actor_internal_user_id:
              actorId(access),
            p_articulation_id: sourceId,
          },
        )
      : await supabase.rpc(
          'can_manage_project',
          {
            p_actor_internal_user_id:
              actorId(access),
            p_project_id: sourceId,
          },
        )

  if (error) {
    throw new Error(
      `Unable to check result source permission: ${error.message}`,
    )
  }

  return data === true
}

export async function listResultsForSource(
  sourceType: ResultSourceType,
  sourceId: string,
) {
  const { data, error } =
    await createAdminClient()
      .from('result_list')
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('result_date', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      })

  if (error) {
    throw new Error(
      `Unable to load results: ${error.message}`,
    )
  }

  return (data ?? []) as ResultRecord[]
}

export async function getResult(
  resultId: string,
) {
  const { data, error } =
    await createAdminClient()
      .from('result_list')
      .select('*')
      .eq('result_id', resultId)
      .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load result: ${error.message}`,
    )
  }

  return data as ResultRecord | null
}

export async function listResultContributions(
  resultIds: string[],
) {
  const uniqueResultIds = [
    ...new Set(resultIds),
  ]

  if (uniqueResultIds.length === 0) {
    return []
  }

  const { data, error } =
    await createAdminClient()
      .from('result_contribution_list')
      .select('*')
      .in('result_id', uniqueResultIds)
      .order('added_at', {
        ascending: true,
      })

  if (error) {
    throw new Error(
      `Unable to load result contributions: ${error.message}`,
    )
  }

  return (data ?? []) as ResultContribution[]
}

export async function getResultContribution(
  contributionId: string,
) {
  const { data, error } =
    await createAdminClient()
      .from('result_contribution_list')
      .select('*')
      .eq(
        'contribution_id',
        contributionId,
      )
      .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load result contribution: ${error.message}`,
    )
  }

  return data as ResultContribution | null
}

export async function listResultContributorCandidates(
  sourceType: ResultSourceType,
  sourceId: string,
) {
  const { data, error } =
    await createAdminClient()
      .from(
        'result_contributor_candidate_list',
      )
      .select('*')
      .eq('source_type', sourceType)
      .eq('source_id', sourceId)
      .order('is_current_participant', {
        ascending: false,
      })
      .order('last_participated_at', {
        ascending: false,
      })
      .order('display_name', {
        ascending: true,
      })

  if (error) {
    throw new Error(
      `Unable to load result contributor candidates: ${error.message}`,
    )
  }

  return (
    data ?? []
  ) as ResultContributorCandidate[]
}

export async function createResult(
  access: InternalAccess[],
  input: {
    sourceType: ResultSourceType
    sourceId: string
    resultType: ResultType
    title: string
    description: string
    resultDate: string
    evidenceReference: string | null
  },
) {
  const { data, error } =
    await createAdminClient().rpc(
      'create_result',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_articulation_id:
          input.sourceType ===
          'articulation'
            ? input.sourceId
            : null,

        p_project_id:
          input.sourceType ===
          'project'
            ? input.sourceId
            : null,

        p_result_type:
          input.resultType,

        p_title:
          input.title,

        p_description:
          input.description,

        p_result_date:
          input.resultDate,

        p_evidence_reference:
          input.evidenceReference,
      },
    )

  if (error) {
    throw new Error(error.message)
  }

  const resultId =
    data?.[0]?.result_id

  if (!resultId) {
    throw new Error(
      'Result was created without returning an identifier',
    )
  }

  return resultId as string
}

export async function updateResult(
  access: InternalAccess[],
  input: {
    resultId: string
    resultType: ResultType
    title: string
    description: string
    resultDate: string
    evidenceReference: string | null
    rationale: string
  },
) {
  const { error } =
    await createAdminClient().rpc(
      'update_result',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_result_id:
          input.resultId,

        p_result_type:
          input.resultType,

        p_title:
          input.title,

        p_description:
          input.description,

        p_result_date:
          input.resultDate,

        p_evidence_reference:
          input.evidenceReference,

        p_rationale:
          input.rationale,
      },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function voidResult(
  access: InternalAccess[],
  input: {
    resultId: string
    rationale: string
  },
) {
  const { error } =
    await createAdminClient().rpc(
      'void_result',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_result_id:
          input.resultId,

        p_rationale:
          input.rationale,
      },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function addResultContribution(
  access: InternalAccess[],
  input: {
    resultId: string
    personId: string | null
    organizationId: string | null
    contributionSummary: string
    evidenceReference: string | null
  },
) {
  const { data, error } =
    await createAdminClient().rpc(
      'add_result_contribution',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_result_id:
          input.resultId,

        p_person_id:
          input.personId,

        p_organization_id:
          input.organizationId,

        p_contribution_summary:
          input.contributionSummary,

        p_evidence_reference:
          input.evidenceReference,
      },
    )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(
      'Result contribution was created without returning an identifier',
    )
  }

  return data as string
}

export async function updateResultContribution(
  access: InternalAccess[],
  input: {
    contributionId: string
    contributionSummary: string
    evidenceReference: string | null
    rationale: string
  },
) {
  const { error } =
    await createAdminClient().rpc(
      'update_result_contribution',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_contribution_id:
          input.contributionId,

        p_contribution_summary:
          input.contributionSummary,

        p_evidence_reference:
          input.evidenceReference,

        p_rationale:
          input.rationale,
      },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export async function removeResultContribution(
  access: InternalAccess[],
  input: {
    contributionId: string
    rationale: string
  },
) {
  const { error } =
    await createAdminClient().rpc(
      'remove_result_contribution',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_contribution_id:
          input.contributionId,

        p_rationale:
          input.rationale,
      },
    )

  if (error) {
    throw new Error(error.message)
  }
}

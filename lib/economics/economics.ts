import 'server-only'

import type {
  InternalAccess,
} from '../auth/internal-access'
import {
  createAdminClient,
} from '../supabase/admin'

export const ECONOMIC_SOURCE_TYPES = [
  'opportunity',
  'articulation',
  'project',
] as const

export type EconomicSourceType =
  typeof ECONOMIC_SOURCE_TYPES[number]

export const COLLECTION_STATUSES = [
  'pending',
  'partial',
  'collected',
  'uncollectible',
  'cancelled',
  'not_applicable',
] as const

export type CollectionStatus =
  typeof COLLECTION_STATUSES[number]

export type EconomicNumericValue =
  | string
  | number
  | null

export type EconomicProfileCurrent = {
  economic_profile_id: string
  source_type: EconomicSourceType
  source_id: string

  opportunity_id: string | null
  articulation_id: string | null
  project_id: string | null

  revision_id: string
  revision_no: number

  currency_code: string | null

  estimated_value: EconomicNumericValue
  estimated_costs: EconomicNumericValue
  estimated_margin: EconomicNumericValue

  probability_percent:
    EconomicNumericValue

  participant_income_potential:
    EconomicNumericValue

  mp25m_contribution_potential:
    EconomicNumericValue

  distribution_notes: string | null

  agreed_value: EconomicNumericValue

  collection_status:
    CollectionStatus | null

  collected_amount: EconomicNumericValue

  final_costs: EconomicNumericValue

  participant_income_final:
    EconomicNumericValue

  mp25m_contribution_final:
    EconomicNumericValue

  final_result_amount:
    EconomicNumericValue

  economic_summary: string | null
  evidence_reference: string | null

  rationale: string

  changed_by_internal_user_id: string
  changed_by_display_name: string | null
  changed_at: string

  created_by_internal_user_id: string
  created_at: string
}

export type EconomicProfileRevision = {
  economic_profile_id: string
  source_type: EconomicSourceType
  source_id: string

  opportunity_id: string | null
  articulation_id: string | null
  project_id: string | null

  revision_id: string
  revision_no: number

  currency_code: string | null

  estimated_value: EconomicNumericValue
  estimated_costs: EconomicNumericValue
  estimated_margin: EconomicNumericValue

  probability_percent:
    EconomicNumericValue

  participant_income_potential:
    EconomicNumericValue

  mp25m_contribution_potential:
    EconomicNumericValue

  distribution_notes: string | null

  agreed_value: EconomicNumericValue

  collection_status:
    CollectionStatus | null

  collected_amount: EconomicNumericValue

  final_costs: EconomicNumericValue

  participant_income_final:
    EconomicNumericValue

  mp25m_contribution_final:
    EconomicNumericValue

  final_result_amount:
    EconomicNumericValue

  economic_summary: string | null
  evidence_reference: string | null

  rationale: string

  changed_by_internal_user_id: string
  changed_by_display_name: string | null
  changed_at: string
}

export type SaveEconomicProfileInput = {
  sourceType: EconomicSourceType
  sourceId: string

  expectedRevisionNo: number

  currencyCode: string | null

  estimatedValue: string | null
  estimatedCosts: string | null
  probabilityPercent: string | null

  participantIncomePotential:
    string | null

  mp25mContributionPotential:
    string | null

  distributionNotes: string | null

  agreedValue: string | null

  collectionStatus:
    CollectionStatus | null

  collectedAmount: string | null

  finalCosts: string | null

  participantIncomeFinal:
    string | null

  mp25mContributionFinal:
    string | null

  finalResultAmount: string | null

  economicSummary: string | null
  evidenceReference: string | null

  rationale: string
}

export class EconomicProfileWriteError
  extends Error {
  code: string | null

  constructor(
    message: string,
    code: string | null = null,
  ) {
    super(message)
    this.name = 'EconomicProfileWriteError'
    this.code = code
  }
}

function actorId(
  access: InternalAccess[],
) {
  const ids = [
    ...new Set(
      access.map(
        (item) =>
          item.internal_user_id,
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

export async function canManageEconomicSource(
  access: InternalAccess[],
  sourceType: EconomicSourceType,
  sourceId: string,
): Promise<boolean> {
  if (access.length === 0) {
    return false
  }

  const { data, error } =
    await createAdminClient().rpc(
      'can_manage_economic_source',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_source_type:
          sourceType,

        p_source_id:
          sourceId,
      },
    )

  if (error) {
    throw new Error(
      `Unable to check economic permission: ${error.message}`,
    )
  }

  return data === true
}

export async function getEconomicProfileCurrent(
  sourceType: EconomicSourceType,
  sourceId: string,
): Promise<EconomicProfileCurrent | null> {
  const { data, error } =
    await createAdminClient()
      .from('economic_profile_current')
      .select('*')
      .eq(
        'source_type',
        sourceType,
      )
      .eq(
        'source_id',
        sourceId,
      )
      .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load economic profile: ${error.message}`,
    )
  }

  return data as
    | EconomicProfileCurrent
    | null
}

export async function listEconomicProfileRevisions(
  sourceType: EconomicSourceType,
  sourceId: string,
): Promise<EconomicProfileRevision[]> {
  const { data, error } =
    await createAdminClient()
      .from(
        'economic_profile_revision_list',
      )
      .select('*')
      .eq(
        'source_type',
        sourceType,
      )
      .eq(
        'source_id',
        sourceId,
      )
      .order(
        'revision_no',
        {
          ascending: false,
        },
      )

  if (error) {
    throw new Error(
      `Unable to load economic history: ${error.message}`,
    )
  }

  return (
    data ?? []
  ) as EconomicProfileRevision[]
}

export async function saveEconomicProfileRevision(
  access: InternalAccess[],
  input: SaveEconomicProfileInput,
) {
  const { data, error } =
    await createAdminClient().rpc(
      'save_economic_profile_revision',
      {
        p_actor_internal_user_id:
          actorId(access),

        p_source_type:
          input.sourceType,

        p_source_id:
          input.sourceId,

        p_expected_revision_no:
          input.expectedRevisionNo,

        p_currency_code:
          input.currencyCode,

        p_estimated_value:
          input.estimatedValue,

        p_estimated_costs:
          input.estimatedCosts,

        p_probability_percent:
          input.probabilityPercent,

        p_participant_income_potential:
          input.participantIncomePotential,

        p_mp25m_contribution_potential:
          input.mp25mContributionPotential,

        p_distribution_notes:
          input.distributionNotes,

        p_agreed_value:
          input.agreedValue,

        p_collection_status:
          input.collectionStatus,

        p_collected_amount:
          input.collectedAmount,

        p_final_costs:
          input.finalCosts,

        p_participant_income_final:
          input.participantIncomeFinal,

        p_mp25m_contribution_final:
          input.mp25mContributionFinal,

        p_final_result_amount:
          input.finalResultAmount,

        p_economic_summary:
          input.economicSummary,

        p_evidence_reference:
          input.evidenceReference,

        p_rationale:
          input.rationale,
      },
    )

  if (error) {
    throw new EconomicProfileWriteError(
      error.message,
      error.code ?? null,
    )
  }

  const saved =
    data?.[0]

  if (
    !saved?.economic_profile_id ||
    !saved?.revision_id ||
    !saved?.revision_no
  ) {
    throw new EconomicProfileWriteError(
      'Economic profile was saved without returning its identifiers',
    )
  }

  return {
    economicProfileId:
      saved.economic_profile_id as string,

    revisionId:
      saved.revision_id as string,

    revisionNo:
      saved.revision_no as number,
  }
}

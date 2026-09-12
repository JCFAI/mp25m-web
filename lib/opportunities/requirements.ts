import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type OpportunityRequirementType =
  | 'skill_knowledge' | 'productive_capacity' | 'activity_service'
  | 'resource_equipment' | 'certification_authorization' | 'scale_volume'
  | 'location_territory' | 'availability_deadline' | 'language' | 'logistics'
  | 'financial' | 'administrative_legal' | 'institutional_access' | 'other'

export type OpportunityRequirementValidationStatus = 'declared' | 'pending' | 'validated' | 'rejected'
export type OpportunityRequirementRecordStatus = 'active' | 'withdrawn'
export type OpportunityRequirementProvenanceKind = 'human_entry' | 'source_explicit' | 'human_inference' | 'system_suggestion'

export const requirementTypeLabels: Record<OpportunityRequirementType, string> = {
  skill_knowledge: 'Habilidad / conocimiento',
  productive_capacity: 'Capacidad productiva',
  activity_service: 'Actividad / servicio',
  resource_equipment: 'Recurso / equipamiento',
  certification_authorization: 'Certificación / habilitación',
  scale_volume: 'Escala / volumen',
  location_territory: 'Ubicación / territorio',
  availability_deadline: 'Disponibilidad / plazo',
  language: 'Idioma',
  logistics: 'Logística',
  financial: 'Financiero',
  administrative_legal: 'Administrativo / legal',
  institutional_access: 'Acceso institucional',
  other: 'Otro',
}

export const requirementValidationLabels: Record<OpportunityRequirementValidationStatus, string> = {
  declared: 'Declarado',
  pending: 'Pendiente de validación',
  validated: 'Validado',
  rejected: 'Rechazado',
}

export type OpportunityRequirement = {
  requirement_id: string
  opportunity_id: string
  record_status: OpportunityRequirementRecordStatus
  // LEFT JOIN preserves stable identities even before their first revision.
  revision_id: string | null
  revision_no: number | null
  revision_count: number
  name: string | null
  description: string | null
  requirement_type: OpportunityRequirementType | null
  is_mandatory: boolean | null
  weight: number | null
  satisfaction_criteria: string | null
  skill_id: string | null
  skill_name: string | null
  activity_id: string | null
  activity_name: string | null
  conditions: Record<string, unknown> | null
  provenance_kind: OpportunityRequirementProvenanceKind | null
  source_id: string | null
  source_name: string | null
  source_type: string | null
  ingestion_record_id: string | null
  source_locator: string | null
  source_excerpt: string | null
  validation_status: OpportunityRequirementValidationStatus | null
  submitted_by_internal_user_id: string | null
  submitted_at: string | null
  reviewed_by_internal_user_id: string | null
  reviewed_at: string | null
  review_reason: string | null
  created_by_internal_user_id: string
  revision_created_by_internal_user_id: string | null
  created_at: string
  updated_at: string
  revision_created_at: string | null
  revision_updated_at: string | null
}

// Called only from the authenticated internal opportunity page; no browser API.
export async function listOpportunityRequirements(opportunityId: string): Promise<OpportunityRequirement[]> {
  const supabase = createAdminClient()
  const requirements: OpportunityRequirement[] = []
  const pageSize = 500

  // Explicit pagination avoids silently dropping requirements at the API row cap.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('opportunity_requirement_list')
      .select(`
        requirement_id, opportunity_id, record_status, revision_id, revision_no,
        revision_count, name, description, requirement_type, is_mandatory, weight,
        satisfaction_criteria, skill_id, skill_name, activity_id, activity_name,
        conditions, provenance_kind, source_id, source_name, source_type,
        ingestion_record_id::text, source_locator, source_excerpt, validation_status,
        submitted_by_internal_user_id, submitted_at, reviewed_by_internal_user_id,
        reviewed_at, review_reason, created_by_internal_user_id,
        revision_created_by_internal_user_id, created_at, updated_at,
        revision_created_at, revision_updated_at
      `)
      .eq('opportunity_id', opportunityId)
      .order('record_status', { ascending: true })
      .order('is_mandatory', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .order('requirement_id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`Unable to load opportunity requirements: ${error.message}`)
    requirements.push(...((data ?? []) as OpportunityRequirement[]))
    if (!data || data.length < pageSize) return requirements
  }
}

export type OpportunityRequirementRevision =
  Omit<OpportunityRequirement, 'revision_count'>

export type OpportunityRequirementPermissionContext = {
  assigned_to_internal_user_id: string | null
  node_ids: string[]
}

export type HumanOpportunityRequirementProvenanceKind =
  Exclude<
    OpportunityRequirementProvenanceKind,
    'system_suggestion'
  >

export type OpportunityRequirementFormulationInput = {
  name: string
  description?: string | null
  requirementType: OpportunityRequirementType
  isMandatory: boolean
  weight: number
  satisfactionCriteria?: string | null
  skillId?: string | null
  activityId?: string | null
  conditions?: Record<string, unknown> | null
  provenanceKind: HumanOpportunityRequirementProvenanceKind
  sourceId?: string | null
  ingestionRecordId?: string | null
  sourceLocator?: string | null
  sourceExcerpt?: string | null
}

function getInternalUserIdOrNull(
  access: InternalAccess[]
): string | null {
  const ids = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  return ids.length === 1
    ? ids[0]
    : null
}

function accessMatchesOpportunityScope(
  item: InternalAccess,
  opportunity: OpportunityRequirementPermissionContext
) {
  if (item.is_administrative) {
    return true
  }

  if (item.scope_type === 'global') {
    return true
  }

  if (
    item.scope_type === 'node' &&
    item.scope_entity_id &&
    opportunity.node_ids.includes(
      item.scope_entity_id
    )
  ) {
    return true
  }

  // 7A.2 does not infer territorial authorization.
  // There is no authoritative territorial mapping yet.
  return false
}

function isCurrentOpportunityResponsible(
  access: InternalAccess[],
  opportunity: OpportunityRequirementPermissionContext
) {
  const actorId =
    getInternalUserIdOrNull(access)

  return Boolean(
    actorId &&
    opportunity.assigned_to_internal_user_id &&
    actorId ===
      opportunity.assigned_to_internal_user_id
  )
}

export function canFormulateOpportunityRequirement(
  access: InternalAccess[],
  opportunity: OpportunityRequirementPermissionContext
) {
  if (
    isCurrentOpportunityResponsible(
      access,
      opportunity
    )
  ) {
    return true
  }

  return access.some((item) => {
    if (item.is_administrative) {
      return true
    }

    if (
      item.access_role_code !== 'validator' &&
      item.access_role_code !== 'articulator'
    ) {
      return false
    }

    return accessMatchesOpportunityScope(
      item,
      opportunity
    )
  })
}

export function canValidateOpportunityRequirement(
  access: InternalAccess[],
  opportunity: OpportunityRequirementPermissionContext
) {
  return access.some((item) => {
    if (item.is_administrative) {
      return true
    }

    if (
      item.access_role_code !== 'validator'
    ) {
      return false
    }

    return accessMatchesOpportunityScope(
      item,
      opportunity
    )
  })
}

export function canManageOpportunityRequirementLifecycle(
  access: InternalAccess[],
  opportunity: OpportunityRequirementPermissionContext
) {
  if (
    isCurrentOpportunityResponsible(
      access,
      opportunity
    )
  ) {
    return true
  }

  return access.some((item) => {
    if (item.is_administrative) {
      return true
    }

    if (
      item.access_role_code !== 'validator'
    ) {
      return false
    }

    return accessMatchesOpportunityScope(
      item,
      opportunity
    )
  })
}

export async function listOpportunityRequirementRevisions(
  opportunityId: string
): Promise<OpportunityRequirementRevision[]> {
  const supabase = createAdminClient()

  const revisions:
    OpportunityRequirementRevision[] = []

  const pageSize = 500

  for (
    let offset = 0;
    ;
    offset += pageSize
  ) {
    const { data, error } = await supabase
      .from(
        'opportunity_requirement_revision_list'
      )
      .select(`
        requirement_id,
        opportunity_id,
        record_status,
        revision_id,
        revision_no,
        name,
        description,
        requirement_type,
        is_mandatory,
        weight,
        satisfaction_criteria,
        skill_id,
        skill_name,
        activity_id,
        activity_name,
        conditions,
        provenance_kind,
        source_id,
        source_name,
        source_type,
        ingestion_record_id::text,
        source_locator,
        source_excerpt,
        validation_status,
        submitted_by_internal_user_id,
        submitted_at,
        reviewed_by_internal_user_id,
        reviewed_at,
        review_reason,
        created_by_internal_user_id,
        revision_created_by_internal_user_id,
        created_at,
        updated_at,
        revision_created_at,
        revision_updated_at
      `)
      .eq(
        'opportunity_id',
        opportunityId
      )
      .order(
        'requirement_id',
        { ascending: true }
      )
      .order(
        'revision_no',
        { ascending: false }
      )
      .range(
        offset,
        offset + pageSize - 1
      )

    if (error) {
      throw new Error(
        `Unable to load opportunity requirement revisions: ${error.message}`
      )
    }

    revisions.push(
      ...(
        (data ?? []) as
          OpportunityRequirementRevision[]
      )
    )

    if (
      !data ||
      data.length < pageSize
    ) {
      return revisions
    }
  }
}
export type OpportunityRequirementRevisionContext = {
  requirement_id: string
  opportunity_id: string
  revision_id: string
  conditions: Record<string, unknown>
  source_id: string | null
  ingestion_record_id: string | null
}

export async function getOpportunityRequirementRevisionContext(
  requirementId: string,
  revisionId: string
): Promise<OpportunityRequirementRevisionContext | null> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from(
      'opportunity_requirement_revision_list'
    )
    .select(`
      requirement_id,
      opportunity_id,
      revision_id,
      conditions,
      source_id,
      ingestion_record_id::text
    `)
    .eq(
      'requirement_id',
      requirementId
    )
    .eq(
      'revision_id',
      revisionId
    )
    .maybeSingle()

  if (error) {
    throw new Error(
      `Unable to load opportunity requirement revision context: ${error.message}`
    )
  }

  if (!data) {
    return null
  }

  return data as
    OpportunityRequirementRevisionContext
}
export type OpportunityRequirementWriteResult = {
  requirement_id: string
  revision_id: string
  revision_no: number
}

function getActorInternalUserId(
  access: InternalAccess[]
): string {
  const ids = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  if (ids.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  return ids[0]
}

function nullableTrimmed(
  value: string | null | undefined
): string | null {
  const normalized =
    value?.trim() ?? ''

  return normalized || null
}

function validateFormulationInput(
  input: OpportunityRequirementFormulationInput
) {
  const name = input.name.trim()

  if (
    name.length < 3 ||
    name.length > 300
  ) {
    throw new Error(
      'Invalid opportunity requirement name'
    )
  }

  const description =
    nullableTrimmed(input.description)

  if (
    description &&
    description.length > 10000
  ) {
    throw new Error(
      'Invalid opportunity requirement description'
    )
  }

  if (
    !Number.isInteger(input.weight) ||
    input.weight < 1 ||
    input.weight > 5
  ) {
    throw new Error(
      'Invalid opportunity requirement weight'
    )
  }

  const satisfactionCriteria =
    nullableTrimmed(
      input.satisfactionCriteria
    )

  if (
    satisfactionCriteria &&
    satisfactionCriteria.length > 10000
  ) {
    throw new Error(
      'Invalid opportunity requirement satisfaction criteria'
    )
  }

  const sourceLocator =
    nullableTrimmed(input.sourceLocator)

  if (
    sourceLocator &&
    sourceLocator.length > 2000
  ) {
    throw new Error(
      'Invalid opportunity requirement source locator'
    )
  }

  const sourceExcerpt =
    nullableTrimmed(input.sourceExcerpt)

  if (
    sourceExcerpt &&
    sourceExcerpt.length > 10000
  ) {
    throw new Error(
      'Invalid opportunity requirement source excerpt'
    )
  }
}

function formulationRpcInput(
  input: OpportunityRequirementFormulationInput
) {
  validateFormulationInput(input)

  return {
    p_name:
      input.name.trim(),

    p_description:
      nullableTrimmed(
        input.description
      ),

    p_requirement_type:
      input.requirementType,

    p_is_mandatory:
      input.isMandatory,

    p_weight:
      input.weight,

    p_satisfaction_criteria:
      nullableTrimmed(
        input.satisfactionCriteria
      ),

    p_skill_id:
      input.skillId || null,

    p_activity_id:
      input.activityId || null,

    p_conditions:
      input.conditions ?? {},

    p_provenance_kind:
      input.provenanceKind,

    p_source_id:
      input.sourceId || null,

    p_ingestion_record_id:
      input.ingestionRecordId || null,

    p_source_locator:
      nullableTrimmed(
        input.sourceLocator
      ),

    p_source_excerpt:
      nullableTrimmed(
        input.sourceExcerpt
      ),
  }
}

function parseRequirementWriteResult(
  data: unknown
): OpportunityRequirementWriteResult {
  const value =
    Array.isArray(data)
      ? data[0]
      : data

  if (
    !value ||
    typeof value !== 'object'
  ) {
    throw new Error(
      'Opportunity requirement RPC returned no result'
    )
  }

  const row =
    value as Record<string, unknown>

  if (
    typeof row.requirement_id !== 'string' ||
    typeof row.revision_id !== 'string' ||
    typeof row.revision_no !== 'number'
  ) {
    throw new Error(
      'Opportunity requirement RPC returned an invalid result'
    )
  }

  return {
    requirement_id:
      row.requirement_id,

    revision_id:
      row.revision_id,

    revision_no:
      row.revision_no,
  }
}

export async function createOpportunityRequirement(
  access: InternalAccess[],
  opportunityId: string,
  input: OpportunityRequirementFormulationInput
): Promise<OpportunityRequirementWriteResult> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const supabase =
    createAdminClient()

  const { data, error } =
    await supabase.rpc(
      'create_opportunity_requirement',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_opportunity_id:
          opportunityId,

        ...formulationRpcInput(input),
      }
    )

  if (error) {
    throw new Error(
      `Unable to create opportunity requirement: ${error.message}`
    )
  }

  return parseRequirementWriteResult(
    data
  )
}

export async function reviseOpportunityRequirement(
  access: InternalAccess[],
  requirementId: string,
  expectedRevisionId: string,
  input: OpportunityRequirementFormulationInput,
  reason: string
): Promise<OpportunityRequirementWriteResult> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedReason =
    reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(
      'Invalid opportunity requirement revision reason'
    )
  }

  const supabase =
    createAdminClient()

  const { data, error } =
    await supabase.rpc(
      'revise_opportunity_requirement',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_requirement_id:
          requirementId,

        p_expected_revision_id:
          expectedRevisionId,

        ...formulationRpcInput(input),

        p_reason:
          normalizedReason,
      }
    )

  if (error) {
    throw new Error(
      `Unable to revise opportunity requirement: ${error.message}`
    )
  }

  return parseRequirementWriteResult(
    data
  )
}

export async function submitOpportunityRequirementValidation(
  access: InternalAccess[],
  requirementId: string,
  expectedRevisionId: string
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const supabase =
    createAdminClient()

  const { error } =
    await supabase.rpc(
      'submit_opportunity_requirement_validation',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_requirement_id:
          requirementId,

        p_expected_revision_id:
          expectedRevisionId,
      }
    )

  if (error) {
    throw new Error(
      `Unable to submit opportunity requirement validation: ${error.message}`
    )
  }
}

export async function resolveOpportunityRequirementValidation(
  access: InternalAccess[],
  requirementId: string,
  expectedRevisionId: string,
  resolution: 'validated' | 'rejected',
  reason?: string | null
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedReason =
    nullableTrimmed(reason)

  if (
    resolution === 'rejected' &&
    (
      !normalizedReason ||
      normalizedReason.length < 3
    )
  ) {
    throw new Error(
      'A rejection reason is required'
    )
  }

  if (
    normalizedReason &&
    normalizedReason.length > 2000
  ) {
    throw new Error(
      'Invalid opportunity requirement validation reason'
    )
  }

  const supabase =
    createAdminClient()

  const { error } =
    await supabase.rpc(
      'resolve_opportunity_requirement_validation',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_requirement_id:
          requirementId,

        p_expected_revision_id:
          expectedRevisionId,

        p_resolution:
          resolution,

        p_reason:
          normalizedReason,
      }
    )

  if (error) {
    throw new Error(
      `Unable to resolve opportunity requirement validation: ${error.message}`
    )
  }
}

export async function withdrawOpportunityRequirement(
  access: InternalAccess[],
  requirementId: string,
  expectedRevisionId: string,
  reason: string
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedReason =
    reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(
      'Invalid opportunity requirement withdrawal reason'
    )
  }

  const supabase =
    createAdminClient()

  const { error } =
    await supabase.rpc(
      'withdraw_opportunity_requirement',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_requirement_id:
          requirementId,

        p_expected_revision_id:
          expectedRevisionId,

        p_reason:
          normalizedReason,
      }
    )

  if (error) {
    throw new Error(
      `Unable to withdraw opportunity requirement: ${error.message}`
    )
  }
}

export async function reactivateOpportunityRequirement(
  access: InternalAccess[],
  requirementId: string,
  expectedRevisionId: string,
  reason: string
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const normalizedReason =
    reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(
      'Invalid opportunity requirement reactivation reason'
    )
  }

  const supabase =
    createAdminClient()

  const { error } =
    await supabase.rpc(
      'reactivate_opportunity_requirement',
      {
        p_actor_internal_user_id:
          actorInternalUserId,

        p_requirement_id:
          requirementId,

        p_expected_revision_id:
          expectedRevisionId,

        p_reason:
          normalizedReason,
      }
    )

  if (error) {
    throw new Error(
      `Unable to reactivate opportunity requirement: ${error.message}`
    )
  }
}
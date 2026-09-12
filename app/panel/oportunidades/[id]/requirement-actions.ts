'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  getInternalAccess,
  type InternalAccess,
} from '../../../../lib/auth/internal-access'

import {
  createOpportunityRequirement,
  getOpportunityRequirementRevisionContext,
  reactivateOpportunityRequirement,
  resolveOpportunityRequirementValidation,
  reviseOpportunityRequirement,
  submitOpportunityRequirementValidation,
  withdrawOpportunityRequirement,
  type HumanOpportunityRequirementProvenanceKind,
  type OpportunityRequirementFormulationInput,
  type OpportunityRequirementType,
} from '../../../../lib/opportunities/requirements'

import { createClient } from '../../../../lib/supabase/server'

export type RequirementActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}


const allowedRequirementTypes =
  new Set<OpportunityRequirementType>([
    'skill_knowledge',
    'productive_capacity',
    'activity_service',
    'resource_equipment',
    'certification_authorization',
    'scale_volume',
    'location_territory',
    'availability_deadline',
    'language',
    'logistics',
    'financial',
    'administrative_legal',
    'institutional_access',
    'other',
  ])

const allowedHumanProvenanceKinds =
  new Set<HumanOpportunityRequirementProvenanceKind>([
    'human_entry',
    'source_explicit',
    'human_inference',
  ])

function textValue(
  formData: FormData,
  name: string
) {
  return String(
    formData.get(name) ?? ''
  ).trim()
}

function optionalTextValue(
  formData: FormData,
  name: string
) {
  const value =
    textValue(formData, name)

  return value || null
}

async function resolveCurrentAccess():
Promise<InternalAccess[]> {
  const supabase =
    await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (
    claimsError ||
    !authUserId
  ) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      authUserId
    )

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  return access
}

function parseFormulationInput(
  formData: FormData,
  preserved?: {
    conditions: Record<string, unknown> | null
    sourceId: string | null
    ingestionRecordId: string | null
  }
): OpportunityRequirementFormulationInput {
  const name =
    textValue(
      formData,
      'name'
    )

  if (
    name.length < 3 ||
    name.length > 300
  ) {
    throw new Error(
      'El nombre debe tener entre 3 y 300 caracteres.'
    )
  }

  const description =
    optionalTextValue(
      formData,
      'description'
    )

  if (
    description &&
    description.length > 10000
  ) {
    throw new Error(
      'La descripción no puede superar los 10000 caracteres.'
    )
  }

  const rawRequirementType =
    textValue(
      formData,
      'requirement_type'
    )

  if (
    !allowedRequirementTypes.has(
      rawRequirementType as
        OpportunityRequirementType
    )
  ) {
    throw new Error(
      'Seleccioná un tipo de requerimiento válido.'
    )
  }

  const requirementType =
    rawRequirementType as
      OpportunityRequirementType

  const rawWeight =
    textValue(
      formData,
      'weight'
    )

  const weight =
    Number(rawWeight)

  if (
    !Number.isInteger(weight) ||
    weight < 1 ||
    weight > 5
  ) {
    throw new Error(
      'La importancia debe estar entre 1 y 5.'
    )
  }

  const rawProvenance =
    textValue(
      formData,
      'provenance_kind'
    )

  if (
    !allowedHumanProvenanceKinds.has(
      rawProvenance as
        HumanOpportunityRequirementProvenanceKind
    )
  ) {
    throw new Error(
      'Seleccioná un origen válido.'
    )
  }

  const provenanceKind =
    rawProvenance as
      HumanOpportunityRequirementProvenanceKind

  const skillId =
    optionalTextValue(
      formData,
      'skill_id'
    )

  const activityId =
    optionalTextValue(
      formData,
      'activity_id'
    )

  if (
    skillId &&
    activityId
  ) {
    throw new Error(
      'Un requerimiento no puede referenciar simultáneamente una habilidad y una actividad.'
    )
  }

  if (
    skillId &&
    requirementType !==
      'skill_knowledge' &&
    requirementType !==
      'productive_capacity'
  ) {
    throw new Error(
      'La habilidad seleccionada no corresponde al tipo de requerimiento.'
    )
  }

  if (
    activityId &&
    requirementType !==
      'activity_service'
  ) {
    throw new Error(
      'La actividad seleccionada no corresponde al tipo de requerimiento.'
    )
  }

  return {
    name,

    description,

    requirementType,

    isMandatory:
      formData.get(
        'is_mandatory'
      ) !== null,

    weight,

    satisfactionCriteria:
      optionalTextValue(
        formData,
        'satisfaction_criteria'
      ),

    skillId,

    activityId,

    // 7A.2 does not expose raw structured
    // conditions in the UI.
    conditions:
      preserved?.conditions ?? {},

    provenanceKind,

    // Stable source references are preserved
    // when a semantic revision is created.
    sourceId:
      preserved?.sourceId ?? null,

    ingestionRecordId:
      preserved
        ?.ingestionRecordId ?? null,

    sourceLocator:
      optionalTextValue(
        formData,
        'source_locator'
      ),

    sourceExcerpt:
      optionalTextValue(
        formData,
        'source_excerpt'
      ),
  }
}

function requiredReason(
  formData: FormData
) {
  const reason =
    textValue(
      formData,
      'reason'
    )

  if (
    reason.length < 3 ||
    reason.length > 2000
  ) {
    throw new Error(
      'El motivo debe tener entre 3 y 2000 caracteres.'
    )
  }

  return reason
}

function requirementErrorMessage(
  error: unknown,
  fallback: string
) {
  if (!(error instanceof Error)) {
    return fallback
  }

  const detail =
    error.message

  if (
    detail.includes(
      'revision is stale'
    )
  ) {
    return (
      'El requerimiento cambió desde que abriste la página. ' +
      'Actualizá la ficha antes de continuar.'
    )
  }

  if (
    detail.includes(
      'Pending opportunity requirement revision'
    )
  ) {
    return (
      'La revisión está pendiente de validación y debe resolverse antes de crear otra.'
    )
  }

  if (
    detail.includes(
      'Satisfaction criteria are required'
    )
  ) {
    return (
      'Completá el criterio de satisfacción antes de enviar el requerimiento a validación.'
    )
  }

  if (
    detail.includes(
      'cannot validate opportunity requirements'
    )
  ) {
    return (
      'Tu acceso actual no permite validar este requerimiento.'
    )
  }

  if (
    detail.includes(
      'cannot formulate opportunity requirements'
    )
  ) {
    return (
      'Tu acceso actual no permite formular requerimientos para esta oportunidad.'
    )
  }

  if (
    detail.includes(
      'cannot withdraw opportunity requirements'
    )
  ) {
    return (
      'Tu acceso actual no permite retirar este requerimiento.'
    )
  }

  if (
    detail.includes(
      'cannot reactivate opportunity requirements'
    )
  ) {
    return (
      'Tu acceso actual no permite reactivar este requerimiento.'
    )
  }

  if (
    detail.startsWith(
      'El '
    ) ||
    detail.startsWith(
      'La '
    ) ||
    detail.startsWith(
      'Seleccioná'
    ) ||
    detail.startsWith(
      'Completá'
    ) ||
    detail.startsWith(
      'Un requerimiento'
    )
  ) {
    return detail
  }

  return fallback
}

function revalidateOpportunity(
  opportunityId: string
) {
  revalidatePath(
    `/panel/oportunidades/${opportunityId}`
  )
}

export async function createOpportunityRequirementAction(
  opportunityId: string,
  _previousState: RequirementActionState,
  formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  try {
    const input =
      parseFormulationInput(
        formData
      )

    await createOpportunityRequirement(
      access,
      opportunityId,
      input
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement creation failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo crear el requerimiento. No se modificó ningún dato.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      'El requerimiento fue creado correctamente.',
  }
}

export async function reviseOpportunityRequirementAction(
  opportunityId: string,
  requirementId: string,
  expectedRevisionId: string,
  _previousState: RequirementActionState,
  formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  try {
    const revisionContext =
      await getOpportunityRequirementRevisionContext(
        requirementId,
        expectedRevisionId
      )

    if (
      !revisionContext ||
      revisionContext.opportunity_id !==
        opportunityId
    ) {
      throw new Error(
        'Opportunity requirement revision context mismatch'
      )
    }

    const input =
      parseFormulationInput(
        formData,
        {
          conditions:
            revisionContext.conditions,
          sourceId:
            revisionContext.source_id,
          ingestionRecordId:
            revisionContext.ingestion_record_id,
        }
      )

    const reason =
      requiredReason(
        formData
      )

    await reviseOpportunityRequirement(
      access,
      requirementId,
      expectedRevisionId,
      input,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement revision failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo crear la nueva revisión. No se modificó ningún dato.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      'Se creó una nueva revisión del requerimiento.',
  }
}

export async function submitOpportunityRequirementValidationAction(
  opportunityId: string,
  requirementId: string,
  expectedRevisionId: string,
  _previousState: RequirementActionState,
  _formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  try {
    await submitOpportunityRequirementValidation(
      access,
      requirementId,
      expectedRevisionId
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement validation submission failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo enviar el requerimiento a validación.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      'El requerimiento quedó pendiente de validación.',
  }
}

export async function resolveOpportunityRequirementValidationAction(
  opportunityId: string,
  requirementId: string,
  expectedRevisionId: string,
  _previousState: RequirementActionState,
  formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  const resolution =
    textValue(
      formData,
      'resolution'
    )

  if (
    resolution !== 'validated' &&
    resolution !== 'rejected'
  ) {
    return {
      status: 'error',
      message:
        'Seleccioná una decisión de validación válida.',
    }
  }

  const reason =
    optionalTextValue(
      formData,
      'reason'
    )

  if (
    resolution === 'rejected' &&
    (
      !reason ||
      reason.length < 3
    )
  ) {
    return {
      status: 'error',
      message:
        'Indicá el motivo del rechazo.',
    }
  }

  if (
    reason &&
    reason.length > 2000
  ) {
    return {
      status: 'error',
      message:
        'El motivo no puede superar los 2000 caracteres.',
    }
  }

  try {
    await resolveOpportunityRequirementValidation(
      access,
      requirementId,
      expectedRevisionId,
      resolution,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement validation resolution failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo registrar la decisión de validación.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      resolution === 'validated'
        ? 'El requerimiento fue validado.'
        : 'El requerimiento fue rechazado.',
  }
}

export async function withdrawOpportunityRequirementAction(
  opportunityId: string,
  requirementId: string,
  expectedRevisionId: string,
  _previousState: RequirementActionState,
  formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  try {
    const reason =
      requiredReason(
        formData
      )

    await withdrawOpportunityRequirement(
      access,
      requirementId,
      expectedRevisionId,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement withdrawal failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo retirar el requerimiento.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      'El requerimiento fue retirado.',
  }
}

export async function reactivateOpportunityRequirementAction(
  opportunityId: string,
  requirementId: string,
  expectedRevisionId: string,
  _previousState: RequirementActionState,
  formData: FormData
): Promise<RequirementActionState> {
  const access =
    await resolveCurrentAccess()

  try {
    const reason =
      requiredReason(
        formData
      )

    await reactivateOpportunityRequirement(
      access,
      requirementId,
      expectedRevisionId,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity requirement reactivation failed:',
      error
    )

    return {
      status: 'error',
      message:
        requirementErrorMessage(
          error,
          'No se pudo reactivar el requerimiento.'
        ),
    }
  }

  revalidateOpportunity(
    opportunityId
  )

  return {
    status: 'success',
    message:
      'El requerimiento fue reactivado.',
  }
}
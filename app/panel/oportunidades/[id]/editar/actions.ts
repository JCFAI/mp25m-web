'use server'

import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import {
  updateOpportunityDetails,
  type UpdateOpportunityDetailsInput,
} from '../../../../../lib/opportunities/detail'
import { createClient } from '../../../../../lib/supabase/server'

export type EditOpportunityActionState = {
  status: 'idle' | 'error'
  message: string | null
  fieldErrors: {
    title?: string
    description?: string
    kind?: string
    priority?: string
    dueDate?: string
    relations?: string
  }
}

function failure(
  message: string,
  fieldErrors: EditOpportunityActionState['fieldErrors'] = {}
): EditOpportunityActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function parseOriginActors(
  value: FormDataEntryValue | null
): UpdateOpportunityDetailsInput['originActors'] {
  if (!value) {
    return []
  }

  const parsed: unknown = JSON.parse(String(value))

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid origin actors')
  }

  return parsed.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid origin actor')
    }

    const record = item as Record<string, unknown>

    const actorType = record.actorType
    const actorId = record.actorId

    if (
      actorType !== 'person' &&
      actorType !== 'organization' &&
      actorType !== 'candidate'
    ) {
      throw new Error('Invalid actor type')
    }

    if (
      typeof actorId !== 'string' ||
      actorId.length === 0
    ) {
      throw new Error('Invalid actor identifier')
    }

    return {
      actorType,
      actorId,
    }
  })
}

function parseNewActorCandidates(
  value: FormDataEntryValue | null
): UpdateOpportunityDetailsInput['newActorCandidates'] {
  if (!value) {
    return []
  }

  const parsed: unknown = JSON.parse(String(value))

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid actor candidates')
  }

  return parsed.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('Invalid actor candidate')
    }

    const record = item as Record<string, unknown>

    const actorKind = record.actorKind
    const displayName = record.displayName

    if (
      actorKind !== 'person' &&
      actorKind !== 'organization'
    ) {
      throw new Error('Invalid actor kind')
    }

    if (
      typeof displayName !== 'string' ||
      displayName.trim().length < 2 ||
      displayName.trim().length > 300
    ) {
      throw new Error('Invalid actor name')
    }

    const organizationTypeCode =
      typeof record.organizationTypeCode === 'string'
        ? record.organizationTypeCode
        : null

    const contextText =
      typeof record.contextText === 'string'
        ? record.contextText
        : null

    const nodeIds = Array.isArray(record.nodeIds)
      ? record.nodeIds.filter(
          (nodeId): nodeId is string =>
            typeof nodeId === 'string' &&
            nodeId.length > 0
        )
      : []

    if (
      actorKind === 'organization' &&
      !organizationTypeCode
    ) {
      throw new Error(
        'Organization type is required'
      )
    }

    return {
      actorKind,
      displayName,
      organizationTypeCode,
      contextText,
      nodeIds,
    }
  })
}

export async function editOpportunityAction(
  opportunityId: string,
  _previousState: EditOpportunityActionState,
  formData: FormData
): Promise<EditOpportunityActionState> {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const title = String(
    formData.get('title') ?? ''
  ).trim()

  const description = String(
    formData.get('description') ?? ''
  ).trim()

  const kind = String(
    formData.get('kind') ?? ''
  )

  const priority = String(
    formData.get('priority') ?? ''
  )

  const sourceText = String(
    formData.get('source_text') ?? ''
  )

  const dueDate = String(
    formData.get('due_date') ?? ''
  )

  const nodeIds = formData
    .getAll('node_ids')
    .map((value) => String(value))
    .filter(Boolean)

  const fieldErrors:
    EditOpportunityActionState['fieldErrors'] = {}

  if (title.length < 3) {
    fieldErrors.title =
      'El título debe tener al menos 3 caracteres.'
  } else if (title.length > 200) {
    fieldErrors.title =
      'El título no puede superar los 200 caracteres.'
  }

  if (description.length < 10) {
    fieldErrors.description =
      'La descripción debe tener al menos 10 caracteres.'
  } else if (description.length > 10000) {
    fieldErrors.description =
      'La descripción es demasiado extensa.'
  }

  if (
    kind !== 'opportunity' &&
    kind !== 'need'
  ) {
    fieldErrors.kind =
      'Seleccioná un tipo válido.'
  }

  if (
    priority !== 'low' &&
    priority !== 'normal' &&
    priority !== 'high' &&
    priority !== 'urgent'
  ) {
    fieldErrors.priority =
      'Seleccioná una prioridad válida.'
  }

  if (
    dueDate &&
    !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)
  ) {
    fieldErrors.dueDate =
      'Ingresá una fecha válida.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Los cambios permanecen cargados.',
      fieldErrors
    )
  }

  let originActors:
    UpdateOpportunityDetailsInput['originActors']

  let newActorCandidates:
    UpdateOpportunityDetailsInput['newActorCandidates']

  try {
    originActors = parseOriginActors(
      formData.get('origin_actors_json')
    )

    newActorCandidates =
      parseNewActorCandidates(
        formData.get(
          'new_actor_candidates_json'
        )
      )
  } catch {
    return failure(
      'Hay un problema con los actores de origen. Los cambios permanecen cargados.',
      {
        relations:
          'Revisá los actores seleccionados o los actores nuevos.',
      }
    )
  }

  try {
    await updateOpportunityDetails(
      access,
      opportunityId,
      {
        title,
        description,
        kind:
          kind as 'opportunity' | 'need',
        priority:
          priority as
            | 'low'
            | 'normal'
            | 'high'
            | 'urgent',
        sourceText,
        dueDate: dueDate || null,
        nodeIds,
        originActors,
        newActorCandidates,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Opportunity edit failed:',
      error
    )

    return failure(
      'No se pudo guardar la modificación. Ningún cambio fue aplicado y todos los datos permanecen cargados.'
    )
  }

  redirect(
    `/panel/oportunidades/${opportunityId}?updated=1`
  )
}
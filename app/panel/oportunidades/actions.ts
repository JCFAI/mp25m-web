'use server'

import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  createOpportunity,
  type NewActorCandidateInput,
  type OpportunityOriginActorInput,
} from '../../../lib/opportunities/server'
import { createClient } from '../../../lib/supabase/server'

function parseOriginActors(
  value: FormDataEntryValue | null
): OpportunityOriginActorInput[] {
  if (!value) {
    return []
  }

  const parsed: unknown = JSON.parse(String(value))

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid origin actors')
  }

  return parsed.map((item) => {
    if (
      !item ||
      typeof item !== 'object'
    ) {
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
): NewActorCandidateInput[] {
  if (!value) {
    return []
  }

  const parsed: unknown = JSON.parse(String(value))

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid actor candidates')
  }

  return parsed.map((item) => {
    if (
      !item ||
      typeof item !== 'object'
    ) {
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
      displayName.trim().length < 2
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

export async function createOpportunityAction(
  formData: FormData
) {
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

  const title = String(formData.get('title') ?? '')
  const description = String(
    formData.get('description') ?? ''
  )

  const kind = String(formData.get('kind') ?? '')

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

  if (
    kind !== 'opportunity' &&
    kind !== 'need'
  ) {
    redirect(
      '/panel/oportunidades?error=tipo-invalido'
    )
  }

  if (
    priority !== 'low' &&
    priority !== 'normal' &&
    priority !== 'high' &&
    priority !== 'urgent'
  ) {
    redirect(
      '/panel/oportunidades?error=prioridad-invalida'
    )
  }

  try {
    const originActors = parseOriginActors(
      formData.get('origin_actors_json')
    )

    const newActorCandidates =
      parseNewActorCandidates(
        formData.get(
          'new_actor_candidates_json'
        )
      )

    await createOpportunity(access, {
      title,
      description,
      kind,
      status: 'open',
      priority,
      sourceText,
      dueDate: dueDate || null,
      nodeIds,
      originActors,
      newActorCandidates,
    })
  } catch {
    redirect(
      '/panel/oportunidades?error=no-se-pudo-crear'
    )
  }

  redirect('/panel/oportunidades?created=1')
}
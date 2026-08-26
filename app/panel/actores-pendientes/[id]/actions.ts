'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  addPersonNodeParticipationRoles,
  approveActorCandidateNewPerson,
  confirmActorCandidatePersonNodeParticipation,
  rejectActorCandidate,
  resolveActorCandidateExistingPerson,
} from '../../../../lib/actors/review'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createClient } from '../../../../lib/supabase/server'

export type ActorCandidateResolutionDecision =
  | 'existing'
  | 'new'
  | 'reject'

export type ActorCandidateResolutionActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  decision: ActorCandidateResolutionDecision | null
}

function errorState(
  decision: ActorCandidateResolutionDecision | null,
  message: string
): ActorCandidateResolutionActionState {
  return {
    status: 'error',
    message,
    decision,
  }
}

function mapResolutionError(
  decision: ActorCandidateResolutionDecision,
  error: unknown
): ActorCandidateResolutionActionState {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (
    detail.includes(
      'Resolution reason is required'
    )
  ) {
    return errorState(
      decision,
      'Indicá por qué considerás que se trata de la misma persona.'
    )
  }

  if (
    detail.includes(
      'strong nominal match'
    )
  ) {
    return errorState(
      decision,
      'Existe una coincidencia nominal fuerte. Para crear una persona distinta, explicá por qué no corresponde vincularla con la persona existente.'
    )
  }

  if (
    detail.includes(
      'Rejection reason is required'
    )
  ) {
    return errorState(
      decision,
      'Indicá el motivo por el que corresponde rechazar este candidato.'
    )
  }

  if (
    detail.toLowerCase().includes('not pending') ||
    detail.toLowerCase().includes('already')
  ) {
    return errorState(
      decision,
      'Este candidato ya fue resuelto. Actualizá la pantalla para ver su estado actual.'
    )
  }

  return errorState(
    decision,
    'No se pudo guardar la resolución. No se modificó ningún dato.'
  )
}

export async function resolveActorCandidateAction(
  candidateId: string,
  _previousState: ActorCandidateResolutionActionState,
  formData: FormData
): Promise<ActorCandidateResolutionActionState> {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const decision = String(
    formData.get('decision') ?? ''
  ) as ActorCandidateResolutionDecision

  if (
    ![
      'existing',
      'new',
      'reject',
    ].includes(decision)
  ) {
    return errorState(
      null,
      'La decisión seleccionada no es válida.'
    )
  }

  const resolverAccess =
    access.find(
      (item) =>
        item.scope_type === 'global' &&
        (
          item.access_role_code ===
            'administrator' ||
          item.access_role_code ===
            'validator'
        )
    )

  if (!resolverAccess) {
    return errorState(
      decision,
      'Tu usuario no tiene permisos para resolver candidatos de identidad.'
    )
  }

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  const personId = String(
    formData.get('person_id') ?? ''
  ).trim()

  if (
    decision === 'existing' &&
    !personId
  ) {
    return errorState(
      decision,
      'Seleccioná la persona existente con la que querés vincular este candidato.'
    )
  }

  if (
    (
      decision === 'existing' ||
      decision === 'reject'
    ) &&
    reason.length < 3
  ) {
    return errorState(
      decision,
      decision === 'existing'
        ? 'Indicá brevemente por qué confirmás que se trata de la misma persona.'
        : 'Indicá brevemente el motivo del rechazo.'
    )
  }

  if (
    reason.length > 2000
  ) {
    return errorState(
      decision,
      'La justificación no puede superar los 2000 caracteres.'
    )
  }

  try {
    switch (decision) {
      case 'existing':
        await resolveActorCandidateExistingPerson(
          resolverAccess.internal_user_id,
          candidateId,
          personId,
          reason
        )
        break

      case 'new':
        await approveActorCandidateNewPerson(
          resolverAccess.internal_user_id,
          candidateId,
          reason
        )
        break

      case 'reject':
        await rejectActorCandidate(
          resolverAccess.internal_user_id,
          candidateId,
          reason
        )
        break
    }
  } catch (error) {
    console.error(
      '[MP25M] Actor candidate resolution failed:',
      error
    )

    return mapResolutionError(
      decision,
      error
    )
  }

  revalidatePath(
    `/panel/actores-pendientes/${candidateId}`
  )

  revalidatePath('/panel/oportunidades')

  return {
    status: 'success',
    decision,
    message:
      decision === 'existing'
        ? 'El candidato fue vinculado con la persona existente.'
        : decision === 'new'
          ? 'Se creó una nueva persona a partir del candidato.'
          : 'El candidato fue rechazado.',
  }
}
export type TerritorialActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

function getTerritorialResolver(
  access: Awaited<
    ReturnType<typeof getInternalAccess>
  >
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      (
        item.access_role_code ===
          'administrator' ||
        item.access_role_code ===
          'validator'
      )
  )
}

export async function confirmTerritorialParticipationAction(
  candidateId: string,
  nodeId: string,
  _previousState: TerritorialActionState,
  formData: FormData
): Promise<TerritorialActionState> {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const resolver =
    getTerritorialResolver(access)

  if (!resolver) {
    return {
      status: 'error',
      message:
        'Tu usuario no tiene permisos para confirmar participaciones territoriales.',
    }
  }

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  if (reason.length < 3) {
    return {
      status: 'error',
      message:
        'Indicá brevemente por qué confirmás esta participación territorial.',
    }
  }

  if (reason.length > 2000) {
    return {
      status: 'error',
      message:
        'La justificación no puede superar los 2000 caracteres.',
    }
  }

  try {
    await confirmActorCandidatePersonNodeParticipation(
      resolver.internal_user_id,
      candidateId,
      nodeId,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Territorial participation confirmation failed:',
      error
    )

    const detail =
      error instanceof Error
        ? error.message
        : ''

    if (
      detail.includes(
        'already confirmed'
      )
    ) {
      return {
        status: 'error',
        message:
          'Esta participación territorial ya está confirmada.',
      }
    }

    return {
      status: 'error',
      message:
        'No se pudo confirmar la participación. No se modificó ningún dato.',
    }
  }

  revalidatePath(
    `/panel/actores-pendientes/${candidateId}`
  )

  return {
    status: 'success',
    message:
      'La participación territorial fue confirmada correctamente.',
  }
}

export async function addTerritorialRolesAction(
  candidateId: string,
  participationId: string,
  _previousState: TerritorialActionState,
  formData: FormData
): Promise<TerritorialActionState> {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const resolver =
    getTerritorialResolver(access)

  if (!resolver) {
    return {
      status: 'error',
      message:
        'Tu usuario no tiene permisos para administrar roles territoriales.',
    }
  }

  const roleCodes = [
    ...new Set(
      formData
        .getAll('role_codes')
        .map((value) =>
          String(value).trim()
        )
        .filter(Boolean)
    ),
  ]

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  if (roleCodes.length === 0) {
    return {
      status: 'error',
      message:
        'Seleccioná al menos un rol territorial.',
    }
  }

  if (reason.length < 3) {
    return {
      status: 'error',
      message:
        'Indicá brevemente por qué asignás estos roles.',
    }
  }

  if (reason.length > 2000) {
    return {
      status: 'error',
      message:
        'La justificación no puede superar los 2000 caracteres.',
    }
  }

  try {
    await addPersonNodeParticipationRoles(
      resolver.internal_user_id,
      participationId,
      roleCodes,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Territorial role assignment failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudieron asignar los roles territoriales. No se modificó ningún dato.',
    }
  }

  revalidatePath(
    `/panel/actores-pendientes/${candidateId}`
  )

  return {
    status: 'success',
    message:
      'Los roles territoriales fueron registrados correctamente.',
  }
}
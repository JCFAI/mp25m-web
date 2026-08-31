'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  addPersonSkill,
  deactivatePersonSkill,
  resolvePersonSkill,
  updatePersonSkill,
} from '../../../../lib/skills/person-manage'
import { createClient } from '../../../../lib/supabase/server'

export type PersonSkillActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    skillId?: string
    proficiencyLevel?: string
    experienceRange?: string
    experienceNotes?: string
    notes?: string
    evidenceText?: string
    reason?: string
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EXPERIENCE_RANGES = new Set([
  'lt_1',
  '1_3',
  '4_7',
  '8_15',
  'gt_15',
  'unspecified',
])

function failure(
  message: string,
  fieldErrors: PersonSkillActionState['fieldErrors'] = {}
): PersonSkillActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function success(
  message: string
): PersonSkillActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

async function getCurrentAccess() {
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

  return access
}

function textField(
  formData: FormData,
  field: string
) {
  return String(
    formData.get(field) ?? ''
  ).trim()
}

function parseDetails(formData: FormData) {
  const proficiencyRaw =
    textField(formData, 'proficiency_level')
  const experienceRange =
    textField(formData, 'experience_range')
  const experienceNotes =
    textField(formData, 'experience_notes')
  const notes =
    textField(formData, 'notes')
  const evidenceText =
    textField(formData, 'evidence_text')

  const fieldErrors:
    PersonSkillActionState['fieldErrors'] = {}

  let proficiencyLevel: number | null = null

  if (proficiencyRaw) {
    const parsed = Number(proficiencyRaw)

    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > 5
    ) {
      fieldErrors.proficiencyLevel =
        'Seleccioná un nivel entre 1 y 5.'
    } else {
      proficiencyLevel = parsed
    }
  }

  if (
    experienceRange &&
    !EXPERIENCE_RANGES.has(experienceRange)
  ) {
    fieldErrors.experienceRange =
      'Seleccioná un rango de experiencia válido.'
  }

  if (experienceNotes.length > 2000) {
    fieldErrors.experienceNotes =
      'Las notas de experiencia no pueden superar los 2000 caracteres.'
  }

  if (notes.length > 2000) {
    fieldErrors.notes =
      'Las observaciones no pueden superar los 2000 caracteres.'
  }

  if (evidenceText.length > 2000) {
    fieldErrors.evidenceText =
      'La evidencia no puede superar los 2000 caracteres.'
  }

  return {
    details: {
      proficiencyLevel,
      experienceRange:
        experienceRange || null,
      experienceNotes:
        experienceNotes || null,
      notes:
        notes || null,
      evidenceText:
        evidenceText || null,
    },
    fieldErrors,
  }
}

function parseReason(
  formData: FormData,
  fieldName: string
) {
  const reason =
    textField(formData, 'reason')

  if (reason.length < 3) {
    return {
      reason,
      fieldErrors: {
        reason: `${fieldName} debe tener al menos 3 caracteres.`,
      },
    }
  }

  if (reason.length > 2000) {
    return {
      reason,
      fieldErrors: {
        reason: `${fieldName} no puede superar los 2000 caracteres.`,
      },
    }
  }

  return {
    reason,
    fieldErrors: {},
  }
}

function revalidatePersonSkillPaths(
  personId: string,
  skillId?: string
) {
  revalidatePath(`/panel/personas/${personId}`)
  revalidatePath('/panel/habilidades')

  if (skillId && UUID_PATTERN.test(skillId)) {
    revalidatePath(`/panel/habilidades/${skillId}`)
  }
}

function mapPersonSkillError(error: unknown) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (/already has this skill|duplicate/i.test(detail)) {
    return failure(
      'La persona ya tiene esta habilidad registrada.',
      {
        skillId:
          'Revisá la habilidad existente en la lista.',
      }
    )
  }

  if (/skill not found|unavailable for people/i.test(detail)) {
    return failure(
      'La habilidad seleccionada ya no está disponible para personas.',
      {
        skillId:
          'Buscá y seleccioná una habilidad activa.',
      }
    )
  }

  if (/person not found|person.*inactive/i.test(detail)) {
    return failure(
      'La persona ya no está disponible para actualizar habilidades.'
    )
  }

  if (/not active/i.test(detail)) {
    return failure(
      'La habilidad de la persona ya no está activa. Actualizá la ficha antes de continuar.'
    )
  }

  if (/already confirmed/i.test(detail)) {
    return failure(
      'La habilidad ya está confirmada.'
    )
  }

  if (/only self-reported or candidate/i.test(detail)) {
    return failure(
      'Solo pueden rechazarse habilidades autodeclaradas o pendientes de validación. Para una habilidad confirmada usá desactivar.'
    )
  }

  if (/reason|motivo/i.test(detail)) {
    return failure(
      'Indicá una justificación breve para completar la acción.',
      {
        reason:
          'La justificación debe tener entre 3 y 2000 caracteres.',
      }
    )
  }

  if (/permission|cannot manage|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para gestionar habilidades de personas.'
    )
  }

  return failure(
    'No se pudo actualizar la habilidad. No se modificó ningún dato.'
  )
}

export async function addPersonSkillAction(
  personId: string,
  personName: string,
  _previousState: PersonSkillActionState,
  formData: FormData
): Promise<PersonSkillActionState> {
  const access = await getCurrentAccess()

  const skillId =
    textField(formData, 'skill_id')
  const skillName =
    textField(formData, 'skill_name')

  const {
    details,
    fieldErrors,
  } = parseDetails(formData)

  if (!UUID_PATTERN.test(personId)) {
    return failure(
      'La persona seleccionada no es válida.'
    )
  }

  if (!UUID_PATTERN.test(skillId)) {
    fieldErrors.skillId =
      'Seleccioná una habilidad desde el buscador.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await addPersonSkill(access, {
      personId,
      skillId,
      ...details,
    })
  } catch (error) {
    console.error(
      '[MP25M] Person skill creation failed:',
      error
    )

    return mapPersonSkillError(error)
  }

  revalidatePersonSkillPaths(personId, skillId)

  const readableSkillName =
    skillName || 'la habilidad seleccionada'
  const readablePersonName =
    personName.trim()

  return success(
    readablePersonName
      ? `Se agregó "${readableSkillName}" a ${readablePersonName}. Quedó pendiente de validación.`
      : `Se agregó "${readableSkillName}". Quedó pendiente de validación.`
  )
}

export async function updatePersonSkillAction(
  personId: string,
  personSkillId: string,
  skillId: string,
  _previousState: PersonSkillActionState,
  formData: FormData
): Promise<PersonSkillActionState> {
  const access = await getCurrentAccess()

  const {
    details,
    fieldErrors,
  } = parseDetails(formData)

  if (
    !UUID_PATTERN.test(personId) ||
    !UUID_PATTERN.test(personSkillId)
  ) {
    return failure(
      'La habilidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await updatePersonSkill(access, {
      personId,
      personSkillId,
      ...details,
    })
  } catch (error) {
    console.error(
      '[MP25M] Person skill update failed:',
      error
    )

    return mapPersonSkillError(error)
  }

  revalidatePersonSkillPaths(personId, skillId)

  return success(
    'Los datos de la habilidad fueron actualizados.'
  )
}

export async function confirmPersonSkillAction(
  personId: string,
  personSkillId: string,
  skillId: string,
  _previousState: PersonSkillActionState,
  formData: FormData
): Promise<PersonSkillActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseReason(
    formData,
    'La justificación de confirmación'
  )

  if (
    !UUID_PATTERN.test(personId) ||
    !UUID_PATTERN.test(personSkillId)
  ) {
    return failure(
      'La habilidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolvePersonSkill(access, {
      personId,
      personSkillId,
      resolutionAction: 'confirmed',
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Person skill confirmation failed:',
      error
    )

    return mapPersonSkillError(error)
  }

  revalidatePersonSkillPaths(personId, skillId)

  return success(
    'La habilidad fue confirmada correctamente.'
  )
}

export async function rejectPersonSkillAction(
  personId: string,
  personSkillId: string,
  skillId: string,
  _previousState: PersonSkillActionState,
  formData: FormData
): Promise<PersonSkillActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseReason(
    formData,
    'El motivo de rechazo'
  )

  if (
    !UUID_PATTERN.test(personId) ||
    !UUID_PATTERN.test(personSkillId)
  ) {
    return failure(
      'La habilidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolvePersonSkill(access, {
      personId,
      personSkillId,
      resolutionAction: 'rejected',
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Person skill rejection failed:',
      error
    )

    return mapPersonSkillError(error)
  }

  revalidatePersonSkillPaths(personId, skillId)

  return success(
    'La habilidad fue rechazada y quedó inactiva.'
  )
}

export async function deactivatePersonSkillAction(
  personId: string,
  personSkillId: string,
  skillId: string,
  _previousState: PersonSkillActionState,
  formData: FormData
): Promise<PersonSkillActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseReason(
    formData,
    'El motivo de desactivación'
  )

  if (
    !UUID_PATTERN.test(personId) ||
    !UUID_PATTERN.test(personSkillId)
  ) {
    return failure(
      'La habilidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await deactivatePersonSkill(access, {
      personId,
      personSkillId,
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Person skill deactivation failed:',
      error
    )

    return mapPersonSkillError(error)
  }

  revalidatePersonSkillPaths(personId, skillId)

  return success(
    'La habilidad fue desactivada sin eliminar el registro.'
  )
}

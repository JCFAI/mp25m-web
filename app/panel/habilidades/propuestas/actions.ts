'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  resolveSkillProposal,
  type ResolveSkillProposalResult,
} from '../../../../lib/skills/proposals-manage'
import { createClient } from '../../../../lib/supabase/server'

export type SkillProposalResolutionActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    targetSkillId?: string
    canonicalName?: string
    categoryCode?: string
    description?: string
    appliesTo?: string
    reason?: string
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CODE_PATTERN = /^[a-z0-9_-]+$/i

function failure(
  message: string,
  fieldErrors: SkillProposalResolutionActionState['fieldErrors'] = {}
): SkillProposalResolutionActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function success(
  message: string
): SkillProposalResolutionActionState {
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

function reasonField(
  formData: FormData
): {
  reason: string
  fieldErrors: SkillProposalResolutionActionState['fieldErrors']
} {
  const reason =
    textField(formData, 'reason')

  if (reason.length < 3) {
    return {
      reason,
      fieldErrors: {
        reason:
          'La justificación debe tener al menos 3 caracteres.',
      },
    }
  }

  if (reason.length > 2000) {
    return {
      reason,
      fieldErrors: {
        reason:
          'La justificación no puede superar los 2000 caracteres.',
      },
    }
  }

  return {
    reason,
    fieldErrors: {},
  }
}

function mapSkillProposalError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  const [, equivalentSkillName] =
    detail.match(
      /Equivalent skill already exists:\s*(.+)$/i
    ) ?? []

  if (equivalentSkillName) {
    return failure(
      `Ya existe una habilidad equivalente: "${equivalentSkillName}". Mapeá la propuesta a esa habilidad existente.`,
      {
        canonicalName:
          'Usá una habilidad existente o ajustá el nombre canónico.',
      }
    )
  }

  if (/target skill not found|skill not found/i.test(detail)) {
    return failure(
      'La habilidad seleccionada no está disponible.',
      {
        targetSkillId:
          'Buscá y seleccioná una habilidad activa del catálogo.',
      }
    )
  }

  if (/category/i.test(detail)) {
    return failure(
      'La categoría seleccionada no está disponible.',
      {
        categoryCode:
          'Seleccioná una categoría activa o dejá el campo sin categoría.',
      }
    )
  }

  if (/applicability|apply to people or organizations/i.test(detail)) {
    return failure(
      'Indicá si la habilidad aplica a personas, organizaciones o ambas.',
      {
        appliesTo:
          'Seleccioná al menos una opción.',
      }
    )
  }

  if (/canonical skill name|proposal name|invalid skill/i.test(detail)) {
    return failure(
      'El nombre de la habilidad debe tener entre 2 y 160 caracteres.',
      {
        canonicalName:
          'Ingresá un nombre claro para la habilidad canónica.',
      }
    )
  }

  if (/not pending/i.test(detail)) {
    return failure(
      'La propuesta ya fue resuelta. Actualizá la pantalla para ver su estado actual.'
    )
  }

  if (/reason|justificaci/i.test(detail)) {
    return failure(
      'Indicá una justificación breve para resolver la propuesta.',
      {
        reason:
          'La justificación debe tener entre 3 y 2000 caracteres.',
      }
    )
  }

  if (/cannot manage|permission|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para resolver propuestas del catálogo.'
    )
  }

  return failure(
    'No se pudo resolver la propuesta. No se modificó ningún dato.'
  )
}

function revalidateSkillProposalPaths(
  result?: ResolveSkillProposalResult
) {
  revalidatePath('/panel/habilidades')
  revalidatePath('/panel/habilidades/propuestas')

  if (
    result?.resolvedSkillId &&
    UUID_PATTERN.test(result.resolvedSkillId)
  ) {
    revalidatePath(
      `/panel/habilidades/${result.resolvedSkillId}`
    )
  }
}

export async function mapSkillProposalAction(
  proposalId: string,
  _previousState: SkillProposalResolutionActionState,
  formData: FormData
): Promise<SkillProposalResolutionActionState> {
  const access = await getCurrentAccess()

  const targetSkillId =
    textField(formData, 'target_skill_id')
  const targetSkillName =
    textField(formData, 'target_skill_name')
  const { reason, fieldErrors } =
    reasonField(formData)

  if (!UUID_PATTERN.test(proposalId)) {
    return failure(
      'La propuesta seleccionada no es válida.'
    )
  }

  if (!UUID_PATTERN.test(targetSkillId)) {
    fieldErrors.targetSkillId =
      'Seleccioná una habilidad desde el buscador.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  let result: ResolveSkillProposalResult

  try {
    result = await resolveSkillProposal(access, {
      proposalId,
      resolutionAction: 'map',
      targetSkillId,
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Skill proposal map failed:',
      error
    )

    return mapSkillProposalError(error)
  }

  revalidateSkillProposalPaths(result)

  return success(
    `La propuesta se mapeó a "${result.resolvedSkillName ?? targetSkillName}".`
  )
}

export async function createSkillFromProposalAction(
  proposalId: string,
  _previousState: SkillProposalResolutionActionState,
  formData: FormData
): Promise<SkillProposalResolutionActionState> {
  const access = await getCurrentAccess()

  const canonicalName =
    textField(formData, 'canonical_name')
  const categoryCode =
    textField(formData, 'category_code')
  const description =
    textField(formData, 'description')
  const appliesToPerson =
    formData.get('applies_to_person') === 'on'
  const appliesToOrganization =
    formData.get('applies_to_organization') === 'on'
  const { reason, fieldErrors } =
    reasonField(formData)

  if (!UUID_PATTERN.test(proposalId)) {
    return failure(
      'La propuesta seleccionada no es válida.'
    )
  }

  if (
    canonicalName.length < 2 ||
    canonicalName.length > 160
  ) {
    fieldErrors.canonicalName =
      'Ingresá un nombre entre 2 y 160 caracteres.'
  }

  if (
    categoryCode &&
    !CODE_PATTERN.test(categoryCode)
  ) {
    fieldErrors.categoryCode =
      'Seleccioná una categoría válida.'
  }

  if (description.length > 2000) {
    fieldErrors.description =
      'La descripción no puede superar los 2000 caracteres.'
  }

  if (
    !appliesToPerson &&
    !appliesToOrganization
  ) {
    fieldErrors.appliesTo =
      'Seleccioná al menos una aplicación.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  let result: ResolveSkillProposalResult

  try {
    result = await resolveSkillProposal(access, {
      proposalId,
      resolutionAction: 'create',
      canonicalName,
      categoryCode: categoryCode || null,
      description: description || null,
      appliesToPerson,
      appliesToOrganization,
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Skill proposal create failed:',
      error
    )

    return mapSkillProposalError(error)
  }

  revalidateSkillProposalPaths(result)

  return success(
    `Se creó "${result.resolvedSkillName ?? canonicalName}" como habilidad canónica y la propuesta quedó resuelta.`
  )
}

export async function rejectSkillProposalAction(
  proposalId: string,
  _previousState: SkillProposalResolutionActionState,
  formData: FormData
): Promise<SkillProposalResolutionActionState> {
  const access = await getCurrentAccess()

  const { reason, fieldErrors } =
    reasonField(formData)

  if (!UUID_PATTERN.test(proposalId)) {
    return failure(
      'La propuesta seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolveSkillProposal(access, {
      proposalId,
      resolutionAction: 'reject',
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Skill proposal rejection failed:',
      error
    )

    return mapSkillProposalError(error)
  }

  revalidateSkillProposalPaths()

  return success(
    'La propuesta fue rechazada y se conserva para trazabilidad.'
  )
}

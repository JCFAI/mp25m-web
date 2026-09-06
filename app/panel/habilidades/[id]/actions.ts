'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { addSkillAlias } from '../../../../lib/skills/aliases-manage'
import { createClient } from '../../../../lib/supabase/server'

export type SkillAliasActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    alias?: string
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(
  message: string,
  fieldErrors: SkillAliasActionState['fieldErrors'] = {}
): SkillAliasActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function success(
  message: string
): SkillAliasActionState {
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

function mapSkillAliasError(error: unknown) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  const [, canonicalSkillName] =
    detail.match(
      /conflicts with canonical skill:\s*(.+)$/i
    ) ?? []

  if (canonicalSkillName) {
    return failure(
      `Ese alias coincide con una habilidad canónica: "${canonicalSkillName}".`,
      {
        alias:
          'Usá la habilidad canónica existente.',
      }
    )
  }

  const [, aliasSkillName] =
    detail.match(
      /alias already exists for skill:\s*(.+)$/i
    ) ?? []

  if (aliasSkillName) {
    return failure(
      `Ese alias ya está registrado para "${aliasSkillName}".`,
      {
        alias:
          'Ingresá un alias diferente.',
      }
    )
  }

  if (/alias.*between|invalid skill alias/i.test(detail)) {
    return failure(
      'El alias debe tener entre 2 y 180 caracteres.',
      {
        alias:
          'Ingresá un alias claro.',
      }
    )
  }

  if (/skill not found|inactive/i.test(detail)) {
    return failure(
      'La habilidad ya no está disponible para agregar aliases.'
    )
  }

  if (/cannot manage|permission|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para administrar aliases del catálogo.'
    )
  }

  return failure(
    'No se pudo agregar el alias. No se modificó ningún dato.'
  )
}

export async function addSkillAliasAction(
  skillId: string,
  skillName: string,
  _previousState: SkillAliasActionState,
  formData: FormData
): Promise<SkillAliasActionState> {
  const access = await getCurrentAccess()

  const alias =
    textField(formData, 'alias')

  if (!UUID_PATTERN.test(skillId)) {
    return failure(
      'La habilidad seleccionada no es válida.'
    )
  }

  if (
    alias.length < 2 ||
    alias.length > 180
  ) {
    return failure(
      'Hay datos que necesitan corrección.',
      {
        alias:
          'El alias debe tener entre 2 y 180 caracteres.',
      }
    )
  }

  try {
    await addSkillAlias(access, {
      skillId,
      alias,
    })
  } catch (error) {
    console.error(
      '[MP25M] Skill alias creation failed:',
      error
    )

    return mapSkillAliasError(error)
  }

  revalidatePath(`/panel/habilidades/${skillId}`)
  revalidatePath('/panel/habilidades')

  return success(
    `Se agregó "${alias}" como alias de "${skillName}".`
  )
}

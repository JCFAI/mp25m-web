'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  createCanonicalOrganization,
  createOrganizationWithTypeProposal,
} from '../../../../lib/organizations/manage'
import { createClient } from '../../../../lib/supabase/server'

const PROPOSE_NEW_TYPE_VALUE =
  '__propose_new_type__'

export type CreateOrganizationActionState = {
  status: 'idle' | 'error'
  message: string | null
  fieldErrors: {
    name?: string
    organizationTypeCode?: string
    proposedTypeName?: string
    notes?: string
  }
}

function failure(
  message: string,
  fieldErrors: CreateOrganizationActionState['fieldErrors'] = {}
): CreateOrganizationActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function mapCreateOrganizationError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (
    /strong organization nominal match|duplicate|already exists/i.test(
      detail
    )
  ) {
    return failure(
      'Ya existe una organización canónica con un nombre muy similar. Revisá la organización existente antes de crear otra.',
      {
        name:
          'Hay una coincidencia nominal fuerte con una organización ya registrada.',
      }
    )
  }

  if (
    /cannot create organizations|cannot manage organizations|not allowed|permission/i.test(
      detail
    )
  ) {
    return failure(
      'Tu usuario no tiene permisos para crear organizaciones canónicas.'
    )
  }

  if (/organization type/i.test(detail)) {
    if (/proposal/i.test(detail)) {
      return failure(
        'El tipo propuesto necesita corrección.',
        {
          proposedTypeName:
            'Ingresá un nombre de tipo válido.',
        }
      )
    }

    return failure(
      'El tipo de organización seleccionado ya no está disponible.',
      {
        organizationTypeCode:
          'Seleccioná un tipo vigente.',
      }
    )
  }

  return failure(
    'No se pudo crear la organización. No se registró ningún dato.'
  )
}

export async function createOrganizationAction(
  _previousState: CreateOrganizationActionState,
  formData: FormData
): Promise<CreateOrganizationActionState> {
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

  const name = String(
    formData.get('name') ?? ''
  ).trim()

  const organizationTypeCode = String(
    formData.get('organization_type_code') ?? ''
  ).trim()

  const notes = String(
    formData.get('notes') ?? ''
  ).trim()

  const proposedTypeName = String(
    formData.get('proposed_type_name') ?? ''
  ).trim()

  const isTypeProposal =
    organizationTypeCode ===
    PROPOSE_NEW_TYPE_VALUE

  const fieldErrors:
    CreateOrganizationActionState['fieldErrors'] = {}

  if (name.length < 2) {
    fieldErrors.name =
      'El nombre debe tener al menos 2 caracteres.'
  } else if (name.length > 300) {
    fieldErrors.name =
      'El nombre no puede superar los 300 caracteres.'
  }

  if (!organizationTypeCode) {
    fieldErrors.organizationTypeCode =
      'Seleccioná un tipo de organización.'
  }

  if (isTypeProposal) {
    if (proposedTypeName.length < 2) {
      fieldErrors.proposedTypeName =
        'El tipo propuesto debe tener al menos 2 caracteres.'
    } else if (proposedTypeName.length > 120) {
      fieldErrors.proposedTypeName =
        'El tipo propuesto no puede superar los 120 caracteres.'
    }
  }

  if (notes.length > 2000) {
    fieldErrors.notes =
      'Las observaciones no pueden superar los 2000 caracteres.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  let organizationId: string

  try {
    organizationId = isTypeProposal
      ? await createOrganizationWithTypeProposal(
          access,
          {
            name,
            proposedTypeName,
            notes: notes || null,
          }
        )
      : await createCanonicalOrganization(access, {
          name,
          organizationTypeCode,
          notes: notes || null,
        })
  } catch (error) {
    console.error(
      '[MP25M] Organization creation failed:',
      error
    )

    return mapCreateOrganizationError(error)
  }

  revalidatePath('/panel/organizaciones')

  redirect(`/panel/organizaciones/${organizationId}`)
}

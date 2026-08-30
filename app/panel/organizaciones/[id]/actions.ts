'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  confirmOrganizationNodeLink,
  createOrganizationNodeLink,
  resolveOrganizationTypeProposal,
  type ResolveOrganizationTypeProposalAction,
  updateOrganizationNodeLinkDetails,
} from '../../../../lib/organizations/manage'
import { createClient } from '../../../../lib/supabase/server'

export type OrganizationNodeLinkActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    nodeId?: string
    evidenceText?: string
    startedOn?: string
    reason?: string
  }
}

export type OrganizationTypeProposalResolutionActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    resolutionAction?: string
    organizationTypeCode?: string
    reason?: string
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function failure(
  message: string,
  fieldErrors: OrganizationNodeLinkActionState['fieldErrors'] = {}
): OrganizationNodeLinkActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function success(
  message: string
): OrganizationNodeLinkActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

function proposalFailure(
  message: string,
  fieldErrors: OrganizationTypeProposalResolutionActionState['fieldErrors'] = {}
): OrganizationTypeProposalResolutionActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function proposalSuccess(
  message: string
): OrganizationTypeProposalResolutionActionState {
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

function isFutureDate(value: string) {
  if (!value) {
    return false
  }

  const today =
    new Date().toISOString().slice(0, 10)

  return value > today
}

function mapCreateLinkError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (/already exists|duplicate/i.test(detail)) {
    return failure(
      'Este nodo ya está vinculado con la organización. Revisá el vínculo existente debajo.',
      {
        nodeId:
          'Este nodo ya está vinculado con la organización.',
      }
    )
  }

  if (/start date.*future|future/i.test(detail)) {
    return failure(
      'La fecha de inicio no puede ser futura.',
      {
        startedOn:
          'Ingresá una fecha actual o pasada.',
      }
    )
  }

  if (/node.*not found|node.*inactive|invalid.*node/i.test(detail)) {
    return failure(
      'El nodo seleccionado ya no está disponible.',
      {
        nodeId:
          'Quitá y volvé a seleccionar el nodo.',
      }
    )
  }

  if (/organization.*not found|organization.*inactive/i.test(detail)) {
    return failure(
      'La organización ya no está disponible para vincular nodos.'
    )
  }

  if (/cannot link|cannot manage|permission|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para vincular organizaciones con nodos.'
    )
  }

  return failure(
    'No se pudo registrar el vínculo territorial. No se modificó ningún dato.'
  )
}

function mapConfirmLinkError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (/already confirmed/i.test(detail)) {
    return failure(
      'Este vínculo territorial ya está confirmado. Actualizá la pantalla para ver su estado actual.'
    )
  }

  if (/not pending/i.test(detail)) {
    return failure(
      'Este vínculo territorial ya no está pendiente de confirmación.'
    )
  }

  if (/reason.*required|invalid.*reason/i.test(detail)) {
    return failure(
      'Indicá brevemente por qué confirmás este vínculo territorial.',
      {
        reason:
          'La justificación es obligatoria.',
      }
    )
  }

  if (/cannot confirm|permission|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para confirmar vínculos territoriales.'
    )
  }

  return failure(
    'No se pudo confirmar el vínculo territorial. No se modificó ningún otro dato.'
  )
}

function mapUpdateLinkDetailsError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (/future/i.test(detail)) {
    return failure(
      'La fecha de inicio no puede ser futura.',
      {
        startedOn:
          'Ingresá una fecha actual o pasada.',
      }
    )
  }

  if (/not pending|while pending/i.test(detail)) {
    return failure(
      'Solo se puede editar la evidencia mientras el vínculo territorial está pendiente.'
    )
  }

  if (/not active/i.test(detail)) {
    return failure(
      'El vínculo territorial ya no está activo y no puede editarse desde esta acción.'
    )
  }

  if (/not found|inactive/i.test(detail)) {
    return failure(
      'No se encontró el vínculo territorial pendiente para actualizar.'
    )
  }

  if (/cannot update|permission|not allowed/i.test(detail)) {
    return failure(
      'Tu usuario no tiene permisos para editar la evidencia del vínculo territorial.'
    )
  }

  return failure(
    'No se pudo actualizar la evidencia del vínculo territorial. No se modificó ningún otro dato.'
  )
}

function mapResolveTypeProposalError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (
    /strong organization type match|duplicate|already exists/i.test(
      detail
    )
  ) {
    const [, matchingTypeName] =
      detail.match(
        /strong organization type match already exists:\s*(.*?)\s*\(/i
      ) ?? []

    return proposalFailure(
      matchingTypeName
        ? `Se detectó una posible coincidencia con ${matchingTypeName}. Revisá si corresponde usar ese tipo existente o mantener la propuesta como un tipo diferente.`
        : 'Se detectó una posible coincidencia con un tipo de organización existente. Revisá si corresponde usar ese tipo existente o mantener la propuesta como un tipo diferente.',
      {
        organizationTypeCode:
          'Seleccioná el tipo canónico sugerido o justificá mantener la propuesta como tipo nuevo.',
      }
    )
  }

  if (/not pending/i.test(detail)) {
    return proposalFailure(
      'La propuesta de tipo ya fue resuelta. Actualizá la pantalla para ver su estado actual.'
    )
  }

  if (/canonical organization type|invalid organization type/i.test(detail)) {
    return proposalFailure(
      'El tipo canónico seleccionado no está disponible.',
      {
        organizationTypeCode:
          'Seleccioná un tipo vigente.',
      }
    )
  }

  if (/reason.*required|invalid.*reason/i.test(detail)) {
    return proposalFailure(
      'Indicá una justificación breve para resolver la propuesta.',
      {
        reason:
          'La justificación debe tener entre 3 y 2000 caracteres.',
      }
    )
  }

  if (/cannot resolve|permission|not allowed/i.test(detail)) {
    return proposalFailure(
      'Tu usuario no tiene permisos para resolver propuestas de tipo.'
    )
  }

  if (/not found|inactive/i.test(detail)) {
    return proposalFailure(
      'No se encontró la propuesta pendiente para resolver.'
    )
  }

  return proposalFailure(
    'No se pudo resolver la propuesta de tipo. No se modificó ningún otro dato.'
  )
}

export async function createOrganizationNodeLinkAction(
  organizationId: string,
  _previousState: OrganizationNodeLinkActionState,
  formData: FormData
): Promise<OrganizationNodeLinkActionState> {
  const access = await getCurrentAccess()

  const nodeId = String(
    formData.get('node_id') ?? ''
  ).trim()

  const evidenceText = String(
    formData.get('evidence_text') ?? ''
  ).trim()

  const startedOn = String(
    formData.get('started_on') ?? ''
  ).trim()

  const fieldErrors:
    OrganizationNodeLinkActionState['fieldErrors'] = {}

  if (!UUID_PATTERN.test(organizationId)) {
    return failure(
      'La organización seleccionada no es válida.'
    )
  }

  if (!UUID_PATTERN.test(nodeId)) {
    fieldErrors.nodeId =
      'Seleccioná un nodo desde el buscador.'
  }

  if (evidenceText.length > 2000) {
    fieldErrors.evidenceText =
      'La evidencia o justificación no puede superar los 2000 caracteres.'
  }

  if (
    startedOn &&
    !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)
  ) {
    fieldErrors.startedOn =
      'Ingresá una fecha válida.'
  } else if (isFutureDate(startedOn)) {
    fieldErrors.startedOn =
      'La fecha de inicio no puede ser futura.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await createOrganizationNodeLink(access, {
      organizationId,
      nodeId,
      evidenceText:
        evidenceText || null,
      startedOn:
        startedOn || null,
    })
  } catch (error) {
    console.error(
      '[MP25M] Organization node link creation failed:',
      error
    )

    return mapCreateLinkError(error)
  }

  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
  revalidatePath('/panel/organizaciones')

  return success(
    'El vínculo territorial fue registrado como pendiente.'
  )
}

export async function confirmOrganizationNodeLinkAction(
  organizationId: string,
  nodeId: string,
  _previousState: OrganizationNodeLinkActionState,
  formData: FormData
): Promise<OrganizationNodeLinkActionState> {
  const access = await getCurrentAccess()

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  const fieldErrors:
    OrganizationNodeLinkActionState['fieldErrors'] = {}

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(nodeId)
  ) {
    return failure(
      'El vínculo territorial seleccionado no es válido.'
    )
  }

  if (reason.length < 3) {
    fieldErrors.reason =
      'La justificación debe tener al menos 3 caracteres.'
  } else if (reason.length > 2000) {
    fieldErrors.reason =
      'La justificación no puede superar los 2000 caracteres.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await confirmOrganizationNodeLink(
      access,
      organizationId,
      nodeId,
      reason
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization node link confirmation failed:',
      error
    )

    return mapConfirmLinkError(error)
  }

  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
  revalidatePath(`/panel/nodos/${nodeId}`)
  revalidatePath('/panel/organizaciones')

  return success(
    'El vínculo territorial fue confirmado correctamente.'
  )
}

export async function updateOrganizationNodeLinkDetailsAction(
  organizationId: string,
  nodeId: string,
  _previousState: OrganizationNodeLinkActionState,
  formData: FormData
): Promise<OrganizationNodeLinkActionState> {
  const access = await getCurrentAccess()

  const evidenceText = String(
    formData.get('evidence_text') ?? ''
  ).trim()

  const startedOn = String(
    formData.get('started_on') ?? ''
  ).trim()

  const fieldErrors:
    OrganizationNodeLinkActionState['fieldErrors'] = {}

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(nodeId)
  ) {
    return failure(
      'El vínculo territorial seleccionado no es válido.'
    )
  }

  if (evidenceText.length > 2000) {
    fieldErrors.evidenceText =
      'La evidencia o justificación no puede superar los 2000 caracteres.'
  }

  if (
    startedOn &&
    !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)
  ) {
    fieldErrors.startedOn =
      'Ingresá una fecha válida.'
  } else if (isFutureDate(startedOn)) {
    fieldErrors.startedOn =
      'La fecha de inicio no puede ser futura.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return failure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await updateOrganizationNodeLinkDetails(access, {
      organizationId,
      nodeId,
      evidenceText:
        evidenceText || null,
      startedOn:
        startedOn || null,
    })
  } catch (error) {
    console.error(
      '[MP25M] Organization node link detail update failed:',
      error
    )

    return mapUpdateLinkDetailsError(error)
  }

  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
  revalidatePath(`/panel/nodos/${nodeId}`)
  revalidatePath('/panel/organizaciones')

  return success(
    'La evidencia del vínculo pendiente fue actualizada.'
  )
}

export async function resolveOrganizationTypeProposalAction(
  organizationId: string,
  proposalId: string,
  _previousState: OrganizationTypeProposalResolutionActionState,
  formData: FormData
): Promise<OrganizationTypeProposalResolutionActionState> {
  const access = await getCurrentAccess()

  const resolutionAction = String(
    formData.get('resolution_action') ?? ''
  ).trim() as ResolveOrganizationTypeProposalAction

  const organizationTypeCode = String(
    formData.get(
      'resolved_organization_type_code'
    ) ?? ''
  ).trim()

  const reason = String(
    formData.get('reason') ?? ''
  ).trim()

  const fieldErrors:
    OrganizationTypeProposalResolutionActionState['fieldErrors'] = {}

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(proposalId)
  ) {
    return proposalFailure(
      'La propuesta de tipo seleccionada no es válida.'
    )
  }

  if (
    ![
      'mapped',
      'approved',
      'approved_override',
      'rejected',
    ].includes(resolutionAction)
  ) {
    fieldErrors.resolutionAction =
      'Seleccioná una acción de resolución.'
  }

  if (
    resolutionAction === 'mapped' &&
    !organizationTypeCode
  ) {
    fieldErrors.organizationTypeCode =
      'Seleccioná un tipo canónico existente.'
  }

  if (reason.length < 3) {
    fieldErrors.reason =
      'La justificación debe tener al menos 3 caracteres.'
  } else if (reason.length > 2000) {
    fieldErrors.reason =
      'La justificación no puede superar los 2000 caracteres.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return proposalFailure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolveOrganizationTypeProposal(access, {
      proposalId,
      resolutionAction,
      existingOrganizationTypeCode:
        organizationTypeCode || null,
      reason,
    })
  } catch (error) {
    console.error(
      '[MP25M] Organization type proposal resolution failed:',
      error
    )

    return mapResolveTypeProposalError(error)
  }

  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
  revalidatePath('/panel/organizaciones')
  revalidatePath('/panel/nodos')

  return proposalSuccess(
    'La propuesta de tipo fue resuelta correctamente.'
  )
}

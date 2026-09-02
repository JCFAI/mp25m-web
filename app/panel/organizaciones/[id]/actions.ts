'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  addOrganizationActivity,
  proposeOrganizationActivity,
  type AddOrganizationActivityResult,
} from '../../../../lib/organizations/activities-manage'
import {
  addOrganizationCapability,
  deactivateOrganizationCapability,
  resolveOrganizationCapability,
  type AddOrganizationCapabilityResult,
  updateOrganizationCapability,
} from '../../../../lib/organizations/capabilities-manage'
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

export type OrganizationCapabilityActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    skillId?: string
    scopeKind?: string
    nodeId?: string
    notes?: string
    evidenceText?: string
    reason?: string
  }
}

export type OrganizationActivityActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: {
    activityId?: string
    proposedName?: string
    notes?: string
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

function capabilityFailure(
  message: string,
  fieldErrors: OrganizationCapabilityActionState['fieldErrors'] = {}
): OrganizationCapabilityActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function capabilitySuccess(
  message: string
): OrganizationCapabilityActionState {
  return {
    status: 'success',
    message,
    fieldErrors: {},
  }
}

function activityFailure(
  message: string,
  fieldErrors: OrganizationActivityActionState['fieldErrors'] = {}
): OrganizationActivityActionState {
  return {
    status: 'error',
    message,
    fieldErrors,
  }
}

function activitySuccess(
  message: string
): OrganizationActivityActionState {
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

function isFutureDate(value: string) {
  if (!value) {
    return false
  }

  const today =
    new Date().toISOString().slice(0, 10)

  return value > today
}

function parseCapabilityDetails(
  formData: FormData
) {
  const notes =
    textField(formData, 'notes')
  const evidenceText =
    textField(formData, 'evidence_text')

  const fieldErrors:
    OrganizationCapabilityActionState['fieldErrors'] = {}

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
      notes: notes || null,
      evidenceText:
        evidenceText || null,
    },
    fieldErrors,
  }
}

function parseActivityNotes(
  formData: FormData
) {
  const notes =
    textField(formData, 'notes')

  if (notes.length > 2000) {
    return {
      notes: notes || null,
      fieldErrors: {
        notes:
          'Las observaciones no pueden superar los 2000 caracteres.',
      },
    }
  }

  return {
    notes: notes || null,
    fieldErrors: {},
  }
}

function parseCapabilityReason(
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

function revalidateOrganizationCapabilityPaths(
  organizationId: string,
  skillId?: string,
  nodeId?: string | null
) {
  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
  revalidatePath('/panel/habilidades')

  if (skillId && UUID_PATTERN.test(skillId)) {
    revalidatePath(
      `/panel/habilidades/${skillId}`
    )
  }

  if (nodeId && UUID_PATTERN.test(nodeId)) {
    revalidatePath(
      `/panel/nodos/${nodeId}/capacidades`
    )
  }
}

function revalidateOrganizationActivityPaths(
  organizationId: string
) {
  revalidatePath(
    `/panel/organizaciones/${organizationId}`
  )
}

function organizationCapabilityStatusText(
  verificationStatus: string
) {
  if (verificationStatus === 'confirmed') {
    return 'Conserva el estado Confirmada.'
  }

  if (verificationStatus === 'self_reported') {
    return 'Conserva el estado Autodeclarada.'
  }

  if (verificationStatus === 'candidate') {
    return 'Quedó pendiente de validación.'
  }

  return 'Conserva su estado actual.'
}

function mapOrganizationCapabilityError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (
    /already has this capability|duplicate/i.test(
      detail
    )
  ) {
    return capabilityFailure(
      'La organización ya tiene esta capacidad registrada para este alcance.',
      {
        skillId:
          'Revisá la capacidad existente en la lista.',
      }
    )
  }

  if (
    /confirmed current territorial link|territorial link/i.test(
      detail
    )
  ) {
    return capabilityFailure(
      'La organización no tiene un vínculo territorial confirmado y vigente con ese nodo.',
      {
        nodeId:
          'Seleccioná un nodo confirmado para esta organización.',
      }
    )
  }

  if (
    /skill not found|unavailable for organizations/i.test(
      detail
    )
  ) {
    return capabilityFailure(
      'La capacidad seleccionada ya no está disponible para organizaciones.',
      {
        skillId:
          'Buscá y seleccioná una capacidad activa del catálogo.',
      }
    )
  }

  if (/organization not found|organization.*inactive/i.test(detail)) {
    return capabilityFailure(
      'La organización ya no está disponible para actualizar capacidades.'
    )
  }

  if (/not active/i.test(detail)) {
    return capabilityFailure(
      'La capacidad de la organización ya no está activa. Actualizá la ficha antes de continuar.'
    )
  }

  if (/already confirmed/i.test(detail)) {
    return capabilityFailure(
      'La capacidad ya está confirmada.'
    )
  }

  if (/only self-reported or candidate/i.test(detail)) {
    return capabilityFailure(
      'Solo pueden rechazarse capacidades autodeclaradas o pendientes de validación. Para una capacidad confirmada usá desactivar.'
    )
  }

  if (/reason|motivo/i.test(detail)) {
    return capabilityFailure(
      'Indicá una justificación breve para completar la acción.',
      {
        reason:
          'La justificación debe tener entre 3 y 2000 caracteres.',
      }
    )
  }

  if (/permission|cannot manage|not allowed/i.test(detail)) {
    return capabilityFailure(
      'Tu usuario no tiene permisos para gestionar capacidades de organizaciones.'
    )
  }

  return capabilityFailure(
    'No se pudo actualizar la capacidad. No se modificó ningún dato.'
  )
}

function mapOrganizationActivityError(
  error: unknown
) {
  const detail =
    error instanceof Error
      ? error.message
      : ''

  if (
    /already has this activity|duplicate/i.test(
      detail
    )
  ) {
    return activityFailure(
      'La organización ya tiene esta actividad registrada.',
      {
        activityId:
          'Revisá la actividad existente en la lista.',
      }
    )
  }

  if (/canonical activity already exists/i.test(detail)) {
    return activityFailure(
      'Ya existe una actividad equivalente. Seleccionala desde el buscador.',
      {
        proposedName:
          'Buscá la actividad canónica y agregala desde los resultados.',
      }
    )
  }

  if (/pending organization activity proposal/i.test(detail)) {
    return activityFailure(
      'Ya existe una propuesta pendiente para esa actividad.',
      {
        proposedName:
          'Revisá las propuestas pendientes de la organización.',
      }
    )
  }

  if (/activity not found|activity.*inactive/i.test(detail)) {
    return activityFailure(
      'La actividad seleccionada ya no está disponible.',
      {
        activityId:
          'Buscá y seleccioná una actividad activa del catálogo.',
      }
    )
  }

  if (/proposal name|invalid organization activity proposal/i.test(detail)) {
    return activityFailure(
      'La actividad propuesta debe tener entre 2 y 200 caracteres.',
      {
        proposedName:
          'Ingresá un nombre claro para la actividad propuesta.',
      }
    )
  }

  if (/organization not found|organization.*inactive/i.test(detail)) {
    return activityFailure(
      'La organización ya no está disponible para actualizar actividades.'
    )
  }

  if (/cannot manage|permission|not allowed/i.test(detail)) {
    return activityFailure(
      'Tu usuario no tiene permisos para gestionar actividades de organizaciones.'
    )
  }

  return activityFailure(
    'No se pudo actualizar la actividad. No se modificó ningún dato.'
  )
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
  organizationName: string,
  _previousState: OrganizationNodeLinkActionState,
  formData: FormData
): Promise<OrganizationNodeLinkActionState> {
  const access = await getCurrentAccess()

  const nodeId = String(
    formData.get('node_id') ?? ''
  ).trim()

  const nodeName = String(
    formData.get('node_name') ?? ''
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

  const readableNodeName =
    nodeName || 'el nodo seleccionado'
  const readableOrganizationName =
    organizationName.trim() ||
    'la organización'

  return success(
    `Se agregó "${readableNodeName}" como vínculo territorial de ${readableOrganizationName}. Quedó pendiente de validación.`
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

export async function addOrganizationActivityAction(
  organizationId: string,
  organizationName: string,
  _previousState: OrganizationActivityActionState,
  formData: FormData
): Promise<OrganizationActivityActionState> {
  const access = await getCurrentAccess()

  const activityId =
    textField(formData, 'activity_id')
  const activityName =
    textField(formData, 'activity_name')

  const {
    notes,
    fieldErrors: notesFieldErrors,
  } = parseActivityNotes(formData)

  const fieldErrors:
    OrganizationActivityActionState['fieldErrors'] = {
      ...notesFieldErrors,
    }

  if (!UUID_PATTERN.test(organizationId)) {
    return activityFailure(
      'La organización seleccionada no es válida.'
    )
  }

  if (!UUID_PATTERN.test(activityId)) {
    fieldErrors.activityId =
      'Seleccioná una actividad desde el buscador.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return activityFailure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  let result: AddOrganizationActivityResult

  try {
    result = await addOrganizationActivity(
      access,
      {
        organizationId,
        activityId,
        notes,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization activity creation failed:',
      error
    )

    return mapOrganizationActivityError(error)
  }

  revalidateOrganizationActivityPaths(
    organizationId
  )

  const readableActivityName =
    result.activityName ||
    activityName ||
    'la actividad seleccionada'
  const readableOrganizationName =
    result.organizationName ||
    organizationName.trim()

  if (result.operation === 'reactivate') {
    return activitySuccess(
      `Se reactivó "${readableActivityName}" en ${readableOrganizationName}. ${organizationCapabilityStatusText(result.verificationStatus)}`
    )
  }

  return activitySuccess(
    `Se agregó "${readableActivityName}" a ${readableOrganizationName}. Quedó pendiente de validación.`
  )
}

export async function proposeOrganizationActivityAction(
  organizationId: string,
  organizationName: string,
  _previousState: OrganizationActivityActionState,
  formData: FormData
): Promise<OrganizationActivityActionState> {
  const access = await getCurrentAccess()

  const proposedName =
    textField(formData, 'proposed_name')

  const fieldErrors:
    OrganizationActivityActionState['fieldErrors'] = {}

  if (!UUID_PATTERN.test(organizationId)) {
    return activityFailure(
      'La organización seleccionada no es válida.'
    )
  }

  if (
    proposedName.length < 2 ||
    proposedName.length > 200
  ) {
    fieldErrors.proposedName =
      'Ingresá un nombre de actividad entre 2 y 200 caracteres.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return activityFailure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await proposeOrganizationActivity(
      access,
      {
        organizationId,
        proposedName,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization activity proposal failed:',
      error
    )

    return mapOrganizationActivityError(error)
  }

  revalidateOrganizationActivityPaths(
    organizationId
  )

  return activitySuccess(
    `Se propuso "${proposedName}" como nueva actividad de ${organizationName.trim()}. Quedó pendiente de validación.`
  )
}

export async function addOrganizationCapabilityAction(
  organizationId: string,
  organizationName: string,
  _previousState: OrganizationCapabilityActionState,
  formData: FormData
): Promise<OrganizationCapabilityActionState> {
  const access = await getCurrentAccess()

  const skillId =
    textField(formData, 'skill_id')
  const skillName =
    textField(formData, 'skill_name')
  const scopeKind =
    textField(formData, 'scope_kind')
  const rawNodeId =
    textField(formData, 'node_id')
  const nodeName =
    textField(formData, 'node_name')

  const {
    details,
    fieldErrors,
  } = parseCapabilityDetails(formData)

  if (!UUID_PATTERN.test(organizationId)) {
    return capabilityFailure(
      'La organización seleccionada no es válida.'
    )
  }

  if (!UUID_PATTERN.test(skillId)) {
    fieldErrors.skillId =
      'Seleccioná una capacidad desde el buscador.'
  }

  if (
    scopeKind !== 'institutional' &&
    scopeKind !== 'node'
  ) {
    fieldErrors.scopeKind =
      'Seleccioná un alcance válido.'
  }

  const nodeId =
    scopeKind === 'node'
      ? rawNodeId
      : null

  if (
    scopeKind === 'node' &&
    !UUID_PATTERN.test(rawNodeId)
  ) {
    fieldErrors.nodeId =
      'Seleccioná un nodo confirmado de la organización.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return capabilityFailure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  let result: AddOrganizationCapabilityResult

  try {
    result = await addOrganizationCapability(
      access,
      {
        organizationId,
        skillId,
        nodeId,
        ...details,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization capability creation failed:',
      error
    )

    return mapOrganizationCapabilityError(error)
  }

  revalidateOrganizationCapabilityPaths(
    organizationId,
    result.skillId,
    result.nodeId
  )

  const readableSkillName =
    result.skillName ||
    skillName ||
    'la capacidad seleccionada'
  const readableOrganizationName =
    result.organizationName ||
    organizationName.trim()
  const readableNodeName =
    nodeName || result.nodeName

  const scopeText =
    result.nodeId
      ? `para ${readableNodeName || 'el nodo seleccionado'}`
      : 'como capacidad institucional'

  if (result.operation === 'reactivate') {
    return capabilitySuccess(
      `Se reactivó "${readableSkillName}" en ${readableOrganizationName} ${scopeText}. ${organizationCapabilityStatusText(result.verificationStatus)}`
    )
  }

  return capabilitySuccess(
    `Se agregó "${readableSkillName}" a ${readableOrganizationName} ${scopeText}. Quedó pendiente de validación.`
  )
}

export async function updateOrganizationCapabilityAction(
  organizationId: string,
  organizationCapabilityId: string,
  skillId: string,
  nodeId: string | null,
  _previousState: OrganizationCapabilityActionState,
  formData: FormData
): Promise<OrganizationCapabilityActionState> {
  const access = await getCurrentAccess()

  const {
    details,
    fieldErrors,
  } = parseCapabilityDetails(formData)

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(organizationCapabilityId)
  ) {
    return capabilityFailure(
      'La capacidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return capabilityFailure(
      'Hay datos que necesitan corrección. Tus datos permanecen cargados.',
      fieldErrors
    )
  }

  try {
    await updateOrganizationCapability(
      access,
      {
        organizationId,
        organizationCapabilityId,
        ...details,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization capability update failed:',
      error
    )

    return mapOrganizationCapabilityError(error)
  }

  revalidateOrganizationCapabilityPaths(
    organizationId,
    skillId,
    nodeId
  )

  return capabilitySuccess(
    'Los datos de la capacidad fueron actualizados.'
  )
}

export async function confirmOrganizationCapabilityAction(
  organizationId: string,
  organizationCapabilityId: string,
  skillId: string,
  nodeId: string | null,
  _previousState: OrganizationCapabilityActionState,
  formData: FormData
): Promise<OrganizationCapabilityActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseCapabilityReason(
    formData,
    'La justificación de confirmación'
  )

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(organizationCapabilityId)
  ) {
    return capabilityFailure(
      'La capacidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return capabilityFailure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolveOrganizationCapability(
      access,
      {
        organizationId,
        organizationCapabilityId,
        resolutionAction: 'confirmed',
        reason,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization capability confirmation failed:',
      error
    )

    return mapOrganizationCapabilityError(error)
  }

  revalidateOrganizationCapabilityPaths(
    organizationId,
    skillId,
    nodeId
  )

  return capabilitySuccess(
    'La capacidad fue confirmada correctamente.'
  )
}

export async function rejectOrganizationCapabilityAction(
  organizationId: string,
  organizationCapabilityId: string,
  skillId: string,
  nodeId: string | null,
  _previousState: OrganizationCapabilityActionState,
  formData: FormData
): Promise<OrganizationCapabilityActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseCapabilityReason(
    formData,
    'El motivo de rechazo'
  )

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(organizationCapabilityId)
  ) {
    return capabilityFailure(
      'La capacidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return capabilityFailure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await resolveOrganizationCapability(
      access,
      {
        organizationId,
        organizationCapabilityId,
        resolutionAction: 'rejected',
        reason,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization capability rejection failed:',
      error
    )

    return mapOrganizationCapabilityError(error)
  }

  revalidateOrganizationCapabilityPaths(
    organizationId,
    skillId,
    nodeId
  )

  return capabilitySuccess(
    'La capacidad fue rechazada y quedó inactiva. El registro se conserva para trazabilidad.'
  )
}

export async function deactivateOrganizationCapabilityAction(
  organizationId: string,
  organizationCapabilityId: string,
  skillId: string,
  nodeId: string | null,
  _previousState: OrganizationCapabilityActionState,
  formData: FormData
): Promise<OrganizationCapabilityActionState> {
  const access = await getCurrentAccess()

  const {
    reason,
    fieldErrors,
  } = parseCapabilityReason(
    formData,
    'El motivo de desactivación'
  )

  if (
    !UUID_PATTERN.test(organizationId) ||
    !UUID_PATTERN.test(organizationCapabilityId)
  ) {
    return capabilityFailure(
      'La capacidad seleccionada no es válida.'
    )
  }

  if (Object.keys(fieldErrors).length > 0) {
    return capabilityFailure(
      'Hay datos que necesitan corrección.',
      fieldErrors
    )
  }

  try {
    await deactivateOrganizationCapability(
      access,
      {
        organizationId,
        organizationCapabilityId,
        reason,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Organization capability deactivation failed:',
      error
    )

    return mapOrganizationCapabilityError(error)
  }

  revalidateOrganizationCapabilityPaths(
    organizationId,
    skillId,
    nodeId
  )

  return capabilitySuccess(
    'La capacidad fue desactivada sin eliminar el registro.'
  )
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  createAgendaEntry,
  transitionAgendaEntry,
  updateAgendaEntry,
  type CreateAgendaEntryInput,
  type AgendaEntryType,
  type AgendaMeetingMode,
  type AgendaMeetingProvider,
  type AgendaTerminalStatus,
} from '../../../lib/agenda/agenda'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { assertElevatedPanelAccess } from '../../../lib/auth/require-elevated-panel-access'
import { createClient } from '../../../lib/supabase/server'

export type AgendaActionState = {
  status:
    | 'idle'
    | 'success'
    | 'error'
  message: string | null
}

const entryTypes =
  new Set<AgendaEntryType>([
    'meeting',
    'visit',
    'training',
    'demonstration',
    'call',
    'follow_up',
    'deadline',
    'other',
  ])

const meetingModes =
  new Set<AgendaMeetingMode>([
    'in_person',
    'virtual',
    'hybrid',
  ])

const meetingProviders =
  new Set<AgendaMeetingProvider>([
    'google_meet',
    'jitsi',
    'other',
  ])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

const TIME_PATTERN =
  /^\d{2}:\d{2}$/

async function currentAccess() {
  const supabase =
    await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      data.claims.sub
    )

  if (!access.length) {
    redirect('/sin-acceso')
  }

  assertElevatedPanelAccess(access)

  return access
}

function text(
  formData: FormData,
  name: string
) {
  return String(
    formData.get(name) ?? ''
  ).trim()
}

function optionalText(
  formData: FormData,
  name: string
) {
  return text(
    formData,
    name
  ) || null
}

function optionalUuid(
  formData: FormData,
  name: string
) {
  const value =
    optionalText(
      formData,
      name
    )

  if (
    value !== null &&
    !UUID_PATTERN.test(value)
  ) {
    throw new Error(
      `Invalid UUID field: ${name}`
    )
  }

  return value
}

type ParsedAgendaEntryForm =
  | {
      input: CreateAgendaEntryInput
    }
  | {
      error: string
    }

function parseAgendaEntryForm(
  formData: FormData
): ParsedAgendaEntryForm {
  const entryType =
    text(
      formData,
      'entry_type'
    ) as AgendaEntryType

  const title =
    text(
      formData,
      'title'
    )

  const detail =
    text(
      formData,
      'detail'
    )

  const scheduledDate =
    text(
      formData,
      'scheduled_date'
    )

  const scheduledTime =
    optionalText(
      formData,
      'scheduled_time'
    )

  const timeZone =
    text(
      formData,
      'time_zone'
    ) ||
    'America/Argentina/Buenos_Aires'

  const meetingModeRaw =
    optionalText(
      formData,
      'meeting_mode'
    )

  const meetingProviderRaw =
    optionalText(
      formData,
      'meeting_provider'
    )

  const meetingMode =
    meetingModeRaw as
      AgendaMeetingMode | null

  const meetingProvider =
    meetingProviderRaw as
      AgendaMeetingProvider | null

  if (
    !entryTypes.has(entryType) ||
    title.length < 3 ||
    detail.length < 3 ||
    !ISO_DATE_PATTERN.test(
      scheduledDate
    ) ||
    (
      scheduledTime !== null &&
      !TIME_PATTERN.test(
        scheduledTime
      )
    )
  ) {
    return {
      error:
        'Revisá tipo, título, detalle, fecha y hora.',
    }
  }

  if (
    meetingMode !== null &&
    !meetingModes.has(
      meetingMode
    )
  ) {
    return {
      error:
        'La modalidad de reunión no es válida.',
    }
  }

  if (
    meetingProvider !== null &&
    !meetingProviders.has(
      meetingProvider
    )
  ) {
    return {
      error:
        'El proveedor de reunión no es válido.',
    }
  }

  const meetingUrl =
    optionalText(
      formData,
      'meeting_url'
    )

  if (
    entryType !== 'meeting' &&
    (
      meetingMode !== null ||
      meetingProvider !== null ||
      meetingUrl !== null
    )
  ) {
    return {
      error:
        'La modalidad, proveedor y enlace sólo corresponden a reuniones.',
    }
  }

  if (
    entryType === 'meeting' &&
    (
      meetingProvider !== null ||
      meetingUrl !== null
    ) &&
    meetingMode !== 'virtual' &&
    meetingMode !== 'hybrid'
  ) {
    return {
      error:
        'El proveedor y el enlace sólo corresponden a reuniones virtuales o híbridas.',
    }
  }

  if (
    meetingUrl !== null &&
    !/^https?:\/\//i.test(
      meetingUrl
    )
  ) {
    return {
      error:
        'El enlace de la reunión debe comenzar con http:// o https://.',
    }
  }

  let opportunityId: string | null
  let articulationId: string | null
  let projectId: string | null
  let themeId: string | null
  let needOfferId: string | null
  let responsibleInternalUserId:
    string | null

  try {
    opportunityId =
      optionalUuid(
        formData,
        'opportunity_id'
      )

    articulationId =
      optionalUuid(
        formData,
        'articulation_id'
      )

    projectId =
      optionalUuid(
        formData,
        'project_id'
      )

    themeId =
      optionalUuid(
        formData,
        'theme_id'
      )

    needOfferId =
      optionalUuid(
        formData,
        'need_offer_id'
      )

    responsibleInternalUserId =
      optionalUuid(
        formData,
        'responsible_internal_user_id'
      )
  } catch {
    return {
      error:
        'El responsable o la entidad de origen no son válidos.',
    }
  }

  const originCount =
    [
      opportunityId,
      articulationId,
      projectId,
      themeId,
      needOfferId,
    ].filter(Boolean).length

  if (originCount > 1) {
    return {
      error:
        'Una actividad puede tener como máximo una entidad de origen.',
    }
  }

  return {
    input: {
      entryType,
      title,
      detail,
      scheduledDate,
      scheduledTime,
      timeZone,

      meetingMode,

      locationText:
        optionalText(
          formData,
          'location_text'
        ),

      meetingProvider,
      meetingUrl,

      responsibleInternalUserId,

      opportunityId,
      articulationId,
      projectId,
      themeId,
      needOfferId,
    },
  }
}


export async function createAgendaEntryAction(
  _state: AgendaActionState,
  formData: FormData
): Promise<AgendaActionState> {
  const parsed =
    parseAgendaEntryForm(
      formData
    )

  if ('error' in parsed) {
    return {
      status: 'error',
      message: parsed.error,
    }
  }

  try {
    await createAgendaEntry(
      await currentAccess(),
      parsed.input
    )
  } catch (error) {
    console.error(
      '[MP25M] Agenda entry creation failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo registrar la actividad. Revisá los datos y permisos.',
    }
  }

  revalidatePath(
    '/panel/agenda'
  )

  return {
    status: 'success',
    message:
      'La actividad fue registrada.',
  }
}


export async function updateAgendaEntryAction(
  agendaEntryId: string,
  _state: AgendaActionState,
  formData: FormData
): Promise<AgendaActionState> {
  if (
    !UUID_PATTERN.test(
      agendaEntryId
    )
  ) {
    return {
      status: 'error',
      message:
        'La actividad no es válida.',
    }
  }

  const rationale =
    text(
      formData,
      'rationale'
    )

  if (
    rationale.length < 3 ||
    rationale.length > 10000
  ) {
    return {
      status: 'error',
      message:
        'Ingresá un fundamento de al menos 3 caracteres.',
    }
  }

  const parsed =
    parseAgendaEntryForm(
      formData
    )

  if ('error' in parsed) {
    return {
      status: 'error',
      message: parsed.error,
    }
  }

  try {
    await updateAgendaEntry(
      await currentAccess(),
      agendaEntryId,
      {
        ...parsed.input,
        rationale,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Agenda entry update failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo editar la actividad. Revisá los datos y permisos.',
    }
  }

  revalidatePath(
    '/panel/agenda'
  )

  return {
    status: 'success',
    message:
      'La actividad fue actualizada.',
  }
}


const terminalStatuses =
  new Set<AgendaTerminalStatus>([
    'completed',
    'cancelled',
  ])

export async function transitionAgendaEntryAction(
  agendaEntryId: string,
  _state: AgendaActionState,
  formData: FormData
): Promise<AgendaActionState> {
  if (
    !UUID_PATTERN.test(
      agendaEntryId
    )
  ) {
    return {
      status: 'error',
      message:
        'La actividad no es válida.',
    }
  }

  const status =
    text(
      formData,
      'status'
    ) as AgendaTerminalStatus

  const rationale =
    text(
      formData,
      'rationale'
    )

  if (
    !terminalStatuses.has(
      status
    )
  ) {
    return {
      status: 'error',
      message:
        'El estado solicitado no es válido.',
    }
  }

  if (
    rationale.length < 3 ||
    rationale.length > 10000
  ) {
    return {
      status: 'error',
      message:
        'Ingresá un fundamento de al menos 3 caracteres.',
    }
  }

  try {
    await transitionAgendaEntry(
      await currentAccess(),
      agendaEntryId,
      status,
      rationale
    )
  } catch (error) {
    console.error(
      '[MP25M] Agenda transition failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo actualizar el estado de la actividad.',
    }
  }

  revalidatePath(
    '/panel/agenda'
  )

  return {
    status: 'success',
    message:
      status === 'completed'
        ? 'La actividad fue completada.'
        : 'La actividad fue cancelada.',
  }
}

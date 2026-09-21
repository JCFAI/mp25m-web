'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  createNeedOffer,
  createNeedOfferFollowup,
  transitionNeedOffer,
  updateNeedOffer,
  type NeedOfferFollowupType,
  type NeedOfferRecordType,
  type NeedOfferStatus,
} from '../../../lib/needs-offers/needs-offers'
import { createClient } from '../../../lib/supabase/server'

export type NeedOfferActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const recordTypes =
  new Set<NeedOfferRecordType>([
    'need',
    'offer',
  ])

const statuses =
  new Set<NeedOfferStatus>([
    'draft',
    'active',
    'paused',
    'closed',
    'cancelled',
  ])

const followupTypes =
  new Set<NeedOfferFollowupType>([
    'general',
    'observation',
    'update',
    'next_step',
    'result',
  ])

const ISO_INSTANT_PATTERN =
  /(?:Z|[+-]\d{2}:\d{2})$/i

async function currentAccess() {
  const supabase = await createClient()

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
  return text(formData, name) || null
}

function optionalInstant(
  formData: FormData,
  name: string
) {
  const value =
    optionalText(formData, name)

  if (value === null) {
    return {
      valid: true,
      value: null,
    }
  }

  if (
    !ISO_INSTANT_PATTERN.test(value) ||
    Number.isNaN(
      new Date(value).getTime()
    )
  ) {
    return {
      valid: false,
      value: null,
    }
  }

  return {
    valid: true,
    value:
      new Date(value).toISOString(),
  }
}

export async function createNeedOfferAction(
  _state: NeedOfferActionState,
  formData: FormData
): Promise<NeedOfferActionState> {
  const recordType =
    text(
      formData,
      'record_type'
    ) as NeedOfferRecordType

  const title =
    text(formData, 'title')

  const description =
    text(formData, 'description')

  const responsibleInternalUserId =
    text(
      formData,
      'responsible_internal_user_id'
    )

  const nodeId =
    optionalText(
      formData,
      'node_id'
    )

  const rationale =
    text(
      formData,
      'rationale'
    )

  if (
    !recordTypes.has(recordType) ||
    title.length < 3 ||
    description.length < 10 ||
    !responsibleInternalUserId ||
    rationale.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Completá tipo, título, descripción, responsable y fundamento.',
    }
  }

  let needOfferId: string

  try {
    needOfferId =
      await createNeedOffer(
        await currentAccess(),
        {
          recordType,
          title,
          description,
          responsibleInternalUserId,
          nodeId,
          rationale,
        }
      )
  } catch (error) {
    console.error(
      '[MP25M] Need/offer creation failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo crear la necesidad u oferta. Revisá los datos y permisos.',
    }
  }

  revalidatePath(
    '/panel/necesidades-ofertas'
  )

  redirect(
    `/panel/necesidades-ofertas/${needOfferId}`
  )
}

export async function updateNeedOfferAction(
  needOfferId: string,
  _state: NeedOfferActionState,
  formData: FormData
): Promise<NeedOfferActionState> {
  const title =
    text(formData, 'title')

  const description =
    text(formData, 'description')

  const responsibleInternalUserId =
    text(
      formData,
      'responsible_internal_user_id'
    )

  const nodeId =
    optionalText(
      formData,
      'node_id'
    )

  const rationale =
    text(
      formData,
      'rationale'
    )

  if (
    title.length < 3 ||
    description.length < 10 ||
    !responsibleInternalUserId ||
    rationale.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Completá título, descripción, responsable y fundamento.',
    }
  }

  try {
    await updateNeedOffer(
      await currentAccess(),
      {
        needOfferId,
        title,
        description,
        responsibleInternalUserId,
        nodeId,
        rationale,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Need/offer update failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo actualizar la necesidad u oferta.',
    }
  }

  revalidatePath(
    '/panel/necesidades-ofertas'
  )

  revalidatePath(
    `/panel/necesidades-ofertas/${needOfferId}`
  )

  return {
    status: 'success',
    message:
      'La necesidad u oferta fue actualizada.',
  }
}

export async function transitionNeedOfferAction(
  needOfferId: string,
  _state: NeedOfferActionState,
  formData: FormData
): Promise<NeedOfferActionState> {
  const status =
    text(
      formData,
      'status'
    ) as NeedOfferStatus

  const rationale =
    text(
      formData,
      'rationale'
    )

  if (
    !statuses.has(status) ||
    rationale.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Elegí un estado válido y explicá el cambio.',
    }
  }

  try {
    await transitionNeedOffer(
      await currentAccess(),
      {
        needOfferId,
        status,
        rationale,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Need/offer transition failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo cambiar el estado.',
    }
  }

  revalidatePath(
    '/panel/necesidades-ofertas'
  )

  revalidatePath(
    `/panel/necesidades-ofertas/${needOfferId}`
  )

  return {
    status: 'success',
    message:
      'El estado fue actualizado.',
  }
}

export async function createNeedOfferFollowupAction(
  needOfferId: string,
  _state: NeedOfferActionState,
  formData: FormData
): Promise<NeedOfferActionState> {
  const followupType =
    text(
      formData,
      'followup_type'
    ) as NeedOfferFollowupType

  const detail =
    text(
      formData,
      'detail'
    )

  const occurredAt =
    optionalInstant(
      formData,
      'occurred_at'
    )

  if (!occurredAt.valid) {
    return {
      status: 'error',
      message:
        'Revisá la fecha y hora de la novedad.',
    }
  }

  if (
    !followupTypes.has(
      followupType
    ) ||
    detail.length < 3
  ) {
    return {
      status: 'error',
      message:
        'Elegí un tipo válido y describí la novedad.',
    }
  }

  try {
    await createNeedOfferFollowup(
      await currentAccess(),
      {
        needOfferId,
        followupType,
        detail,
        occurredAt:
          occurredAt.value,
      }
    )
  } catch (error) {
    console.error(
      '[MP25M] Need/offer follow-up failed:',
      error
    )

    return {
      status: 'error',
      message:
        'No se pudo registrar la novedad.',
    }
  }

  revalidatePath(
    '/panel/necesidades-ofertas'
  )

  revalidatePath(
    `/panel/necesidades-ofertas/${needOfferId}`
  )

  return {
    status: 'success',
    message:
      'La novedad fue registrada.',
  }
}

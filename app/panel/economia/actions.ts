'use server'

import {
  revalidatePath,
} from 'next/cache'
import {
  redirect,
} from 'next/navigation'

import {
  getInternalAccess,
} from '../../../lib/auth/internal-access'
import {
  COLLECTION_STATUSES,
  ECONOMIC_SOURCE_TYPES,
  EconomicProfileWriteError,
  saveEconomicProfileRevision,
  type CollectionStatus,
  type EconomicSourceType,
} from '../../../lib/economics/economics'
import {
  createClient,
} from '../../../lib/supabase/server'

export type EconomicActionState = {
  status:
    | 'idle'
    | 'success'
    | 'error'
    | 'conflict'

  message: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NON_NEGATIVE_DECIMAL_PATTERN =
  /^\d+(?:[.,]\d{1,4})?$/

const SIGNED_DECIMAL_PATTERN =
  /^-?\d+(?:[.,]\d{1,4})?$/

const SOURCE_TYPE_SET =
  new Set<string>(
    ECONOMIC_SOURCE_TYPES,
  )

const COLLECTION_STATUS_SET =
  new Set<string>(
    COLLECTION_STATUSES,
  )

function field(
  data: FormData,
  name: string,
) {
  return String(
    data.get(name) ?? '',
  ).trim()
}

function nullableText(
  value: string,
) {
  return value || null
}

function normalizeDecimal(
  value: string,
) {
  return value.replace(',', '.')
}

function decimalOrNull(
  value: string,
  allowNegative = false,
): string | null | undefined {
  if (!value) {
    return null
  }

  const pattern =
    allowNegative
      ? SIGNED_DECIMAL_PATTERN
      : NON_NEGATIVE_DECIMAL_PATTERN

  if (!pattern.test(value)) {
    return undefined
  }

  return normalizeDecimal(value)
}

function validOptionalText(
  value: string | null,
  maxLength: number,
) {
  return (
    value === null ||
    (
      value.length >= 3 &&
      value.length <= maxLength
    )
  )
}

function isSourceType(
  value: string,
): value is EconomicSourceType {
  return SOURCE_TYPE_SET.has(value)
}

function isCollectionStatus(
  value: string,
): value is CollectionStatus {
  return COLLECTION_STATUS_SET.has(
    value,
  )
}

async function getCurrentAccess() {
  const supabase =
    await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      data.claims.sub,
    )

  if (!access.length) {
    redirect('/sin-acceso')
  }

  return access
}

function revalidateSource(
  sourceType: EconomicSourceType,
  sourceId: string,
) {
  if (sourceType === 'opportunity') {
    revalidatePath(
      `/panel/oportunidades/${sourceId}`,
    )

    revalidatePath(
      '/panel/oportunidades',
    )

    return
  }

  if (sourceType === 'articulation') {
    revalidatePath(
      `/panel/articulaciones/${sourceId}`,
    )

    revalidatePath(
      '/panel/articulaciones',
    )

    return
  }

  revalidatePath(
    `/panel/proyectos/${sourceId}`,
  )

  revalidatePath(
    '/panel/proyectos',
  )
}

export async function saveEconomicProfileAction(
  sourceType: EconomicSourceType,
  sourceId: string,
  expectedRevisionNo: number,
  _state: EconomicActionState,
  data: FormData,
): Promise<EconomicActionState> {
  if (
    !isSourceType(sourceType) ||
    !UUID_PATTERN.test(sourceId) ||
    !Number.isInteger(
      expectedRevisionNo,
    ) ||
    expectedRevisionNo < 0
  ) {
    return {
      status: 'error',
      message:
        'La ficha económica indicada no es válida.',
    }
  }

  const currencyRaw =
    field(
      data,
      'currency_code',
    ).toUpperCase()

  const currencyCode =
    currencyRaw || null

  if (
    currencyCode &&
    !/^[A-Z]{3}$/.test(
      currencyCode,
    )
  ) {
    return {
      status: 'error',
      message:
        'La moneda debe indicarse con un código de tres letras, por ejemplo ARS o USD.',
    }
  }

  const estimatedValue =
    decimalOrNull(
      field(
        data,
        'estimated_value',
      ),
    )

  const estimatedCosts =
    decimalOrNull(
      field(
        data,
        'estimated_costs',
      ),
    )

  const probabilityPercent =
    decimalOrNull(
      field(
        data,
        'probability_percent',
      ),
    )

  const participantIncomePotential =
    decimalOrNull(
      field(
        data,
        'participant_income_potential',
      ),
    )

  const mp25mContributionPotential =
    decimalOrNull(
      field(
        data,
        'mp25m_contribution_potential',
      ),
    )

  const agreedValue =
    decimalOrNull(
      field(
        data,
        'agreed_value',
      ),
    )

  const collectedAmount =
    decimalOrNull(
      field(
        data,
        'collected_amount',
      ),
    )

  const finalCosts =
    decimalOrNull(
      field(
        data,
        'final_costs',
      ),
    )

  const participantIncomeFinal =
    decimalOrNull(
      field(
        data,
        'participant_income_final',
      ),
    )

  const mp25mContributionFinal =
    decimalOrNull(
      field(
        data,
        'mp25m_contribution_final',
      ),
    )

  const finalResultAmount =
    decimalOrNull(
      field(
        data,
        'final_result_amount',
      ),
      true,
    )

  const numericValues = [
    estimatedValue,
    estimatedCosts,
    probabilityPercent,
    participantIncomePotential,
    mp25mContributionPotential,
    agreedValue,
    collectedAmount,
    finalCosts,
    participantIncomeFinal,
    mp25mContributionFinal,
    finalResultAmount,
  ]

  if (
    numericValues.some(
      (value) =>
        value === undefined,
    )
  ) {
    return {
      status: 'error',
      message:
        'Revisá los importes. Usá números sin separador de miles y hasta cuatro decimales.',
    }
  }

  const monetaryValues = [
    estimatedValue,
    estimatedCosts,
    participantIncomePotential,
    mp25mContributionPotential,
    agreedValue,
    collectedAmount,
    finalCosts,
    participantIncomeFinal,
    mp25mContributionFinal,
    finalResultAmount,
  ]

  if (
    !currencyCode &&
    monetaryValues.some(
      (value) =>
        value !== null &&
        value !== undefined,
    )
  ) {
    return {
      status: 'error',
      message:
        'Ingresá la moneda para los importes, por ejemplo ARS o USD.',
    }
  }

  if (
    probabilityPercent !== null &&
    probabilityPercent !== undefined &&
    (
      Number(
        probabilityPercent,
      ) < 0 ||
      Number(
        probabilityPercent,
      ) > 100
    )
  ) {
    return {
      status: 'error',
      message:
        'La probabilidad debe estar entre 0 y 100.',
    }
  }

  const collectionRaw =
    field(
      data,
      'collection_status',
    )

  const collectionStatus =
    collectionRaw
      ? (
          isCollectionStatus(
            collectionRaw,
          )
            ? collectionRaw
            : null
        )
      : null

  if (
    collectionRaw &&
    !collectionStatus
  ) {
    return {
      status: 'error',
      message:
        'El estado de cobro no es válido.',
    }
  }

  const distributionNotes =
    nullableText(
      field(
        data,
        'distribution_notes',
      ),
    )

  const economicSummary =
    nullableText(
      field(
        data,
        'economic_summary',
      ),
    )

  const evidenceReference =
    nullableText(
      field(
        data,
        'evidence_reference',
      ),
    )

  const rationale =
    field(
      data,
      'rationale',
    )

  if (!rationale) {
    return {
      status: 'error',
      message:
        'El motivo de esta revisión es obligatorio.',
    }
  }

  if (
    rationale.length < 3 ||
    rationale.length > 2000
  ) {
    return {
      status: 'error',
      message:
        'El motivo de esta revisión debe tener entre 3 y 2000 caracteres.',
    }
  }

  if (
    !validOptionalText(
      distributionNotes,
      10000,
    ) ||
    !validOptionalText(
      economicSummary,
      10000,
    ) ||
    !validOptionalText(
      evidenceReference,
      2000,
    )
  ) {
    return {
      status: 'error',
      message:
        'Revisá los textos ingresados. Los campos opcionales completados deben tener al menos 3 caracteres.',
    }
  }

  try {
    await saveEconomicProfileRevision(
      await getCurrentAccess(),
      {
        sourceType,
        sourceId,
        expectedRevisionNo,

        currencyCode,

        estimatedValue:
          estimatedValue ?? null,

        estimatedCosts:
          estimatedCosts ?? null,

        probabilityPercent:
          probabilityPercent ?? null,

        participantIncomePotential:
          participantIncomePotential ??
          null,

        mp25mContributionPotential:
          mp25mContributionPotential ??
          null,

        distributionNotes,

        agreedValue:
          agreedValue ?? null,

        collectionStatus,

        collectedAmount:
          collectedAmount ?? null,

        finalCosts:
          finalCosts ?? null,

        participantIncomeFinal:
          participantIncomeFinal ??
          null,

        mp25mContributionFinal:
          mp25mContributionFinal ??
          null,

        finalResultAmount:
          finalResultAmount ?? null,

        economicSummary,
        evidenceReference,
        rationale,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Economic profile save failed:',
      error,
    )

    if (
      error instanceof
        EconomicProfileWriteError &&
      error.code === '40001'
    ) {
      return {
        status: 'conflict',
        message:
          'La ficha económica cambió mientras la estabas editando. Recargá la página antes de volver a guardar.',
      }
    }

    return {
      status: 'error',
      message:
        'No se pudo guardar la ficha económica. Revisá los datos y tus permisos.',
    }
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      expectedRevisionNo === 0
        ? 'La ficha económica fue registrada.'
        : 'La nueva revisión económica fue guardada.',
  }
}

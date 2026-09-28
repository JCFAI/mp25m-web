'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  getInternalAccess,
} from '../../../lib/auth/internal-access'
import {
  RESULT_TYPES,
  addResultContribution,
  createResult,
  getResult,
  getResultContribution,
  removeResultContribution,
  updateResult,
  updateResultContribution,
  voidResult,
  type ResultSourceType,
  type ResultType,
} from '../../../lib/results/results'
import {
  createClient,
} from '../../../lib/supabase/server'

export type ResultActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/

const RESULT_TYPE_SET =
  new Set<string>(RESULT_TYPES)

const failure = (
  message: string,
): ResultActionState => ({
  status: 'error',
  message,
})

const field = (
  data: FormData,
  name: string,
) =>
  String(
    data.get(name) ?? '',
  ).trim()

function isSourceType(
  value: string,
): value is ResultSourceType {
  return (
    value === 'articulation' ||
    value === 'project'
  )
}

function isResultType(
  value: string,
): value is ResultType {
  return RESULT_TYPE_SET.has(value)
}

function validText(
  value: string,
  maxLength = 10000,
) {
  return (
    value.length >= 3 &&
    value.length <= maxLength
  )
}

function validOptionalEvidence(
  value: string | null,
) {
  return (
    value === null ||
    validText(value, 2000)
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

function validateSource(
  sourceType: string,
  sourceId: string,
): sourceType is ResultSourceType {
  return (
    isSourceType(sourceType) &&
    UUID_PATTERN.test(sourceId)
  )
}

function revalidateSource(
  sourceType: ResultSourceType,
  sourceId: string,
) {
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

async function assertResultBelongsToSource(
  resultId: string,
  sourceType: ResultSourceType,
  sourceId: string,
) {
  const result =
    await getResult(resultId)

  if (
    !result ||
    result.source_type !== sourceType ||
    result.source_id !== sourceId
  ) {
    throw new Error(
      'Result does not belong to source',
    )
  }

  return result
}

async function assertContributionBelongsToSource(
  contributionId: string,
  sourceType: ResultSourceType,
  sourceId: string,
) {
  const contribution =
    await getResultContribution(
      contributionId,
    )

  if (!contribution) {
    throw new Error(
      'Result contribution not found',
    )
  }

  await assertResultBelongsToSource(
    contribution.result_id,
    sourceType,
    sourceId,
  )

  return contribution
}

export async function createResultAction(
  sourceType: ResultSourceType,
  sourceId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    )
  ) {
    return failure(
      'El origen del resultado no es válido.',
    )
  }

  const resultType =
    field(
      data,
      'result_type',
    )

  const title =
    field(
      data,
      'title',
    )

  const description =
    field(
      data,
      'description',
    )

  const resultDate =
    field(
      data,
      'result_date',
    )

  const evidenceReference =
    field(
      data,
      'evidence_reference',
    ) || null

  if (
    !isResultType(resultType) ||
    !validText(title, 200) ||
    !validText(description) ||
    !DATE_PATTERN.test(resultDate) ||
    !validOptionalEvidence(
      evidenceReference,
    )
  ) {
    return failure(
      'Completá el tipo, título, descripción y fecha del resultado. La evidencia es opcional.',
    )
  }

  try {
    await createResult(
      await getCurrentAccess(),
      {
        sourceType,
        sourceId,
        resultType,
        title,
        description,
        resultDate,
        evidenceReference,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result creation failed:',
      error,
    )

    return failure(
      'No se pudo registrar el resultado. Revisá los datos y tus permisos.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'El resultado fue registrado.',
  }
}

export async function updateResultAction(
  sourceType: ResultSourceType,
  sourceId: string,
  resultId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    ) ||
    !UUID_PATTERN.test(resultId)
  ) {
    return failure(
      'El resultado no es válido.',
    )
  }

  const resultType =
    field(
      data,
      'result_type',
    )

  const title =
    field(
      data,
      'title',
    )

  const description =
    field(
      data,
      'description',
    )

  const resultDate =
    field(
      data,
      'result_date',
    )

  const evidenceReference =
    field(
      data,
      'evidence_reference',
    ) || null

  const rationale =
    field(
      data,
      'rationale',
    )

  if (
    !isResultType(resultType) ||
    !validText(title, 200) ||
    !validText(description) ||
    !DATE_PATTERN.test(resultDate) ||
    !validOptionalEvidence(
      evidenceReference,
    ) ||
    !validText(rationale)
  ) {
    return failure(
      'Revisá los datos del resultado e indicá el motivo de la corrección.',
    )
  }

  try {
    const access =
      await getCurrentAccess()

    await assertResultBelongsToSource(
      resultId,
      sourceType,
      sourceId,
    )

    await updateResult(
      access,
      {
        resultId,
        resultType,
        title,
        description,
        resultDate,
        evidenceReference,
        rationale,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result update failed:',
      error,
    )

    return failure(
      'No se pudo corregir el resultado. Puede estar anulado o no tenés permiso para modificarlo.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'El resultado fue corregido.',
  }
}

export async function voidResultAction(
  sourceType: ResultSourceType,
  sourceId: string,
  resultId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    ) ||
    !UUID_PATTERN.test(resultId)
  ) {
    return failure(
      'El resultado no es válido.',
    )
  }

  const rationale =
    field(
      data,
      'rationale',
    )

  if (!validText(rationale)) {
    return failure(
      'Indicá el motivo de la anulación.',
    )
  }

  try {
    const access =
      await getCurrentAccess()

    await assertResultBelongsToSource(
      resultId,
      sourceType,
      sourceId,
    )

    await voidResult(
      access,
      {
        resultId,
        rationale,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result void failed:',
      error,
    )

    return failure(
      'No se pudo anular el resultado.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'El resultado fue anulado y conserva su trazabilidad.',
  }
}

export async function addResultContributionAction(
  sourceType: ResultSourceType,
  sourceId: string,
  resultId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    ) ||
    !UUID_PATTERN.test(resultId)
  ) {
    return failure(
      'El resultado no es válido.',
    )
  }

  const actor =
    field(
      data,
      'actor',
    )

  const [
    actorType,
    actorId,
    extra,
  ] = actor.split(':')

  const contributionSummary =
    field(
      data,
      'contribution_summary',
    )

  const evidenceReference =
    field(
      data,
      'evidence_reference',
    ) || null

  if (
    ![
      'person',
      'organization',
    ].includes(actorType) ||
    !UUID_PATTERN.test(actorId ?? '') ||
    extra !== undefined ||
    !validText(
      contributionSummary,
    ) ||
    !validOptionalEvidence(
      evidenceReference,
    )
  ) {
    return failure(
      'Elegí una persona u organización y describí su contribución.',
    )
  }

  try {
    const access =
      await getCurrentAccess()

    await assertResultBelongsToSource(
      resultId,
      sourceType,
      sourceId,
    )

    await addResultContribution(
      access,
      {
        resultId,

        personId:
          actorType === 'person'
            ? actorId
            : null,

        organizationId:
          actorType === 'organization'
            ? actorId
            : null,

        contributionSummary,
        evidenceReference,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result contribution creation failed:',
      error,
    )

    return failure(
      'No se pudo registrar la contribución. Puede que ese actor ya tenga una contribución activa.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'La contribución fue registrada.',
  }
}

export async function updateResultContributionAction(
  sourceType: ResultSourceType,
  sourceId: string,
  contributionId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    ) ||
    !UUID_PATTERN.test(
      contributionId,
    )
  ) {
    return failure(
      'La contribución no es válida.',
    )
  }

  const contributionSummary =
    field(
      data,
      'contribution_summary',
    )

  const evidenceReference =
    field(
      data,
      'evidence_reference',
    ) || null

  const rationale =
    field(
      data,
      'rationale',
    )

  if (
    !validText(
      contributionSummary,
    ) ||
    !validOptionalEvidence(
      evidenceReference,
    ) ||
    !validText(rationale)
  ) {
    return failure(
      'Revisá la contribución e indicá el motivo de la corrección.',
    )
  }

  try {
    const access =
      await getCurrentAccess()

    await assertContributionBelongsToSource(
      contributionId,
      sourceType,
      sourceId,
    )

    await updateResultContribution(
      access,
      {
        contributionId,
        contributionSummary,
        evidenceReference,
        rationale,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result contribution update failed:',
      error,
    )

    return failure(
      'No se pudo corregir la contribución.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'La contribución fue corregida.',
  }
}

export async function removeResultContributionAction(
  sourceType: ResultSourceType,
  sourceId: string,
  contributionId: string,
  _state: ResultActionState,
  data: FormData,
): Promise<ResultActionState> {
  if (
    !validateSource(
      sourceType,
      sourceId,
    ) ||
    !UUID_PATTERN.test(
      contributionId,
    )
  ) {
    return failure(
      'La contribución no es válida.',
    )
  }

  const rationale =
    field(
      data,
      'rationale',
    )

  if (!validText(rationale)) {
    return failure(
      'Indicá el motivo del retiro.',
    )
  }

  try {
    const access =
      await getCurrentAccess()

    await assertContributionBelongsToSource(
      contributionId,
      sourceType,
      sourceId,
    )

    await removeResultContribution(
      access,
      {
        contributionId,
        rationale,
      },
    )
  } catch (error) {
    console.error(
      '[MP25M] Result contribution removal failed:',
      error,
    )

    return failure(
      'No se pudo retirar la contribución.',
    )
  }

  revalidateSource(
    sourceType,
    sourceId,
  )

  return {
    status: 'success',
    message:
      'La contribución fue retirada y queda conservada en el historial.',
  }
}

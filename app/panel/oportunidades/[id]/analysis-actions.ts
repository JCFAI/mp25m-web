'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  getInternalAccess,
  type InternalAccess,
} from '../../../../lib/auth/internal-access'
import {
  assessOpportunityRequirementMatch,
  evaluateOpportunityRequirementCoverage,
  OpportunityAnalysisRpcError,
  type MatchAssessmentKind,
  type RequirementCoverageStatus,
} from '../../../../lib/opportunities/analysis'
import { createClient } from '../../../../lib/supabase/server'

export type AnalysisActionState = {
  status: 'idle' | 'success' | 'error'
  message: string | null
}

const assessmentKinds = new Set<MatchAssessmentKind>([
  'satisfies',
  'partially_satisfies',
  'does_not_satisfy',
  'insufficient_evidence',
])

const coverageStatuses = new Set<RequirementCoverageStatus>([
  'covered',
  'partial',
  'missing',
])

async function resolveCurrentAccess(): Promise<InternalAccess[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const authUserId = data?.claims?.sub

  if (error || !authUserId) redirect('/login')

  const access = await getInternalAccess(authUserId)
  if (access.length === 0) redirect('/sin-acceso')
  return access
}

function requiredRationale(formData: FormData) {
  const rationale = String(formData.get('rationale') ?? '').trim()
  if (rationale.length < 3 || rationale.length > 10000) {
    throw new Error('El fundamento debe tener entre 3 y 10.000 caracteres.')
  }
  return rationale
}

function uniqueTextValues(formData: FormData, name: string) {
  const values = formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean)

  return [...new Set(values)]
}

function analysisErrorMessage(error: unknown, fallback: string) {
  if (error instanceof OpportunityAnalysisRpcError) {
    if (
      error.code === '40001' ||
      error.message.includes('changed; reload')
    ) {
      if (error.message.includes('coverage')) {
        return 'La cobertura cambió desde que abriste el formulario. Recargá la información antes de volver a evaluar.'
      }

      return 'La evaluación cambió desde que abriste el formulario. Recargá la información antes de volver a evaluar.'
    }

    if (error.code === '42501') {
      return 'Tu acceso actual no permite realizar esta evaluación.'
    }

    const translated: Array<[string, string]> = [
      ['Substantive match assessments require at least one frozen foundation', 'Seleccioná al menos un fundamento de este match.'],
      ['Every selected foundation must belong to the assessed match', 'Todos los fundamentos seleccionados deben pertenecer a este match.'],
      ['Unresolved candidates may only be assessed as insufficient_evidence', 'Un actor pendiente sólo puede evaluarse como evidencia insuficiente.'],
      ['Only accepted_for_analysis matches may be assessed', 'Sólo los matches aceptados para análisis pueden evaluarse.'],
      ['Historical opportunity requirement matches cannot be newly assessed', 'Los matches de revisiones históricas son sólo de lectura.'],
      ['Only validated current opportunity requirement matches may be assessed', 'Sólo pueden evaluarse matches de la revisión actual validada.'],
      ['Covered requires at least one current match assessment', 'Cubierto requiere al menos una evaluación vigente.'],
      ['Covered requires a satisfies assessment or at least two partially_satisfies assessments', 'Cubierto requiere una evaluación “Satisface” o al menos dos “Satisface parcialmente”.'],
      ['Partial coverage requires at least one current match assessment', 'Parcial requiere al menos una evaluación vigente.'],
      ['Partial coverage cannot use a satisfies assessment', 'Parcial no puede incluir una evaluación “Satisface”.'],
      ['Partial coverage requires at least one partially_satisfies assessment', 'Parcial requiere al menos una evaluación “Satisface parcialmente”.'],
      ['Missing coverage cannot use satisfies or partially_satisfies assessments', 'Faltante sólo puede apoyarse en evaluaciones “No satisface”.'],
      ['Insufficient evidence cannot support a missing coverage conclusion', 'Evidencia insuficiente no demuestra que el requerimiento esté faltante.'],
      ['Coverage may only use current assessments from accepted matches of this exact requirement revision', 'La cobertura sólo puede usar evaluaciones vigentes de matches aceptados de esta revisión.'],
      ['Historical opportunity requirement revisions cannot receive new coverage evaluations', 'Las revisiones históricas son sólo de lectura.'],
      ['Only validated current opportunity requirement revisions may receive coverage evaluations', 'Sólo la revisión actual validada puede recibir evaluaciones de cobertura.'],
      ['Withdrawn opportunity requirements cannot receive new coverage evaluations', 'Los requerimientos retirados son sólo de lectura.'],
    ]

    const match = translated.find(([source]) => error.message.includes(source))
    return match?.[1] ?? fallback
  }

  if (
    error instanceof Error &&
    (
      error.message.startsWith('El ') ||
      error.message.startsWith('Elegí ') ||
      error.message.startsWith('Seleccioná ')
    )
  ) {
    return error.message
  }

  return fallback
}

export async function assessOpportunityRequirementMatchAction(
  opportunityId: string,
  matchId: string,
  expectedAssessmentNo: number | null,
  _previousState: AnalysisActionState,
  formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()

  try {
    const assessmentKind = String(formData.get('assessment_kind') ?? '') as MatchAssessmentKind
    if (!assessmentKinds.has(assessmentKind)) {
      throw new Error('Elegí una conclusión para el match.')
    }

    const rationale = requiredRationale(formData)
    const foundationIds = uniqueTextValues(formData, 'foundation_ids')

    if (assessmentKind !== 'insufficient_evidence' && foundationIds.length === 0) {
      throw new Error('Seleccioná al menos un fundamento de este match.')
    }

    await assessOpportunityRequirementMatch(access, {
      matchId,
      expectedAssessmentNo,
      assessmentKind,
      rationale,
      foundationIds,
    })
  } catch (error) {
    console.error('[MP25M] Match assessment failed:', error)
    return {
      status: 'error',
      message: analysisErrorMessage(error, 'No se pudo guardar la evaluación. No se modificó ningún dato.'),
    }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return {
    status: 'success',
    message: expectedAssessmentNo === null
      ? 'La evaluación fue registrada correctamente.'
      : 'La reevaluación fue registrada correctamente.',
  }
}

export async function evaluateOpportunityRequirementCoverageAction(
  opportunityId: string,
  requirementRevisionId: string,
  expectedEvaluationNo: number | null,
  _previousState: AnalysisActionState,
  formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()

  try {
    const coverageStatus = String(formData.get('coverage_status') ?? '') as RequirementCoverageStatus
    if (!coverageStatuses.has(coverageStatus)) {
      throw new Error('Elegí un estado de cobertura.')
    }

    await evaluateOpportunityRequirementCoverage(access, {
      requirementRevisionId,
      expectedEvaluationNo,
      coverageStatus,
      rationale: requiredRationale(formData),
      matchAssessmentIds: uniqueTextValues(formData, 'match_assessment_ids'),
    })
  } catch (error) {
    console.error('[MP25M] Requirement coverage evaluation failed:', error)
    return {
      status: 'error',
      message: analysisErrorMessage(error, 'No se pudo guardar la cobertura. No se modificó ningún dato.'),
    }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return {
    status: 'success',
    message: expectedEvaluationNo === null
      ? 'La cobertura fue registrada correctamente.'
      : 'La reevaluación de cobertura fue registrada correctamente.',
  }
}

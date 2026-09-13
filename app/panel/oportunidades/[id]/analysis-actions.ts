'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  getInternalAccess,
  type InternalAccess,
} from '../../../../lib/auth/internal-access'
import {
  assessOpportunityRequirementMatch,
  addOpportunityRequirementMatchFoundation,
  createOpportunityCoverageSnapshot,
  createOpportunityGapAction,
  evaluateOpportunityRequirementCoverage,
  openOpportunityGap,
  transitionOpportunityGap,
  transitionOpportunityGapAction as transitionOpportunityGapActionRecord,
  OpportunityAnalysisRpcError,
  type FoundationRelationKind,
  type MatchAssessmentKind,
  type RequirementCoverageStatus,
  type OpportunityGapType,
  type OpportunityGapStatus,
  type OpportunityGapActionType,
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

const opportunityGapTypes = new Set<OpportunityGapType>([
  'capacity', 'scale', 'availability', 'resource_equipment',
  'certification_authorization', 'knowledge', 'articulation',
  'financing', 'logistics', 'deadline', 'other',
])

const opportunityGapStatuses = new Set<OpportunityGapStatus>([
  'open', 'in_treatment', 'blocked', 'resolved', 'closed_unresolved', 'cancelled',
])
const opportunityGapActionTypes = new Set<OpportunityGapActionType>(['search_mp25m', 'search_argentina', 'search_international', 'contact_actor', 'request_information', 'request_quote', 'verify_capacity', 'verify_availability', 'verify_certification', 'call_for_participants', 'develop_capacity', 'acquire_equipment', 'seek_financing', 'coordinate_meeting', 'reanalyze_requirement', 'other'])

const foundationRelationKinds = new Set<FoundationRelationKind>([
  'direct',
  'related',
  'contextual',
])

const foundationSourceRecordTypes = new Set([
  'person_skill',
  'person_skill_evidence',
  'person_profile',
  'organization_capability',
  'organization_capability_evidence',
  'organization_activity',
  'actor_evidence_fragment',
  'node_participation',
  'organization_node',
  'actor_candidate',
  'actor_candidate_node',
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
      return 'Tu acceso actual no permite realizar esta operación de análisis.'
    }

    const translated: Array<[string, string]> = [
      ['Substantive match assessments require at least one frozen foundation', 'Seleccioná al menos un fundamento de este match.'],
      ['Every selected foundation must belong to the assessed match', 'Todos los fundamentos seleccionados deben pertenecer a este match.'],
      ['Unresolved candidates may only be assessed as insufficient_evidence', 'Un actor pendiente sólo puede evaluarse como evidencia insuficiente.'],
      ['This evidence is already a foundation of the match', 'Esta evidencia ya fue agregada como fundamento del match.'],
      ['Direct added evidence requires exact canonical skill or activity equality', 'La relación directa requiere una coincidencia canónica exacta con la habilidad o actividad requerida.'],
      ['Unresolved candidate added evidence may only be contextual', 'Un candidato no resuelto sólo admite evidencia contextual.'],
      ['Resolved or inactive actor candidates cannot receive new foundations', 'Este candidato ya no está operativo para agregar evidencia.'],
      ['Evidence is not a current searchable record of the matched actor', 'La evidencia seleccionada ya no está disponible para este actor. Recargá la búsqueda.'],
      ['Only accepted_for_analysis matches may receive added evidence', 'Sólo los matches aceptados para análisis pueden recibir evidencia adicional.'],
      ['Historical or withdrawn opportunity requirement matches are read-only', 'Los matches de revisiones históricas o retiradas son sólo de lectura.'],
      ['Only validated current requirement matches may receive added evidence', 'Sólo los matches de la revisión actual validada pueden recibir evidencia adicional.'],
      ['Internal user cannot add opportunity requirement match foundations', 'Tu acceso actual no permite agregar fundamentos a este match.'],
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
      ['Internal user cannot create this opportunity coverage snapshot', 'Tu acceso actual no permite crear un snapshot de cobertura.'],
      ['Opportunity gaps require a current partial or missing coverage conclusion', 'Sólo podés abrir una brecha cuando la cobertura actual sea parcial o faltante.'],
      ['Only validated current opportunity requirement revisions may open gaps', 'Sólo podés abrir brechas sobre la revisión actual validada del requerimiento.'],
      ['Internal user cannot open this opportunity gap', 'Tu acceso actual no permite abrir esta brecha.'],
      ['Internal user cannot update this opportunity gap', 'Tu acceso actual no permite actualizar esta brecha.'],
      ['Resolving or closing an opportunity gap requires a responsible user', 'Para resolver o cerrar una brecha tenés que indicar un responsable.'],
      ['Internal user cannot create this opportunity gap action', 'Tu acceso actual no permite registrar acciones para esta brecha.'],
      ['Internal user cannot update this opportunity gap action', 'Tu acceso actual no permite actualizar esta acción.'],
      ['Opportunity gap action not found', 'La acción ya no está disponible. Recargá la página.'],
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

export async function addOpportunityRequirementMatchFoundationAction(
  opportunityId: string,
  matchId: string,
  _previousState: AnalysisActionState,
  formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()

  try {
    const sourceRecordType = String(formData.get('source_record_type') ?? '').trim()
    const sourceRecordId = String(formData.get('source_record_id') ?? '').trim()
    const relationKind = String(formData.get('relation_kind') ?? '') as FoundationRelationKind

    if (!foundationSourceRecordTypes.has(sourceRecordType)) {
      throw new Error('Seleccioná una evidencia válida del resultado de búsqueda.')
    }

    if (!sourceRecordId || sourceRecordId.length > 500) {
      throw new Error('Seleccioná una evidencia válida del resultado de búsqueda.')
    }

    if (!foundationRelationKinds.has(relationKind)) {
      throw new Error('Elegí cómo se relaciona la evidencia con el requerimiento.')
    }

    await addOpportunityRequirementMatchFoundation(access, {
      matchId,
      sourceRecordType,
      sourceRecordId,
      relationKind,
    })
  } catch (error) {
    console.error('[MP25M] Match foundation add failed:', error)
    return {
      status: 'error',
      message: analysisErrorMessage(error, 'No se pudo agregar el fundamento. No se modificó ningún dato.'),
    }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return {
    status: 'success',
    message: 'La evidencia fue agregada como fundamento del match.',
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
    const networkCoverageStatus = String(
      formData.get('network_coverage_status') ?? ''
    ) as RequirementCoverageStatus
    const expandedCoverageStatus = String(
      formData.get('expanded_coverage_status') ?? ''
    ) as RequirementCoverageStatus
    if (
      !coverageStatuses.has(networkCoverageStatus) ||
      !coverageStatuses.has(expandedCoverageStatus)
    ) {
      throw new Error('Elegí ambos estados de cobertura.')
    }

    const coverageValue = {
      missing: 0,
      partial: 1,
      covered: 2,
    } satisfies Record<RequirementCoverageStatus, number>

    if (coverageValue[expandedCoverageStatus] < coverageValue[networkCoverageStatus]) {
      throw new Error('La cobertura ampliada no puede ser menor que la cobertura de la red MP25M.')
    }

    await evaluateOpportunityRequirementCoverage(access, {
      requirementRevisionId,
      expectedEvaluationNo,
      networkCoverageStatus,
      expandedCoverageStatus,
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

export async function createOpportunityCoverageSnapshotAction(
  opportunityId: string,
  _previousState: AnalysisActionState,
  _formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()

  try {
    await createOpportunityCoverageSnapshot(access, opportunityId)
  } catch (error) {
    console.error('[MP25M] Opportunity coverage snapshot failed:', error)
    return {
      status: 'error',
      message: analysisErrorMessage(error, 'No se pudo crear el snapshot. No se modificó ningún dato.'),
    }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return {
    status: 'success',
    message: 'El snapshot de cobertura fue creado correctamente.',
  }
}

export async function openOpportunityGapAction(
  opportunityId: string,
  _previousState: AnalysisActionState,
  formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()
  try {
    const requirementRevisionId = String(formData.get('requirement_revision_id') ?? '').trim()
    const coverageLayer = String(formData.get('coverage_layer') ?? '')
    const gapType = String(formData.get('gap_type') ?? '') as OpportunityGapType
    if (!requirementRevisionId) throw new Error('Elegí el requerimiento afectado.')
    if (coverageLayer !== 'network_mp25m' && coverageLayer !== 'expanded_argentina') throw new Error('Elegí la capa de cobertura.')
    if (!opportunityGapTypes.has(gapType)) throw new Error('Elegí el tipo de brecha.')
    await openOpportunityGap(access, {
      requirementRevisionId,
      coverageLayer,
      gapType,
      rationale: requiredRationale(formData),
      responsibleInternalUserId: String(formData.get('responsible_internal_user_id') ?? '').trim() || null,
    })
  } catch (error) {
    console.error('[MP25M] Opportunity gap open failed:', error)
    return { status: 'error', message: analysisErrorMessage(error, 'No se pudo abrir la brecha. No se modificó ningún dato.') }
  }
  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La brecha fue abierta correctamente.' }
}

export async function transitionOpportunityGapAction(
  opportunityId: string,
  gapId: string,
  _previousState: AnalysisActionState,
  formData: FormData
): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()

  try {
    const status = String(formData.get('status') ?? '') as OpportunityGapStatus
    const responsibleInternalUserId = String(formData.get('responsible_internal_user_id') ?? '').trim() || null
    if (!opportunityGapStatuses.has(status)) throw new Error('Elegí un estado válido para la brecha.')
    if ((status === 'resolved' || status === 'closed_unresolved') && !responsibleInternalUserId) {
      throw new Error('Para resolver o cerrar una brecha tenés que indicar un responsable.')
    }

    await transitionOpportunityGap(access, {
      gapId,
      status,
      rationale: requiredRationale(formData),
      responsibleInternalUserId,
    })
  } catch (error) {
    console.error('[MP25M] Opportunity gap transition failed:', error)
    return { status: 'error', message: analysisErrorMessage(error, 'No se pudo actualizar la brecha. No se modificó ningún dato.') }
  }

  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La brecha fue actualizada correctamente.' }
}

export async function createOpportunityGapActionAction(opportunityId: string, gapId: string, _previousState: AnalysisActionState, formData: FormData): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()
  try {
    const actionType = String(formData.get('action_type') ?? '') as OpportunityGapActionType
    if (!opportunityGapActionTypes.has(actionType)) throw new Error('Elegí una acción válida.')
    await createOpportunityGapAction(access, { gapId, actionType, rationale: requiredRationale(formData), responsibleInternalUserId: String(formData.get('responsible_internal_user_id') ?? '').trim() || null })
  } catch (error) {
    console.error('[MP25M] Opportunity gap action create failed:', error)
    return { status: 'error', message: analysisErrorMessage(error, 'No se pudo crear la acción. No se modificó ningún dato.') }
  }
  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La acción fue registrada como planificada.' }
}

export async function transitionOpportunityGapActionAction(opportunityId: string, actionId: string, _previousState: AnalysisActionState, formData: FormData): Promise<AnalysisActionState> {
  const access = await resolveCurrentAccess()
  try {
    const status = String(formData.get('status') ?? '')
    if (!['planned', 'in_progress', 'completed', 'cancelled'].includes(status)) throw new Error('Elegí un estado válido para la acción.')
    await transitionOpportunityGapActionRecord(access, { actionId, status: status as 'planned' | 'in_progress' | 'completed' | 'cancelled', rationale: requiredRationale(formData), responsibleInternalUserId: String(formData.get('responsible_internal_user_id') ?? '').trim() || null })
  } catch (error) {
    console.error('[MP25M] Opportunity gap action transition failed:', error)
    return { status: 'error', message: analysisErrorMessage(error, 'No se pudo actualizar la acción. No se modificó ningún dato.') }
  }
  revalidatePath(`/panel/oportunidades/${opportunityId}`)
  return { status: 'success', message: 'La acción fue actualizada correctamente.' }
}

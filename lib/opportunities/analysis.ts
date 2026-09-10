import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import {
  canFormulateOpportunityRequirement,
  type OpportunityRequirementPermissionContext,
} from './requirements'

export type MatchStatus =
  | 'suggested'
  | 'accepted_for_analysis'
  | 'discarded'

export type MatchActorKind =
  | 'person'
  | 'organization'
  | 'candidate'

export type MatchAssessmentKind =
  | 'satisfies'
  | 'partially_satisfies'
  | 'does_not_satisfy'
  | 'insufficient_evidence'

export type RequirementCoverageStatus =
  | 'covered'
  | 'partial'
  | 'missing'

export const matchAssessmentLabels: Record<MatchAssessmentKind, string> = {
  satisfies: 'Satisface',
  partially_satisfies: 'Satisface parcialmente',
  does_not_satisfy: 'No satisface',
  insufficient_evidence: 'Evidencia insuficiente',
}

export const coverageStatusLabels: Record<RequirementCoverageStatus, string> = {
  covered: 'Cubierto',
  partial: 'Parcial',
  missing: 'Faltante',
}

export const matchActorKindLabels: Record<MatchActorKind, string> = {
  person: 'Persona',
  organization: 'Organización',
  candidate: 'Actor pendiente',
}

export type OpportunityRequirementMatch = {
  match_id: string
  requirement_revision_id: string
  requirement_id: string
  opportunity_id: string
  revision_no: number
  validation_status: string
  requirement_record_status: string
  is_current_revision: boolean
  actor_kind: MatchActorKind
  actor_id: string
  actor_display_name: string
  status: MatchStatus
  origin_kind: string
  foundation_count: number
  last_decision_kind: string | null
  last_decision_reason: string | null
  last_decided_by_internal_user_id: string | null
  last_decided_at: string | null
  created_by_internal_user_id: string
  created_at: string
  updated_at: string
}

export type OpportunityRequirementMatchFoundation = {
  id: string
  match_id: string
  foundation_origin: string
  foundation_kind: string
  relation_kind: string
  observed_text: string
  inference_text: string | null
  verification_status: string | null
  evidence_attributes: Record<string, unknown>
  source_locator: string | null
  source_excerpt: string | null
  source_record_type: string | null
  source_record_id: string | null
  created_at: string
}

export type OpportunityRequirementMatchAssessment = {
  assessment_id: string
  match_id: string
  assessment_no: number
  assessment_kind: MatchAssessmentKind
  rationale: string
  assessed_by_internal_user_id: string
  assessed_by_display_name: string | null
  assessed_at: string
  requirement_revision_id: string
  requirement_id: string
  opportunity_id: string
  revision_no: number
  validation_status: string
  requirement_record_status: string
  is_current_requirement_revision: boolean
  match_status: MatchStatus
  match_origin_kind: string
  actor_kind: MatchActorKind
  actor_id: string
  actor_display_name: string
  is_current_assessment: boolean
  selected_foundation_count: number
}

export type OpportunityRequirementMatchAssessmentFoundation = {
  assessment_id: string
  match_id: string
  foundation_id: string
  assessment_no: number
  assessment_kind: MatchAssessmentKind
  foundation_origin: string
  foundation_kind: string
  relation_kind: string
  observed_text: string
  inference_text: string | null
  verification_status: string | null
  evidence_attributes: Record<string, unknown>
  source_locator: string | null
  source_excerpt: string | null
  source_record_type: string | null
  source_record_id: string | null
  linked_by_display_name: string | null
  linked_at: string
}

export type OpportunityRequirementCoverageEvaluation = {
  coverage_evaluation_id: string
  requirement_revision_id: string
  requirement_id: string
  opportunity_id: string
  revision_no: number
  requirement_name: string
  validation_status: string
  requirement_record_status: string
  is_current_requirement_revision: boolean
  evaluation_no: number
  coverage_status: RequirementCoverageStatus
  rationale: string
  evaluated_by_internal_user_id: string
  evaluated_by_display_name: string | null
  evaluated_at: string
  is_current_coverage_evaluation: boolean
  linked_match_assessment_count: number
}

export type OpportunityRequirementCoverageEvaluationMatch = {
  coverage_evaluation_id: string
  requirement_revision_id: string
  coverage_evaluation_no: number
  coverage_status: RequirementCoverageStatus
  match_assessment_id: string
  match_assessment_no: number
  assessment_kind: MatchAssessmentKind
  match_assessment_rationale: string
  match_id: string
  match_status: MatchStatus
  match_origin_kind: string
  actor_kind: MatchActorKind
  actor_id: string
  actor_display_name: string
  linked_by_display_name: string | null
  linked_at: string
}

export type OpportunityAnalysisCandidateState = {
  id: string
  status: string
  resolved_person_id: string | null
  resolved_organization_id: string | null
}

export type OpportunityAnalysis = {
  matches: OpportunityRequirementMatch[]
  foundations: OpportunityRequirementMatchFoundation[]
  assessments: OpportunityRequirementMatchAssessment[]
  assessmentFoundations: OpportunityRequirementMatchAssessmentFoundation[]
  coverageEvaluations: OpportunityRequirementCoverageEvaluation[]
  coverageEvaluationMatches: OpportunityRequirementCoverageEvaluationMatch[]
  candidateStates: OpportunityAnalysisCandidateState[]
}

const pageSize = 500
const idChunkSize = 100

async function listMatches(opportunityId: string) {
  const supabase = createAdminClient()
  const rows: OpportunityRequirementMatch[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('opportunity_requirement_match_list')
      .select(`
        match_id, requirement_revision_id, requirement_id, opportunity_id,
        revision_no, validation_status, requirement_record_status,
        is_current_revision, actor_kind, actor_id, actor_display_name,
        status, origin_kind, foundation_count, last_decision_kind,
        last_decision_reason, last_decided_by_internal_user_id,
        last_decided_at, created_by_internal_user_id, created_at, updated_at
      `)
      .eq('opportunity_id', opportunityId)
      .order('requirement_revision_id', { ascending: true })
      .order('created_at', { ascending: true })
      .order('match_id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Unable to load opportunity requirement matches: ${error.message}`)
    }

    rows.push(...((data ?? []) as OpportunityRequirementMatch[]))
    if (!data || data.length < pageSize) return rows
  }
}

async function listAssessments(opportunityId: string) {
  const supabase = createAdminClient()
  const rows: OpportunityRequirementMatchAssessment[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('opportunity_requirement_match_assessment_list')
      .select(`
        assessment_id, match_id, assessment_no, assessment_kind, rationale,
        assessed_by_internal_user_id, assessed_by_display_name, assessed_at,
        requirement_revision_id, requirement_id, opportunity_id, revision_no,
        validation_status, requirement_record_status,
        is_current_requirement_revision, match_status, match_origin_kind,
        actor_kind, actor_id, actor_display_name, is_current_assessment,
        selected_foundation_count
      `)
      .eq('opportunity_id', opportunityId)
      .order('match_id', { ascending: true })
      .order('assessment_no', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Unable to load match assessments: ${error.message}`)
    }

    rows.push(...((data ?? []) as OpportunityRequirementMatchAssessment[]))
    if (!data || data.length < pageSize) return rows
  }
}

async function listCoverageEvaluations(opportunityId: string) {
  const supabase = createAdminClient()
  const rows: OpportunityRequirementCoverageEvaluation[] = []

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('opportunity_requirement_coverage_evaluation_list')
      .select(`
        coverage_evaluation_id, requirement_revision_id, requirement_id,
        opportunity_id, revision_no, requirement_name, validation_status,
        requirement_record_status, is_current_requirement_revision,
        evaluation_no, coverage_status, rationale,
        evaluated_by_internal_user_id, evaluated_by_display_name, evaluated_at,
        is_current_coverage_evaluation, linked_match_assessment_count
      `)
      .eq('opportunity_id', opportunityId)
      .order('requirement_revision_id', { ascending: true })
      .order('evaluation_no', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`Unable to load requirement coverage evaluations: ${error.message}`)
    }

    rows.push(...((data ?? []) as OpportunityRequirementCoverageEvaluation[]))
    if (!data || data.length < pageSize) return rows
  }
}

function chunks(values: string[]) {
  const result: string[][] = []
  for (let index = 0; index < values.length; index += idChunkSize) {
    result.push(values.slice(index, index + idChunkSize))
  }
  return result
}

async function listFoundations(matchIds: string[]) {
  if (matchIds.length === 0) return []

  const supabase = createAdminClient()
  const rows: OpportunityRequirementMatchFoundation[] = []

  for (const matchIdChunk of chunks(matchIds)) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('opportunity_requirement_match_foundation_list')
        .select(`
          id, match_id, foundation_origin, foundation_kind, relation_kind,
          observed_text, inference_text, verification_status,
          evidence_attributes, source_locator, source_excerpt,
          source_record_type, source_record_id, created_at
        `)
        .in('match_id', matchIdChunk)
        .order('match_id', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`Unable to load match foundations: ${error.message}`)
      rows.push(...((data ?? []) as OpportunityRequirementMatchFoundation[]))
      if (!data || data.length < pageSize) break
    }
  }

  return rows
}

async function listAssessmentFoundations(assessmentIds: string[]) {
  if (assessmentIds.length === 0) return []

  const supabase = createAdminClient()
  const rows: OpportunityRequirementMatchAssessmentFoundation[] = []

  for (const assessmentIdChunk of chunks(assessmentIds)) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('opportunity_requirement_match_assessment_foundation_list')
        .select(`
          assessment_id, match_id, foundation_id, assessment_no,
          assessment_kind, foundation_origin, foundation_kind, relation_kind,
          observed_text, inference_text, verification_status,
          evidence_attributes, source_locator, source_excerpt,
          source_record_type, source_record_id, linked_by_display_name, linked_at
        `)
        .in('assessment_id', assessmentIdChunk)
        .order('assessment_id', { ascending: true })
        .order('foundation_id', { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`Unable to load assessment foundations: ${error.message}`)
      rows.push(...((data ?? []) as OpportunityRequirementMatchAssessmentFoundation[]))
      if (!data || data.length < pageSize) break
    }
  }

  return rows
}

async function listCoverageEvaluationMatches(coverageEvaluationIds: string[]) {
  if (coverageEvaluationIds.length === 0) return []

  const supabase = createAdminClient()
  const rows: OpportunityRequirementCoverageEvaluationMatch[] = []

  for (const evaluationIdChunk of chunks(coverageEvaluationIds)) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('opportunity_requirement_coverage_evaluation_match_list')
        .select(`
          coverage_evaluation_id, requirement_revision_id,
          coverage_evaluation_no, coverage_status, match_assessment_id,
          match_assessment_no, assessment_kind, match_assessment_rationale,
          match_id, match_status, match_origin_kind, actor_kind, actor_id,
          actor_display_name, linked_by_display_name, linked_at
        `)
        .in('coverage_evaluation_id', evaluationIdChunk)
        .order('coverage_evaluation_id', { ascending: true })
        .order('match_id', { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`Unable to load coverage assessment links: ${error.message}`)
      rows.push(...((data ?? []) as OpportunityRequirementCoverageEvaluationMatch[]))
      if (!data || data.length < pageSize) break
    }
  }

  return rows
}

async function listCandidateStates(candidateIds: string[]) {
  if (candidateIds.length === 0) return []

  const supabase = createAdminClient()
  const rows: OpportunityAnalysisCandidateState[] = []

  for (const candidateIdChunk of chunks(candidateIds)) {
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('actor_candidate_review')
        .select('id, status, resolved_person_id, resolved_organization_id')
        .in('id', candidateIdChunk)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1)

      if (error) throw new Error(`Unable to load candidate match state: ${error.message}`)
      rows.push(...((data ?? []) as OpportunityAnalysisCandidateState[]))
      if (!data || data.length < pageSize) break
    }
  }

  return rows
}

export async function listOpportunityAnalysis(opportunityId: string): Promise<OpportunityAnalysis> {
  const [matches, assessments, coverageEvaluations] = await Promise.all([
    listMatches(opportunityId),
    listAssessments(opportunityId),
    listCoverageEvaluations(opportunityId),
  ])

  const [foundations, assessmentFoundations, coverageEvaluationMatches, candidateStates] =
    await Promise.all([
      listFoundations(matches.map((match) => match.match_id)),
      listAssessmentFoundations(assessments.map((assessment) => assessment.assessment_id)),
      listCoverageEvaluationMatches(
        coverageEvaluations.map((evaluation) => evaluation.coverage_evaluation_id)
      ),
      listCandidateStates(
        matches
          .filter((match) => match.actor_kind === 'candidate')
          .map((match) => match.actor_id)
      ),
    ])

  return {
    matches,
    foundations,
    assessments,
    assessmentFoundations,
    coverageEvaluations,
    coverageEvaluationMatches,
    candidateStates,
  }
}

export function canOperateOpportunityRequirementEvaluation(
  access: InternalAccess[],
  opportunity: OpportunityRequirementPermissionContext
) {
  // The installed 7C helper intentionally mirrors the 7B "decide" authority,
  // which is the same responsible/admin/validator/articulator scope used here.
  return canFormulateOpportunityRequirement(access, opportunity)
}

function getActorInternalUserId(access: InternalAccess[]) {
  const ids = [...new Set(access.map((item) => item.internal_user_id))]
  if (ids.length !== 1) throw new Error('Unable to resolve a unique internal user')
  return ids[0]
}

export class OpportunityAnalysisRpcError extends Error {
  constructor(
    message: string,
    readonly code: string | null
  ) {
    super(message)
  }
}

export async function assessOpportunityRequirementMatch(
  access: InternalAccess[],
  input: {
    matchId: string
    expectedAssessmentNo: number | null
    assessmentKind: MatchAssessmentKind
    rationale: string
    foundationIds: string[]
  }
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('assess_opportunity_requirement_match', {
    p_actor_internal_user_id: getActorInternalUserId(access),
    p_match_id: input.matchId,
    p_expected_assessment_no: input.expectedAssessmentNo,
    p_assessment_kind: input.assessmentKind,
    p_rationale: input.rationale,
    p_foundation_ids: input.foundationIds,
  })

  if (error) throw new OpportunityAnalysisRpcError(error.message, error.code ?? null)
  return data
}

export async function evaluateOpportunityRequirementCoverage(
  access: InternalAccess[],
  input: {
    requirementRevisionId: string
    expectedEvaluationNo: number | null
    coverageStatus: RequirementCoverageStatus
    rationale: string
    matchAssessmentIds: string[]
  }
) {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('evaluate_opportunity_requirement_coverage', {
    p_actor_internal_user_id: getActorInternalUserId(access),
    p_requirement_revision_id: input.requirementRevisionId,
    p_expected_evaluation_no: input.expectedEvaluationNo,
    p_coverage_status: input.coverageStatus,
    p_rationale: input.rationale,
    p_match_assessment_ids: input.matchAssessmentIds,
  })

  if (error) throw new OpportunityAnalysisRpcError(error.message, error.code ?? null)
  return data
}

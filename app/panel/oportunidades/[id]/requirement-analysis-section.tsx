import 'server-only'

import {
  coverageStatusLabels,
  matchActorKindLabels,
  matchAssessmentLabels,
  type OpportunityAnalysis,
  type OpportunityRequirementMatch,
} from '../../../../lib/opportunities/analysis'
import { CoverageEvaluationForm } from './coverage-evaluation-form'
import { MatchAssessmentForm } from './match-assessment-form'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function MatchCard({
  opportunityId,
  match,
  analysis,
  canWrite,
}: {
  opportunityId: string
  match: OpportunityRequirementMatch
  analysis: OpportunityAnalysis
  canWrite: boolean
}) {
  const foundations = analysis.foundations.filter((item) => item.match_id === match.match_id)
  const assessments = analysis.assessments
    .filter((item) => item.match_id === match.match_id)
    .sort((left, right) => right.assessment_no - left.assessment_no)
  const currentAssessment = assessments.find((item) => item.is_current_assessment) ?? null
  const candidateState = match.actor_kind === 'candidate'
    ? analysis.candidateStates.find((item) => item.id === match.actor_id) ?? null
    : null
  const candidateCanBeAssessed = match.actor_kind !== 'candidate' || Boolean(
    candidateState &&
    (candidateState.status === 'pending' || candidateState.status === 'approved') &&
    !candidateState.resolved_person_id &&
    !candidateState.resolved_organization_id
  )
  const matchCanWrite = canWrite && candidateCanBeAssessed

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h5 className="font-semibold text-slate-900">{match.actor_display_name}</h5>
          <p className="mt-1 text-xs text-slate-500">
            {matchActorKindLabels[match.actor_kind]} · Origen: {match.origin_kind}
          </p>
        </div>
        <span className={match.status === 'accepted_for_analysis'
          ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700'
          : match.status === 'discarded'
            ? 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700'
            : 'rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700'}>
          {match.status === 'accepted_for_analysis'
            ? 'Aceptado para análisis'
            : match.status === 'discarded'
              ? 'Descartado del análisis'
              : 'Sugerido, pendiente de decisión'}
        </span>
      </div>

      {match.status === 'discarded' && match.last_decision_reason ? (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-xs italic leading-5 text-slate-600">
          “{match.last_decision_reason}”
        </p>
      ) : null}

      <details className="mt-4 rounded-xl border border-slate-200">
        <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">
          Foundations persistidas ({foundations.length})
        </summary>
        <div className="space-y-2 border-t border-slate-200 p-3">
          {foundations.length === 0 ? (
            <p className="text-xs text-slate-500">No hay foundations persistidas para este match.</p>
          ) : foundations.map((foundation) => (
            <div key={foundation.id} className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">
              <p className="font-semibold text-slate-700">
                {foundation.foundation_kind} · {foundation.relation_kind} · {foundation.foundation_origin}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words">{foundation.observed_text}</p>
              {foundation.inference_text ? (
                <p className="mt-1 whitespace-pre-wrap break-words text-slate-500">
                  Inferencia: {foundation.inference_text}
                </p>
              ) : null}
              {foundation.verification_status ? (
                <p className="mt-1 text-slate-400">Verificación: {foundation.verification_status}</p>
              ) : null}
              {foundation.source_locator || foundation.source_record_type ? (
                <p className="mt-1 break-words text-slate-400">
                  Fuente: {foundation.source_locator ?? foundation.source_record_type}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </details>

      <div className="mt-4 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Evaluación vigente
        </p>
        {currentAssessment ? (
          <>
            <p className="mt-1 text-sm font-semibold text-slate-800">
              {matchAssessmentLabels[currentAssessment.assessment_kind]}
            </p>
            {currentAssessment.assessment_kind === 'insufficient_evidence' ? (
              <p className="mt-1 text-xs leading-5 text-amber-700">
                No hay evidencia suficiente para concluir si satisface el requerimiento.
              </p>
            ) : null}
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {currentAssessment.rationale}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm font-medium text-slate-600">Sin evaluación</p>
        )}
      </div>

      {canWrite && !candidateCanBeAssessed ? (
        <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
          Este candidato ya fue resuelto o dejó de estar operativo. El match es sólo de lectura y debe rematerializarse con la identidad canónica para continuar.
        </p>
      ) : null}

      {matchCanWrite ? (
        <MatchAssessmentForm
          opportunityId={opportunityId}
          matchId={match.match_id}
          actorKind={match.actor_kind}
          expectedAssessmentNo={currentAssessment?.assessment_no ?? null}
          foundations={foundations}
        />
      ) : null}

      {assessments.length > 0 ? (
        <details className="mt-4 rounded-xl border border-slate-200">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">
            Historial de assessments ({assessments.length})
          </summary>
          <div className="border-t border-slate-200">
            {assessments.map((assessment) => {
              const selectedFoundations = analysis.assessmentFoundations.filter(
                (item) => item.assessment_id === assessment.assessment_id
              )

              return (
                <div key={assessment.assessment_id} className="border-b border-slate-100 p-3 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                      Evaluación {assessment.assessment_no} · {matchAssessmentLabels[assessment.assessment_kind]}
                    </span>
                    {assessment.is_current_assessment ? (
                      <span className="rounded-full bg-[#E8F0F8] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A5F]">Vigente</span>
                    ) : null}
                  </div>
                  {assessment.assessment_kind === 'insufficient_evidence' ? (
                    <p className="mt-1 text-xs text-amber-700">
                      No hay evidencia suficiente para concluir si satisface el requerimiento.
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{assessment.rationale}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {assessment.assessed_by_display_name ?? 'Usuario interno'} · {formatDateTime(assessment.assessed_at)}
                  </p>
                  <div className="mt-2 space-y-1">
                    {selectedFoundations.length === 0 ? (
                      <p className="text-xs text-slate-400">Sin foundations seleccionadas.</p>
                    ) : selectedFoundations.map((foundation) => (
                      <p key={foundation.foundation_id} className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                        {foundation.foundation_kind} · {foundation.relation_kind}: {foundation.observed_text}
                      </p>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </details>
      ) : null}
    </article>
  )
}

export function RequirementAnalysisSection({
  opportunityId,
  requirementRevisionId,
  revisionNo,
  analysis,
  canOperate,
  isOperational,
}: {
  opportunityId: string
  requirementRevisionId: string
  revisionNo: number
  analysis: OpportunityAnalysis
  canOperate: boolean
  isOperational: boolean
}) {
  const matches = analysis.matches.filter(
    (match) => match.requirement_revision_id === requirementRevisionId
  )
  const acceptedMatches = matches.filter((match) => match.status === 'accepted_for_analysis')
  const discardedMatches = matches.filter((match) => match.status === 'discarded')
  const otherMatches = matches.filter(
    (match) => match.status !== 'accepted_for_analysis' && match.status !== 'discarded'
  )
  const coverageEvaluations = analysis.coverageEvaluations
    .filter((evaluation) => evaluation.requirement_revision_id === requirementRevisionId)
    .sort((left, right) => right.evaluation_no - left.evaluation_no)
  const currentCoverage = coverageEvaluations.find(
    (evaluation) => evaluation.is_current_coverage_evaluation
  ) ?? null
  const currentAssessments = analysis.assessments.filter(
    (assessment) =>
      assessment.requirement_revision_id === requirementRevisionId &&
      assessment.is_current_assessment &&
      assessment.match_status === 'accepted_for_analysis'
  )
  const canWrite = canOperate && isOperational

  return (
    <section className="mt-5 rounded-2xl border border-[#C8D6E5] bg-[#F8FAFC] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
          Assessment y coverage · revisión {revisionNo}
        </p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Aceptar un match para análisis no afirma satisfacción, disponibilidad, voluntad, asignación ni articulación.
        </p>
        {!canWrite ? (
          <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Esta revisión se muestra en modo sólo lectura por permisos o por su estado operativo.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-900">
          Aceptados para análisis ({acceptedMatches.length})
        </h4>
        {acceptedMatches.length === 0 ? (
          <p className="mt-2 rounded-xl bg-white p-3 text-xs text-slate-500">No hay matches aceptados para esta revisión.</p>
        ) : (
          <div className="mt-2 grid gap-3">
            {acceptedMatches.map((match) => (
              <MatchCard
                key={match.match_id}
                opportunityId={opportunityId}
                match={match}
                analysis={analysis}
                canWrite={canWrite}
              />
            ))}
          </div>
        )}
      </div>

      {discardedMatches.length > 0 ? (
        <details className="mt-4 rounded-xl border border-slate-300 bg-slate-100/70">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">
            Descartados ({discardedMatches.length})
          </summary>
          <div className="grid gap-3 border-t border-slate-200 p-3">
            <p className="text-xs text-slate-500">
              Los matches descartados conservan su historia y no admiten nuevas evaluaciones. La reconsideración todavía no está integrada en esta UI.
            </p>
            {discardedMatches.map((match) => (
              <MatchCard key={match.match_id} opportunityId={opportunityId} match={match} analysis={analysis} canWrite={false} />
            ))}
          </div>
        </details>
      ) : null}

      {otherMatches.length > 0 ? (
        <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60">
          <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-amber-800">
            Sugeridos pendientes de decisión ({otherMatches.length})
          </summary>
          <div className="grid gap-3 border-t border-amber-100 p-3">
            {otherMatches.map((match) => (
              <MatchCard key={match.match_id} opportunityId={opportunityId} match={match} analysis={analysis} canWrite={false} />
            ))}
          </div>
        </details>
      ) : null}

      <section className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-900">Cobertura del requerimiento</h4>
        {currentCoverage ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">
              {coverageStatusLabels[currentCoverage.coverage_status]}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{currentCoverage.rationale}</p>
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-600">
            Sin evaluación de cobertura
          </p>
        )}

        {canWrite ? (
          <CoverageEvaluationForm
            opportunityId={opportunityId}
            requirementRevisionId={requirementRevisionId}
            expectedEvaluationNo={currentCoverage?.evaluation_no ?? null}
            currentAssessments={currentAssessments}
          />
        ) : null}

        {coverageEvaluations.length > 0 ? (
          <details className="mt-4 rounded-xl border border-slate-200">
            <summary className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-slate-700">
              Historial de cobertura ({coverageEvaluations.length})
            </summary>
            <div className="border-t border-slate-200">
              {coverageEvaluations.map((evaluation) => {
                const linkedAssessments = analysis.coverageEvaluationMatches.filter(
                  (item) => item.coverage_evaluation_id === evaluation.coverage_evaluation_id
                )

                return (
                  <div key={evaluation.coverage_evaluation_id} className="border-b border-slate-100 p-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">
                        Evaluación {evaluation.evaluation_no} · {coverageStatusLabels[evaluation.coverage_status]}
                      </span>
                      {evaluation.is_current_coverage_evaluation ? (
                        <span className="rounded-full bg-[#E8F0F8] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A5F]">Vigente</span>
                      ) : null}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">{evaluation.rationale}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {evaluation.evaluated_by_display_name ?? 'Usuario interno'} · {formatDateTime(evaluation.evaluated_at)}
                    </p>
                    <div className="mt-2 space-y-1">
                      {linkedAssessments.length === 0 ? (
                        <p className="text-xs text-slate-400">Se declaró sin assessments vinculados.</p>
                      ) : linkedAssessments.map((link) => (
                        <p key={link.match_assessment_id} className="rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
                          {link.actor_display_name} · assessment {link.match_assessment_no} · {matchAssessmentLabels[link.assessment_kind]}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        ) : null}
      </section>
    </section>
  )
}

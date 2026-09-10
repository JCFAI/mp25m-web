'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  OpportunityRequirementMatchAssessment,
} from '../../../../lib/opportunities/analysis'
import {
  evaluateOpportunityRequirementCoverageAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

const assessmentLabels = {
  satisfies: 'Satisface',
  partially_satisfies: 'Satisface parcialmente',
  does_not_satisfy: 'No satisface',
  insufficient_evidence: 'Evidencia insuficiente',
}

export function CoverageEvaluationForm({
  opportunityId,
  requirementRevisionId,
  expectedEvaluationNo,
  currentAssessments,
}: {
  opportunityId: string
  requirementRevisionId: string
  expectedEvaluationNo: number | null
  currentAssessments: OpportunityRequirementMatchAssessment[]
}) {
  const action = evaluateOpportunityRequirementCoverageAction.bind(
    null,
    opportunityId,
    requirementRevisionId,
    expectedEvaluationNo
  )
  const [state, formAction, pending] = useActionState(action, initialState)
  const [coverageStatus, setCoverageStatus] = useState('')
  const [rationale, setRationale] = useState('')
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>([])
  const [assessmentError, setAssessmentError] = useState<string | null>(null)
  const [messageDismissed, setMessageDismissed] = useState(false)
  const statusRef = useRef<HTMLSelectElement>(null)
  const rationaleRef = useRef<HTMLTextAreaElement>(null)
  const assessmentGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessageDismissed(false)
    if (state.status === 'success') {
      setCoverageStatus('')
      setRationale('')
      setSelectedAssessmentIds([])
      setAssessmentError(null)
    }
  }, [state])

  function clearMessage() {
    setMessageDismissed(true)
  }

  function selectedAssessments() {
    const selected = new Set(selectedAssessmentIds)
    return currentAssessments.filter((assessment) => selected.has(assessment.assessment_id))
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setAssessmentError(null)

        if (!coverageStatus) {
          event.preventDefault()
          statusRef.current?.setCustomValidity('Elegí un estado de cobertura.')
          statusRef.current?.reportValidity()
          statusRef.current?.focus()
          return
        }

        if (rationale.trim().length < 3) {
          event.preventDefault()
          rationaleRef.current?.setCustomValidity(
            rationale.trim().length === 0
              ? 'Escribí el fundamento de la cobertura.'
              : 'El fundamento debe tener al menos 3 caracteres.'
          )
          rationaleRef.current?.reportValidity()
          rationaleRef.current?.focus()
          return
        }

        const selected = selectedAssessments()
        let message: string | null = null

        if (coverageStatus === 'covered') {
          const satisfiesCount = selected.filter((item) => item.assessment_kind === 'satisfies').length
          const partialCount = selected.filter((item) => item.assessment_kind === 'partially_satisfies').length
          if (satisfiesCount === 0 && partialCount < 2) {
            message = 'Cubierto requiere una evaluación “Satisface” o al menos dos “Satisface parcialmente”.'
          }
        } else if (coverageStatus === 'partial') {
          if (selected.some((item) => item.assessment_kind === 'satisfies')) {
            message = 'Parcial no puede incluir una evaluación “Satisface”.'
          } else if (!selected.some((item) => item.assessment_kind === 'partially_satisfies')) {
            message = 'Parcial requiere al menos una evaluación “Satisface parcialmente”.'
          }
        } else if (
          coverageStatus === 'missing' &&
          selected.some((item) => item.assessment_kind !== 'does_not_satisfy')
        ) {
          message = selected.some((item) => item.assessment_kind === 'insufficient_evidence')
            ? 'Evidencia insuficiente no demuestra que el requerimiento esté faltante.'
            : 'Faltante sólo puede apoyarse en evaluaciones “No satisface”.'
        }

        if (message) {
          event.preventDefault()
          setAssessmentError(message)
          assessmentGroupRef.current?.focus()
        }
      }}
      className="mt-4 rounded-xl border border-[#C8D6E5] bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-[#1E3A5F]">
        {expectedEvaluationNo === null ? 'Evaluar cobertura' : 'Reevaluar cobertura'}
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Estado de cobertura
        <select
          ref={statusRef}
          name="coverage_status"
          value={coverageStatus}
          onChange={(event) => {
            event.currentTarget.setCustomValidity('')
            setCoverageStatus(event.target.value)
            setAssessmentError(null)
            clearMessage()
          }}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        >
          <option value="">Elegir estado...</option>
          <option value="covered">Cubierto</option>
          <option value="partial">Parcial</option>
          <option value="missing">Faltante</option>
        </select>
      </label>

      <div className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
        <p><strong>Cubierto:</strong> al menos un “Satisface” o dos “Satisface parcialmente”.</p>
        <p><strong>Parcial:</strong> al menos un “Satisface parcialmente” y ningún “Satisface”.</p>
        <p><strong>Faltante:</strong> puede declararse sin assessments; si se seleccionan, sólo pueden ser “No satisface”.</p>
      </div>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Fundamento
        <textarea
          ref={rationaleRef}
          name="rationale"
          value={rationale}
          rows={3}
          maxLength={10000}
          onChange={(event) => {
            event.currentTarget.setCustomValidity('')
            setRationale(event.target.value)
            clearMessage()
          }}
          className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
          placeholder="Explicá la decisión humana de cobertura..."
        />
      </label>

      <div
        ref={assessmentGroupRef}
        tabIndex={-1}
        className="mt-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2F5D8C]/20"
      >
        <p className="text-sm font-medium text-slate-700">
          Evaluaciones vigentes utilizadas
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          La selección aporta evidencia a tu decisión; la interfaz no calcula la cobertura automáticamente.
        </p>

        {currentAssessments.length === 0 ? (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
            No hay assessments vigentes disponibles. Sólo “Faltante” puede guardarse sin seleccionar assessments.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {currentAssessments.map((assessment) => (
              <label
                key={assessment.assessment_id}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <input
                  type="checkbox"
                  name="match_assessment_ids"
                  value={assessment.assessment_id}
                  checked={selectedAssessmentIds.includes(assessment.assessment_id)}
                  onChange={(event) => {
                    setSelectedAssessmentIds((current) =>
                      event.target.checked
                        ? [...current, assessment.assessment_id]
                        : current.filter((id) => id !== assessment.assessment_id)
                    )
                    setAssessmentError(null)
                    clearMessage()
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2F5D8C]"
                />
                <span className="min-w-0 text-xs leading-5 text-slate-600">
                  <span className="block font-semibold text-slate-700">
                    {assessment.actor_display_name} · {assessmentLabels[assessment.assessment_kind]}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap break-words">
                    {assessment.rationale}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {assessmentError ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {assessmentError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Guardando...' : expectedEvaluationNo === null ? 'Guardar cobertura' : 'Guardar reevaluación'}
      </button>

      {state.message && !messageDismissed ? (
        <p
          role="status"
          className={state.status === 'success'
            ? 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
            : 'mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

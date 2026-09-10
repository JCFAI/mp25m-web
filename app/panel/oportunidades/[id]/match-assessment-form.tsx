'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  MatchActorKind,
  OpportunityRequirementMatchFoundation,
} from '../../../../lib/opportunities/analysis'
import {
  assessOpportunityRequirementMatchAction,
  type AnalysisActionState,
} from './analysis-actions'

const initialState: AnalysisActionState = {
  status: 'idle',
  message: null,
}

export function MatchAssessmentForm({
  opportunityId,
  matchId,
  actorKind,
  expectedAssessmentNo,
  foundations,
}: {
  opportunityId: string
  matchId: string
  actorKind: MatchActorKind
  expectedAssessmentNo: number | null
  foundations: OpportunityRequirementMatchFoundation[]
}) {
  const action = assessOpportunityRequirementMatchAction.bind(
    null,
    opportunityId,
    matchId,
    expectedAssessmentNo
  )
  const [state, formAction, pending] = useActionState(action, initialState)
  const [assessmentKind, setAssessmentKind] = useState('')
  const [rationale, setRationale] = useState('')
  const [selectedFoundationIds, setSelectedFoundationIds] = useState<string[]>([])
  const [foundationError, setFoundationError] = useState<string | null>(null)
  const [messageDismissed, setMessageDismissed] = useState(false)
  const conclusionRef = useRef<HTMLSelectElement>(null)
  const rationaleRef = useRef<HTMLTextAreaElement>(null)
  const foundationGroupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessageDismissed(false)
    if (state.status === 'success') {
      setAssessmentKind('')
      setRationale('')
      setSelectedFoundationIds([])
      setFoundationError(null)
    }
  }, [state])

  function clearMessage() {
    setMessageDismissed(true)
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        setFoundationError(null)

        if (!assessmentKind) {
          event.preventDefault()
          conclusionRef.current?.setCustomValidity('Elegí una conclusión para el match.')
          conclusionRef.current?.reportValidity()
          conclusionRef.current?.focus()
          return
        }

        if (rationale.trim().length < 3) {
          event.preventDefault()
          rationaleRef.current?.setCustomValidity(
            rationale.trim().length === 0
              ? 'Escribí el fundamento de la evaluación.'
              : 'El fundamento debe tener al menos 3 caracteres.'
          )
          rationaleRef.current?.reportValidity()
          rationaleRef.current?.focus()
          return
        }

        if (
          assessmentKind !== 'insufficient_evidence' &&
          selectedFoundationIds.length === 0
        ) {
          event.preventDefault()
          setFoundationError('Seleccioná al menos un fundamento de este match.')
          foundationGroupRef.current?.focus()
        }
      }}
      className="mt-4 rounded-xl border border-[#C8D6E5] bg-slate-50 p-4"
    >
      <p className="text-sm font-semibold text-[#1E3A5F]">
        {expectedAssessmentNo === null ? 'Evaluar match' : 'Reevaluar match'}
      </p>

      {actorKind === 'candidate' ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Un actor pendiente sólo puede evaluarse como evidencia insuficiente mientras no tenga identidad canónica. El servidor verificará su estado actual.
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Conclusión
        <select
          ref={conclusionRef}
          name="assessment_kind"
          value={assessmentKind}
          onChange={(event) => {
            event.currentTarget.setCustomValidity('')
            setAssessmentKind(event.target.value)
            setFoundationError(null)
            clearMessage()
          }}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
        >
          <option value="">Elegir conclusión...</option>
          {actorKind !== 'candidate' ? (
            <>
              <option value="satisfies">Satisface</option>
              <option value="partially_satisfies">Satisface parcialmente</option>
              <option value="does_not_satisfy">No satisface</option>
            </>
          ) : null}
          <option value="insufficient_evidence">Evidencia insuficiente</option>
        </select>
      </label>

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
          placeholder="Explicá la conclusión humana sobre este match..."
        />
      </label>

      <div
        ref={foundationGroupRef}
        tabIndex={-1}
        className="mt-4 rounded-xl outline-none focus:ring-2 focus:ring-[#2F5D8C]/20"
      >
        <p className="text-sm font-medium text-slate-700">
          Fundamentos utilizados
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Las conclusiones sustantivas requieren al menos un fundamento. Para evidencia insuficiente, la selección es opcional.
        </p>

        {foundations.length === 0 ? (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs text-slate-500">
            Este match no tiene foundations persistidas.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {foundations.map((foundation) => (
              <label
                key={foundation.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-3"
              >
                <input
                  type="checkbox"
                  name="foundation_ids"
                  value={foundation.id}
                  checked={selectedFoundationIds.includes(foundation.id)}
                  onChange={(event) => {
                    setSelectedFoundationIds((current) =>
                      event.target.checked
                        ? [...current, foundation.id]
                        : current.filter((id) => id !== foundation.id)
                    )
                    setFoundationError(null)
                    clearMessage()
                  }}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#2F5D8C]"
                />
                <span className="min-w-0 text-xs leading-5 text-slate-600">
                  <span className="block font-semibold text-slate-700">
                    {foundation.foundation_kind} · {foundation.relation_kind}
                  </span>
                  <span className="mt-1 block whitespace-pre-wrap break-words">
                    {foundation.observed_text}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {foundationError ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-700">
            {foundationError}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-xl bg-[#2F5D8C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E3A5F] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Guardando...' : expectedAssessmentNo === null ? 'Guardar evaluación' : 'Guardar reevaluación'}
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

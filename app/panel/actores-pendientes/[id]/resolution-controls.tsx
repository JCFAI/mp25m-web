'use client'

import {
  useActionState,
  useState,
} from 'react'

import {
  resolveActorCandidateAction,
  type ActorCandidateResolutionActionState,
  type ActorCandidateResolutionDecision,
} from './actions'

type Match = {
  person_id: string
  display_name: string
  similarity_score: number
  node_names: string[]
  node_verification_statuses: string[]
}

type ResolutionControlsProps = {
  candidateId: string
  candidateStatus: string
  resolvedPersonId: string | null
  canResolve: boolean
  matches: Match[]
}

function similarityLabel(score: number) {
  if (score >= 0.8) {
    return 'Coincidencia alta'
  }

  if (score >= 0.5) {
    return 'Coincidencia media'
  }

  return 'Coincidencia débil'
}

function verificationLabel(
  value: string | undefined
) {
  switch (value) {
    case 'confirmed':
      return 'Participación confirmada'

    case 'pending':
      return 'Participación pendiente'

    default:
      return 'Participación sin verificar'
  }
}

function resolutionLabel(
  status: string
) {
  switch (status) {
    case 'merged':
      return 'Vinculado a persona existente'

    case 'approved':
      return 'Creado como persona nueva'

    case 'rejected':
      return 'Candidato rechazado'

    default:
      return 'Pendiente de validación'
  }
}

export function ResolutionControls({
  candidateId,
  candidateStatus,
  resolvedPersonId,
  canResolve,
  matches,
}: ResolutionControlsProps) {
  const action =
    resolveActorCandidateAction.bind(
      null,
      candidateId
    )

  const initialState:
    ActorCandidateResolutionActionState = {
      status: 'idle',
      message: null,
      decision: null,
    }

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  const [
    decision,
    setDecision,
  ] =
    useState<
      ActorCandidateResolutionDecision | null
    >(null)

  const [
    selectedPersonId,
    setSelectedPersonId,
  ] =
    useState<string>('')

  const [
    reason,
    setReason,
  ] =
    useState('')

  const strongMatchExists =
    matches.some(
      (match) =>
        match.similarity_score >= 0.9
    )

  const selectedMatch =
    matches.find(
      (match) =>
        match.person_id ===
        selectedPersonId
    )

  const resolvedMatch =
    resolvedPersonId
      ? matches.find(
          (match) =>
            match.person_id ===
            resolvedPersonId
        )
      : undefined

  function chooseDecision(
    nextDecision:
      ActorCandidateResolutionDecision,
    personId = ''
  ) {
    setDecision(nextDecision)
    setSelectedPersonId(personId)
    setReason('')
  }

  function cancelDecision() {
    setDecision(null)
    setSelectedPersonId('')
    setReason('')
  }

  const reasonRequired =
    decision === 'existing' ||
    decision === 'reject' ||
    (
      decision === 'new' &&
      strongMatchExists
    )

  const decisionTitle =
    decision === 'existing'
      ? `Confirmar identidad${
          selectedMatch
            ? `: ${selectedMatch.display_name}`
            : ''
        }`
      : decision === 'new'
        ? 'Crear una persona nueva'
        : decision === 'reject'
          ? 'Rechazar candidato'
          : ''

  const decisionHelp =
    decision === 'existing'
      ? 'La articulación dejará de apuntar al registro provisorio y quedará vinculada con esta persona canónica. Los nodos informados para el candidato no se convertirán en pertenencias confirmadas.'
      : decision === 'new'
        ? strongMatchExists
          ? 'Existe al menos una coincidencia nominal fuerte. Si sabés que se trata de otra persona, explicá por qué antes de crear un nuevo registro canónico.'
          : 'Se creará una nueva persona canónica a partir de los datos informados. Los nodos del candidato conservarán carácter de procedencia y no se confirmarán automáticamente.'
        : decision === 'reject'
          ? 'El candidato dejará de ser un actor de origen de la articulación. La decisión quedará registrada en la auditoría.'
          : ''

  const submitLabel =
    decision === 'existing'
      ? 'Confirmar que es la misma persona'
      : decision === 'new'
        ? 'Crear persona nueva'
        : 'Confirmar rechazo'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Posibles coincidencias
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Estas sugerencias se basan en similitud de nombre.
          No implican que se trate de la misma persona.
        </p>
      </div>

      {candidateStatus !== 'pending' ? (
        <div
          className={
            candidateStatus === 'rejected'
              ? 'mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-900'
              : 'mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900'
          }
        >
          <p className="font-semibold">
            {resolutionLabel(
              candidateStatus
            )}
          </p>

          {resolvedMatch ? (
            <p className="mt-1">
              Persona resultante:{' '}
              <strong>
                {resolvedMatch.display_name}
              </strong>
            </p>
          ) : null}

          <p className="mt-2 leading-6">
            Esta revisión ya fue resuelta y no puede volver a modificarse desde esta pantalla.
          </p>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        {matches.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No se encontraron personas similares.
          </div>
        ) : (
          matches.map(
            (match, index) => {
              const selected =
                decision === 'existing' &&
                selectedPersonId ===
                  match.person_id

              return (
                <article
                  key={match.person_id}
                  className={
                    selected
                      ? 'rounded-2xl border-2 border-[#2F5D8C] bg-[#2F5D8C]/5 p-5'
                      : index === 0
                        ? 'rounded-2xl border border-[#2F5D8C]/30 bg-[#2F5D8C]/5 p-5'
                        : 'rounded-2xl border border-slate-200 bg-white p-5'
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {match.display_name}
                      </h3>

                      <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                        {similarityLabel(
                          match.similarity_score
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {Math.round(
                        match.similarity_score *
                          100
                      )}
                      % similitud
                    </span>
                  </div>

                  {match.node_names.length >
                  0 ? (
                    <div className="mt-4 space-y-2">
                      {match.node_names.map(
                        (
                          nodeName,
                          nodeIndex
                        ) => (
                          <div
                            key={`${match.person_id}-${nodeName}`}
                            className="text-sm text-slate-600"
                          >
                            <span className="font-medium text-slate-800">
                              {nodeName}
                            </span>

                            {' · '}

                            {verificationLabel(
                              match
                                .node_verification_statuses[
                                  nodeIndex
                                ]
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      Sin participación territorial registrada.
                    </p>
                  )}

                  {candidateStatus ===
                    'pending' &&
                  canResolve ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        chooseDecision(
                          'existing',
                          match.person_id
                        )
                      }
                      className="mt-4 rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Es la misma persona
                    </button>
                  ) : null}
                </article>
              )
            }
          )
        )}
      </div>

      {candidateStatus === 'pending' &&
      canResolve ? (
        <>
          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-sm font-semibold text-slate-900">
              ¿No corresponde ninguna coincidencia?
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  chooseDecision('new')
                }
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Es una persona nueva
              </button>

              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  chooseDecision('reject')
                }
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rechazar candidato
              </button>
            </div>
          </div>

          {decision ? (
            <form
              action={formAction}
              className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5"
            >
              <input
                type="hidden"
                name="decision"
                value={decision}
              />

              <input
                type="hidden"
                name="person_id"
                value={
                  selectedPersonId
                }
              />

              <h3 className="font-semibold text-slate-950">
                {decisionTitle}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {decisionHelp}
              </p>

              <label className="mt-4 block text-sm font-semibold text-slate-800">
                Justificación
                {reasonRequired
                  ? ' *'
                  : ''}
              </label>

              <textarea
                name="reason"
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
                required={
                  reasonRequired
                }
                minLength={
                  reasonRequired
                    ? 3
                    : undefined
                }
                maxLength={2000}
                rows={4}
                placeholder={
                  decision ===
                  'existing'
                    ? 'Ej.: confirmé con el referente que ambos registros corresponden a la misma persona.'
                    : decision ===
                        'new'
                      ? 'Si existe una coincidencia fuerte, explicá por qué sabés que se trata de otra persona.'
                      : 'Explicá por qué este registro no corresponde como actor de la articulación.'
                }
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-blue-100"
              />

              {state.status ===
                'error' &&
              state.decision ===
                decision ? (
                <div
                  aria-live="polite"
                  className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                >
                  {state.message}
                </div>
              ) : null}

              {state.status ===
                'success' &&
              state.decision ===
                decision ? (
                <div
                  aria-live="polite"
                  className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800"
                >
                  {state.message}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={
                    cancelDecision
                  }
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={pending}
                  className={
                    decision ===
                    'reject'
                      ? 'rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50'
                      : 'rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-50'
                  }
                >
                  {pending
                    ? 'Guardando...'
                    : submitLabel}
                </button>
              </div>
            </form>
          ) : null}

          {!decision ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Todavía no se realiza ninguna modificación.
              La decisión de identidad será explícita y quedará auditada.
            </div>
          ) : null}
        </>
      ) : null}

      {candidateStatus === 'pending' &&
      !canResolve ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
          Podés consultar esta revisión, pero tu rol no tiene permiso para resolver identidades.
        </div>
      ) : null}
    </section>
  )
}
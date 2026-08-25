'use client'

import {
  useActionState,
  useState,
} from 'react'

import type {
  ActorCandidateTerritorialContext,
  TerritorialRoleOption,
} from '../../../../lib/actors/review'

import {
  addTerritorialRolesAction,
  confirmTerritorialParticipationAction,
  type TerritorialActionState,
} from './actions'

type Props = {
  candidateId: string
  canManage: boolean
  territories: ActorCandidateTerritorialContext[]
  roleOptions: TerritorialRoleOption[]
  opportunityTitles: string[]
}

const initialState: TerritorialActionState = {
  status: 'idle',
  message: null,
}

function verificationLabel(
  value: string | null
) {
  switch (value) {
    case 'confirmed':
      return 'Participación confirmada'

    case 'pending':
      return 'Participación pendiente'

    default:
      return 'Sin verificar'
  }
}

function ConfirmParticipationForm({
  candidateId,
  nodeId,
}: {
  candidateId: string
  nodeId: string
}) {
  const action =
    confirmTerritorialParticipationAction.bind(
      null,
      candidateId,
      nodeId
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  const [open, setOpen] =
    useState(false)

  const [reason, setReason] =
    useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D]"
      >
        Confirmar participación
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-4 rounded-xl border border-amber-200 bg-white p-4"
    >
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
        Esta acción realizará una modificación real:
        confirmará que la persona participa en este nodo.
        No asignará ningún rol automáticamente.
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-800">
        Justificación *
      </label>

      <textarea
        name="reason"
        value={reason}
        onChange={(event) =>
          setReason(
            event.target.value
          )
        }
        required
        minLength={3}
        maxLength={2000}
        rows={3}
        placeholder="Ej.: se confirmó que también participa en este nodo."
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-blue-100"
      />

      {state.message ? (
        <div
          aria-live="polite"
          className={
            state.status === 'error'
              ? 'mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
              : 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            setOpen(false)
          }
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={
            pending ||
            reason.trim().length < 3
          }
          className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? 'Confirmando...'
            : 'Confirmar definitivamente'}
        </button>
      </div>
    </form>
  )
}

function RoleAssignmentForm({
  candidateId,
  participationId,
  existingRoleCodes,
  roleOptions,
}: {
  candidateId: string
  participationId: string
  existingRoleCodes: string[]
  roleOptions: TerritorialRoleOption[]
}) {
  const action =
    addTerritorialRolesAction.bind(
      null,
      candidateId,
      participationId
    )

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialState
  )

  const [open, setOpen] =
    useState(false)

  const [reason, setReason] =
    useState('')

  const availableRoles =
    roleOptions.filter(
      (role) =>
        !existingRoleCodes.includes(
          role.code
        )
    )

  if (availableRoles.length === 0) {
    return null
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 rounded-xl border border-[#2F5D8C]/30 bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-50"
      >
        Agregar roles
      </button>
    )
  }

  return (
    <form
      action={formAction}
      className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="text-sm font-semibold text-slate-900">
        Roles para este nodo
      </p>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        Podés seleccionar uno o varios.
        Los roles corresponden únicamente a esta participación territorial.
      </p>

      <div className="mt-3 space-y-3">
        {availableRoles.map(
          (role) => (
            <label
              key={role.code}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50"
            >
              <input
                type="checkbox"
                name="role_codes"
                value={role.code}
                className="mt-1 h-4 w-4"
              />

              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  {role.name}
                </span>

                {role.description ? (
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {role.description}
                  </span>
                ) : null}
              </span>
            </label>
          )
        )}
      </div>

      <label className="mt-4 block text-sm font-semibold text-slate-800">
        Justificación *
      </label>

      <textarea
        name="reason"
        value={reason}
        onChange={(event) =>
          setReason(
            event.target.value
          )
        }
        required
        minLength={3}
        maxLength={2000}
        rows={3}
        placeholder="Indicá por qué corresponden estos roles en este nodo."
        className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-blue-100"
      />

      {state.message ? (
        <div
          aria-live="polite"
          className={
            state.status === 'error'
              ? 'mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
              : 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            setOpen(false)
          }
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={
            pending ||
            reason.trim().length < 3
          }
          className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending
            ? 'Guardando...'
            : 'Registrar roles'}
        </button>
      </div>
    </form>
  )
}

export function TerritorialControls({
  candidateId,
  canManage,
  territories,
  roleOptions,
  opportunityTitles,
}: Props) {
  const canonical =
    territories.filter(
      (item) =>
        item.has_canonical_participation
    )

  const reportedPending =
    territories.filter(
      (item) =>
        item.reported_by_candidate &&
        !item.has_canonical_participation
    )

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">
          Participaciones territoriales
        </h2>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          La identidad, la participación territorial y los roles se validan por separado.
          Una misma persona puede participar en varios nodos y cumplir distintos roles en cada uno.
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Participaciones registradas
          </h3>

          <div className="mt-3 space-y-3">
            {canonical.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No hay participaciones territoriales registradas para esta persona.
              </div>
            ) : (
              canonical.map(
                (territory) => (
                  <article
                    key={territory.node_id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="font-semibold text-slate-950">
                        {territory.node_name}
                      </h4>

                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {verificationLabel(
                          territory.participation_verification_status
                        )}
                      </span>
                    </div>

                    {territory.role_names.length >
                    0 ? (
                      <div className="mt-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Roles territoriales
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {territory.role_names.map(
                            (
                              roleName,
                              index
                            ) => (
                              <span
                                key={`${territory.node_id}-${territory.role_codes[index] ?? roleName}`}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                              >
                                {roleName}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">
                        Sin rol territorial registrado.
                      </p>
                    )}

                    {territory.reported_by_candidate ? (
                      <p className="mt-3 text-xs text-[#2F5D8C]">
                        Este nodo también fue informado en el registro provisorio.
                      </p>
                    ) : null}

                    {canManage &&
                    territory.participation_id &&
                    territory.participation_verification_status ===
                      'confirmed' ? (
                      <RoleAssignmentForm
                        candidateId={
                          candidateId
                        }
                        participationId={
                          territory.participation_id
                        }
                        existingRoleCodes={
                          territory.role_codes
                        }
                        roleOptions={
                          roleOptions
                        }
                      />
                    ) : null}
                  </article>
                )
              )
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Contexto territorial pendiente de validar
          </h3>

          <div className="mt-3 space-y-3">
            {reportedPending.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No hay otros nodos informados pendientes de validación.
              </div>
            ) : (
              reportedPending.map(
                (territory) => (
                  <article
                    key={territory.node_id}
                    className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h4 className="font-semibold text-slate-950">
                        {territory.node_name}
                      </h4>

                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Pendiente de validar
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-700">
                      Este nodo fue informado como contexto del candidato,
                      pero todavía no constituye una participación territorial
                      confirmada de la persona.
                    </p>

                    {opportunityTitles.length >
                    0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Origen del dato:{' '}
                        {opportunityTitles.join(
                          ', '
                        )}
                      </p>
                    ) : null}

                    {canManage ? (
                      <ConfirmParticipationForm
                        candidateId={
                          candidateId
                        }
                        nodeId={
                          territory.node_id
                        }
                      />
                    ) : null}
                  </article>
                )
              )
            )}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
        Confirmar una participación territorial no asigna automáticamente ningún rol.
        Fundador, Referente, Participante o Contacto se registran explícitamente
        y de forma independiente para cada nodo.
      </div>
    </section>
  )
}
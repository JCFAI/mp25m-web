'use client'

import {
  useActionState,
  useEffect,
  useState,
} from 'react'
import { useRouter } from 'next/navigation'

import {
  resolveOrganizationTypeProposalAction,
  type OrganizationTypeProposalResolutionActionState,
} from './actions'

type OrganizationTypeOption = {
  code: string
  name: string
  display_order: number
}

type OrganizationTypeProposalForResolution = {
  proposed_name: string
  suggested_organization_type_code: string | null
  suggested_organization_type_name: string | null
  suggested_match_kind: string | null
  suggested_similarity: number | null
}

type ResolutionAction =
  | 'mapped'
  | 'approved'
  | 'approved_override'
  | 'rejected'

const initialState: OrganizationTypeProposalResolutionActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}

function fieldClass(hasError: boolean) {
  return hasError
    ? 'mt-2 min-h-12 w-full rounded-xl border border-red-300 bg-red-50/30 px-4 py-3 text-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100'
    : 'mt-2 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10'
}

function FieldError({
  message,
}: {
  message?: string
}) {
  if (!message) {
    return null
  }

  return (
    <p className="mt-2 text-xs font-medium text-red-600">
      {message}
    </p>
  )
}

function matchKindLabel(value: string | null) {
  const labels: Record<string, string> = {
    exact: 'Coincidencia exacta',
    similar: 'Coincidencia similar',
    semantic: 'Coincidencia semántica',
  }

  return value ? labels[value] ?? value : null
}

export function OrganizationTypeProposalResolutionForm({
  organizationId,
  proposalId,
  proposal,
  organizationTypes,
}: {
  organizationId: string
  proposalId: string
  proposal: OrganizationTypeProposalForResolution
  organizationTypes: OrganizationTypeOption[]
}) {
  const router = useRouter()
  const suggestedTypeCode =
    proposal.suggested_organization_type_code ?? ''
  const suggestedTypeName =
    proposal.suggested_organization_type_name
  const hasSuggestedType =
    suggestedTypeCode.length > 0 &&
    Boolean(suggestedTypeName)
  const suggestedMappableTypeCode =
    suggestedTypeCode !== 'other'
      ? suggestedTypeCode
      : ''
  const approvalAction: ResolutionAction =
    hasSuggestedType
      ? 'approved_override'
      : 'approved'

  const [resolutionAction, setResolutionAction] =
    useState<ResolutionAction>('mapped')
  const [
    organizationTypeCode,
    setOrganizationTypeCode,
  ] = useState(suggestedMappableTypeCode)
  const [reason, setReason] = useState('')

  const existingTypes =
    organizationTypes.filter(
      (type) => type.code !== 'other'
    )

  const matchKind =
    matchKindLabel(
      proposal.suggested_match_kind
    )

  const resolutionOptions: Array<{
    value: ResolutionAction
    label: string
  }> = [
    {
      value: 'mapped',
      label:
        hasSuggestedType &&
        suggestedTypeName &&
        suggestedMappableTypeCode
          ? `Usar ${suggestedTypeName}`
          : 'Usar tipo existente',
    },
    {
      value: approvalAction,
      label: hasSuggestedType
        ? `Mantener ${proposal.proposed_name} como nuevo tipo`
        : 'Confirmar como nuevo',
    },
    {
      value: 'rejected',
      label: 'Rechazar propuesta',
    },
  ]

  const [state, formAction, pending] =
    useActionState(
      resolveOrganizationTypeProposalAction.bind(
        null,
        organizationId,
        proposalId
      ),
      initialState
    )

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [router, state.status, state.message])

  useEffect(() => {
    if (suggestedMappableTypeCode) {
      setOrganizationTypeCode(
        suggestedMappableTypeCode
      )
    }
  }, [suggestedMappableTypeCode])

  function selectResolutionAction(
    nextAction: ResolutionAction
  ) {
    setResolutionAction(nextAction)

    if (
      nextAction === 'mapped' &&
      suggestedMappableTypeCode &&
      !organizationTypeCode
    ) {
      setOrganizationTypeCode(
        suggestedMappableTypeCode
      )
    }
  }

  return (
    <form
      action={formAction}
      className="mt-4 border-t border-amber-200 pt-4 sm:mt-5 sm:rounded-2xl sm:border sm:border-amber-200 sm:bg-amber-50/60 sm:p-5"
    >
      <p className="text-sm font-semibold text-slate-950">
        Resolver propuesta de tipo
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Tipo propuesto
          </p>
          <p className="mt-1 break-words font-semibold text-slate-950">
            {proposal.proposed_name}
          </p>
        </div>

        {hasSuggestedType ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Posible tipo existente
            </p>
            <p className="mt-1 break-words font-semibold text-slate-950">
              {suggestedTypeName}
            </p>
            {matchKind ? (
              <p className="mt-1 text-xs text-amber-800">
                {matchKind}
                {typeof proposal.suggested_similarity ===
                'number'
                  ? ` · similitud ${proposal.suggested_similarity.toFixed(2)}`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {hasSuggestedType ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-white/70 px-4 py-3 text-sm leading-6 text-amber-900">
          Se detectó una posible coincidencia. Revisá si
          corresponde usar el tipo existente o mantener
          la propuesta como un tipo diferente.
        </p>
      ) : null}

      {state.status !== 'idle' &&
      state.message ? (
        <div
          role="alert"
          className={
            state.status === 'success'
              ? 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800'
              : 'mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {resolutionOptions.map((option) => (
          <label
            key={option.value}
            className={
              resolutionAction === option.value
                ? 'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#2F5D8C] bg-white px-4 py-3 text-sm font-semibold text-[#1E3A5F]'
                : 'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-[#2F5D8C]/40'
            }
          >
            <input
              type="radio"
              name="resolution_action"
              value={option.value}
              checked={
                resolutionAction ===
                option.value
              }
              onChange={() =>
                selectResolutionAction(
                  option.value
                )
              }
              className="h-4 w-4 shrink-0"
            />
            <span className="min-w-0 break-words">
              {option.label}
            </span>
          </label>
        ))}
      </div>

      <FieldError
        message={
          state.fieldErrors.resolutionAction
        }
      />

      {resolutionAction === 'mapped' ? (
        <label className="mt-4 block sm:max-w-xl">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Tipo canónico existente
          </span>

          <select
            name="resolved_organization_type_code"
            required
            value={organizationTypeCode}
            onChange={(event) =>
              setOrganizationTypeCode(
                event.target.value
              )
            }
            className={fieldClass(
              Boolean(
                state.fieldErrors
                  .organizationTypeCode
              )
            )}
            aria-invalid={Boolean(
              state.fieldErrors
                .organizationTypeCode
            )}
          >
            <option value="" disabled>
              Seleccionar tipo
            </option>

            {existingTypes.map((type) => (
              <option
                key={type.code}
                value={type.code}
              >
                {type.name}
              </option>
            ))}
          </select>

          <FieldError
            message={
              state.fieldErrors
                .organizationTypeCode
            }
          />
        </label>
      ) : null}

      {resolutionAction === 'approved' ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          Se creará un tipo canónico nuevo solo si no
          existe una coincidencia fuerte en el catálogo.
        </p>
      ) : null}

      {resolutionAction === 'approved_override' ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          Se creará un tipo canónico nuevo aunque exista
          la coincidencia sugerida. La justificación
          quedará auditada como decisión explícita.
        </p>
      ) : null}

      {resolutionAction === 'rejected' ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
          La organización conservará el tipo canónico
          Otra organización.
        </p>
      ) : null}

      <label className="mt-4 block">
        <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
          Justificación
        </span>

        <textarea
          name="reason"
          required
          minLength={3}
          maxLength={2000}
          rows={3}
          value={reason}
          onChange={(event) =>
            setReason(event.target.value)
          }
          className={`${fieldClass(
            Boolean(state.fieldErrors.reason)
          )} resize-y leading-6`}
          aria-invalid={Boolean(
            state.fieldErrors.reason
          )}
          placeholder="Motivo breve de la resolución."
        />

        <FieldError
          message={state.fieldErrors.reason}
        />
      </label>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {pending
            ? 'Resolviendo...'
            : 'Resolver propuesta'}
        </button>
      </div>
    </form>
  )
}

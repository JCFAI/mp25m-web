'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  createOpportunityRequirementAction,
  reviseOpportunityRequirementAction,
  type RequirementActionState,
} from './requirement-actions'

type RequirementType =
  | 'skill_knowledge'
  | 'productive_capacity'
  | 'activity_service'
  | 'resource_equipment'
  | 'certification_authorization'
  | 'scale_volume'
  | 'location_territory'
  | 'availability_deadline'
  | 'language'
  | 'logistics'
  | 'financial'
  | 'administrative_legal'
  | 'institutional_access'
  | 'other'

type ProvenanceKind =
  | 'human_entry'
  | 'source_explicit'
  | 'human_inference'

type CanonicalSearchResult = {
  id: string
  display_name: string
  description: string | null
}

export type RequirementFormInitialValues = {
  name: string
  description: string
  requirementType: RequirementType
  isMandatory: boolean
  weight: number
  satisfactionCriteria: string
  provenanceKind: ProvenanceKind
  sourceLocator: string
  sourceExcerpt: string
  skillId: string | null
  skillName: string | null
  activityId: string | null
  activityName: string | null
}

const requirementTypeLabels:
Record<RequirementType, string> = {
  skill_knowledge:
    'Habilidad / conocimiento',
  productive_capacity:
    'Capacidad productiva',
  activity_service:
    'Actividad / servicio',
  resource_equipment:
    'Recurso / equipamiento',
  certification_authorization:
    'Certificación / habilitación',
  scale_volume:
    'Escala / volumen',
  location_territory:
    'Ubicación / territorio',
  availability_deadline:
    'Disponibilidad / plazo',
  language:
    'Idioma',
  logistics:
    'Logística',
  financial:
    'Financiero',
  administrative_legal:
    'Administrativo / legal',
  institutional_access:
    'Acceso institucional',
  other:
    'Otro',
}

const provenanceLabels:
Record<ProvenanceKind, string> = {
  human_entry:
    'Carga humana',
  source_explicit:
    'Explícito en una fuente',
  human_inference:
    'Inferencia humana',
}

const initialActionState:
RequirementActionState = {
  status: 'idle',
  message: null,
}

const emptyInitialValues:
RequirementFormInitialValues = {
  name: '',
  description: '',
  requirementType: 'other',
  isMandatory: false,
  weight: 1,
  satisfactionCriteria: '',
  provenanceKind: 'human_entry',
  sourceLocator: '',
  sourceExcerpt: '',
  skillId: null,
  skillName: null,
  activityId: null,
  activityName: null,
}

function supportsSkillReference(
  type: RequirementType
) {
  return (
    type === 'skill_knowledge' ||
    type === 'productive_capacity'
  )
}

function supportsActivityReference(
  type: RequirementType
) {
  return type === 'activity_service'
}

export function OpportunityRequirementForm({
  opportunityId,
  mode,
  requirementId,
  expectedRevisionId,
  initialValues = emptyInitialValues,
}: {
  opportunityId: string
  mode: 'create' | 'revise'
  requirementId?: string
  expectedRevisionId?: string
  initialValues?: RequirementFormInitialValues
}) {
  const formRef =
    useRef<HTMLFormElement>(null)

  const [requirementType, setRequirementType] =
    useState<RequirementType>(
      initialValues.requirementType
    )

  const [canonicalQuery, setCanonicalQuery] =
    useState('')

  const [canonicalResults, setCanonicalResults] =
    useState<CanonicalSearchResult[]>([])

  const [canonicalLoading, setCanonicalLoading] =
    useState(false)

  const [
    canonicalError,
    setCanonicalError,
  ] = useState<string | null>(null)

  const [
    selectedCanonical,
    setSelectedCanonical,
  ] = useState<CanonicalSearchResult | null>(
    initialValues.skillId &&
    initialValues.skillName
      ? {
          id: initialValues.skillId,
          display_name:
            initialValues.skillName,
          description: null,
        }
      : initialValues.activityId &&
          initialValues.activityName
        ? {
            id: initialValues.activityId,
            display_name:
              initialValues.activityName,
            description: null,
          }
        : null
  )

  const createAction =
    createOpportunityRequirementAction.bind(
      null,
      opportunityId
    )

  const reviseAction =
    requirementId &&
    expectedRevisionId
      ? reviseOpportunityRequirementAction.bind(
          null,
          opportunityId,
          requirementId,
          expectedRevisionId
        )
      : null

  const action =
    mode === 'revise'
      ? reviseAction
      : createAction

  if (!action) {
    throw new Error(
      'Missing requirement revision context'
    )
  }

  const [
    state,
    formAction,
    pending,
  ] = useActionState(
    action,
    initialActionState
  )

  const canSearchCanonical =
    supportsSkillReference(
      requirementType
    ) ||
    supportsActivityReference(
      requirementType
    )

  useEffect(() => {
    const term =
      canonicalQuery.trim()

    setCanonicalResults([])
    setCanonicalError(null)

    if (
      !canSearchCanonical ||
      term.length < 2
    ) {
      setCanonicalLoading(false)
      return
    }

    const controller =
      new AbortController()

    setCanonicalLoading(true)

    const timeout =
      window.setTimeout(
        async () => {
          try {
            const params =
              new URLSearchParams()

            params.set('q', term)

            let endpoint:
              string

            if (
              supportsActivityReference(
                requirementType
              )
            ) {
              endpoint =
                `/api/panel/actividades?${params.toString()}`
            } else {
              params.set(
                'application',
                'all'
              )

              endpoint =
                `/api/panel/habilidades?${params.toString()}`
            }

            const response =
              await fetch(
                endpoint,
                {
                  signal:
                    controller.signal,
                  cache: 'no-store',
                }
              )

            if (!response.ok) {
              throw new Error(
                'Search failed'
              )
            }

            const data =
              await response.json() as
                CanonicalSearchResult[]

            if (
              !controller.signal.aborted
            ) {
              setCanonicalResults(
                data
              )
            }
          } catch (error) {
            if (
              error instanceof DOMException &&
              error.name ===
                'AbortError'
            ) {
              return
            }

            if (
              !controller.signal.aborted
            ) {
              setCanonicalResults([])
              setCanonicalError(
                'No se pudo completar la búsqueda.'
              )
            }
          } finally {
            if (
              !controller.signal.aborted
            ) {
              setCanonicalLoading(
                false
              )
            }
          }
        },
        250
      )

    return () => {
      window.clearTimeout(
        timeout
      )

      controller.abort()
    }
  }, [
    canonicalQuery,
    requirementType,
    canSearchCanonical,
  ])

  useEffect(() => {
    if (
      mode === 'create' &&
      state.status === 'success'
    ) {
      formRef.current?.reset()

      setRequirementType(
        'other'
      )

      setSelectedCanonical(
        null
      )

      setCanonicalQuery('')
      setCanonicalResults([])
      setCanonicalError(null)
    }
  }, [
    mode,
    state.status,
  ])

  function handleTypeChange(
    value: string
  ) {
    const nextType =
      value as RequirementType

    setRequirementType(
      nextType
    )

    setCanonicalQuery('')
    setCanonicalResults([])
    setCanonicalError(null)
    setSelectedCanonical(null)
  }

  const canonicalLabel =
    supportsActivityReference(
      requirementType
    )
      ? 'Actividad canónica'
      : 'Habilidad / capacidad canónica'

  const canonicalPlaceholder =
    supportsActivityReference(
      requirementType
    )
      ? 'Ej.: reciclado, logística...'
      : 'Ej.: soldadura, programación...'

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
          {mode === 'create'
            ? 'Nuevo requerimiento'
            : 'Nueva revisión'}
        </p>

        <h3 className="mt-2 text-lg font-semibold text-slate-950">
          {mode === 'create'
            ? 'Registrar condición de la oportunidad'
            : 'Revisar formulación'}
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          El requerimiento describe qué se necesita.
          No asigna automáticamente quién lo cumple.
        </p>
      </div>

      {state.message ? (
        <div
          className={
            state.status === 'success'
              ? 'mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800'
              : 'mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800'
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Nombre
          </span>

          <input
            name="name"
            required
            minLength={3}
            maxLength={300}
            defaultValue={
              initialValues.name
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Ej.: capacidad para producir 10.000 unidades por mes"
          />
        </label>

        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Descripción
          </span>

          <textarea
            name="description"
            rows={3}
            maxLength={10000}
            defaultValue={
              initialValues.description
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Explicá brevemente qué condición debe cumplirse."
          />
        </label>

        <label>
          <span className="text-sm font-semibold text-slate-700">
            Tipo
          </span>

          <select
            name="requirement_type"
            value={requirementType}
            onChange={(event) =>
              handleTypeChange(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C]"
          >
            {(
              Object.keys(
                requirementTypeLabels
              ) as RequirementType[]
            ).map((type) => (
              <option
                key={type}
                value={type}
              >
                {
                  requirementTypeLabels[
                    type
                  ]
                }
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="text-sm font-semibold text-slate-700">
            Importancia
          </span>

          <select
            name="weight"
            defaultValue={
              String(
                initialValues.weight
              )
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C]"
          >
            {[1, 2, 3, 4, 5].map(
              (weight) => (
                <option
                  key={weight}
                  value={weight}
                >
                  {weight} de 5
                </option>
              )
            )}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2">
          <input
            type="checkbox"
            name="is_mandatory"
            defaultChecked={
              initialValues.isMandatory
            }
            className="h-4 w-4 rounded border-slate-300"
          />

          <span>
            <span className="block text-sm font-semibold text-slate-700">
              Requerimiento obligatorio
            </span>

            <span className="mt-0.5 block text-xs text-slate-500">
              Marcá esta opción si la oportunidad no puede abordarse sin cumplir esta condición.
            </span>
          </span>
        </label>

        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Criterio de satisfacción
          </span>

          <textarea
            name="satisfaction_criteria"
            rows={3}
            maxLength={10000}
            defaultValue={
              initialValues.satisfactionCriteria
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="¿Cómo sabremos que esta condición está suficientemente cumplida?"
          />

          <span className="mt-1 block text-xs text-slate-500">
            Puede completarse después, pero será obligatorio antes de enviar a validación.
          </span>
        </label>

        {canSearchCanonical ? (
          <div className="sm:col-span-2">
            <p className="text-sm font-semibold text-slate-700">
              {canonicalLabel}
              <span className="ml-1 font-normal text-slate-400">
                (opcional)
              </span>
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Vinculá una referencia canónica sólo si representa realmente este requerimiento.
            </p>

            {selectedCanonical ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-sky-900">
                    {
                      selectedCanonical.display_name
                    }
                  </p>

                  <p className="mt-0.5 text-xs text-sky-700">
                    Referencia seleccionada
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCanonical(
                      null
                    )
                    setCanonicalQuery('')
                    setCanonicalResults([])
                  }}
                  className="rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition hover:bg-sky-100"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={canonicalQuery}
                  onChange={(event) =>
                    setCanonicalQuery(
                      event.target.value
                    )
                  }
                  autoComplete="off"
                  placeholder={
                    canonicalPlaceholder
                  }
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
                />

                {canonicalQuery.trim().length > 0 &&
                canonicalQuery.trim().length < 2 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Escribí al menos 2 caracteres.
                  </p>
                ) : null}

                {canonicalLoading ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Buscando...
                  </p>
                ) : null}

                {canonicalError ? (
                  <p className="mt-2 text-sm text-red-700">
                    {canonicalError}
                  </p>
                ) : null}

                {canonicalResults.length > 0 ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {canonicalResults.map(
                      (item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setSelectedCanonical(
                              item
                            )
                            setCanonicalQuery('')
                            setCanonicalResults([])
                            setCanonicalError(null)
                          }}
                          className="block w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                        >
                          <span className="block text-sm font-semibold text-slate-800">
                            {
                              item.display_name
                            }
                          </span>

                          {item.description ? (
                            <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">
                              {
                                item.description
                              }
                            </span>
                          ) : null}
                        </button>
                      )
                    )}
                  </div>
                ) : null}
              </>
            )}

            <input
              type="hidden"
              name="skill_id"
              value={
                supportsSkillReference(
                  requirementType
                )
                  ? selectedCanonical?.id ??
                    ''
                  : ''
              }
            />

            <input
              type="hidden"
              name="activity_id"
              value={
                supportsActivityReference(
                  requirementType
                )
                  ? selectedCanonical?.id ??
                    ''
                  : ''
              }
            />
          </div>
        ) : (
          <>
            <input
              type="hidden"
              name="skill_id"
              value=""
            />

            <input
              type="hidden"
              name="activity_id"
              value=""
            />
          </>
        )}

        <label>
          <span className="text-sm font-semibold text-slate-700">
            Origen de la formulación
          </span>

          <select
            name="provenance_kind"
            defaultValue={
              initialValues.provenanceKind
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C]"
          >
            {(
              Object.keys(
                provenanceLabels
              ) as ProvenanceKind[]
            ).map((kind) => (
              <option
                key={kind}
                value={kind}
              >
                {
                  provenanceLabels[
                    kind
                  ]
                }
              </option>
            ))}
          </select>
        </label>

        <div className="hidden sm:block" />

        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Referencia de la fuente
            <span className="ml-1 font-normal text-slate-400">
              (opcional)
            </span>
          </span>

          <input
            name="source_locator"
            maxLength={2000}
            defaultValue={
              initialValues.sourceLocator
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Ej.: pliego, correo, reunión, sección del documento..."
          />
        </label>

        <label className="sm:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Fragmento / evidencia de origen
            <span className="ml-1 font-normal text-slate-400">
              (opcional)
            </span>
          </span>

          <textarea
            name="source_excerpt"
            rows={3}
            maxLength={10000}
            defaultValue={
              initialValues.sourceExcerpt
            }
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
            placeholder="Texto o síntesis que respalda la formulación."
          />
        </label>

        {mode === 'revise' ? (
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Motivo de la nueva revisión
            </span>

            <textarea
              name="reason"
              required
              minLength={3}
              maxLength={2000}
              rows={2}
              onInvalid={(event) => {
                const field =
                  event.currentTarget

                if (
                  field.validity.valueMissing
                ) {
                  field.setCustomValidity(
                    'Ingresá el motivo de la nueva revisión.'
                  )
                  return
                }

                if (
                  field.validity.tooShort
                ) {
                  field.setCustomValidity(
                    'El motivo debe tener al menos 3 caracteres.'
                  )
                }
              }}
              onInput={(event) => {
                event.currentTarget.setCustomValidity(
                  ''
                )
              }}
              className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              placeholder="Explicá por qué cambia la formulación."
            />
          </label>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-5 rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? 'Guardando...'
          : mode === 'create'
            ? 'Crear requerimiento'
            : 'Crear nueva revisión'}
      </button>
    </form>
  )
}
'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
} from 'react'

import type {
  AgendaEntryType,
  AgendaMeetingMode,
  AgendaMeetingProvider,
  AgendaSourceType,
  AgendaUserOption,
} from '../../../lib/agenda/agenda'
import {
  createAgendaEntryAction,
  type AgendaActionState,
} from './actions'

type AgendaOriginOption = {
  id: string
  label: string
  status: string
  detail?: string
}

const initialState:
AgendaActionState = {
  status: 'idle',
  message: null,
}

const inputClass =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm'

const entryTypeLabels:
Record<AgendaEntryType, string> = {
  meeting: 'Reunión',
  visit: 'Visita',
  training: 'Capacitación',
  demonstration: 'Demostración',
  call: 'Llamada',
  follow_up: 'Seguimiento',
  deadline: 'Vencimiento',
  other: 'Otro',
}

const originLabels:
Record<AgendaSourceType, string> = {
  opportunity: 'Oportunidad',
  articulation: 'Articulación',
  project: 'Proyecto',
  theme: 'Tema',
  need_offer: 'Necesidad / oferta',
}

const meetingModeLabels:
Record<AgendaMeetingMode, string> = {
  in_person: 'Presencial',
  virtual: 'Virtual',
  hybrid: 'Híbrida',
}

const providerLabels:
Record<AgendaMeetingProvider, string> = {
  google_meet: 'Google Meet',
  jitsi: 'Jitsi',
  other: 'Otro',
}

export function AgendaCreateForm({
  users,
  onCreated,
}: {
  users: AgendaUserOption[]
  onCreated: () => void
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    createAgendaEntryAction,
    initialState
  )

  const detailsRef =
    useRef<HTMLDetailsElement | null>(
      null
    )

  const [
    entryType,
    setEntryType,
  ] =
    useState<AgendaEntryType>(
      'meeting'
    )

  const [
    meetingMode,
    setMeetingMode,
  ] =
    useState<AgendaMeetingMode | ''>(
      ''
    )

  const [
    originType,
    setOriginType,
  ] =
    useState<AgendaSourceType | ''>(
      ''
    )

  const [
    originQuery,
    setOriginQuery,
  ] =
    useState('')

  const [
    originId,
    setOriginId,
  ] =
    useState('')

  const [
    originOptions,
    setOriginOptions,
  ] =
    useState<AgendaOriginOption[]>(
      []
    )

  const [
    originLoading,
    setOriginLoading,
  ] =
    useState(false)

  const [
    originError,
    setOriginError,
  ] =
    useState<string | null>(
      null
    )

  const [
    editedSinceResult,
    setEditedSinceResult,
  ] =
    useState(false)

  useEffect(() => {
    if (!originType) {
      return
    }

    const controller =
      new AbortController()

    const timeout =
      window.setTimeout(
        async () => {
          try {
            setOriginLoading(true)
            setOriginError(null)

            const params =
              new URLSearchParams({
                type: originType,
                q: originQuery,
              })

            const response =
              await fetch(
                `/api/panel/agenda/origins?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                  cache:
                    'no-store',
                }
              )

            if (!response.ok) {
              throw new Error(
                'Origin lookup failed'
              )
            }

            const payload =
              await response.json() as {
                items:
                  AgendaOriginOption[]
              }

            if (
              controller.signal.aborted
            ) {
              return
            }

            setOriginOptions(
              payload.items
            )
          } catch {
            if (
              !controller.signal.aborted
            ) {
              setOriginOptions([])
              setOriginError(
                'No se pudieron cargar las entidades.'
              )
            }
          } finally {
            if (
              !controller.signal.aborted
            ) {
              setOriginLoading(false)
            }
          }
        },
        originQuery ? 250 : 0
      )

    return () => {
      window.clearTimeout(
        timeout
      )
      controller.abort()
    }
  }, [
    originQuery,
    originType,
  ])

  useEffect(() => {
    if (
      state.status ===
      'success'
    ) {
      if (detailsRef.current) {
        detailsRef.current.open =
          false
      }

      onCreated()

      window.requestAnimationFrame(
        () => {
          document
            .getElementById(
              'agenda-directory'
            )
            ?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
        }
      )
    }
  }, [
    onCreated,
    state,
  ])

  const virtualMeeting =
    entryType === 'meeting' &&
    (
      meetingMode ===
        'virtual' ||
      meetingMode ===
        'hybrid'
    )

  function changeOriginType(
    value:
      AgendaSourceType | ''
  ) {
    setOriginType(value)
    setOriginQuery('')
    setOriginId('')
    setOriginOptions([])
    setOriginError(null)
  }

  return (
    <details
      ref={detailsRef}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-[#1E3A5F]">
        + Registrar actividad
      </summary>

      <form
        action={action}
        onChange={() => {
          if (state.message) {
            setEditedSinceResult(true)
          }
        }}
        onSubmit={() => {
          setEditedSinceResult(false)
        }}
        className="border-t border-slate-200 p-5 sm:p-6"
      >
        <p className="text-sm leading-6 text-slate-600">
          Registrá una actividad operativa.
          Puede quedar independiente o
          vinculada a una única entidad
          existente. El vínculo no crea
          relaciones adicionales.
        </p>

        <input
          type="hidden"
          name="time_zone"
          value="America/Argentina/Buenos_Aires"
        />

        <input
          type="hidden"
          name="opportunity_id"
          value={
            originType ===
            'opportunity'
              ? originId
              : ''
          }
        />

        <input
          type="hidden"
          name="articulation_id"
          value={
            originType ===
            'articulation'
              ? originId
              : ''
          }
        />

        <input
          type="hidden"
          name="project_id"
          value={
            originType ===
            'project'
              ? originId
              : ''
          }
        />

        <input
          type="hidden"
          name="theme_id"
          value={
            originType ===
            'theme'
              ? originId
              : ''
          }
        />

        <input
          type="hidden"
          name="need_offer_id"
          value={
            originType ===
            'need_offer'
              ? originId
              : ''
          }
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Tipo
            <select
              name="entry_type"
              value={entryType}
              onChange={(event) => {
                const value =
                  event.target.value as
                    AgendaEntryType

                setEntryType(value)

                if (
                  value !==
                  'meeting'
                ) {
                  setMeetingMode('')
                }
              }}
              className={inputClass}
            >
              {Object.entries(
                entryTypeLabels
              ).map(
                ([value, label]) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Responsable
            <select
              name="responsible_internal_user_id"
              defaultValue=""
              className={inputClass}
            >
              <option value="">
                Sin responsable
              </option>

              {users.map(
                (user) => (
                  <option
                    key={user.id}
                    value={user.id}
                  >
                    {
                      user.display_name
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Título
            <input
              name="title"
              required
              minLength={3}
              maxLength={200}
              placeholder="Ej.: Reunión con cooperativa..."
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Detalle
            <textarea
              name="detail"
              required
              minLength={3}
              maxLength={10000}
              rows={3}
              placeholder="Objetivo, contexto o información necesaria..."
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Fecha
            <input
              name="scheduled_date"
              type="date"
              required
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Hora
            <input
              name="scheduled_time"
              type="time"
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Lugar
            <input
              name="location_text"
              maxLength={2000}
              placeholder="Opcional: dirección, sede o referencia..."
              className={inputClass}
            />
          </label>

          {entryType ===
          'meeting' ? (
            <label className="text-sm font-semibold text-slate-700">
              Modalidad
              <select
                name="meeting_mode"
                value={meetingMode}
                onChange={(event) =>
                  setMeetingMode(
                    event.target
                      .value as
                      AgendaMeetingMode |
                      ''
                  )
                }
                className={inputClass}
              >
                <option value="">
                  Sin especificar
                </option>

                {Object.entries(
                  meetingModeLabels
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : null}

          {virtualMeeting ? (
            <>
              <label className="text-sm font-semibold text-slate-700">
                Plataforma
                <select
                  name="meeting_provider"
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="">
                    Sin especificar
                  </option>

                  {Object.entries(
                    providerLabels
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Enlace de reunión
                <input
                  name="meeting_url"
                  type="url"
                  maxLength={2000}
                  placeholder="https://..."
                  className={inputClass}
                />

                <span className="mt-1 block text-xs font-normal text-slate-500">
                  En 12A se registra un
                  enlace existente; no se
                  crea automáticamente una
                  sala.
                </span>
              </label>
            </>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Entidad de origen
          </h3>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Es opcional y sólo puede
            elegirse una. No genera otros
            vínculos ni dependencias.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Tipo de origen
              <select
                value={originType}
                onChange={(event) =>
                  changeOriginType(
                    event.target
                      .value as
                      AgendaSourceType |
                      ''
                  )
                }
                className={inputClass}
              >
                <option value="">
                  Sin entidad de origen
                </option>

                {Object.entries(
                  originLabels
                ).map(
                  ([
                    value,
                    label,
                  ]) => (
                    <option
                      key={value}
                      value={value}
                    >
                      {label}
                    </option>
                  )
                )}
              </select>
            </label>

            {originType ? (
              <label className="text-sm font-semibold text-slate-700">
                Buscar
                <input
                  value={originQuery}
                  onChange={(event) => {
                    setOriginQuery(
                      event.target.value
                    )
                    setOriginId('')
                  }}
                  placeholder="Escribí parte del nombre..."
                  className={inputClass}
                />
              </label>
            ) : null}

            {originType ? (
              <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                Entidad
                <select
                  value={originId}
                  required
                  disabled={
                    originLoading
                  }
                  onChange={(event) =>
                    setOriginId(
                      event.target.value
                    )
                  }
                  className={inputClass}
                >
                  <option value="">
                    {originLoading
                      ? 'Cargando...'
                      : 'Elegir entidad...'}
                  </option>

                  {originOptions.map(
                    (option) => (
                      <option
                        key={option.id}
                        value={option.id}
                      >
                        {option.detail
                          ? `${option.detail} · `
                          : ''}
                        {option.label}
                        {' · '}
                        {option.status}
                      </option>
                    )
                  )}
                </select>
              </label>
            ) : null}
          </div>

          {originError ? (
            <p className="mt-2 text-sm text-red-700">
              {originError}
            </p>
          ) : null}
        </div>

        {state.message &&
        !pending &&
        !editedSinceResult ? (
          <p
            role="status"
            className={`mt-4 text-sm ${
              state.status ===
              'error'
                ? 'text-red-700'
                : 'text-emerald-700'
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <button
          disabled={pending}
          className="ux-button mt-5 rounded-xl bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? 'Registrando...'
            : 'Registrar actividad'}
        </button>
      </form>
    </details>
  )
}

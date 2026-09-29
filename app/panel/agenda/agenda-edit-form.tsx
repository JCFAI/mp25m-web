'use client'

import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from 'react'

import type {
  AgendaEntryType,
  AgendaItem,
  AgendaMeetingMode,
  AgendaMeetingProvider,
  AgendaSourceType,
  AgendaUserOption,
} from '../../../lib/agenda/agenda'
import {
  updateAgendaEntryAction,
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

export function AgendaEditForm({
  item,
  agendaEntryId,
  users,
  onChanged,
}: {
  item: AgendaItem
  agendaEntryId: string
  users: AgendaUserOption[]
  onChanged: () => void
}) {
  const [
    state,
    action,
    pending,
  ] = useActionState(
    updateAgendaEntryAction.bind(
      null,
      agendaEntryId
    ),
    initialState
  )

  const [
    entryType,
    setEntryType,
  ] =
    useState<AgendaEntryType>(
      item.entry_type ?? 'other'
    )

  const [
    meetingMode,
    setMeetingMode,
  ] =
    useState<AgendaMeetingMode | ''>(
      item.meeting_mode ?? ''
    )

  const [
    originType,
    setOriginType,
  ] =
    useState<AgendaSourceType | ''>(
      item.source_type ?? ''
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
    useState(
      item.source_id ?? ''
    )

  const currentOriginOption =
    useMemo<AgendaOriginOption | null>(
      () =>
        item.source_type &&
        item.source_id
          ? {
              id: item.source_id,
              label:
                item.source_title ??
                'Entidad actual',
              status: 'Actual',
            }
          : null,
      [
        item.source_id,
        item.source_title,
        item.source_type,
      ]
    )

  const [
    originOptions,
    setOriginOptions,
  ] =
    useState<AgendaOriginOption[]>(
      currentOriginOption
        ? [currentOriginOption]
        : []
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

            let options =
              payload.items

            if (
              !originQuery &&
              currentOriginOption &&
              originType ===
                item.source_type &&
              !options.some(
                (option) =>
                  option.id ===
                  currentOriginOption.id
              )
            ) {
              options = [
                currentOriginOption,
                ...options,
              ]
            }

            setOriginOptions(
              options
            )
          } catch {
            if (
              !controller.signal.aborted
            ) {
              setOriginOptions(
                currentOriginOption &&
                !originQuery &&
                originType ===
                  item.source_type
                  ? [currentOriginOption]
                  : []
              )

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
    currentOriginOption,
    item.source_type,
    originQuery,
    originType,
  ])

  useEffect(() => {
    if (
      state.status ===
      'success'
    ) {
      onChanged()
    }
  }, [
    onChanged,
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
    <details className="mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">
        Editar actividad
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
        className="border-t border-slate-200 p-4"
      >
        <p className="text-sm leading-6 text-slate-600">
          Corregí los datos operativos de
          esta actividad. Los cambios no
          crean relaciones adicionales y
          requieren un fundamento.
        </p>

        <input
          type="hidden"
          name="time_zone"
          value={
            item.time_zone ||
            'America/Argentina/Buenos_Aires'
          }
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

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              defaultValue={
                item.responsible_internal_user_id ??
                ''
              }
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
              defaultValue={
                item.title
              }
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
              defaultValue={
                item.detail
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Fecha
            <input
              name="scheduled_date"
              type="date"
              required
              defaultValue={
                item.scheduled_date
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Hora
            <input
              name="scheduled_time"
              type="time"
              defaultValue={
                item.scheduled_time
                  ? item.scheduled_time.slice(
                      0,
                      5
                    )
                  : ''
              }
              className={inputClass}
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Lugar
            <input
              name="location_text"
              maxLength={2000}
              defaultValue={
                item.location_text ??
                ''
              }
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
                  defaultValue={
                    item.meeting_provider ??
                    ''
                  }
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
                  defaultValue={
                    item.meeting_url ??
                    ''
                  }
                  placeholder="https://..."
                  className={inputClass}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h4 className="text-sm font-semibold text-slate-900">
            Entidad de origen
          </h4>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Puede mantenerse, cambiarse o
            quitarse. Sigue siendo un único
            vínculo exacto.
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

        <label className="mt-5 block text-sm font-semibold text-slate-700">
          Fundamento de la corrección
          <textarea
            name="rationale"
            required
            minLength={3}
            maxLength={10000}
            rows={2}
            placeholder="Indicá por qué se modifica la actividad..."
            className={inputClass}
          />
        </label>

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
          className="ux-button mt-4 rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending
            ? 'Guardando...'
            : 'Guardar cambios'}
        </button>
      </form>
    </details>
  )
}

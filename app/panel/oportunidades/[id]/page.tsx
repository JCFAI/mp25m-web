import Link from 'next/link'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canManageOpportunity,
  getOpportunityDetail,
  listOpportunityAssigneeOptions,
} from '../../../../lib/opportunities/detail'
import { listProjectsByOpportunity } from '../../../../lib/projects/projects'
import { createClient } from '../../../../lib/supabase/server'
import { OpportunityAssigneeForm } from './assignee-form'
import { OpportunityFollowupForm } from './followup-form'
import { OpportunityStatusForm } from './status-form'
import { OpportunityRequirementsSection } from './requirements-section'
import { OpportunityArticulationsSection } from './opportunity-articulations-section'
import {
  listOpportunityArticulationFollowups,
  listOpportunityArticulationParticipants,
  listOpportunityArticulations,
} from '../../../../lib/opportunities/articulations'

export const dynamic = 'force-dynamic'

type OpportunityDetailPageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    updated?: string
  }>
}

const kindLabels = {
  opportunity: 'Oportunidad / oferta',
  need: 'Necesidad',
}

const statusLabels = {
  draft: 'Borrador',
  open: 'Abierta',
  under_analysis: 'En análisis',
  in_progress: 'En curso',
  resolved: 'Resuelta',
  discarded: 'Descartada',
}

const priorityLabels = {
  low: 'Baja',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
}

const articulationStatusLabels = {
  draft: 'Borrador',
  active: 'Activa',
  follow_up: 'En seguimiento',
  paused: 'Pausada',
  closed_with_result: 'Cerrada con resultado',
  closed_without_result: 'Cerrada sin resultado',
  cancelled: 'Cancelada',
}

const provenanceOriginLabels = {
  manual: 'Registro manual',
  opportunity_candidate: 'Oportunidad candidata',
}

const provenanceDetectionLabels = {
  manual: 'Carga manual',
  radar_broad: 'Radar amplio',
  radar_directed: 'Radar dirigido',
}

const actionLabels: Record<string, string> = {
  'opportunity.origin_resolved': 'Identidad de actor resuelta',
  'opportunity.create':
    'Oportunidad registrada',
  'actor_candidate.create':
    'Actor provisorio registrado',
  'opportunity.status_change':
    'Estado actualizado',
  'opportunity.update':
    'Oportunidad actualizada',
  'opportunity.followup.create':
    'Novedad registrada',
  'opportunity.assignee_change':
    'Responsable actualizado',
  'opportunity.requirement.create':
    'Requerimiento creado',
  'opportunity.requirement.update':
    'Nueva revisión de requerimiento',
  'opportunity.requirement.submit_validation':
    'Requerimiento enviado a validación',
  'opportunity.requirement.validate':
    'Requerimiento validado',
  'opportunity.requirement.reject':
    'Requerimiento rechazado',
  'opportunity.requirement.withdraw':
    'Requerimiento retirado',
  'opportunity.requirement.reactivate':
    'Requerimiento reactivado',
  'opportunity.requirement.match.foundation.add':
    'Fundamento agregado al match',
  'opportunity.requirement.match.assess':
    'Match evaluado',
  'opportunity.requirement.match.reassess':
    'Match reevaluado',
  'opportunity.requirement.coverage.evaluate':
    'Cobertura del requerimiento evaluada',
  'opportunity.requirement.coverage.reevaluate':
    'Cobertura del requerimiento reevaluada',
}

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }
  ).format(
    new Date(`${value}T12:00:00`)
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(new Date(value))
}

function historyValuesEqual(
  left: unknown,
  right: unknown
) {
  return JSON.stringify(left ?? null) ===
    JSON.stringify(right ?? null)
}

function historyTextValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Sin dato'
  }

  return String(value)
}

function historyDateValue(
  value: unknown
) {
  if (!value) {
    return 'Sin fecha'
  }

  return (
    formatDate(String(value)) ??
    String(value)
  )
}

function arrayLength(
  value: unknown
) {
  return Array.isArray(value)
    ? value.length
    : 0
}

type HistoryRelationItem = {
  key: string
  label: string
}

function historyStringArray(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter(
    (item): item is string =>
      typeof item === 'string' &&
      item.length > 0
  )
}

function historyNodeItems(
  snapshot: Record<string, unknown>
): HistoryRelationItem[] {
  const ids =
    historyStringArray(snapshot.node_ids)

  const names =
    historyStringArray(snapshot.node_names)

  return names.map((name, index) => ({
    key:
      ids[index] ??
      `node-name:${name}:${index}`,
    label: name,
  }))
}

function historyActorItems(
  value: unknown
): HistoryRelationItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap(
    (item, index): HistoryRelationItem[] => {
      if (
        !item ||
        typeof item !== 'object'
      ) {
        return []
      }

      const record =
        item as Record<string, unknown>

      const displayName =
        typeof record.display_name === 'string'
          ? record.display_name
          : ''

      if (!displayName) {
        return []
      }

      const actorType =
        typeof record.actor_type === 'string'
          ? record.actor_type
          : ''

      const actorId =
        typeof record.actor_id === 'string'
          ? record.actor_id
          : ''

      const typeLabel =
        typeof record.type_label === 'string'
          ? record.type_label
          : ''

      const provisional =
        record.is_provisional === true

      const label = [
        displayName,
        typeLabel,
      ]
        .filter(Boolean)
        .join(' · ')

      return [
        {
          key:
            actorType && actorId
              ? `${actorType}:${actorId}`
              : `actor:${displayName}:${index}`,
          label:
            provisional
              ? `${label} (pendiente de validación)`
              : label,
        },
      ]
    }
  )
}

function relationDifference(
  previous: HistoryRelationItem[],
  current: HistoryRelationItem[]
) {
  const previousKeys =
    new Set(
      previous.map((item) => item.key)
    )

  const currentKeys =
    new Set(
      current.map((item) => item.key)
    )

  return {
    added: current.filter(
      (item) =>
        !previousKeys.has(item.key)
    ),

    removed: previous.filter(
      (item) =>
        !currentKeys.has(item.key)
    ),
  }
}

function RelationshipChanges({
  label,
  previous,
  current,
  previousCount,
  currentCount,
}: {
  label: string
  previous: HistoryRelationItem[]
  current: HistoryRelationItem[]
  previousCount: number
  currentCount: number
}) {
  const { added, removed } =
    relationDifference(
      previous,
      current
    )

  const hasReadableDifference =
    added.length > 0 ||
    removed.length > 0

  return (
    <li>
      <span className="font-semibold">
        {label}:
      </span>

      {added.map((item) => (
        <div
          key={`added:${item.key}`}
          className="mt-1 pl-3 text-emerald-700"
        >
          + {item.label}
        </div>
      ))}

      {removed.map((item) => (
        <div
          key={`removed:${item.key}`}
          className="mt-1 pl-3 text-red-700"
        >
          − {item.label}
        </div>
      ))}

      {!hasReadableDifference ? (
        <div className="mt-1 pl-3 text-slate-500">
          Se modificó la relación
          {previousCount !== currentCount
            ? ` · ${previousCount} antes → ${currentCount} después`
            : '.'}
        </div>
      ) : null}
    </li>
  )
}

function HistoryDescription({
  event,
}: {
  event: {
    action: string
    old_data: Record<string, unknown> | null
    new_data: Record<string, unknown> | null
    reason: string | null
  }
}) {
  if (
    event.action ===
      'opportunity.status_change' &&
    event.old_data &&
    event.new_data
  ) {
    const oldStatus =
      String(
        event.old_data.status ?? ''
      )

    const newStatus =
      String(
        event.new_data.status ?? ''
      )

    return (
      <>
        <p className="mt-1 text-sm text-slate-600">
          {statusLabels[
            oldStatus as keyof typeof statusLabels
          ] ?? oldStatus}
          {' → '}
          {statusLabels[
            newStatus as keyof typeof statusLabels
          ] ?? newStatus}
        </p>

        {event.reason ? (
          <p className="mt-2 text-sm italic text-slate-500">
            “{event.reason}”
          </p>
        ) : null}
      </>
    )
  }

  if (
    event.action ===
      'opportunity.assignee_change' &&
    event.old_data &&
    event.new_data
  ) {
    const previous =
      historyTextValue(
        event.old_data
          .assigned_to_display_name
      )

    const current =
      historyTextValue(
        event.new_data
          .assigned_to_display_name
      )

    return (
      <>
        <p className="mt-1 text-sm text-slate-600">
          {previous === 'Sin dato'
            ? 'Sin responsable'
            : previous}
          {' → '}
          {current === 'Sin dato'
            ? 'Sin responsable'
            : current}
        </p>

        {event.reason ? (
          <p className="mt-2 text-sm italic text-slate-500">
            “{event.reason}”
          </p>
        ) : null}
      </>
    )
  }
  if (
    event.action ===
      'opportunity.followup.create' &&
    event.new_data
  ) {
    const kind =
      String(
        event.new_data.kind ?? 'note'
      )

    const body =
      String(
        event.new_data.body ?? ''
      )

    const followupLabels: Record<
      string,
      string
    > = {
      note: 'Novedad general',
      contact: 'Contacto',
      meeting: 'Reunión',
      commitment: 'Compromiso',
      delivery: 'Entrega',
      other: 'Otro',
    }

    return (
      <div className="mt-2">
        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {followupLabels[kind] ?? kind}
        </span>

        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
          {body}
        </p>
      </div>
    )
  }
  if (
    event.action ===
      'opportunity.update' &&
    event.old_data &&
    event.new_data
  ) {
    const changes: ReactNode[] = []

    if (
      !historyValuesEqual(
        event.old_data.title,
        event.new_data.title
      )
    ) {
      changes.push(
        <li key="title">
          <span className="font-semibold">
            Título:
          </span>{' '}
          “{historyTextValue(
            event.old_data.title
          )}”
          {' → '}
          “{historyTextValue(
            event.new_data.title
          )}”
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.description,
        event.new_data.description
      )
    ) {
      changes.push(
        <li key="description">
          <span className="font-semibold">
            Descripción:
          </span>{' '}
          “{historyTextValue(
            event.old_data.description
          )}”
          {' → '}
          “{historyTextValue(
            event.new_data.description
          )}”
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.kind,
        event.new_data.kind
      )
    ) {
      const oldKind =
        String(event.old_data.kind ?? '')

      const newKind =
        String(event.new_data.kind ?? '')

      changes.push(
        <li key="kind">
          <span className="font-semibold">
            Tipo:
          </span>{' '}
          {kindLabels[
            oldKind as keyof typeof kindLabels
          ] ?? oldKind}
          {' → '}
          {kindLabels[
            newKind as keyof typeof kindLabels
          ] ?? newKind}
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.priority,
        event.new_data.priority
      )
    ) {
      const oldPriority =
        String(
          event.old_data.priority ?? ''
        )

      const newPriority =
        String(
          event.new_data.priority ?? ''
        )

      changes.push(
        <li key="priority">
          <span className="font-semibold">
            Prioridad:
          </span>{' '}
          {priorityLabels[
            oldPriority as keyof typeof priorityLabels
          ] ?? oldPriority}
          {' → '}
          {priorityLabels[
            newPriority as keyof typeof priorityLabels
          ] ?? newPriority}
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.due_date,
        event.new_data.due_date
      )
    ) {
      changes.push(
        <li key="due-date">
          <span className="font-semibold">
            Fecha límite:
          </span>{' '}
          {historyDateValue(
            event.old_data.due_date
          )}
          {' → '}
          {historyDateValue(
            event.new_data.due_date
          )}
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.source_text,
        event.new_data.source_text
      )
    ) {
      changes.push(
        <li key="source-text">
          <span className="font-semibold">
            Nota sobre el origen:
          </span>{' '}
          “{historyTextValue(
            event.old_data.source_text
          )}”
          {' → '}
          “{historyTextValue(
            event.new_data.source_text
          )}”
        </li>
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.node_ids,
        event.new_data.node_ids
      )
    ) {
      const previousNodes =
        historyNodeItems(
          event.old_data
        )

      const currentNodes =
        historyNodeItems(
          event.new_data
        )

      changes.push(
        <RelationshipChanges
          key="nodes"
          label="Nodos relacionados"
          previous={previousNodes}
          current={currentNodes}
          previousCount={arrayLength(
            event.old_data.node_ids
          )}
          currentCount={arrayLength(
            event.new_data.node_ids
          )}
        />
      )
    }

    if (
      !historyValuesEqual(
        event.old_data.origin_actors,
        event.new_data.origin_actors
      )
    ) {
      const previousActors =
        historyActorItems(
          event.old_data.origin_actors
        )

      const currentActors =
        historyActorItems(
          event.new_data.origin_actors
        )

      changes.push(
        <RelationshipChanges
          key="origins"
          label="Actores de origen"
          previous={previousActors}
          current={currentActors}
          previousCount={arrayLength(
            event.old_data.origin_actors
          )}
          currentCount={arrayLength(
            event.new_data.origin_actors
          )}
        />
      )
    }

    if (changes.length === 0) {
      return (
        <p className="mt-2 text-sm text-slate-500">
          No hubo cambios en los datos de la oportunidad.
        </p>
      )
    }

    return (
      <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
        {changes}
      </ul>
    )
  }

  if (
    event.action.startsWith(
      'opportunity.requirement.'
    )
  ) {
    return event.reason ? (
      <p className="mt-2 text-sm italic text-slate-500">
        “{event.reason}”
      </p>
    ) : null
  }

  return null
}

export default async function OpportunityDetailPage({
  params,
  searchParams,
}: OpportunityDetailPageProps) {
  const { id } = await params
  const query = await searchParams

  const [
    supabase,
    detail,
    assigneeOptions,
    articulations,
    articulationParticipants,
    articulationFollowups,
    projects,
  ] = await Promise.all([
    createClient(),
    getOpportunityDetail(id),
    listOpportunityAssigneeOptions(),
    listOpportunityArticulations(id),
    listOpportunityArticulationParticipants(id),
    listOpportunityArticulationFollowups(id),
    listProjectsByOpportunity(id),
  ])

  if (!detail) {
    notFound()
  }

  const { data: claimsData } =
    await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  const access = authUserId
    ? await getInternalAccess(authUserId)
    : []

  const canManage =
    canManageOpportunity(access)

  const {
    opportunity,
    provenance,
    origins,
    history,
  } = detail

  const primaryArticulation =
    articulations[0] ?? null

  const projectReadyArticulation =
    articulations.find(
      (articulation) =>
        articulation.status ===
        'closed_with_result'
    ) ?? null

  const primaryProject =
    projects[0] ?? null

  const articulationStageLabel =
    articulations.length === 0
      ? 'No iniciada'
      : articulations.length === 1 &&
          primaryArticulation
        ? articulationStatusLabels[
            primaryArticulation.status
          ]
        : `${articulations.length} registradas`

  const projectStageLabel =
    primaryProject
      ? projects.length === 1
        ? 'Proyecto registrado'
        : `${projects.length} proyectos registrados`
      : projectReadyArticulation
        ? 'Disponible para iniciar'
        : 'Opcional · no iniciado'

  return (
    <div className="space-y-7">
      <div>
        <Link
          href="/panel/oportunidades"
          className="text-sm font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
        >
          ← Volver a oportunidades
        </Link>
      </div>

      {query.updated === '1' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
          Los cambios de la oportunidad fueron guardados correctamente.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
              {kindLabels[opportunity.kind]}
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {opportunity.title}
            </h1>

            <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-50/85 sm:text-base">
              {opportunity.description}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
                {statusLabels[opportunity.status]}
              </span>

              <span className="rounded-full border border-white/20 px-3 py-1.5 text-xs">
                Prioridad{' '}
                {priorityLabels[
                  opportunity.priority
                ]}
              </span>
            </div>

            {canManage ? (
              <Link
                href={`/panel/oportunidades/${opportunity.id}/editar`}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] shadow-sm transition hover:bg-slate-50"
              >
                Editar oportunidad
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Proceso operativo
        </p>

        <h2 className="mt-2 text-xl font-semibold text-slate-950">
          De la oportunidad a la ejecución
        </h2>

        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          La oportunidad permite analizar qué se necesita
          y si puede abordarse. La articulación coordina
          actores, acuerdos y acciones concretas. Un
          proyecto es una etapa posterior y opcional,
          sólo cuando el resultado requiere una ejecución
          organizada.
        </p>

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          <article className="rounded-xl border border-[#2F5D8C]/20 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
              1 · Oportunidad
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-950">
                {opportunity.title}
              </h3>

              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {statusLabels[opportunity.status]}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Análisis, requerimientos, cobertura y
              decisión sobre cómo avanzar.
            </p>
          </article>

          <article className="rounded-xl border border-[#2F5D8C]/20 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
              2 · Articulación
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-950">
                Coordinación operativa
              </h3>

              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {articulationStageLabel}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Contactos, reuniones, compromisos,
              participantes, entregas y seguimiento del
              trabajo concreto.
            </p>

            {articulations.length === 0 ? (
              canManage ? (
                <a
                  href="#iniciar-articulacion"
                  className="ux-button mt-3 inline-flex min-h-10 items-center rounded-lg bg-[#1E3A5F] px-3 py-2 text-sm font-semibold text-white"
                >
                  Iniciar articulación
                </a>
              ) : null
            ) : articulations.length === 1 &&
              primaryArticulation ? (
              <Link
                href={`/panel/articulaciones/${primaryArticulation.articulation_id}`}
                className="mt-3 inline-flex text-sm font-semibold text-[#2F5D8C] hover:underline"
              >
                Ver articulación →
              </Link>
            ) : (
              <a
                href="#articulaciones"
                className="mt-3 inline-flex text-sm font-semibold text-[#2F5D8C] hover:underline"
              >
                Ver articulaciones →
              </a>
            )}
          </article>

          <article className="rounded-xl border border-[#2F5D8C]/20 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
              3 · Proyecto
            </p>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-950">
                Ejecución organizada
              </h3>

              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                {projectStageLabel}
              </span>
            </div>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Sólo hace falta si el resultado de una
              articulación requiere una etapa propia de
              ejecución, entregables y seguimiento.
            </p>

            {primaryProject ? (
              <Link
                href={`/panel/proyectos/${primaryProject.project_id}`}
                className="mt-3 inline-flex text-sm font-semibold text-[#2F5D8C] hover:underline"
              >
                Ver proyecto →
              </Link>
            ) : projectReadyArticulation ? (
              <Link
                href={`/panel/proyectos?articulation=${projectReadyArticulation.articulation_id}`}
                className="ux-button mt-3 inline-flex min-h-10 items-center rounded-lg border border-[#2F5D8C] px-3 py-2 text-sm font-semibold text-[#1E3A5F]"
              >
                Crear proyecto
              </Link>
            ) : null}
          </article>
        </div>
      </section>

      <OpportunityRequirementsSection
        opportunityId={opportunity.id}
        access={access}
        assignedToInternalUserId={
          opportunity.assigned_to_internal_user_id
        }
        nodeIds={
          opportunity.node_ids ?? []
        }
        assigneeOptions={assigneeOptions}
      />
      <OpportunityArticulationsSection
        opportunityId={opportunity.id}
        articulations={articulations}
        participants={articulationParticipants}
        followups={articulationFollowups}
        origins={origins}
        canOperate={canManage}
        assigneeOptions={assigneeOptions}
      />
      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Información
            </h2>

            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fecha límite
                </dt>

                <dd className="mt-1 text-sm font-medium text-slate-700">
                  {opportunity.due_date
                    ? formatDate(
                        opportunity.due_date
                      )
                    : 'Sin fecha límite'}
                </dd>
              </div>

              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Prioridad
                </dt>

                <dd className="mt-1 text-sm font-medium text-slate-700">
                  {priorityLabels[
                    opportunity.priority
                  ]}
                </dd>
              </div>
            </dl>

            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nodos relacionados
              </p>

              {opportunity.node_names.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {opportunity.node_names.map(
                    (nodeName) => (
                      <span
                        key={nodeName}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                      >
                        {nodeName}
                      </span>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Sin nodos asociados.
                </p>
              )}
            </div>

            {opportunity.source_text ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Nota sobre el origen
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {opportunity.source_text}
                </p>
              </div>
            ) : null}

            {provenance ? (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Procedencia
                </p>
                <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Origen</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">{provenanceOriginLabels[provenance.origin_kind]}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Método de detección</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">{provenanceDetectionLabels[provenance.detection_method]}</dd>
                  </div>
                  {provenance.source_name ? <div><dt className="text-slate-500">Fuente</dt><dd className="mt-0.5 text-slate-700">{provenance.source_name}</dd></div> : null}
                  {provenance.external_reference ? <div><dt className="text-slate-500">Referencia externa</dt><dd className="mt-0.5 break-words text-slate-700">{provenance.external_reference}</dd></div> : null}
                </dl>
                <p className="mt-3 text-xs leading-5 text-slate-500">La procedencia se conserva para futuras señales del Radar; no implica una detección ni asignación automática.</p>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Actores de origen
            </h2>

            {origins.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No hay actores de origen asociados.
              </p>
            ) : (
              <div className="mt-4 grid gap-3">
                {origins.map((origin) => (
                  <div
                    key={origin.origin_id}
                    className={
                      origin.is_provisional
                        ? 'rounded-xl border border-amber-200 bg-amber-50 p-4'
                        : 'rounded-xl border border-slate-200 bg-slate-50 p-4'
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {origin.actor_type === 'person' ? (
                        <Link
                          href={`/panel/personas/${origin.actor_id}`}
                          className="font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                          title="Ver ficha de la persona"
                        >
                          {origin.display_name}
                        </Link>
                      ) : origin.review_candidate_id ? (
                        <Link
                          href={`/panel/actores-pendientes/${origin.review_candidate_id}?opportunity=${opportunity.id}`}
                          className="font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                          title="Revisar actor pendiente"
                        >
                          {origin.display_name}
                        </Link>
                      ) : (
                        <p className="font-semibold text-slate-800">
                          {origin.display_name}
                        </p>
                      )}

                      {origin.is_provisional ? (
                        <Link
                          href={`/panel/actores-pendientes/${origin.review_candidate_id ?? origin.actor_id}?opportunity=${opportunity.id}`}
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200"
                          title="Revisar actor pendiente"
                        >
                          Pendiente de validación
                        </Link>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {[
                        origin.type_label,
                        ...origin.role_names,
                        ...origin.node_names,
                      ].join(' · ')}
                    </p>

                    {origin.context_text ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {origin.context_text}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Historial
            </h2>

            <div className="mt-5 space-y-4">
              {history.map((event) => (
                <div
                  key={event.event_id}
                  className="border-l-2 border-[#C8D6E5] pl-4"
                >
                  <p className="text-sm font-semibold text-slate-700">
                    {actionLabels[event.action] ??
                      event.action}
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    {formatDateTime(
                      event.occurred_at
                    )}
                  </p>

                  <HistoryDescription
                    event={event}
                  />
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside>
          {canManage ? (
            <div>
              <OpportunityStatusForm
                opportunityId={opportunity.id}
                currentStatus={
                  opportunity.status === 'draft'
                    ? 'open'
                    : opportunity.status
                }
              />

              <OpportunityAssigneeForm
                opportunityId={opportunity.id}
                currentAssigneeId={
                  opportunity.assigned_to_internal_user_id
                }
                options={assigneeOptions}
              />

              <OpportunityFollowupForm
                opportunityId={opportunity.id}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
              Tu perfil puede consultar esta oportunidad,
              pero no modificar su estado.
            </div>
          )}
        </aside>
      </section>
    </div>
  )
}

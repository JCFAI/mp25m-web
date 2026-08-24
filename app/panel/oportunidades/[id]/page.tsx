import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canManageOpportunity,
  getOpportunityDetail,
} from '../../../../lib/opportunities/detail'
import { createClient } from '../../../../lib/supabase/server'
import { OpportunityStatusForm } from './status-form'

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
  opportunity: 'Oportunidad',
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

const actionLabels: Record<string, string> = {
  'opportunity.create':
    'Oportunidad registrada',
  'actor_candidate.create':
    'Actor provisorio registrado',
  'opportunity.status_change':
    'Estado actualizado',
  'opportunity.update':
    'Oportunidad actualizada',
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
  ] = await Promise.all([
    createClient(),
    getOpportunityDetail(id),
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
    origins,
    history,
  } = detail

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
                      <p className="font-semibold text-slate-800">
                        {origin.display_name}
                      </p>

                      {origin.is_provisional ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          Pendiente de validación
                        </span>
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
            <OpportunityStatusForm
              opportunityId={opportunity.id}
              currentStatus={
                opportunity.status === 'draft'
                  ? 'open'
                  : opportunity.status
              }
            />
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
import {
  canCreateOpportunity,
  listOpportunities,
  type Opportunity,
} from '../../../lib/opportunities/server'
import {
  listOpportunityOrganizationTypes,
} from '../../../lib/opportunities/actors'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import { createOpportunityAction } from './actions'
import { OpportunityRelations } from './opportunity-relations'

export const dynamic = 'force-dynamic'

type OpportunitiesPageProps = {
  searchParams: Promise<{
    created?: string
    error?: string
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

function formatDate(value: string | null) {
  if (!value) {
    return null
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value}T12:00:00`))
}

function OpportunityCard({
  opportunity,
}: {
  opportunity: Opportunity
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-[#EAF0F7] px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
            {kindLabels[opportunity.kind]}
          </span>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {statusLabels[opportunity.status]}
          </span>

          <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500">
            Prioridad {priorityLabels[opportunity.priority]}
          </span>
        </div>

        {opportunity.due_date ? (
          <span className="text-xs font-medium text-slate-500">
            Vence {formatDate(opportunity.due_date)}
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-slate-950">
        {opportunity.title}
      </h3>

      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
        {opportunity.description}
      </p>

      {opportunity.node_names.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {opportunity.node_names.map((nodeName) => (
            <span
              key={nodeName}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600"
            >
              {nodeName}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs text-slate-400">
          Sin nodo territorial asociado
        </p>
      )}

      {opportunity.source_text ? (
        <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <span className="font-semibold text-slate-600">
            Nota sobre el origen:
          </span>{' '}
          {opportunity.source_text}
        </p>
      ) : null}
    </article>
  )
}

export default async function OpportunitiesPage({
  searchParams,
}: OpportunitiesPageProps) {
  const params = await searchParams

  const supabase = await createClient()

  const { data: claimsData } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  const access = authUserId
    ? await getInternalAccess(authUserId)
    : []

  const canCreate = canCreateOpportunity(access)

  const [
    opportunities,
    organizationTypes,
  ] = await Promise.all([
    listOpportunities(),
    listOpportunityOrganizationTypes(),
  ])

  const openCount = opportunities.filter(
    (item) =>
      item.status === 'open' ||
      item.status === 'under_analysis'
  ).length

  const inProgressCount = opportunities.filter(
    (item) => item.status === 'in_progress'
  ).length

  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
            Incremento 2
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Oportunidades
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-50/80 sm:text-base">
            Registro y seguimiento de oportunidades y necesidades productivas
            identificadas por el Movimiento Productivo 25 de Mayo.
          </p>
        </div>
      </section>

      {params.created === '1' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
          La oportunidad fue registrada correctamente.
        </div>
      ) : null}

      {params.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
          No se pudo registrar la oportunidad. Revisá los datos e intentá nuevamente.
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Total registradas
          </p>
          <p className="mt-3 text-3xl font-bold text-[#1E3A5F]">
            {opportunities.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Abiertas / en análisis
          </p>
          <p className="mt-3 text-3xl font-bold text-[#1E3A5F]">
            {openCount}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            En curso
          </p>
          <p className="mt-3 text-3xl font-bold text-[#1E3A5F]">
            {inProgressCount}
          </p>
        </article>
      </section>

      {canCreate ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="border-b border-slate-100 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Nueva carga
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Registrar oportunidad o necesidad
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Podés relacionarla con nodos territoriales y con las personas,
              empresas o instituciones que dieron origen a la oportunidad.
            </p>
          </div>

          <form
            action={createOpportunityAction}
            className="mt-6 grid gap-5 lg:grid-cols-2"
          >
            <label className="block lg:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Título
              </span>
              <input
                name="title"
                required
                minLength={3}
                maxLength={200}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
                placeholder="Ej.: Empresa busca proveedor nacional de..."
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Descripción
              </span>
              <textarea
                name="description"
                required
                minLength={10}
                maxLength={10000}
                rows={5}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
                placeholder="Describí la oportunidad, la necesidad identificada y cualquier información relevante."
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Tipo
              </span>
              <select
                name="kind"
                defaultValue="opportunity"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
              >
                <option value="opportunity">
                  Oportunidad
                </option>
                <option value="need">
                  Necesidad
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Prioridad
              </span>
              <select
                name="priority"
                defaultValue="normal"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
              >
                <option value="low">Baja</option>
                <option value="normal">Normal</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Fecha límite
              </span>
              <input
                type="date"
                name="due_date"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Nota sobre el origen
              </span>
              <input
                name="source_text"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#2F5D8C]"
                placeholder="Ej.: surge de la reunión del 21/8..."
              />
            </label>

            <OpportunityRelations
              organizationTypes={organizationTypes}
            />

            <div className="flex justify-end lg:col-span-2">
              <button
                type="submit"
                className="rounded-xl bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14263D]"
              >
                Registrar
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="border-b border-slate-100 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
            Seguimiento
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            Oportunidades registradas
          </h2>
        </div>

        {opportunities.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-base font-semibold text-slate-700">
              Todavía no hay oportunidades registradas.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              La primera carga aparecerá acá y quedará registrada en la auditoría del sistema.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {opportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
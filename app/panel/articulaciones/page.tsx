import { notFound, redirect } from 'next/navigation'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import Link from 'next/link'

import { listOpportunityAssigneeOptions } from '../../../lib/opportunities/detail'
import { listArticulations } from '../../../lib/opportunities/articulations'

import { ArticulationCreationForm } from './articulation-forms'

export const dynamic = 'force-dynamic'

const statusLabels = {
  draft: 'Borrador',
  active: 'Activa',
  follow_up: 'En seguimiento',
  paused: 'Pausada',
  closed_with_result: 'Cerrada con resultado',
  closed_without_result: 'Cerrada sin resultado',
  cancelled: 'Cancelada',
}

export default async function ArticulationsPage() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = claimsData?.claims?.sub
  if (!userId) redirect('/login')
  const access = await getInternalAccess(userId)
  if (!access.some(grant => grant.scope_type === 'global' &&
    ['administrator', 'validator'].includes(grant.access_role_code))) notFound()

  const [articulations, assigneeOptions] =
    await Promise.all([
      listArticulations(),
      listOpportunityAssigneeOptions(),
    ])

  return (
    <div className="space-y-6">
      <section data-tour="articulations-intro">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Articulaciones
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Articulaciones
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Una articulación es una unidad de coordinación
          autónoma entre actores. Puede comenzar por sí
          misma y luego vincular oportunidades, proyectos,
          personas, organizaciones y otros recursos.
        </p>
      </section>

      <ArticulationCreationForm
        assigneeOptions={assigneeOptions}
      />

      <section data-tour="articulation-directory" data-tour-empty={articulations.length === 0 ? 'true' : 'false'} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-950">
            Articulaciones registradas
          </h2>

          <span className="text-sm text-slate-500">
            {articulations.length}
          </span>
        </div>

        {articulations.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {articulations.map((articulation) => (
              <Link
                key={articulation.articulation_id}
                href={`/panel/articulaciones/${articulation.articulation_id}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-slate-950">
                    {articulation.title}
                  </strong>

                  <span className="text-sm text-slate-600">
                    {statusLabels[articulation.status]}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-slate-700">
                  {articulation.objective}
                </p>

                <p className="mt-3 text-xs text-slate-500">
                  Responsable:{' '}
                  {articulation.responsible_display_name ??
                    'Sin asignar'}
                  {' · '}
                  Participantes:{' '}
                  {articulation.participant_count}
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  Los vínculos con oportunidades y proyectos
                  se gestionan desde la ficha.
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Todavía no hay articulaciones registradas.
          </p>
        )}
      </section>
    </div>
  )
}

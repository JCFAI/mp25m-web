import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { getCanonicalNodeProfile } from '../../../../lib/nodes/profile'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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

function articulationKindLabel(
  kind: 'opportunity' | 'need'
) {
  return kind === 'need'
    ? 'Necesidad'
    : 'Oportunidad / oferta'
}

function articulationStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    open: 'Abierta',
    under_analysis: 'En análisis',
    in_progress: 'En curso',
    resolved: 'Resuelta',
    discarded: 'Descartada',
  }

  return labels[value] ?? value
}

function roleVerificationLabel(value: string) {
  if (value === 'confirmed') {
    return 'Confirmado'
  }

  if (value === 'pending') {
    return 'Pendiente'
  }

  return value
}

export default async function NodeProfilePage({
  params,
}: PageProps) {
  const { id } = await params

  if (!UUID_PATTERN.test(id)) {
    notFound()
  }

  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const profile =
    await getCanonicalNodeProfile(id)

  if (!profile) {
    notFound()
  }

  const {
    node,
    jurisdictions,
    participants,
    skills,
    articulations,
    organizations,
  } = profile

  return (
    <div className="space-y-7">
      <Link
        href="/panel/nodos"
        className="inline-flex text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Nodos
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Nodo territorial
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {node.display_name}
          </h1>

          {node.node_number !== null ? (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
              Nodo {node.node_number}
            </span>
          ) : null}

          <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100">
            Activo
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          {node.description ??
            'Ficha territorial del nodo. La composición y las capacidades se construyen a partir de información confirmada y validada progresivamente.'}
        </p>

        {node.jurisdiction_name ? (
          <p className="mt-4 text-sm font-medium text-blue-100">
            {node.jurisdiction_type_name
              ? `${node.jurisdiction_type_name}: `
              : ''}
            {node.jurisdiction_name}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.confirmed_people_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Personas confirmadas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.people_with_skills_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Personas con habilidades
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.reported_skill_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Habilidades relevadas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.confirmed_skill_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Habilidades confirmadas
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.articulation_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Articulaciones
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-2xl font-bold text-slate-950">
            {node.organization_count}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Organizaciones
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Cobertura territorial
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Jurisdicciones vinculadas con este nodo.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {jurisdictions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cobertura territorial pendiente de completar.
            </p>
          ) : (
            jurisdictions.map((jurisdiction) => (
              <article
                key={jurisdiction.jurisdiction_id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-950">
                    {jurisdiction.jurisdiction_name}
                  </p>

                  {jurisdiction.is_primary ? (
                    <span className="rounded-full bg-[#EAF0F7] px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
                      Principal
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-sm text-slate-600">
                  {jurisdiction.jurisdiction_type_name}
                  {jurisdiction.parent_jurisdiction_name
                    ? ` · ${jurisdiction.parent_jurisdiction_name}`
                    : ''}
                </p>

                {jurisdiction.coverage_notes ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {jurisdiction.coverage_notes}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Composición del nodo
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Solo se muestran participaciones territoriales confirmadas. Los roles conservan su propio estado de validación.
            </p>
          </div>

          <span className="text-sm font-semibold text-slate-500">
            {participants.length}{' '}
            {participants.length === 1
              ? 'persona'
              : 'personas'}
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {participants.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No hay personas con participación confirmada en este nodo.
            </div>
          ) : (
            participants.map((participant) => (
              <article
                key={participant.participation_id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <Link
                  href={`/panel/personas/${participant.person_id}`}
                  className="font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                >
                  {participant.display_name}
                </Link>

                {participant.profession_text ||
                participant.primary_activity_text ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {[
                      participant.profession_text,
                      participant.primary_activity_text,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    Actividad pendiente de completar.
                  </p>
                )}

                {participant.role_names.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {participant.role_names.map(
                      (roleName, index) => {
                        const verification =
                          participant
                            .role_verification_statuses[
                            index
                          ]

                        return (
                          <span
                            key={`${participant.participation_id}-${roleName}-${index}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                          >
                            <strong>{roleName}</strong>
                            {verification
                              ? ` · ${roleVerificationLabel(
                                  verification
                                )}`
                              : ''}
                          </span>
                        )
                      }
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-700">
                    Rol pendiente de completar.
                  </p>
                )}

                {participant.started_on ? (
                  <p className="mt-3 text-xs text-slate-400">
                    Participación desde{' '}
                    {formatDate(participant.started_on)}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Capacidades y habilidades
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Resumen de habilidades de las personas con participación confirmada en el nodo.
          </p>

          <div className="mt-5 space-y-3">
            {skills.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Habilidades pendientes de relevar.
              </div>
            ) : (
              skills.map((skill) => (
                <article
                  key={skill.skill_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {skill.skill_name}
                      </p>

                      {skill.category_name ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {skill.category_name}
                        </p>
                      ) : null}
                    </div>

                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {skill.person_count}{' '}
                      {skill.person_count === 1
                        ? 'persona'
                        : 'personas'}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-500">
                    Confirmadas:{' '}
                    {skill.confirmed_person_count}
                    {' · '}
                    No confirmadas:{' '}
                    {skill.person_count -
                      skill.confirmed_person_count}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Organizaciones vinculadas
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Organizaciones canónicas relacionadas territorialmente con el nodo.
          </p>

          <div className="mt-5 space-y-3">
            {organizations.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Organizaciones pendientes de registrar.
              </div>
            ) : (
              organizations.map((organization) => (
                <article
                  key={organization.organization_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-semibold text-slate-950">
                    {organization.organization_name}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                    {organization.organization_type_name}
                  </p>

                  {organization.notes ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {organization.notes}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Articulaciones
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Necesidades y oportunidades vinculadas territorialmente con este nodo.
        </p>

        <div className="mt-5 space-y-3">
          {articulations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No hay articulaciones vinculadas con este nodo.
            </div>
          ) : (
            articulations.map((articulation) => (
              <Link
                key={articulation.opportunity_id}
                href={`/panel/oportunidades/${articulation.opportunity_id}`}
                className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-[#2F5D8C]/40 hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {articulation.title}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                      {articulationKindLabel(
                        articulation.kind
                      )}
                      {' · '}
                      {articulationStatusLabel(
                        articulation.status
                      )}
                    </p>
                  </div>

                  <span className="text-sm font-medium text-[#2F5D8C]">
                    Ver articulación →
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {articulation.description}
                </p>

                {articulation.due_date ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Fecha prevista:{' '}
                    {formatDate(articulation.due_date)}
                  </p>
                ) : null}
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
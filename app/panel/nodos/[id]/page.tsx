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

function organizationVerificationBadgeClass(
  value: string
) {
  if (value === 'pending') {
    return 'rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200'
  }

  return 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200'
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
    pendingOrganizations,
  } = profile

  return (
    <div className="space-y-5 sm:space-y-7">
      <Link
        href="/panel/nodos"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Nodos
      </Link>

      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Nodo territorial
        </p>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            {node.display_name}
          </h1>

          {node.node_number !== null ? (
            <span className="rounded-full bg-[#EAF0F7] px-3 py-1 text-xs font-semibold text-[#1E3A5F] md:bg-white/15 md:text-blue-50">
              Nodo {node.node_number}
            </span>
          ) : null}

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 md:bg-emerald-300/20 md:text-emerald-100">
            Activo
          </span>
        </div>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          {node.description ??
            'Ficha territorial del nodo. La composición y las capacidades se construyen a partir de información confirmada y validada progresivamente.'}
        </p>

        {node.jurisdiction_name ? (
          <p className="mt-3 break-words text-sm font-medium text-[#2F5D8C] md:mt-4 md:text-blue-100">
            {node.jurisdiction_type_name
              ? `${node.jurisdiction_type_name}: `
              : ''}
            {node.jurisdiction_name}
          </p>
        ) : null}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-6">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.confirmed_people_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Personas confirmadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.people_with_skills_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Personas con habilidades
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.reported_skill_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Habilidades relevadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.confirmed_skill_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Habilidades confirmadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.articulation_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Articulaciones
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {node.organization_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Organizaciones confirmadas
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Cobertura territorial
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Jurisdicciones vinculadas con este nodo.
        </p>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 md:grid-cols-2">
          {jurisdictions.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cobertura territorial pendiente de completar.
            </p>
          ) : (
            jurisdictions.map((jurisdiction) => (
              <article
                key={jurisdiction.jurisdiction_id}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words font-semibold text-slate-950">
                    {jurisdiction.jurisdiction_name}
                  </p>

                  {jurisdiction.is_primary ? (
                    <span className="rounded-full bg-[#EAF0F7] px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
                      Principal
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 break-words text-sm text-slate-600">
                  {jurisdiction.jurisdiction_type_name}
                  {jurisdiction.parent_jurisdiction_name
                    ? ` · ${jurisdiction.parent_jurisdiction_name}`
                    : ''}
                </p>

                {jurisdiction.coverage_notes ? (
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                    {jurisdiction.coverage_notes}
                  </p>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-slate-950">
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

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
          {participants.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay personas con participación confirmada en este nodo.
            </div>
          ) : (
            participants.map((participant) => (
              <article
                key={participant.participation_id}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <Link
                  href={`/panel/personas/${participant.person_id}`}
                  className="break-words font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                >
                  {participant.display_name}
                </Link>

                {participant.profession_text ||
                participant.primary_activity_text ? (
                  <p className="mt-1 break-words text-sm text-slate-600">
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
                            className="break-words rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="break-words text-lg font-semibold text-slate-950">
              Capacidades y habilidades
            </h2>

            <Link
              href={`/panel/nodos/${id}/capacidades`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
            >
              Ver mapa completo →
            </Link>
          </div>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Resumen de habilidades de las personas con participación confirmada en el nodo.
          </p>

          <div className="mt-5 space-y-3">
            {skills.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
                Habilidades pendientes de relevar.
              </div>
            ) : (
              skills.map((skill) => (
                <article
                  key={skill.skill_id}
                  className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-slate-950">
                        {skill.skill_name}
                      </p>

                      {skill.category_name ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {skill.category_name}
                        </p>
                      ) : null}
                    </div>

                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="break-words text-lg font-semibold text-slate-950">
            Organizaciones vinculadas
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Organizaciones canónicas relacionadas territorialmente con el nodo.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <h3 className="break-words text-base font-semibold text-slate-950">
              Confirmadas
            </h3>

            <span className={organizationVerificationBadgeClass('confirmed')}>
              Confirmadas
            </span>
          </div>

          <div className="mt-3 space-y-3">
            {organizations.length === 0 ? (
              <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
                No hay organizaciones confirmadas en este nodo.
              </div>
            ) : (
              organizations.map((organization) => (
                <Link
                  key={organization.organization_id}
                  href={`/panel/organizaciones/${organization.organization_id}`}
                  className="block rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-[#2F5D8C]/40 sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none sm:hover:bg-white"
                >
                  <p className="break-words font-semibold text-slate-950">
                    {organization.organization_name}
                  </p>

                  <p className="mt-1 break-words text-xs font-semibold text-[#2F5D8C]">
                    {organization.organization_type_name}
                  </p>

                  {organization.notes ? (
                    <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                      {organization.notes}
                    </p>
                  ) : null}
                </Link>
              ))
            )}
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-base font-semibold text-slate-950">
                Vínculos de organizaciones pendientes
              </h3>

              <span className={organizationVerificationBadgeClass('pending')}>
                Pendientes
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {pendingOrganizations.length === 0 ? (
                <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
                  No hay vínculos de organizaciones pendientes en este nodo.
                </div>
              ) : (
                pendingOrganizations.map(
                  (organization) => (
                    <Link
                      key={organization.organization_id}
                      href={`/panel/organizaciones/${organization.organization_id}`}
                      className="block rounded-xl border border-amber-200 bg-amber-50/70 p-3 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 sm:p-4 sm:shadow-none"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-950">
                            {
                              organization.organization_name
                            }
                          </p>

                          <p className="mt-1 break-words text-xs font-semibold text-[#2F5D8C]">
                            {
                              organization.organization_type_name
                            }
                          </p>
                        </div>

                        <span className={organizationVerificationBadgeClass('pending')}>
                          Pendiente
                        </span>
                      </div>

                      <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                        Evidencia:{' '}
                        {organization.evidence_text?.trim()
                          ? organization.evidence_text
                          : 'Sin evidencia registrada.'}
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Inicio:{' '}
                        {organization.started_on
                          ? formatDate(
                              organization.started_on
                            )
                          : 'Fecha de inicio no informada.'}
                      </p>
                    </Link>
                  )
                )
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Articulaciones
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Necesidades y oportunidades vinculadas territorialmente con este nodo.
        </p>

        <div className="mt-5 space-y-3">
          {articulations.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay articulaciones vinculadas con este nodo.
            </div>
          ) : (
            articulations.map((articulation) => (
              <Link
                key={articulation.opportunity_id}
                href={`/panel/oportunidades/${articulation.opportunity_id}`}
                className="block rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-[#2F5D8C]/40 sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none sm:hover:bg-white"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
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

                  <span className="inline-flex min-h-11 shrink-0 items-center text-sm font-medium text-[#2F5D8C]">
                    Ver articulación →
                  </span>
                </div>

                <p className="mt-3 break-words text-sm leading-6 text-slate-600">
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

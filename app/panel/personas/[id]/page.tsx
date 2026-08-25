import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { getCanonicalPersonProfile } from '../../../../lib/people/profile'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function articulationKindLabel(
  kind: 'opportunity' | 'need'
) {
  return kind === 'need'
    ? 'Necesidad'
    : 'Oportunidad / oferta'
}

function participationVerificationLabel(
  value: string
) {
  return value === 'confirmed'
    ? 'Participación confirmada'
    : 'Participación pendiente'
}

export default async function PersonProfilePage({
  params,
}: PageProps) {
  const { id } = await params

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
    await getCanonicalPersonProfile(id)

  if (!profile) {
    notFound()
  }

  const {
    person,
    territories,
    articulations,
    aliases,
    skills,
  } = profile

  return (
    <div className="space-y-7">
      <Link
        href="/panel/personas"
        className="inline-flex text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Personas
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Persona
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {person.display_name}
          </h1>

          <span className="rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100">
            {person.record_status === 'active'
              ? 'Activo'
              : person.record_status}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          Registro canónico de la persona. La información se completa y valida progresivamente.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Identidad
          </h2>

          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nombre actual
              </dt>
              <dd className="mt-1 font-semibold text-slate-900">
                {person.display_name}
              </dd>
            </div>

            {person.profession_text ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Profesión
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {person.profession_text}
                </dd>
              </div>
            ) : null}

            {person.primary_activity_text ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Actividad principal
                </dt>
                <dd className="mt-1 text-sm text-slate-700">
                  {person.primary_activity_text}
                </dd>
              </div>
            ) : null}

            {!person.profession_text &&
            !person.primary_activity_text ? (
              <p className="text-sm text-slate-500">
                Profesión y actividad principal pendientes de completar.
              </p>
            ) : null}
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Antecedentes de identidad
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Nombres y contextos informados anteriormente que fueron vinculados con esta persona.
          </p>

          <div className="mt-5 space-y-3">
            {aliases.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay otros nombres informados registrados.
              </p>
            ) : (
              aliases.map((alias) => (
                <article
                  key={alias.actor_candidate_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {alias.reported_name}
                      </p>

                      {alias.context_text ? (
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {alias.context_text}
                        </p>
                      ) : null}
                    </div>

                    <Link
                      href={`/panel/actores-pendientes/${alias.actor_candidate_id}`}
                      className="text-xs font-semibold text-[#2F5D8C] hover:underline"
                    >
                      Ver revisión
                    </Link>
                  </div>

                  {alias.reported_node_names.length > 0 ? (
                    <p className="mt-3 text-xs text-slate-500">
                      Contexto territorial informado:{' '}
                      {alias.reported_node_names.join(', ')}
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
          Participaciones territoriales
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Una persona puede participar en varios nodos y cumplir roles distintos en cada uno.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {territories.length === 0 ? (
            <p className="text-sm text-slate-500">
              Participaciones territoriales pendientes de completar.
            </p>
          ) : (
            territories.map((territory) => (
              <article
                key={territory.participation_id}
                className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-950">
                    {territory.node_name}
                  </h3>

                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    {participationVerificationLabel(
                      territory.participation_verification_status
                    )}
                  </span>
                </div>

                {territory.role_names.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {territory.role_names.map(
                      (roleName) => (
                        <span
                          key={roleName}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                        >
                          {roleName}
                        </span>
                      )
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-amber-700">
                    Rol pendiente de completar.
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Habilidades
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Las habilidades pueden incorporarse y validarse progresivamente.
          </p>

          <div className="mt-5 space-y-3">
            {skills.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Habilidades pendientes de completar.
              </div>
            ) : (
              skills.map((skill) => (
                <article
                  key={skill.person_skill_id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <p className="font-semibold text-slate-900">
                    {skill.skill_name}
                  </p>

                  {skill.category_name ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {skill.category_name}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Actividades
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Una persona puede participar en múltiples actividades, independientemente de sus nodos y roles.
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Actividades pendientes de completar.
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Articulaciones
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-500">
          Articulaciones en las que la persona figura como actor de origen.
        </p>

        <div className="mt-5 space-y-3">
          {articulations.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Articulaciones pendientes de registrar.
            </div>
          ) : (
            articulations.map(
              (articulation) => (
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
                      </p>
                    </div>

                    <span className="text-sm font-medium text-[#2F5D8C]">
                      Ver articulación →
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {articulation.description}
                  </p>

                  {articulation.node_names.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {articulation.node_names.join(' · ')}
                    </p>
                  ) : null}
                </Link>
              )
            )
          )}
        </div>
      </section>
    </div>
  )
}
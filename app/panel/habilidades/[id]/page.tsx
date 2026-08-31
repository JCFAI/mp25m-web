import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  getGlobalSkillProfile,
  type SkillPerson,
} from '../../../../lib/skills/profile'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function verificationLabel(value: string) {
  const labels: Record<string, string> = {
    self_reported: 'Autodeclarada',
    candidate: 'Pendiente de validación',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
  }

  return labels[value] ?? value
}

function verificationBadgeClass(value: string) {
  const classes: Record<string, string> = {
    self_reported:
      'bg-sky-100 text-sky-800 ring-1 ring-sky-200',
    candidate:
      'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200',
    pending:
      'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    confirmed:
      'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200',
    rejected:
      'bg-red-100 text-red-700 ring-1 ring-red-200',
  }

  return [
    'rounded-full px-2.5 py-1 text-xs font-semibold',
    classes[value] ??
      'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  ].join(' ')
}

function experienceLabel(value: string | null) {
  if (!value) {
    return 'Sin informar'
  }

  const labels: Record<string, string> = {
    lt_1: 'Menos de 1 año',
    '1_3': '1 a 3 años',
    '4_7': '4 a 7 años',
    '8_15': '8 a 15 años',
    gt_15: 'Más de 15 años',
    unspecified: 'Sin especificar',
  }

  return labels[value] ?? value
}

function countLabel(
  value: number,
  singular: string,
  plural: string
) {
  return value === 1
    ? `1 ${singular}`
    : `${value} ${plural}`
}

function personNodeItems(person: SkillPerson) {
  return person.node_ids.map((nodeId, index) => ({
    id: nodeId,
    name:
      person.node_names[index] ??
      'Nodo',
    number:
      person.node_numbers[index] ??
      null,
  }))
}

function nodeDisplayName(
  name: string,
  number: number | null
) {
  return number === null
    ? name
    : `Nodo ${number}: ${name}`
}

export default async function SkillProfilePage({
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
    await getGlobalSkillProfile(id)

  if (!profile) {
    notFound()
  }

  const {
    skill,
    aliases,
    people,
    organizations,
    nodePresence,
  } = profile

  return (
    <div className="space-y-5 sm:space-y-7">
      <Link
        href="/panel/habilidades"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Habilidades
      </Link>

      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Habilidad / capacidad
        </p>

        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="min-w-0 break-words text-2xl font-bold tracking-tight sm:text-3xl">
            {skill.display_name}
          </h1>

          {skill.category_name ? (
            <span className="rounded-full bg-[#EAF0F7] px-3 py-1 text-xs font-semibold text-[#1E3A5F] md:bg-white/15 md:text-blue-50">
              {skill.category_name}
            </span>
          ) : null}
        </div>

        {skill.description ? (
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
            {skill.description}
          </p>
        ) : (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
            Descripción pendiente de completar.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {skill.applies_to_person ? (
            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800 md:bg-white/15 md:text-blue-50">
              Personas
            </span>
          ) : null}

          {skill.applies_to_organization ? (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 md:bg-white/15 md:text-blue-50">
              Organizaciones
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {skill.person_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Personas asociadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {skill.organization_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Organizaciones asociadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {skill.node_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Nodos con presencia
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {skill.alias_count}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Aliases
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="break-words text-lg font-semibold text-slate-950">
          Aliases
        </h2>

        <div className="mt-4 flex flex-wrap gap-2">
          {aliases.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay aliases registrados.
            </p>
          ) : (
            aliases.map((alias) => (
              <span
                key={alias.alias_id}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              >
                {alias.alias}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950">
            Personas
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Personas activas que declararon o tienen
            asociada esta capacidad. La validación de la
            capacidad conserva su propio estado.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
          {people.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay personas asociadas a esta capacidad.
            </div>
          ) : (
            people.map((person) => {
              const nodes =
                personNodeItems(person)

              return (
                <article
                  key={person.person_skill_id}
                  className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/panel/personas/${person.person_id}`}
                        className="break-words font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                      >
                        {person.display_name}
                      </Link>

                      {person.profession_text ? (
                        <p className="mt-1 break-words text-xs text-slate-500">
                          Contexto:{' '}
                          {person.profession_text}
                        </p>
                      ) : null}
                    </div>

                    <span
                      className={verificationBadgeClass(
                        person.verification_status
                      )}
                    >
                      {verificationLabel(
                        person.verification_status
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold">
                      {person.proficiency_level
                        ? `Nivel ${person.proficiency_level}/5`
                        : 'Nivel sin informar'}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-1 font-semibold">
                      {experienceLabel(
                        person.experience_range
                      )}
                    </span>
                  </div>

                  {person.experience_notes ? (
                    <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                      {person.experience_notes}
                    </p>
                  ) : null}

                  {person.notes ? (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {person.notes}
                    </p>
                  ) : null}

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Nodos activos confirmados
                    </p>

                    {nodes.length === 0 ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Sin participación territorial
                        confirmada vigente.
                      </p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {nodes.map((node) => (
                          <Link
                            key={node.id}
                            href={`/panel/nodos/${node.id}`}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#2F5D8C] transition hover:bg-[#EAF0F7] hover:underline"
                          >
                            {nodeDisplayName(
                              node.name,
                              node.number
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950">
            Organizaciones
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Organizaciones activas con esta capacidad,
            incluyendo emprendimientos, cooperativas,
            instituciones y empresas de distintos tamaños.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
          {organizations.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay organizaciones asociadas a esta
              capacidad.
            </div>
          ) : (
            organizations.map((organization) => (
              <article
                key={
                  organization.organization_capability_id
                }
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/panel/organizaciones/${organization.organization_id}`}
                      className="break-words font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                    >
                      {organization.organization_name}
                    </Link>

                    <p className="mt-1 break-words text-xs text-slate-500">
                      {organization.organization_type_name}
                    </p>
                  </div>

                  <span
                    className={verificationBadgeClass(
                      organization.verification_status
                    )}
                  >
                    {verificationLabel(
                      organization.verification_status
                    )}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Alcance
                  </p>

                  {organization.scope_node_id &&
                  organization.scope_node_name ? (
                    <Link
                      href={`/panel/nodos/${organization.scope_node_id}`}
                      className="mt-1 inline-flex min-h-10 items-center break-words text-sm font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                    >
                      {nodeDisplayName(
                        organization.scope_node_name,
                        organization.scope_node_number
                      )}
                    </Link>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700">
                      Institucional
                    </p>
                  )}
                </div>

                {organization.notes ? (
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                    {organization.notes}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {organization.source_name ? (
                    <span className="rounded-full bg-white px-2.5 py-1">
                      Fuente: {organization.source_name}
                    </span>
                  ) : null}

                  <span className="rounded-full bg-white px-2.5 py-1">
                    {countLabel(
                      organization.evidence_count,
                      'evidencia',
                      'evidencias'
                    )}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950">
            Presencia territorial
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Nodos donde esta capacidad aparece por personas
            con participación confirmada o por capacidades
            organizacionales con nodo específico y vínculo
            territorial confirmado.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
          {nodePresence.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay presencia territorial confirmada para
              esta capacidad.
            </div>
          ) : (
            nodePresence.map((node) => (
              <article
                key={node.node_id}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
                      {nodeDisplayName(
                        node.node_name,
                        node.node_number
                      )}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {countLabel(
                        node.person_count,
                        'persona',
                        'personas'
                      )}{' '}
                      ·{' '}
                      {countLabel(
                        node.organization_count,
                        'organización',
                        'organizaciones'
                      )}
                    </p>
                  </div>

                  <Link
                    href={`/panel/nodos/${node.node_id}/capacidades`}
                    className="inline-flex min-h-10 shrink-0 items-center text-xs font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                  >
                    Ver capacidades
                  </Link>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

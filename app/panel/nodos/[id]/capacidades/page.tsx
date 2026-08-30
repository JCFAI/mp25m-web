import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../../lib/auth/internal-access'
import {
  getNodeCapabilityMap,
  type NodeOrganizationCapability,
  type NodePersonCapability,
} from '../../../../../lib/nodes/capabilities'
import { createClient } from '../../../../../lib/supabase/server'

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
    candidate: 'Candidata',
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    rejected: 'Rechazada',
  }

  return labels[value] ?? value
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

function groupPersonCapabilities(
  capabilities: NodePersonCapability[]
) {
  const grouped = new Map<
    string,
    {
      skillId: string
      skillName: string
      categoryName: string | null
      people: NodePersonCapability[]
    }
  >()

  for (const capability of capabilities) {
    const current =
      grouped.get(capability.skill_id)

    if (current) {
      current.people.push(capability)
      continue
    }

    grouped.set(capability.skill_id, {
      skillId: capability.skill_id,
      skillName: capability.skill_name,
      categoryName: capability.category_name,
      people: [capability],
    })
  }

  return Array.from(grouped.values())
}

function groupOrganizationCapabilities(
  capabilities: NodeOrganizationCapability[]
) {
  const grouped = new Map<
    string,
    {
      skillId: string
      capabilityName: string
      categoryName: string | null
      organizations: NodeOrganizationCapability[]
    }
  >()

  for (const capability of capabilities) {
    const current =
      grouped.get(capability.skill_id)

    if (current) {
      current.organizations.push(capability)
      continue
    }

    grouped.set(capability.skill_id, {
      skillId: capability.skill_id,
      capabilityName: capability.capability_name,
      categoryName: capability.category_name,
      organizations: [capability],
    })
  }

  return Array.from(grouped.values())
}

export default async function NodeCapabilitiesPage({
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

  const capabilityMap =
    await getNodeCapabilityMap(id)

  if (!capabilityMap) {
    notFound()
  }

  const {
    node,
    vectors,
    personCapabilities,
    organizationCapabilities,
  } = capabilityMap

  const peopleCount =
    new Set(
      personCapabilities.map(
        (capability) => capability.person_id
      )
    ).size

  const organizationCount =
    new Set(
      organizationCapabilities.map(
        (capability) => capability.organization_id
      )
    ).size

  const groupedPeople =
    groupPersonCapabilities(
      personCapabilities
    )

  const groupedOrganizations =
    groupOrganizationCapabilities(
      organizationCapabilities
    )

  return (
    <div className="space-y-5 sm:space-y-7">
      <Link
        href={`/panel/nodos/${id}`}
        className="inline-flex min-h-11 items-center text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver al nodo
      </Link>

      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Mapa de capacidades
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
        </div>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          Vista integrada de vectores territoriales,
          capacidades de personas y capacidades de
          organizaciones vinculadas con el nodo.
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

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {vectors.length}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Vectores territoriales
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {personCapabilities.length}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Capacidades personales relevadas
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {peopleCount}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Personas con capacidades
          </p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
          <p className="text-xl font-bold text-slate-950 sm:text-2xl">
            {organizationCount}
          </p>
          <p className="mt-1 text-xs leading-4 text-slate-500 sm:text-sm sm:leading-5">
            Organizaciones con capacidades
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950 sm:text-xl">
            Vectores territoriales
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Ejes, entramados y recursos detectados en el
            territorio del nodo.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:mt-5 sm:gap-4 lg:grid-cols-2">
          {vectors.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay vectores territoriales registrados.
            </div>
          ) : (
            vectors.map((vector) => (
              <article
                key={vector.vector_id}
                className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-950">
                      {vector.vector_name}
                    </p>

                    {vector.source_name ? (
                      <p className="mt-1 break-words text-xs text-slate-500">
                        Fuente: {vector.source_name}
                      </p>
                    ) : null}
                  </div>

                  <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
                    {verificationLabel(
                      vector.verification_status
                    )}
                  </span>
                </div>

                {vector.evidence_text ? (
                  <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                    {vector.evidence_text}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Evidencia pendiente de documentar.
                  </p>
                )}
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950 sm:text-xl">
            Capacidades de personas
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Capacidades asociadas a personas con participación
            territorial confirmada en el nodo. La capacidad
            conserva su propio estado de validación.
          </p>
        </div>

        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          {groupedPeople.length === 0 ? (
            <div className="rounded-xl border border-slate-100 bg-white p-3 text-sm text-slate-600 shadow-sm sm:border-slate-200 sm:bg-slate-50 sm:p-4 sm:shadow-none">
              No hay capacidades personales relevadas.
            </div>
          ) : (
            groupedPeople.map((group) => (
              <article
                key={group.skillId}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:border-slate-200 sm:shadow-none"
              >
                <div className="bg-slate-50/70 px-3 py-3 sm:px-5 sm:py-4">
                  <p className="break-words font-semibold text-slate-950">
                    {group.skillName}
                  </p>

                  {group.categoryName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {group.categoryName}
                    </p>
                  ) : null}
                </div>

                <div className="divide-y divide-slate-200 bg-white">
                  {group.people.map((person) => (
                    <div
                      key={person.person_skill_id}
                      className="px-3 py-3 sm:px-5 sm:py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/panel/personas/${person.person_id}`}
                            className="break-words font-semibold text-[#2F5D8C] transition hover:text-[#1E3A5F] hover:underline"
                          >
                            {person.display_name}
                          </Link>

                          <p className="mt-1 text-xs text-slate-500">
                            Estado:{' '}
                            {verificationLabel(
                              person.verification_status
                            )}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {person.proficiency_level
                            ? `Nivel ${person.proficiency_level}/5`
                            : 'Nivel sin informar'}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-600">
                        Experiencia:{' '}
                        {experienceLabel(
                          person.experience_range
                        )}
                      </p>

                      {person.experience_notes ? (
                        <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                          {person.experience_notes}
                        </p>
                      ) : null}

                      {person.other_node_names.length > 0 ? (
                        <p className="mt-3 break-words text-xs text-slate-500">
                          También participa en:{' '}
                          {person.other_node_names.join(', ')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 className="break-words text-lg font-semibold text-slate-950 sm:text-xl">
            Capacidades de organizaciones
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-500">
            Capacidades disponibles en empresas, cooperativas,
            universidades, sindicatos, instituciones y otras
            organizaciones relacionadas con el nodo.
          </p>
        </div>

        <div className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
          {groupedOrganizations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 sm:p-5">
              <p className="font-medium text-slate-700">
                Todavía no hay capacidades organizacionales
                registradas para este nodo.
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                El modelo ya está preparado para incorporar
                capacidades institucionales o capacidades
                específicas de una sede o territorio.
              </p>
            </div>
          ) : (
            groupedOrganizations.map((group) => (
              <article
                key={group.skillId}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm sm:border-slate-200 sm:shadow-none"
              >
                <div className="bg-slate-50/70 px-3 py-3 sm:px-5 sm:py-4">
                  <p className="break-words font-semibold text-slate-950">
                    {group.capabilityName}
                  </p>

                  {group.categoryName ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {group.categoryName}
                    </p>
                  ) : null}
                </div>

                <div className="divide-y divide-slate-200 bg-white">
                  {group.organizations.map(
                    (organization) => (
                      <div
                        key={
                          organization.organization_capability_id
                        }
                        className="px-3 py-3 sm:px-5 sm:py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="break-words font-semibold text-slate-950">
                              {
                                organization.organization_name
                              }
                            </p>

                            <p className="mt-1 break-words text-xs text-slate-500">
                              {
                                organization.organization_type_name
                              }
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {verificationLabel(
                              organization.verification_status
                            )}
                          </span>
                        </div>

                        {organization.notes ? (
                          <p className="mt-3 break-words text-sm leading-6 text-slate-600">
                            {organization.notes}
                          </p>
                        ) : null}

                        <p className="mt-3 text-xs text-slate-500">
                          Evidencias registradas:{' '}
                          {organization.evidence_count}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

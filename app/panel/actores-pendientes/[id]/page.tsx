import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getActorCandidateReview } from '../../../../lib/actors/review'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createClient } from '../../../../lib/supabase/server'
import { ResolutionControls } from './resolution-controls'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
  searchParams: Promise<{
    opportunity?: string
  }>
}

function candidateStatusPresentation(
  status: string
) {
  switch (status) {
    case 'merged':
      return {
        label:
          'Vinculado a persona existente',
        className:
          'rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100',
      }

    case 'approved':
      return {
        label:
          'Creado como persona nueva',
        className:
          'rounded-full bg-emerald-300/20 px-3 py-1 text-xs font-semibold text-emerald-100',
      }

    case 'rejected':
      return {
        label:
          'Candidato rechazado',
        className:
          'rounded-full bg-red-300/20 px-3 py-1 text-xs font-semibold text-red-100',
      }

    default:
      return {
        label:
          'Pendiente de validación',
        className:
          'rounded-full bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-100',
      }
  }
}

export default async function ActorCandidateReviewPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params

  const query = await searchParams

  const returnOpportunityId =
    String(
      query.opportunity ?? ''
    ).trim()

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

  const canResolve =
    access.some(
      (item) =>
        item.scope_type === 'global' &&
        (
          item.access_role_code ===
            'administrator' ||
          item.access_role_code ===
            'validator'
        )
    )

  let review

  try {
    review =
      await getActorCandidateReview(id)
  } catch (error) {
    console.error(
      '[MP25M] Candidate review load failed:',
      error
    )

    notFound()
  }

  const {
    candidate,
    matches,
    territorialContext,
  } = review

  const canonicalTerritories =
    territorialContext.filter(
      (item) =>
        item.has_canonical_participation
    )

  const reportedTerritories =
    territorialContext.filter(
      (item) =>
        item.reported_by_candidate &&
        !item.has_canonical_participation
    )

  const status =
    candidateStatusPresentation(
      candidate.status
    )

  return (
    <div className="space-y-7">
      <Link
        href={
          returnOpportunityId
            ? `/panel/oportunidades/${returnOpportunityId}`
            : candidate.opportunity_ids.length ===
                1
              ? `/panel/oportunidades/${candidate.opportunity_ids[0]}`
              : '/panel/oportunidades'
        }
        className="inline-flex text-sm font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
      >
        ← Volver
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
          Revisión de actor
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {candidate.display_name}
          </h1>

          <span
            className={
              status.className
            }
          >
            {status.label}
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-50/80">
          {candidate.status ===
          'pending'
            ? 'Compará este registro provisorio con personas ya existentes antes de decidir si corresponde vincularlo, crear una persona nueva o rechazarlo.'
            : 'Esta revisión ya tiene una resolución registrada. Los datos se mantienen disponibles para consulta y trazabilidad.'}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Datos del candidato
          </h2>

          <dl className="mt-5 space-y-5 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nombre informado
              </dt>

              <dd className="mt-1 font-semibold text-slate-900">
                {candidate.display_name}
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Nodo relacionado
              </dt>

              <dd className="mt-2 flex flex-wrap gap-2">
                {candidate.node_names
                  .length > 0
                  ? candidate.node_names.map(
                      (name) => (
                        <span
                          key={name}
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700"
                        >
                          {name}
                        </span>
                      )
                    )
                  : 'Sin nodo informado'}
              </dd>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Este nodo describe el contexto de procedencia del candidato.
                No constituye por sí solo una pertenencia territorial confirmada.
              </p>
            </div>

            {candidate.context_text ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Contexto informado
                </dt>

                <dd className="mt-1 leading-6 text-slate-700">
                  {
                    candidate.context_text
                  }
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Articulación relacionada
              </dt>

              <dd className="mt-2 space-y-2">
                {candidate.opportunity_titles.map(
                  (
                    title,
                    index
                  ) => {
                    const opportunityId =
                      candidate
                        .opportunity_ids[
                          index
                        ]

                    return opportunityId ? (
                      <Link
                        key={
                          opportunityId
                        }
                        href={`/panel/oportunidades/${opportunityId}`}
                        className="block font-semibold text-[#2F5D8C] hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span
                        key={`${title}-${index}`}
                      >
                        {title}
                      </span>
                    )
                  }
                )}
              </dd>
            </div>
          </dl>
        </section>

        <ResolutionControls
          candidateId={
            candidate.id
          }
          candidateStatus={
            candidate.status
          }
          resolvedPersonId={
            candidate.resolved_person_id
          }
          canResolve={canResolve}
          matches={matches}
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">
            Participaciones territoriales
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            La identidad y la participación territorial se validan por separado.
            Una misma persona puede participar en varios nodos y cumplir
            distintos roles en cada uno.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Participaciones registradas
            </h3>

            <div className="mt-3 space-y-3">
              {canonicalTerritories.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay participaciones territoriales registradas para esta persona.
                </div>
              ) : (
                canonicalTerritories.map(
                  (territory) => (
                    <article
                      key={territory.node_id}
                      className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h4 className="font-semibold text-slate-950">
                          {territory.node_name}
                        </h4>

                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          {territory.participation_verification_status ===
                          'confirmed'
                            ? 'Participación confirmada'
                            : 'Participación pendiente'}
                        </span>
                      </div>

                      {territory.role_names.length > 0 ? (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Roles territoriales
                          </p>

                          {territory.role_names.map(
                            (roleName, index) => (
                              <p
                                key={`${territory.node_id}-${territory.role_codes[index] ?? roleName}`}
                                className="text-sm text-slate-700"
                              >
                                {roleName}
                                {' · '}
                                {territory.role_verification_statuses[
                                  index
                                ] === 'confirmed'
                                  ? 'confirmado'
                                  : 'pendiente'}
                              </p>
                            )
                          )}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-slate-500">
                          Sin rol territorial registrado.
                        </p>
                      )}

                      {territory.reported_by_candidate ? (
                        <p className="mt-3 text-xs text-[#2F5D8C]">
                          Este nodo también fue informado en el registro provisorio.
                        </p>
                      ) : null}
                    </article>
                  )
                )
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Contexto territorial pendiente de validar
            </h3>

            <div className="mt-3 space-y-3">
              {reportedTerritories.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  No hay otros nodos informados pendientes de validación.
                </div>
              ) : (
                reportedTerritories.map(
                  (territory) => (
                    <article
                      key={territory.node_id}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h4 className="font-semibold text-slate-950">
                          {territory.node_name}
                        </h4>

                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Pendiente de validar
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-700">
                        Este nodo fue informado como contexto del candidato,
                        pero todavía no constituye una participación territorial
                        confirmada de la persona.
                      </p>

                      {candidate.opportunity_titles.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Origen del dato:{' '}
                          {candidate.opportunity_titles.join(', ')}
                        </p>
                      ) : null}
                    </article>
                  )
                )
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-900">
          Confirmar una participación territorial no asignará automáticamente
          un rol. Fundador, Referente, Participante u otro rol se registrarán
          explícitamente para cada nodo.
        </div>
      </section>
    </div>
  )
}
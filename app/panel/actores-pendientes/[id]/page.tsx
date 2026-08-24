import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { getActorCandidateReview } from '../../../../lib/actors/review'
import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{
    id: string
  }>
}

function similarityLabel(score: number) {
  if (score >= 0.8) {
    return 'Coincidencia alta'
  }

  if (score >= 0.5) {
    return 'Coincidencia media'
  }

  return 'Coincidencia débil'
}

function verificationLabel(
  value: string | undefined
) {
  switch (value) {
    case 'confirmed':
      return 'Participación confirmada'

    case 'pending':
      return 'Participación pendiente'

    default:
      return 'Participación sin verificar'
  }
}

export default async function ActorCandidateReviewPage({
  params,
}: PageProps) {
  const { id } = await params

  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

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

  const { candidate, matches } =
    review

  return (
    <div className="space-y-7">
      <Link
        href={
          candidate.opportunity_ids.length === 1
            ? `/panel/oportunidades/${candidate.opportunity_ids[0]}`
            : '/panel/oportunidades'
        }
        className="inline-flex text-sm font-semibold text-[#2F5D8C] hover:text-[#1E3A5F]"
      >
        ← Volver
      </Link>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
          Revisión de actor
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {candidate.display_name}
          </h1>

          <span className="rounded-full bg-amber-300/20 px-3 py-1 text-xs font-semibold text-amber-100">
            Pendiente de validación
          </span>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-50/80">
          Compará este registro provisorio con personas ya existentes
          antes de decidir si corresponde vincularlo o crear una
          persona nueva.
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
                {candidate.node_names.length > 0
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
            </div>

            {candidate.context_text ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Contexto informado
                </dt>

                <dd className="mt-1 leading-6 text-slate-700">
                  {candidate.context_text}
                </dd>
              </div>
            ) : null}

            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Articulación relacionada
              </dt>

              <dd className="mt-2 space-y-2">
                {candidate.opportunity_titles.map(
                  (title, index) => {
                    const opportunityId =
                      candidate.opportunity_ids[index]

                    return opportunityId ? (
                      <Link
                        key={opportunityId}
                        href={`/panel/oportunidades/${opportunityId}`}
                        className="block font-semibold text-[#2F5D8C] hover:underline"
                      >
                        {title}
                      </Link>
                    ) : (
                      <span key={`${title}-${index}`}>
                        {title}
                      </span>
                    )
                  }
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Posibles coincidencias
            </h2>

            <p className="mt-1 text-sm leading-6 text-slate-500">
              Estas sugerencias se basan en similitud de nombre.
              No implican que se trate de la misma persona.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            {matches.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No se encontraron personas similares.
              </div>
            ) : (
              matches.map((match, index) => (
                <article
                  key={match.person_id}
                  className={
                    index === 0
                      ? 'rounded-2xl border border-[#2F5D8C]/30 bg-[#2F5D8C]/5 p-5'
                      : 'rounded-2xl border border-slate-200 bg-white p-5'
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-950">
                        {match.display_name}
                      </h3>

                      <p className="mt-1 text-xs font-semibold text-[#2F5D8C]">
                        {similarityLabel(
                          match.similarity_score
                        )}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {Math.round(
                        match.similarity_score * 100
                      )}
                      % similitud
                    </span>
                  </div>

                  {match.node_names.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {match.node_names.map(
                        (nodeName, nodeIndex) => (
                          <div
                            key={`${match.person_id}-${nodeName}`}
                            className="text-sm text-slate-600"
                          >
                            <span className="font-medium text-slate-800">
                              {nodeName}
                            </span>
                            {' · '}
                            {verificationLabel(
                              match
                                .node_verification_statuses[
                                  nodeIndex
                                ]
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">
                      Sin participación territorial registrada.
                    </p>
                  )}
                </article>
              ))
            )}
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Todavía no se realiza ninguna modificación.
            La decisión de identidad será explícita y quedará auditada.
          </div>
        </section>
      </div>
    </div>
  )
}
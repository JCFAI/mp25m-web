import Link from 'next/link'
import {
  notFound,
  redirect,
} from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canFollowupNeedOffer,
  canGovernNeedsOffers,
  canManageNeedOffer,
  getNeedOffer,
  listNeedOfferFollowups,
  listNeedOfferNodeOptions,
  listNeedOfferStatusHistory,
  listNeedOfferUserOptions,
} from '../../../../lib/needs-offers/needs-offers'
import { createClient } from '../../../../lib/supabase/server'
import {
  NeedOfferEditForm,
  NeedOfferFollowups,
  NeedOfferStatusForm,
  needOfferStatusLabels,
  needOfferTypeLabels,
} from '../need-offer-forms'

export const dynamic = 'force-dynamic'

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    'es-AR',
    {
      dateStyle: 'short',
      timeStyle: 'short',
    }
  ).format(new Date(value))
}

export default async function NeedOfferDetailPage({
  params,
}: {
  params: Promise<{
    id: string
  }>
}) {
  const { id } = await params

  const supabase =
    await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      data.claims.sub
    )

  if (!access.length) {
    redirect('/sin-acceso')
  }

  const [
    needOffer,
    followups,
    history,
  ] = await Promise.all([
    getNeedOffer(id),
    listNeedOfferFollowups(id),
    listNeedOfferStatusHistory(
      id
    ),
  ])

  if (!needOffer) {
    notFound()
  }

  const canGovern =
    canGovernNeedsOffers(access)

  const terminal =
    needOffer.status ===
      'closed' ||
    needOffer.status ===
      'cancelled'

  const canManage =
    !terminal &&
    canManageNeedOffer(
      access,
      needOffer
    )

  const canFollowup =
    canFollowupNeedOffer(
      access,
      needOffer
    )

  const [users, nodes] =
    canManage
      ? await Promise.all([
          canGovern
            ? listNeedOfferUserOptions()
            : Promise.resolve(
                []
              ),
          listNeedOfferNodeOptions(),
        ])
      : [[], []]

  return (
    <div className="space-y-6">
      <Link
        href="/panel/necesidades-ofertas"
        className="text-sm font-semibold text-[#2F5D8C]"
      >
        ← Volver a necesidades y ofertas
      </Link>

      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
          {
            needOfferTypeLabels[
              needOffer.record_type
            ]
          }
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          {needOffer.title}
        </h1>

        <p className="mt-3 max-w-4xl whitespace-pre-line text-sm leading-6 text-slate-100/85">
          {needOffer.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
            {
              needOfferStatusLabels[
                needOffer.status
              ]
            }
          </span>

          <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
            Responsable:{' '}
            {
              needOffer.responsible_display_name
            }
          </span>

          {needOffer.node_name ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
              Nodo:{' '}
              {
                needOffer.node_name
              }
            </span>
          ) : null}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Datos del registro
            </h2>

            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-500">
                  Tipo
                </dt>

                <dd className="mt-1 text-slate-800">
                  {
                    needOfferTypeLabels[
                      needOffer.record_type
                    ]
                  }
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Estado
                </dt>

                <dd className="mt-1 text-slate-800">
                  {
                    needOfferStatusLabels[
                      needOffer.status
                    ]
                  }
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Responsable
                </dt>

                <dd className="mt-1 text-slate-800">
                  {
                    needOffer.responsible_display_name
                  }
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Nodo
                </dt>

                <dd className="mt-1 text-slate-800">
                  {
                    needOffer.node_name ??
                    'Sin nodo específico'
                  }
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Creado por
                </dt>

                <dd className="mt-1 text-slate-800">
                  {
                    needOffer.created_by_display_name
                  }
                </dd>
              </div>

              <div>
                <dt className="font-semibold text-slate-500">
                  Creación
                </dt>

                <dd className="mt-1 text-slate-800">
                  {formatDateTime(
                    needOffer.created_at
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <NeedOfferFollowups
            needOfferId={
              needOffer.need_offer_id
            }
            followups={
              followups
            }
            canFollowup={
              canFollowup
            }
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
              Historial de estado
            </h2>

            {history.length ? (
              <ol className="mt-4 space-y-4">
                {history.map(
                  (item) => (
                    <li
                      key={
                        item.history_id
                      }
                      className="border-l-2 border-slate-200 pl-4 text-sm text-slate-700"
                    >
                      <strong>
                        {
                          needOfferStatusLabels[
                            item.status
                          ]
                        }
                      </strong>

                      <p className="mt-1 whitespace-pre-line">
                        {
                          item.rationale
                        }
                      </p>

                      <p className="mt-2 text-xs text-slate-500">
                        Responsable:{' '}
                        {
                          item.responsible_display_name
                        }

                        {item.node_name
                          ? ` · Nodo: ${item.node_name}`
                          : ''}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {
                          item.changed_by_display_name
                        }
                        {' · '}
                        {formatDateTime(
                          item.changed_at
                        )}
                      </p>
                    </li>
                  )
                )}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No hay historial disponible.
              </p>
            )}
          </section>
        </div>

        <aside className="space-y-5">
          {canManage ? (
            <NeedOfferEditForm
              needOffer={
                needOffer
              }
              users={users}
              nodes={nodes}
              canGovern={
                canGovern
              }
            />
          ) : null}

          {canGovern ? (
            <NeedOfferStatusForm
              needOffer={
                needOffer
              }
            />
          ) : null}

          {!canManage &&
          !canGovern ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              Tu acceso actual permite consultar este registro y su historial.
            </section>
          ) : null}

          {terminal ? (
            <section className="rounded-2xl bg-slate-200/70 p-4 text-sm text-slate-600">
              El registro está en estado histórico. No admite edición ni nuevas novedades mientras permanezca{' '}
              <strong>
                {
                  needOfferStatusLabels[
                    needOffer.status
                  ].toLowerCase()
                }
              </strong>
              .
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

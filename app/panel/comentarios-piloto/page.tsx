import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createAdminClient } from '../../../lib/supabase/admin'
import { createClient } from '../../../lib/supabase/server'
import { PilotFeedbackAdminControls } from './pilot-feedback-admin-controls'
import { PilotFeedbackForm } from './pilot-feedback-form'

type FeedbackRow = {
  id: string
  feedback_type: string
  detail: string
  context_path: string | null
  status: string
  admin_response: string | null
  created_by_internal_user_id?: string
  created_by_display_name?: string | null
  reviewed_by_display_name: string | null
  created_at: string
  reviewed_at: string | null
  archived_at?: string | null
}

const typeLabels: Record<string, string> = {
  difficulty: 'Dificultad',
  suggestion: 'Sugerencia',
  error: 'Error',
  other: 'Otro',
}

const statusLabels: Record<string, string> = {
  new: 'Nuevo',
  in_review: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone:
      'America/Argentina/Buenos_Aires',
  }).format(new Date(value))
}

export default async function PilotFeedbackPage() {
  const supabase = await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const authUserId =
    data?.claims?.sub

  if (error || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const internalUserIds = [
    ...new Set(
      access.map(
        (item) => item.internal_user_id
      )
    ),
  ]

  if (internalUserIds.length !== 1) {
    throw new Error(
      'Unable to resolve a unique internal user'
    )
  }

  const internalUserId =
    internalUserIds[0]

  const canReviewFeedback = access.some(
    (item) =>
      [
        'administrator',
        'local_administrator',
        'founder_access',
      ].includes(item.access_role_code)
  )

  const admin = createAdminClient()

  const {
    data: myFeedbackData,
    error: myFeedbackError,
  } = await admin.rpc(
    'list_my_pilot_feedback',
    {
      p_actor_internal_user_id:
        internalUserId,
      p_limit: 50,
    }
  )

  const myFeedback =
    myFeedbackError
      ? []
      : ((myFeedbackData ?? []) as FeedbackRow[])

  let adminFeedback: FeedbackRow[] = []
  let adminFeedbackError = false

  if (canReviewFeedback) {
    const {
      data: feedbackData,
      error: feedbackError,
    } = await admin.rpc(
      'list_pilot_feedback',
      {
        p_actor_internal_user_id:
          internalUserId,
        p_limit: 100,
      }
    )

    if (feedbackError) {
      console.error(
        '[MP25M] Unable to load pilot feedback:',
        feedbackError
      )
      adminFeedbackError = true
    } else {
      adminFeedback =
        (feedbackData ?? []) as FeedbackRow[]
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
          Piloto MP25M_S
        </p>

        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
          Sugerencias para este Programa
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Registrá dificultades, errores o sugerencias.
          Vas a poder seguir acá mismo el estado y la
          respuesta del equipo.
        </p>

        <PilotFeedbackForm />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">
            Mis comentarios
          </h2>

          <Link
            href="/panel/comentarios-piloto/archivados"
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ver archivados
          </Link>
        </div>

        {myFeedbackError ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            No se pudieron cargar tus comentarios.
          </p>
        ) : myFeedback.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            Todavía no registraste comentarios.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {myFeedback.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200">
                    {typeLabels[item.feedback_type]}
                  </span>

                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    {statusLabels[item.status]}
                  </span>

                  {item.archived_at ? (
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      Archivado
                    </span>
                  ) : null}

                  <time className="ml-auto text-xs text-slate-500">
                    {formatDate(item.created_at)}
                  </time>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                  {item.detail}
                </p>

                {item.admin_response ? (
                  <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                      Respuesta
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-950">
                      {item.admin_response}
                    </p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      {canReviewFeedback ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
            Administración
          </p>

          <h2 className="mt-2 text-xl font-semibold text-slate-950">
            Comentarios recibidos
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Los archivados dejan de aparecer en esta
            bandeja, pero permanecen registrados.
          </p>

          {adminFeedbackError ? (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              No se pudieron cargar los comentarios.
            </p>
          ) : adminFeedback.length === 0 ? (
            <p className="mt-5 text-sm text-slate-600">
              No hay comentarios pendientes en la bandeja.
            </p>
          ) : (
            <div className="mt-5 space-y-4">
              {adminFeedback.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200">
                      {typeLabels[item.feedback_type]}
                    </span>

                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                      {statusLabels[item.status]}
                    </span>

                    <time className="ml-auto text-xs text-slate-500">
                      {formatDate(item.created_at)}
                    </time>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                    {item.detail}
                  </p>

                  <p className="mt-3 text-xs text-slate-500">
                    Enviado por:{' '}
                    <strong className="text-slate-700">
                      {item.created_by_display_name ??
                        'Usuario interno'}
                    </strong>
                  </p>

                  {item.context_path ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Contexto: {item.context_path}
                    </p>
                  ) : null}

                  <PilotFeedbackAdminControls
                    feedbackId={item.id}
                    status={item.status}
                    response={item.admin_response}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createAdminClient } from '../../../../lib/supabase/admin'
import { createClient } from '../../../../lib/supabase/server'

type FeedbackRow = {
  id: string
  feedback_type: string
  detail: string
  context_path: string | null
  status: string
  admin_response: string | null
  created_by_display_name?: string | null
  reviewed_by_display_name: string | null
  created_at: string
  reviewed_at: string | null
  archived_at: string | null
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
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(value))
}

function FeedbackCard({
  item,
  showSender = false,
}: {
  item: FeedbackRow
  showSender?: boolean
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-slate-200">
          {typeLabels[item.feedback_type] ?? item.feedback_type}
        </span>

        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
          {statusLabels[item.status] ?? item.status}
        </span>

        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
          Archivado
        </span>

        {item.archived_at ? (
          <time className="ml-auto text-xs text-slate-500">
            Archivado {formatDate(item.archived_at)}
          </time>
        ) : null}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {item.detail}
      </p>

      {showSender && item.created_by_display_name ? (
        <p className="mt-3 text-xs text-slate-500">
          Enviado por:{' '}
          <strong className="text-slate-700">
            {item.created_by_display_name}
          </strong>
        </p>
      ) : null}

      {item.context_path ? (
        <p className="mt-1 text-xs text-slate-500">
          Contexto: {item.context_path}
        </p>
      ) : null}

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
  )
}

export default async function ArchivedPilotFeedbackPage() {
  const supabase = await createClient()

  const { data, error } =
    await supabase.auth.getClaims()

  const authUserId = data?.claims?.sub

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
    data: myData,
    error: myError,
  } = await admin.rpc(
    'list_my_archived_pilot_feedback',
    {
      p_actor_internal_user_id:
        internalUserId,
      p_limit: 100,
    }
  )

  const myArchived =
    myError
      ? []
      : ((myData ?? []) as FeedbackRow[])

  let allArchived: FeedbackRow[] = []
  let allError = false

  if (canReviewFeedback) {
    const {
      data: archivedData,
      error: archivedError,
    } = await admin.rpc(
      'list_archived_pilot_feedback',
      {
        p_actor_internal_user_id:
          internalUserId,
        p_limit: 200,
      }
    )

    if (archivedError) {
      console.error(
        '[MP25M] Unable to load archived feedback:',
        archivedError
      )
      allError = true
    } else {
      allArchived =
        (archivedData ?? []) as FeedbackRow[]
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Piloto MP25M_S
            </p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Comentarios archivados
            </h1>
          </div>

          <Link
            href="/panel/comentarios-piloto"
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            ← Volver a activos
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-semibold text-slate-950">
          Mis archivados
        </h2>

        {myError ? (
          <p className="mt-4 text-sm text-red-700">
            No se pudieron cargar tus archivados.
          </p>
        ) : myArchived.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No tenés comentarios archivados.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {myArchived.map((item) => (
              <FeedbackCard
                key={item.id}
                item={item}
              />
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
            Todos los archivados
          </h2>

          {allError ? (
            <p className="mt-4 text-sm text-red-700">
              No se pudieron cargar los archivados.
            </p>
          ) : allArchived.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">
              No hay comentarios archivados.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {allArchived.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  showSender
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}

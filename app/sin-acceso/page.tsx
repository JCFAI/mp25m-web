import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { guardarMensajeInicial } from './actions'

type Props = {
  searchParams: Promise<{
    mensaje?: string
  }>
}

export const dynamic = 'force-dynamic'

export default async function SinAccesoPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const { data: userData } = await supabase.auth.getUser()
  const currentMessage =
    typeof userData.user?.user_metadata?.access_message === 'string'
      ? userData.user.user_metadata.access_message
      : ''

  const displayName =
    typeof userData.user?.user_metadata?.display_name === 'string'
      ? userData.user.user_metadata.display_name.trim()
      : ''
  const email = userData.user?.email ?? ''

  const params = await searchParams

  return (
    <main className="min-h-screen bg-[#F4F6F9] px-5 py-10 text-slate-950 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(30,58,95,0.10)]">
          <div className="bg-[#1E3A5F] px-6 py-7 text-white sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
              Movimiento Productivo 25 de Mayo
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">
              Bienvenido a MP25M
            </h1>

            <p className="mt-3 max-w-xl text-sm leading-6 text-white/80">
              Tu cuenta ya está registrada. Desde acá podés comenzar a participar.
            </p>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-800">
                  ✓
                </div>

                <div>
                  <h2 className="font-semibold text-emerald-950">
                    Tu cuenta está activa
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-emerald-900/80">
                    No necesitás volver a registrarte. Los permisos adicionales
                    se incorporarán sobre esta misma cuenta.
                  </p>

                  <div className="mt-4 rounded-xl border border-emerald-200 bg-white/70 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-800/70">
                      Sesión iniciada como
                    </p>
                    <p className="mt-1 font-semibold text-emerald-950">
                      {displayName || 'Usuario MP25M'}
                    </p>
                    {email ? (
                      <p className="mt-0.5 text-sm text-emerald-900/80">
                        {email}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
                Acceso inicial
              </p>

              <h2 className="mt-2 text-xl font-semibold">
                ¿Qué podés hacer ahora?
              </h2>

              <div className="mt-4 grid gap-3">
                <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">
                    Conocer el sistema
                  </p>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Tu acceso comienza con las funciones básicas habilitadas para
                    nuevos participantes.
                  </p>
                </article>
              </div>
            </section>

            <section className="rounded-2xl border border-[#D8E0EA] bg-[#F5F7FA] p-5">
              <h2 className="text-lg font-semibold text-[#1E3A5F]">
                ¿Querés dejar un mensaje?
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Es opcional. Si quienes administran el sistema ya conocen tu
                incorporación, no necesitás explicar nada.
              </p>

              {params.mensaje === 'ok' ? (
                <p
                  role="status"
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  Mensaje guardado.
                </p>
              ) : null}

              {params.mensaje === 'error' ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  No pudimos guardar el mensaje. Intentá nuevamente.
                </p>
              ) : null}

              <form action={guardarMensajeInicial} className="mt-4 space-y-4">
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    Mensaje
                  </span>

                  <textarea
                    name="message"
                    rows={4}
                    maxLength={1000}
                    defaultValue={currentMessage}
                    placeholder="Escribí un mensaje si lo considerás necesario."
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
                  />
                </label>

                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-[#1E3A5F] px-5 text-sm font-semibold text-white hover:bg-[#14263D]"
                >
                  Enviar mensaje
                </button>
              </form>
            </section>

            <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Volver al inicio
              </Link>

              <div className="flex flex-col justify-center text-xs leading-5 text-slate-500">
                <span>Sesión: {displayName || 'Usuario MP25M'}</span>
                {email ? <span>{email}</span> : null}
              </div>

              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

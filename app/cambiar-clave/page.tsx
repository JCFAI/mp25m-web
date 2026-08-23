import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'
import { changePassword } from './actions'

type CambiarClavePageProps = {
  searchParams: Promise<{
    error?: string
  }>
}

const errorMessages: Record<string, string> = {
  campos: 'Completá ambos campos.',
  longitud: 'La nueva contraseña debe tener al menos 12 caracteres.',
  'no-coinciden': 'Las contraseñas no coinciden.',
  actualizacion: 'No pudimos actualizar la contraseña. Probá con otra.',
}

export default async function CambiarClavePage({
  searchParams,
}: CambiarClavePageProps) {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.sub) {
    redirect('/recuperar-clave?error=sesion')
  }

  const params = await searchParams

  const errorMessage = params.error
    ? errorMessages[params.error]
    : null

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Movimiento Productivo 25 de Mayo
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Nueva contraseña
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Elegí una nueva contraseña de al menos 12 caracteres.
          </p>

          {errorMessage ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          <form action={changePassword} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Nueva contraseña
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="password_confirmation"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Repetir contraseña
              </label>

              <input
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={12}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Guardar nueva contraseña
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

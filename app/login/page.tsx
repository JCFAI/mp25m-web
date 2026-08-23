import { login } from './actions'

type LoginPageProps = {
  searchParams: Promise<{
    error?: string
    reset?: string
  }>
}

const errorMessages: Record<string, string> = {
  campos: 'Ingresá tu email y contraseña.',
  credenciales: 'El email o la contraseña no son correctos.',
  sesion: 'No pudimos validar la sesión. Intentá nuevamente.',
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams

  const errorMessage = params.error
    ? errorMessages[params.error]
    : null

  const passwordChanged = params.reset === 'ok'

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-8">
            <p className="text-sm font-medium text-slate-500">
              Movimiento Productivo 25 de Mayo
            </p>

            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              Acceso al sistema
            </h1>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              Ingresá con la cuenta habilitada para el backoffice de MP25M.
            </p>
          </div>

          {passwordChanged ? (
            <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              La contraseña fue actualizada. Ya podés ingresar con la nueva.
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMessage}
            </div>
          ) : null}

          <form action={login} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Email
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>

              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-slate-500"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/recuperar-clave"
              className="text-sm font-medium text-slate-700 underline"
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            El acceso es únicamente para usuarios habilitados.
          </p>
        </div>
      </div>
    </main>
  )
}

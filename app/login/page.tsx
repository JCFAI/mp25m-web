import { PasswordInput } from '../../components/password-input'
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
    <main className="min-h-screen bg-[#F4F6F9] px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 border-t-4 border-t-[#1E3A5F] bg-white p-8 shadow-[0_18px_50px_rgba(30,58,95,0.10)]">
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-[#2F5D8C] focus:ring-2 focus:ring-[#2F5D8C]/10"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>

              <PasswordInput
                id="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white hover:bg-[#14263D]"
            >
              Ingresar
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href="/recuperar-clave"
              className="text-sm font-medium text-[#2F5D8C] underline underline-offset-4 hover:text-[#1E3A5F]"
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

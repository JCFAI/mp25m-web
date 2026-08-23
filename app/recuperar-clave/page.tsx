import { requestPasswordReset } from './actions'

type RecuperarClavePageProps = {
  searchParams: Promise<{
    estado?: string
    error?: string
  }>
}

export default async function RecuperarClavePage({
  searchParams,
}: RecuperarClavePageProps) {
  const params = await searchParams

  const sent = params.estado === 'enviado'

  const errorMessage =
    params.error === 'email'
      ? 'Ingresá una dirección de email válida.'
      : params.error === 'envio'
        ? 'No pudimos procesar la solicitud. Intentá nuevamente más tarde.'
        : params.error === 'enlace'
          ? 'El enlace de recuperación no es válido o ya venció.'
          : params.error === 'sesion'
            ? 'La sesión de recuperación no es válida. Solicitá un nuevo enlace.'
            : null

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Movimiento Productivo 25 de Mayo
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Recuperar contraseña
          </h1>

          {sent ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              Si existe una cuenta asociada a ese email, vas a recibir un
              mensaje con las instrucciones para establecer una nueva
              contraseña.
            </div>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Ingresá el email de tu cuenta. Te enviaremos un enlace para
                establecer una nueva contraseña.
              </p>

              {errorMessage ? (
                <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {errorMessage}
                </div>
              ) : null}

              <form action={requestPasswordReset} className="mt-6 space-y-5">
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

                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Enviar enlace
                </button>
              </form>
            </>
          )}

          <div className="mt-6 text-center">
            <a
              href="/login"
              className="text-sm font-medium text-slate-700 underline"
            >
              Volver al ingreso
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}

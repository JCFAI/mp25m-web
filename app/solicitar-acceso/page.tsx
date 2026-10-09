import Link from 'next/link'
import { redirect } from 'next/navigation'
import { solicitarAcceso } from './actions'

type Props = { searchParams: Promise<{ error?: string }> }

export default async function SolicitarAccesoPage({ searchParams }: Props) {
  if (process.env.MP25M_ENABLE_ACCESS_REQUESTS !== 'true') redirect('/login')
  const params = await searchParams
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-12 text-slate-900">
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm text-slate-500">Movimiento Productivo 25 de Mayo</p>
        <h1 className="mt-2 text-2xl font-semibold">Solicitar acceso</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Registrá tu cuenta para solicitar autorización. El registro no habilita
          el acceso a la información del sistema: un administrador deberá aprobar
          y asignar un rol y su ámbito.
        </p>
        {params.error ? (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {params.error === 'datos'
              ? 'Revisá los datos. La contraseña debe tener entre 12 y 128 caracteres.'
              : 'No pudimos procesar la solicitud. Intentá nuevamente más tarde.'}
          </p>
        ) : null}
        <form action={solicitarAcceso} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Nombre y apellido
            <input name="name" required minLength={2} maxLength={120} autoComplete="name"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3" />
          </label>
          <label className="block text-sm font-medium">Correo electrónico
            <input type="email" name="email" required autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3" />
          </label>
          <label className="block text-sm font-medium">Contraseña
            <input type="password" name="password" required minLength={12} maxLength={128}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-lg border border-slate-300 p-3" />
          </label>
          <button type="submit"
            className="w-full rounded-lg bg-[#1E3A5F] px-4 py-3 font-semibold text-white">
            Enviar solicitud
          </button>
        </form>
        <Link href="/login" className="mt-6 inline-block text-sm text-[#2F5D8C] underline">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  )
}

import Link from 'next/link'
import { redirect } from 'next/navigation'

export default function SolicitudRecibidaPage() {
  if (process.env.MP25M_ENABLE_ACCESS_REQUESTS !== 'true') redirect('/login')
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Cuenta registrada</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Revisá tu correo para confirmar la cuenta, cuando corresponda.
          Después vas a poder ingresar a MP25M con tu acceso inicial.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[#2F5D8C] underline">
          Ir al inicio de sesión
        </Link>
      </section>
    </main>
  )
}

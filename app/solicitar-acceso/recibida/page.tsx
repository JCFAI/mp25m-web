import Link from 'next/link'
import { redirect } from 'next/navigation'

export default function SolicitudRecibidaPage() {
  if (process.env.MP25M_ENABLE_ACCESS_REQUESTS !== 'true') redirect('/login')
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-16 text-slate-900">
      <section className="mx-auto max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Registro enviado</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Si el registro pudo completarse, revisá tu correo para confirmar la cuenta,
          cuando corresponda. La cuenta todavía no tiene autorización para ingresar
          al panel de MP25M. Un administrador deberá habilitarla expresamente.
        </p>
        <Link href="/login" className="mt-6 inline-block text-[#2F5D8C] underline">
          Ir al inicio de sesión
        </Link>
      </section>
    </main>
  )
}

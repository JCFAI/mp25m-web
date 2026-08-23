export default function SinAccesoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-medium text-slate-500">
            Movimiento Productivo 25 de Mayo
          </p>

          <h1 className="mt-2 text-3xl font-semibold text-slate-900">
            Sin acceso al panel
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            La cuenta fue autenticada correctamente, pero actualmente no
            tiene un permiso interno activo para acceder al backoffice.
          </p>

          <form action="/auth/signout" method="post" className="mt-8">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}

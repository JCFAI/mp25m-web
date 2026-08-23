export default function PanelPage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-slate-500">
          Incremento 1
        </p>

        <h1 className="mt-2 text-3xl font-semibold text-slate-900">
          Backoffice MP25M
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          La autenticación y la autorización interna están funcionando.
          Desde este panel vamos a incorporar progresivamente las
          herramientas de administración del sistema.
        </p>

        <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-medium text-emerald-900">
            Acceso autorizado
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            La identidad fue validada por Supabase Auth y el acceso fue
            confirmado contra los roles internos de MP25M.
          </p>
        </div>
      </div>
    </main>
  )
}

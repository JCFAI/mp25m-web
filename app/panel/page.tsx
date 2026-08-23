const modules = [
  {
    name: 'Oportunidades',
    description:
      'Registro, an\u00e1lisis y seguimiento de oportunidades y necesidades productivas.',
    next: true,
  },
  {
    name: 'Organizaciones',
    description:
      'Informaci\u00f3n de empresas, instituciones y fuerzas productivas vinculadas.',
  },
  {
    name: 'Nodos',
    description:
      'Composici\u00f3n territorial, participantes y actividad de cada nodo.',
  },
  {
    name: 'Capacidades',
    description:
      'Mapa de habilidades, profesiones, rubros y capacidades disponibles.',
  },
  {
    name: 'Articulaciones',
    description:
      'Seguimiento de v\u00ednculos y acciones entre actores y nodos.',
  },
  {
    name: 'Proyectos',
    description:
      'Iniciativas productivas, responsables, avances y resultados.',
  },
]

export default function PanelPage() {
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-50">
            <span className="h-2 w-2 rounded-full bg-sky-300" />
            Incremento 1 operativo
          </div>

          <p className="text-sm font-medium text-slate-100/75">
            Movimiento Productivo 25 de Mayo
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Backoffice MP25M
          </h1>

          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-50/80 sm:text-base">
            {'Espacio interno para administrar progresivamente la informaci\u00f3n, las capacidades y las articulaciones del movimiento.'}
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              Estado
            </p>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              Activo
            </span>
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            Acceso interno
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {'La identidad y los permisos internos est\u00e1n siendo validados correctamente.'}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              Seguridad
            </p>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Incremento 1
            </span>
          </div>

          <h2 className="mt-5 text-lg font-semibold text-slate-950">
            {'Autenticaci\u00f3n y roles'}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {'Supabase Auth identifica al usuario y el sistema verifica despu\u00e9s sus roles y \u00e1mbitos internos.'}
          </p>
        </article>

        <article className="rounded-2xl border border-[#D8E0EA] bg-[#F5F7FA] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#64748B]">
              {'Pr\u00f3ximo incremento'}
            </p>

            <span className="rounded-full bg-[#DDE8F3] px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
              Siguiente
            </span>
          </div>

          <h2 className="mt-5 text-lg font-semibold text-[#1E3A5F]">
            Oportunidades
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            {'Ser\u00e1 el primer m\u00f3dulo operativo incorporado sobre esta nueva base de backoffice.'}
          </p>
        </article>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Estructura prevista
            </p>

            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              {'M\u00f3dulos del sistema'}
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-slate-500">
            {'Los m\u00f3dulos se ir\u00e1n habilitando por incrementos. Los que todav\u00eda no est\u00e1n activos se muestran \u00fanicamente para anticipar la estructura del backoffice.'}
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <article
              key={module.name}
              className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-5 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF0F7] font-bold text-[#2F5D8C]">
                  {module.name.charAt(0)}
                </div>

                <span
                  className={
                    module.next
                      ? 'rounded-full bg-[#DDE8F3] px-2.5 py-1 text-[11px] font-semibold text-[#2F5D8C]'
                      : 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500'
                  }
                >
                  {module.next ? 'Pr\u00f3ximo' : 'Planificado'}
                </span>
              </div>

              <h3 className="mt-5 text-base font-semibold text-slate-900">
                {module.name}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {module.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
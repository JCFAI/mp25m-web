import Link from 'next/link'

type PanelModule = {
  name: string
  description: string
  status: 'active' | 'next' | 'planned'
  href?: string
}

const modules: PanelModule[] = [
  {
    name: 'Articulaciones',
    description:
      'Registro, an\u00e1lisis y seguimiento de articulaciones productivas, sus oportunidades y necesidades.',
    status: 'active',
    href: '/panel/oportunidades',
  },
  {
    name: 'Personas',
    description:
      'Directorio de personas, sus participaciones territoriales, habilidades y articulaciones.',
    status: 'active',
    href: '/panel/personas',
  },
  {
    name: 'Nodos',
    description:
      'Composici\u00f3n territorial, participantes y actividad de cada nodo.',
    status: 'active',
    href: '/panel/nodos',
  },
  {
    name: 'Organizaciones',
    description:
      'Informaci\u00f3n de empresas, instituciones y fuerzas productivas vinculadas.',
    status: 'active',
    href: '/panel/organizaciones',
  },
  {
    name: 'Habilidades',
    description:
      'Directorio de habilidades personales y capacidades productivas u organizacionales relevadas.',
    status: 'active',
    href: '/panel/habilidades',
  },
  {
    name: 'Proyectos',
    description:
      'Iniciativas productivas, responsables, avances y resultados.',
    status: 'planned',
  },
  {
    name: 'Informes',
    description:
      'Lecturas, reportes y tableros para seguir la evoluci\u00f3n del sistema.',
    status: 'planned',
  },
]

function moduleBadge(module: PanelModule) {
  if (module.status === 'active') {
    return {
      label: 'Activo',
      className:
        'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100',
    }
  }

  if (module.status === 'next') {
    return {
      label: 'Pr\u00f3ximo',
      className:
        'rounded-full bg-[#DDE8F3] px-2.5 py-1 text-[11px] font-semibold text-[#2F5D8C]',
    }
  }

  return {
    label: 'Planificado',
    className:
      'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500',
  }
}

function moduleCardClass(isActive: boolean) {
  return isActive
    ? 'group block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#2F5D8C]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#2F5D8C]/20 sm:bg-slate-50/60 sm:p-5 sm:shadow-none sm:hover:bg-white sm:hover:shadow-sm'
    : 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:border-slate-200 sm:bg-slate-50/60 sm:p-5 sm:shadow-none'
}

function ModuleCard({
  module,
}: {
  module: PanelModule
}) {
  const badge = moduleBadge(module)
  const active = Boolean(module.href)
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF0F7] font-bold text-[#2F5D8C]">
          {module.name.charAt(0)}
        </div>

        <span className={badge.className}>
          {badge.label}
        </span>
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:mt-5">
        {module.name}
      </h3>

      <p className="mt-2 text-sm leading-6 text-slate-500">
        {module.description}
      </p>

      {active ? (
        <span className="mt-4 inline-flex text-xs font-semibold text-[#2F5D8C] transition group-hover:text-[#1E3A5F] group-hover:underline">
          Ingresar →
        </span>
      ) : null}
    </>
  )

  if (module.href) {
    return (
      <Link
        href={module.href}
        className={moduleCardClass(true)}
      >
        {content}
      </Link>
    )
  }

  return (
    <article className={moduleCardClass(false)}>
      {content}
    </article>
  )
}

export default function PanelPage() {
  return (
    <div className="space-y-5 sm:space-y-7">
      <section className="overflow-hidden rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#2F5D8C] md:to-[#14263D] md:p-6 md:text-white">
        <div className="max-w-3xl">

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:hidden">
            Sistema MP25M
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:mt-0">
            Backoffice MP25M
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-slate-50/80">
            {'Espacio interno para administrar progresivamente la informaci\u00f3n, las habilidades y las articulaciones del movimiento.'}
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              Estado
            </p>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
              Activo
            </span>
          </div>

          <h2 className="mt-4 text-base font-semibold text-slate-950 sm:mt-5 sm:text-lg">
            Backoffice operativo
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {'Los m\u00f3dulos principales incorporados hasta esta etapa ya pueden utilizarse desde el panel interno.'}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-500">
              Seguridad
            </p>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              Activa
            </span>
          </div>

          <h2 className="mt-4 text-base font-semibold text-slate-950 sm:mt-5 sm:text-lg">
            {'Autenticaci\u00f3n y roles'}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {'Supabase Auth identifica al usuario y el sistema aplica sus roles y \u00e1mbitos internos.'}
          </p>
        </article>

        <article className="rounded-2xl border border-[#D8E0EA] bg-[#F5F7FA] p-4 shadow-sm sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#64748B]">
              {'Etapa actual'}
            </p>

            <span className="rounded-full bg-[#DDE8F3] px-2.5 py-1 text-xs font-semibold text-[#2F5D8C]">
              Incremento 6
            </span>
          </div>

          <h2 className="mt-4 text-base font-semibold text-[#1E3A5F] sm:mt-5 sm:text-lg">
            Habilidades y capacidades
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            {'El sistema integra personas, nodos, organizaciones y el catálogo común de capacidades.'}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl md:p-7">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:gap-4 sm:pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Estructura prevista
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
              {'M\u00f3dulos del sistema'}
            </h2>
          </div>

          <p className="max-w-xl text-sm leading-6 text-slate-500">
            {'Los m\u00f3dulos activos permiten acceder directamente a las funciones ya incorporadas. Los restantes se muestran para anticipar la evoluci\u00f3n prevista del backoffice.'}
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.name}
              module={module}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

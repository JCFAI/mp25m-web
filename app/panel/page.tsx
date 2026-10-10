import Link from 'next/link'
import {
  getCurrentReleaseStage,
  getReleaseModuleByKey,
  isReleaseStageAvailable,
  type ReleaseStage,
} from '../../lib/release-stage'

type PanelModule = {
  name: string
  description: string
  status: 'active' | 'next' | 'planned'
  href?: string
  availableFrom?: ReleaseStage
}

const modules: PanelModule[] = [
  {
    name: 'Oportunidades',
    description:
      'Registro y seguimiento de oportunidades productivas como base para su análisis.',
    status: 'active',
    href: '/panel/oportunidades',
    availableFrom: 'L',
  },
  {
    name: 'Necesidades y ofertas',
    description:
      'Registro independiente de necesidades y ofertas, con responsables, estados, seguimiento e historial.',
    status: 'active',
    href: '/panel/necesidades-ofertas',
    availableFrom: 'L',
  },
  {
    name: 'Personas',
    description:
      'Directorio de personas, sus participaciones territoriales, habilidades y oportunidades.',
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
    name: 'Articulaciones',
    description:
      'Proceso de conexión operativa de actores y recursos para concretar oportunidades.',
    status: 'active',
    href: '/panel/articulaciones',
  },
  {
    name: 'Proyectos',
    description:
      'Ejecuciones acordadas, responsables, avances y resultados de articulaciones cerradas.',
    status: 'active',
    href: '/panel/proyectos',
  },
  {
    name: 'Temas',
    description:
      'Asuntos transversales, responsables, estados y seguimientos sostenidos por el Movimiento.',
    status: 'active',
    href: '/panel/temas',
  },
  {
    name: 'Informes',
    description:
      'Indicadores operativos y lecturas agregadas para seguir la evolución del sistema.',
    status: 'active',
    href: '/panel/informes',
    availableFrom: 'M',
  },
]

function moduleBadge(
  module: PanelModule,
  currentStage: ReleaseStage,
) {
  if (
    module.availableFrom &&
    !isReleaseStageAvailable(
      currentStage,
      module.availableFrom,
    )
  ) {
    return {
      label: `MP25M_${module.availableFrom}`,
      className:
        'rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200',
    }
  }

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
  currentStage,
}: {
  module: PanelModule
  currentStage: ReleaseStage
}) {
  const badge = moduleBadge(
    module,
    currentStage,
  )
  const active = Boolean(module.href)
  const available =
    !module.availableFrom ||
    isReleaseStageAvailable(
      currentStage,
      module.availableFrom,
    )
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
          {available
            ? 'Ingresar →'
            : `Se incorporará en MP25M_${module.availableFrom} →`}
        </span>
      ) : null}
    </>
  )

  if (module.href) {
    return (
      <Link
        href={module.href}
        data-tour={
          module.name === 'Articulaciones'
            ? 'module-articulations'
            : undefined
        }
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

type PanelPageProps = {
  searchParams: Promise<{
    release?: string
    module?: string
    access?: string
  }>
}

export default async function PanelPage({
  searchParams,
}: PanelPageProps) {
  const currentStage =
    getCurrentReleaseStage()
  const query = await searchParams
  const unavailableModule =
    query.release === 'unavailable'
      ? getReleaseModuleByKey(query.module)
      : undefined
  const accessDenied =
    query.access === 'denied'

  return (
    <div className="space-y-5 sm:space-y-7">
      <section data-tour="panel-hero" className="overflow-hidden rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#2F5D8C] md:to-[#14263D] md:p-6 md:text-white">
        <div className="max-w-3xl">

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:hidden">
            Sistema MP25M
          </p>

          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl md:mt-0">
            Backoffice MP25M_{currentStage}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-slate-50/80">
            {'Espacio interno para administrar progresivamente la informaci\u00f3n, las habilidades y las articulaciones del movimiento.'}
          </p>
        </div>
      </section>

      {unavailableModule ? (
        <section
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm"
        >
          <h2 className="text-base font-semibold">
            {unavailableModule.label} todavía no está disponible
          </h2>
          <p className="mt-1 text-sm leading-6">
            Se incorporará en MP25M_{unavailableModule.availableFrom}. Actualmente estás recorriendo MP25M_{currentStage}.
          </p>
        </section>
      ) : null}

      {accessDenied ? (
        <section
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm"
        >
          <h2 className="text-base font-semibold">
            Acceso restringido
          </h2>
          <p className="mt-1 text-sm leading-6">
            No tenés permisos para acceder a esa sección.
          </p>
        </section>
      ) : null}

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
              MP25M_{currentStage}
            </span>
          </div>

          <h2 className="mt-4 text-base font-semibold text-[#1E3A5F] sm:mt-5 sm:text-lg">
            Recorrido vigente
          </h2>

          <p className="mt-2 text-sm leading-6 text-[#64748B]">
            {'Las funciones se liberan globalmente en etapas sucesivas para incorporar el uso del sistema de forma gradual.'}
          </p>
        </article>
      </section>

      <section data-tour="panel-modules" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 md:rounded-3xl md:p-7">
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
              currentStage={currentStage}
            />
          ))}
        </div>
      </section>
    </div>
  )
}

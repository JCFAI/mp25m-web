'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const futureModules = [
  'Organizaciones',
  'Nodos',
  'Habilidades',
  'Proyectos',
  'Informes',
]

function activeClass(isActive: boolean) {
  return isActive
    ? 'flex items-center justify-between rounded-xl bg-white/12 px-3 py-3 text-sm font-semibold text-white shadow-sm'
    : 'flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-slate-50/80 transition hover:bg-white/8 hover:text-white'
}

export function PanelNavigation() {
  const pathname = usePathname()

  const homeActive = pathname === '/panel'

  const opportunitiesActive =
    pathname === '/panel/oportunidades' ||
    pathname.startsWith('/panel/oportunidades/')

  const peopleActive =
    pathname === '/panel/personas' ||
    pathname.startsWith('/panel/personas/')

  return (
    <nav className="px-3 py-5">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/50">
        Navegación
      </p>

      <div className="space-y-1">
        <Link
          href="/panel"
          aria-current={homeActive ? 'page' : undefined}
          className={activeClass(homeActive)}
        >
          <span>Inicio</span>

          {homeActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/oportunidades"
          aria-current={
            opportunitiesActive ? 'page' : undefined
          }
          className={activeClass(opportunitiesActive)}
        >
          <span>Articulaciones</span>

          {opportunitiesActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/personas"
          aria-current={
            peopleActive ? 'page' : undefined
          }
          className={activeClass(peopleActive)}
        >
          <span>Personas</span>

          {peopleActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        {futureModules.map((module) => (
          <div
            key={module}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-50/65"
            aria-disabled="true"
          >
            <span>{module}</span>

            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100/50">
              Próximo
            </span>
          </div>
        ))}
      </div>
    </nav>
  )
}
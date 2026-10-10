'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function activeClass(isActive: boolean) {
  return isActive
    ? 'flex items-center justify-between rounded-xl bg-white/12 px-3 py-3 text-sm font-semibold text-white shadow-sm'
    : 'flex items-center justify-between rounded-xl px-3 py-3 text-sm font-medium text-slate-50/80 transition hover:bg-white/8 hover:text-white'
}

export function PanelNavigation({ canManageAccess }: { canManageAccess: boolean }) {
  const pathname = usePathname()

  const homeActive = pathname === '/panel'
  const accessActive = pathname === '/panel/accesos' || pathname.startsWith('/panel/accesos/')

  const opportunitiesActive =
    pathname === '/panel/oportunidades' ||
    pathname.startsWith('/panel/oportunidades/')

  const peopleActive =
    pathname === '/panel/personas' ||
    pathname.startsWith('/panel/personas/')

  const nodesActive =
    pathname === '/panel/nodos' ||
    pathname.startsWith('/panel/nodos/')

  const organizationsActive =
    pathname === '/panel/organizaciones' ||
    pathname.startsWith('/panel/organizaciones/')

  const skillsActive =
    pathname === '/panel/habilidades' ||
    pathname.startsWith('/panel/habilidades/')

  const projectsActive =
    pathname === '/panel/proyectos' ||
    pathname.startsWith('/panel/proyectos/')

  const articulationsActive =
    pathname === '/panel/articulaciones' ||
    pathname.startsWith('/panel/articulaciones/')

  const themesActive =
    pathname === '/panel/temas' ||
    pathname.startsWith('/panel/temas/')

  const needsOffersActive =
    pathname === '/panel/necesidades-ofertas' ||
    pathname.startsWith('/panel/necesidades-ofertas/')

  const agendaActive =
    pathname === '/panel/agenda' ||
    pathname.startsWith('/panel/agenda/')

  const communicationsActive =
    pathname === '/panel/comunicaciones' ||
    pathname.startsWith('/panel/comunicaciones/')

  const reportsActive =
    pathname === '/panel/informes' ||
    pathname.startsWith('/panel/informes/')

  const pilotFeedbackActive =
    pathname === '/panel/comentarios-piloto' ||
    pathname.startsWith('/panel/comentarios-piloto/')

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
          href="/panel/articulaciones"
          aria-current={articulationsActive ? 'page' : undefined}
          className={activeClass(articulationsActive)}
        >
          <span>Articulaciones</span>

          {articulationsActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/proyectos"
          aria-current={projectsActive ? 'page' : undefined}
          className={activeClass(projectsActive)}
        >
          <span>Proyectos</span>

          {projectsActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/temas"
          aria-current={themesActive ? 'page' : undefined}
          className={activeClass(themesActive)}
        >
          <span>Temas</span>

          {themesActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/nodos"
          aria-current={
            nodesActive ? 'page' : undefined
          }
          className={activeClass(nodesActive)}
        >
          <span>Nodos</span>

          {nodesActive ? (
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

        <Link
          href="/panel/organizaciones"
          aria-current={
            organizationsActive
              ? 'page'
              : undefined
          }
          className={activeClass(
            organizationsActive
          )}
        >
          <span>Organizaciones</span>

          {organizationsActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/habilidades"
          aria-current={
            skillsActive ? 'page' : undefined
          }
          className={activeClass(skillsActive)}
        >
          <span>Habilidades</span>

          {skillsActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/agenda"
          aria-current={agendaActive ? 'page' : undefined}
          className={activeClass(agendaActive)}
        >
          <span>Agenda</span>

          {agendaActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/comunicaciones"
          aria-current={communicationsActive ? 'page' : undefined}
          className={activeClass(communicationsActive)}
        >
          <span>Comunicaciones</span>

          {communicationsActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/informes"
          aria-current={reportsActive ? 'page' : undefined}
          className={activeClass(reportsActive)}
        >
          <span>Informes</span>

          {reportsActive ? (
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
          <span>Oportunidades</span>

          {opportunitiesActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <Link
          href="/panel/necesidades-ofertas"
          aria-current={needsOffersActive ? 'page' : undefined}
          className={activeClass(needsOffersActive)}
        >
          <span>Necesidades y ofertas</span>

          {needsOffersActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        <div className="my-3 border-t border-white/10" />

        <Link
          href="/panel/comentarios-piloto"
          aria-current={pilotFeedbackActive ? 'page' : undefined}
          className={activeClass(pilotFeedbackActive)}
        >
          <span>Sugerencias para este Programa</span>

          {pilotFeedbackActive ? (
            <span className="h-2 w-2 rounded-full bg-sky-300" />
          ) : null}
        </Link>

        {canManageAccess ? (
          <Link href="/panel/accesos" aria-current={accessActive ? 'page' : undefined} className={activeClass(accessActive)}>
            <span>Administración de accesos</span>
            {accessActive ? <span className="h-2 w-2 rounded-full bg-sky-300" /> : null}
          </Link>
        ) : null}
      </div>
    </nav>
  )
}

'use client'

import type {
  PointerEvent as ReactPointerEvent,
  TransitionEvent as ReactTransitionEvent,
} from 'react'
import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigationItems = [
  {
    href: '/panel',
    label: 'Inicio',
    marker: 'I',
  },
  {
    href: '/panel/oportunidades',
    label: 'Articulaciones',
    marker: 'A',
  },
  {
    href: '/panel/personas',
    label: 'Personas',
    marker: 'P',
  },
  {
    href: '/panel/nodos',
    label: 'Nodos',
    marker: 'N',
  },
  {
    href: '/panel/organizaciones',
    label: 'Organizaciones',
    marker: 'O',
  },
]

const futureModules = [
  {
    label: 'Habilidades',
    marker: 'H',
  },
  {
    label: 'Proyectos',
    marker: 'P',
  },
  {
    label: 'Informes',
    marker: 'I',
  },
]

const HANDLE_OPEN_THRESHOLD = 38
const DRAWER_CLOSE_THRESHOLD = -52

function isActivePath(
  pathname: string,
  href: string
) {
  return (
    pathname === href ||
    (href !== '/panel' &&
      pathname.startsWith(`${href}/`))
  )
}

function mobileLinkClass(isActive: boolean) {
  return isActive
    ? 'flex min-h-[52px] items-center gap-3 rounded-2xl bg-white/15 px-3 py-3 text-base font-semibold text-white shadow-sm ring-1 ring-white/10'
    : 'flex min-h-[52px] items-center gap-3 rounded-2xl px-3 py-3 text-base font-medium text-slate-50/80 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none'
}

function markerClass(isActive: boolean) {
  return isActive
    ? 'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sky-200 text-xs font-black text-[#1E3A5F]'
    : 'grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-bold text-slate-50/70'
}

export function PanelMobileNavigation({
  displayName,
  roleName,
  scopeName,
}: {
  displayName: string
  roleName: string
  scopeName: string
}) {
  const pathname = usePathname()
  const menuId = useId()
  const closeButtonRef =
    useRef<HTMLButtonElement>(null)
  const handleDragStart =
    useRef<{
      x: number
      y: number
    } | null>(null)
  const drawerDragStartX =
    useRef<number | null>(null)
  const drawerDragStartY =
    useRef<number | null>(null)
  const drawerDragOffset =
    useRef(0)
  const drawerIsDragging =
    useRef(false)

  const [drawerMounted, setDrawerMounted] =
    useState(false)
  const [open, setOpen] = useState(false)
  const [dragOffset, setDragOffset] =
    useState(0)

  function openNavigation() {
    setDrawerMounted(true)
    setDragOffset(0)
    drawerDragOffset.current = 0

    window.requestAnimationFrame(() => {
      setOpen(true)
    })
  }

  function closeNavigation() {
    setOpen(false)
    setDragOffset(0)
    drawerDragOffset.current = 0
    drawerIsDragging.current = false
  }

  useEffect(() => {
    if (!open) {
      return
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeNavigation()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener(
        'keydown',
        onKeyDown
      )
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const previousOverflow =
      document.body.style.overflow

    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow =
        previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const mediaQuery = window.matchMedia(
      '(min-width: 768px)'
    )

    function onMediaQueryChange(
      event: MediaQueryListEvent
    ) {
      if (event.matches) {
        closeNavigation()
      }
    }

    if (mediaQuery.matches) {
      closeNavigation()
      return
    }

    mediaQuery.addEventListener(
      'change',
      onMediaQueryChange
    )

    return () => {
      mediaQuery.removeEventListener(
        'change',
        onMediaQueryChange
      )
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    const timeout = window.setTimeout(() => {
      closeButtonRef.current?.focus()
    }, 120)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [open])

  useEffect(() => {
    if (drawerMounted) {
      closeNavigation()
    }
  }, [pathname])

  function onHandlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return
    }

    handleDragStart.current = {
      x: event.clientX,
      y: event.clientY,
    }
    event.currentTarget.setPointerCapture(
      event.pointerId
    )
  }

  function onHandlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const start = handleDragStart.current

    if (!start) {
      return
    }

    const horizontalDelta =
      event.clientX - start.x
    const verticalDelta =
      Math.abs(event.clientY - start.y)

    if (
      horizontalDelta >=
        HANDLE_OPEN_THRESHOLD &&
      horizontalDelta > verticalDelta
    ) {
      handleDragStart.current = null
      if (
        event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.releasePointerCapture(
          event.pointerId
        )
      }
      openNavigation()
    }
  }

  function onHandlePointerEnd(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    handleDragStart.current = null

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      )
    }
  }

  function onDrawerPointerDown(
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (
      event.pointerType === 'mouse' &&
      event.button !== 0
    ) {
      return
    }

    drawerDragStartX.current = event.clientX
    drawerDragStartY.current = event.clientY
    drawerDragOffset.current = 0
    drawerIsDragging.current = false
  }

  function onDrawerPointerMove(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const startX = drawerDragStartX.current
    const startY = drawerDragStartY.current

    if (startX === null || startY === null) {
      return
    }

    const horizontalDelta =
      event.clientX - startX
    const verticalDelta =
      Math.abs(event.clientY - startY)

    if (
      !drawerIsDragging.current &&
      (horizontalDelta > -8 ||
        Math.abs(horizontalDelta) <= verticalDelta)
    ) {
      return
    }

    if (!drawerIsDragging.current) {
      drawerIsDragging.current = true

      if (
        !event.currentTarget.hasPointerCapture(
          event.pointerId
        )
      ) {
        event.currentTarget.setPointerCapture(
          event.pointerId
        )
      }
    }

    const nextOffset = Math.min(
      0,
      horizontalDelta
    )

    event.preventDefault()
    drawerDragOffset.current = nextOffset
    setDragOffset(nextOffset)
  }

  function onDrawerPointerEnd(
    event: ReactPointerEvent<HTMLElement>
  ) {
    const offset = drawerDragOffset.current

    drawerDragStartX.current = null
    drawerDragStartY.current = null
    drawerDragOffset.current = 0
    drawerIsDragging.current = false

    if (
      event.currentTarget.hasPointerCapture(
        event.pointerId
      )
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      )
    }

    if (offset <= DRAWER_CLOSE_THRESHOLD) {
      closeNavigation()
      return
    }

    setDragOffset(0)
  }

  function onDrawerTransitionEnd(
    event: ReactTransitionEvent<HTMLElement>
  ) {
    if (
      event.target === event.currentTarget &&
      !open
    ) {
      setDrawerMounted(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-controls={menuId}
        aria-expanded={open}
        aria-label="Abrir navegación"
        onClick={openNavigation}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerEnd}
        onPointerCancel={onHandlePointerEnd}
        className="fixed left-0 top-[22dvh] z-40 flex h-24 w-4 touch-none items-center justify-center rounded-r-2xl border-y border-r border-white/20 bg-[#1E3A5F]/75 shadow-lg shadow-slate-900/10 backdrop-blur-md transition hover:w-5 hover:bg-[#1E3A5F]/90 focus:w-5 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C]/30 md:hidden"
      >
        <span
          aria-hidden="true"
          className="flex flex-col gap-1"
        >
          <span className="h-1 w-1 rounded-full bg-white/85" />
          <span className="h-1 w-1 rounded-full bg-white/85" />
          <span className="h-1 w-1 rounded-full bg-white/85" />
        </span>
      </button>

      {drawerMounted ? (
        <div
          className={
            open
              ? 'fixed inset-0 z-50 pointer-events-auto md:hidden'
              : 'pointer-events-none fixed inset-0 z-50 md:hidden'
          }
        >
          <button
            type="button"
            aria-label="Cerrar navegación"
            onClick={closeNavigation}
            className={
              open
                ? 'absolute inset-0 h-full w-full bg-slate-950/50 opacity-100 backdrop-blur-[1px] transition-opacity duration-300 ease-out'
                : 'absolute inset-0 h-full w-full bg-slate-950/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 ease-out'
            }
          />

          <aside
            id={menuId}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            onPointerDown={onDrawerPointerDown}
            onPointerMove={onDrawerPointerMove}
            onPointerUp={onDrawerPointerEnd}
            onPointerCancel={onDrawerPointerEnd}
            onTransitionEnd={onDrawerTransitionEnd}
            style={
              open && dragOffset < 0
                ? {
                    transform: `translateX(${dragOffset}px)`,
                  }
                : undefined
            }
            className={[
              'absolute left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[min(84vw,320px)] max-w-full touch-pan-y flex-col overflow-y-auto overscroll-contain bg-[#1E3A5F]/95 text-white shadow-2xl backdrop-blur-md transition-transform duration-300 ease-out',
              open
                ? 'translate-x-0'
                : '-translate-x-full',
              dragOffset < 0
                ? 'transition-none'
                : '',
            ].join(' ')}
          >
            <div className="shrink-0 flex items-start justify-between gap-4 border-b border-white/10 px-5 pb-4 pt-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black tracking-wide text-[#1E3A5F] shadow-sm">
                  25M
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-100/70">
                    Sistema
                  </p>

                  <p className="mt-1 truncate text-lg font-semibold">
                    MP25M
                  </p>
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeNavigation}
                className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-2xl border border-white/15 text-lg font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/25"
              >
                <span aria-hidden="true">×</span>
                <span className="sr-only">
                  Cerrar navegación
                </span>
              </button>
            </div>

            <nav
              className="shrink-0 px-3 py-5"
              aria-label="Navegación móvil"
            >
              <div className="space-y-1.5">
                {navigationItems.map((item) => {
                  const active = isActivePath(
                    pathname,
                    item.href
                  )

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={
                        active ? 'page' : undefined
                      }
                      className={mobileLinkClass(active)}
                    >
                      <span
                        className={markerClass(active)}
                        aria-hidden="true"
                      >
                        {item.marker}
                      </span>

                      <span className="min-w-0 flex-1">
                        {item.label}
                      </span>

                      {active ? (
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-sky-300"
                        />
                      ) : null}
                    </Link>
                  )
                })}

                <div className="mt-3 border-t border-white/10 pt-3">
                  {futureModules.map((module) => (
                    <div
                      key={module.label}
                      className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 py-3 text-base text-slate-50/60"
                      aria-disabled="true"
                    >
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-xs font-bold text-slate-50/50"
                        aria-hidden="true"
                      >
                        {module.marker}
                      </span>

                      <span className="min-w-0 flex-1">
                        {module.label}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-100/50">
                        Próximo
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </nav>

            <div className="mt-auto shrink-0 border-t border-white/10 px-5 pb-[calc(1.25rem_+_env(safe-area-inset-bottom))] pt-5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {displayName}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                    {roleName}
                  </span>

                  <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-50/80">
                    {scopeName}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <Link
                  href="/panel/perfil"
                  className="flex min-h-11 items-center rounded-xl px-3 py-2 text-sm font-semibold text-slate-50/90 transition hover:bg-white/10 hover:text-white focus:bg-white/10 focus:outline-none"
                >
                  Perfil
                </Link>

                <form
                  action="/auth/signout"
                  method="post"
                >
                  <button
                    type="submit"
                    className="min-h-11 w-full rounded-xl border border-white/15 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/25"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  )
}

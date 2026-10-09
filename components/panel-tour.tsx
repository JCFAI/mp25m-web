'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { usePathname } from 'next/navigation'

type TourStep = {
  key: string
  target?: string
  title: string
  description: string
}

const storageKey = 'mp25m-panel-contextual-tour-v1-seen'

function stepsForPath(pathname: string): TourStep[] {
  if (pathname === '/panel') {
    return [
      {
        key: 'welcome',
        target: 'panel-hero',
        title: 'Bienvenida a MP25M',
        description:
          'Este recorrido ubica las funciones disponibles hoy y muestra cómo empezar a trabajar sin crear datos de práctica.',
      },
      {
        key: 'modules',
        target: 'panel-modules',
        title: 'El sistema crece por etapas',
        description:
          'Los módulos disponibles se usan desde ahora. Los que muestran una etapa futura permanecen visibles como hoja de ruta.',
      },
      {
        key: 'articulations',
        target: 'module-articulations',
        title: 'Las articulaciones organizan el trabajo',
        description:
          'Desde aquí podés registrar una coordinación entre actores, definir responsable y dejar su seguimiento.',
      },
    ]
  }

  if (pathname === '/panel/articulaciones') {
    return [
      {
        key: 'articulation-purpose',
        target: 'articulations-intro',
        title: 'Una articulación puede empezar por sí misma',
        description:
          'No necesita nacer de una oportunidad. Después puede relacionarse con personas, organizaciones, proyectos y otros recursos.',
      },
      {
        key: 'articulation-create',
        target: 'articulation-create',
        title: 'Empezá por lo esencial',
        description:
          'Indicá nombre, propósito inicial y responsable si ya está definido. Se puede completar y actualizar más adelante.',
      },
      {
        key: 'articulation-directory',
        target: 'articulation-directory',
        title: 'Consultá las articulaciones registradas',
        description:
          'Cada ficha muestra su estado, responsable y participantes. Abrí una para continuar el recorrido contextual.',
      },
    ]
  }

  if (pathname.startsWith('/panel/articulaciones/')) {
    return [
      {
        key: 'articulation-summary',
        target: 'articulation-summary',
        title: 'Ésta es la ficha de trabajo',
        description:
          'Resume el propósito, estado y responsable de la articulación.',
      },
      {
        key: 'articulation-history',
        target: 'articulation-history',
        title: 'El historial conserva las decisiones',
        description:
          'Cada cambio de estado deja responsable, fecha, motivo y la persona que lo registró.',
      },
      {
        key: 'articulation-management',
        target: 'articulation-management',
        title: 'Gestioná la articulación',
        description:
          'Según tus permisos, desde acá actualizás estado y responsable, incorporás participantes y registrás seguimiento.',
      },
      {
        key: 'articulation-status',
        target: 'articulation-status',
        title: 'Estado y responsable',
        description:
          'Dejá claro cómo sigue el proceso y quién queda a cargo del próximo paso.',
      },
      {
        key: 'articulation-followup',
        target: 'articulation-followup',
        title: 'Registrá el seguimiento',
        description:
          'Una novedad puede registrar un contacto, reunión, compromiso, resultado o información general.',
      },
      {
        key: 'articulation-participant-action',
        target: 'articulation-participant-action',
        title: 'Sumá participantes sin duplicarlos',
        description:
          'El selector utiliza Personas y Organizaciones canónicas ya registradas en MP25M.',
      },
      {
        key: 'articulation-participants',
        target: 'articulation-participants',
        title: 'Participantes vinculados',
        description:
          'La ficha mantiene visible quiénes participan y el motivo de cada incorporación.',
      },
      {
        key: 'articulation-followups',
        target: 'articulation-followups',
        title: 'Novedades y seguimiento',
        description:
          'La trazabilidad permite comprender el proceso sin depender de la memoria de una sola persona.',
      },
    ]
  }

  return []
}

export function PanelTour() {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [dialogHeight, setDialogHeight] = useState(320)
  const [stepIndex, setStepIndex] = useState(0)
  const [availableSteps, setAvailableSteps] =
    useState<TourStep[]>([])
  const [targetRect, setTargetRect] =
    useState<DOMRect | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextSteps = stepsForPath(pathname).filter(
        (step) =>
          !step.target ||
          Boolean(
            document.querySelector(
              '[data-tour="' + step.target + '"]',
            ),
          ),
      )

      setStepIndex(0)
      setAvailableSteps(nextSteps)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pathname])

  useEffect(() => {
    if (
      pathname !== '/panel' ||
      window.localStorage.getItem(storageKey) === 'true'
    ) {
      return
    }

    const timeout = window.setTimeout(() => {
      setStepIndex(0)
      setOpen(true)
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [pathname])

  const activeStep = useMemo(
    () => availableSteps[stepIndex],
    [availableSteps, stepIndex],
  )

  useEffect(() => {
    const element =
      open && activeStep?.target
        ? document.querySelector<HTMLElement>(
            '[data-tour="' + activeStep.target + '"]',
          )
        : null

    const frame = window.requestAnimationFrame(() => {
      if (!element) {
        setTargetRect(null)
        return
      }

      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches

      element.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
        block: 'center',
      })

      setTargetRect(element.getBoundingClientRect())
    })

    if (!element) {
      return () => window.cancelAnimationFrame(frame)
    }

    const measure = () => {
      setTargetRect(element.getBoundingClientRect())
    }

    window.addEventListener('resize', measure)
    window.addEventListener(
      'scroll',
      measure,
      { capture: true, passive: true },
    )

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [activeStep, open])

  useEffect(() => {
    if (!open) return

    dialogRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.localStorage.setItem(storageKey, 'true')
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return

    const dialog = dialogRef.current
    if (!dialog) return

    const measure = () => {
      setDialogHeight(dialog.getBoundingClientRect().height)
    }

    const observer = new ResizeObserver(measure)
    observer.observe(dialog)
    measure()

    window.addEventListener('resize', measure)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [open, activeStep])

  function closeTour() {
    window.localStorage.setItem(storageKey, 'true')
    setOpen(false)
  }

  function startTour() {
    setStepIndex(0)
    setOpen(true)
  }

  if (availableSteps.length === 0) {
    return null
  }

  const viewportWidth =
    typeof window === 'undefined'
      ? 1024
      : window.innerWidth

  const viewportHeight =
    typeof window === 'undefined' ? 768 : window.innerHeight

  const margin = 16
  const gap = 18
  const visibleHeight = Math.min(dialogHeight, viewportHeight - 2 * margin)

  const popoverTop = (() => {
    if (!targetRect) return margin

    const below = targetRect.bottom + gap
    const above = targetRect.top - gap - visibleHeight

    if (viewportHeight - below - margin >= visibleHeight) {
      return below
    }

    if (above >= margin) {
      return above
    }

    const freeBelow = viewportHeight - targetRect.bottom
    const freeAbove = targetRect.top

    return freeBelow >= freeAbove
      ? Math.max(margin, viewportHeight - visibleHeight - margin)
      : margin
  })()

  const popoverStyle: CSSProperties | undefined = targetRect
    ? {
        left: Math.max(margin, Math.min(targetRect.left, viewportWidth - 336)),
        top: popoverTop,
        maxHeight: `calc(100dvh - ${popoverTop + margin}px)`,
        overflowY: 'auto',
      }
    : undefined

  return (
    <>
      <button
        type="button"
        onClick={startTour}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#14263D] focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] focus:ring-offset-2 motion-reduce:transition-none"
      >
        Ver recorrido
      </button>

      {open && activeStep ? (
        <div className="fixed inset-0 z-50">
          {targetRect ? (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed rounded-2xl border-2 border-sky-300 transition-all duration-200 motion-reduce:transition-none"
              style={{
                left: targetRect.left - 6,
                top: targetRect.top - 6,
                width: targetRect.width + 12,
                height: targetRect.height + 12,
                boxShadow:
                  '0 0 0 9999px rgba(15, 23, 42, 0.58)',
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              className="pointer-events-none fixed inset-0 bg-slate-950/60"
            />
          )}

          <div
            ref={dialogRef}
            role="dialog"
            aria-label="Recorrido guiado de MP25M"
            tabIndex={-1}
            style={popoverStyle}
            className={
              targetRect
                ? 'fixed z-10 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-white p-5 text-slate-950 shadow-2xl outline-none'
                : 'fixed inset-x-4 bottom-5 z-10 mx-auto max-w-md rounded-2xl bg-white p-5 text-slate-950 shadow-2xl outline-none'
            }
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Recorrido MP25M
            </p>

            <h2 className="mt-2 text-lg font-semibold">
              {activeStep.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeStep.description}
            </p>

            <p className="mt-4 text-xs font-medium text-slate-500">
              Paso {stepIndex + 1} de {availableSteps.length}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={closeTour}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none"
              >
                Salir
              </button>

              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setStepIndex((index) => index - 1)}
                    className="rounded-xl px-3 py-2 text-sm font-semibold text-[#1E3A5F] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none"
                  >
                    Anterior
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (stepIndex + 1 >= availableSteps.length) {
                      closeTour()
                      return
                    }

                    setStepIndex((index) => index + 1)
                  }}
                  className="rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] focus:ring-offset-2 motion-reduce:transition-none"
                >
                  {stepIndex + 1 >= availableSteps.length
                    ? 'Finalizar'
                    : 'Siguiente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

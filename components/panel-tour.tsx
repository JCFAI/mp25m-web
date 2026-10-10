'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  getTourLayout,
  getTourScrollAdjustment,
  type TourLayout,
} from '../lib/tour/placement'
import {
  contextualStageSTourSteps,
  homeStageSTourSteps,
  type StageTourAudience,
} from '../lib/tour/stage-s-steps'

type TourStep = {
  key: string
  target?: string
  title: string
  description: string
}

const storageKey = 'mp25m-panel-contextual-tour-v2-seen'

function stepsForPath(pathname: string, audience: StageTourAudience): TourStep[] {
  if (pathname === '/panel') {
    return homeStageSTourSteps(audience)
  }

  if (pathname === '/panel/articulaciones') {
    return [
      {
        key: 'articulation-purpose',
        target: 'articulations-intro',
        title: '¿Para qué sirve una articulación?',
        description:
          'Una articulación es un trabajo coordinado entre personas u organizaciones para conseguir un objetivo concreto. Por ejemplo, reunir recursos y responsables para organizar una entrega. No necesitás registrar primero una Oportunidad: podés iniciar la Articulación por sí misma y vincular luego personas, organizaciones, proyectos u otros recursos. El primer paso es reconocer qué se quiere lograr y quiénes podrían participar.',
      },
      {
        key: 'articulation-create',
        target: 'articulation-create',
        title: 'Cómo registrar una articulación',
        description:
          'En «Nombre de la articulación», escribí una frase breve que permita identificarla; por ejemplo, «Entrega de materiales a una escuela». En «Objetivo o propósito inicial», explicá qué se quiere conseguir y para quién. En el desplegable podés elegir a la persona responsable de coordinarla, si ya está definida, o mantener «Sin responsable inicial». El botón «Crear articulación» guarda el registro para completarlo y seguir su evolución más adelante. Durante este recorrido no lo pulses: solo estamos conociendo el formulario.',
      },
      {
        key: 'articulation-directory',
        target: 'articulation-directory',
        title: 'Abrí una articulación existente',
        description:
          'En «Articulaciones registradas» aparecen las propuestas ya cargadas. Cada tarjeta identifica la articulación e informa su estado actual, responsable y cantidad de participantes. Para conocer el trabajo realizado, pulsá «Finalizar» y después abrí una tarjeta existente. En esa ficha seleccioná «Ver recorrido»: te mostrará dónde consultar los cambios de estado, las personas vinculadas y las novedades de seguimiento. No hace falta editar ni guardar nada para hacer esta prueba.',
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
          'En la parte superior se identifica la articulación, su objetivo y el estado actual. Revisá primero estos datos para saber qué se busca lograr, quién coordina el trabajo y en qué situación se encuentra.',
      },
      {
        key: 'articulation-history',
        target: 'articulation-history',
        title: 'El historial conserva las decisiones',
        description:
          'El historial permite reconstruir las decisiones: cuándo cambió el estado, quién registró el cambio y por qué. Consultalo antes de tomar una nueva decisión para no perder el contexto del trabajo.',
      },
      {
        key: 'articulation-management',
        target: 'articulation-management',
        title: 'Gestioná la articulación',
        description:
          'Este sector reúne las acciones de gestión. Según los permisos de tu usuario, podés cambiar el estado, reasignar a la persona responsable, agregar participantes y registrar novedades. En este recorrido solo vamos a identificar las opciones, sin guardar cambios.',
      },
      {
        key: 'articulation-status',
        target: 'articulation-status',
        title: 'Estado y responsable',
        description:
          'El campo «Estado» describe la situación actual de la articulación. «Responsable» indica quién coordina el próximo paso. Al registrar un cambio, completá el motivo para que otras personas entiendan la decisión. El resumen de cierre corresponde cuando se finaliza el trabajo. No guardes cambios durante esta práctica.',
      },
      {
        key: 'articulation-followup',
        target: 'articulation-followup',
        title: 'Registrá el seguimiento',
        description:
          'Usá el seguimiento para registrar lo que ocurrió: por ejemplo, una llamada, una reunión o un compromiso. Elegí el tipo de novedad, describí el hecho y luego guardalo cuando estés operando realmente. Durante este tutorial no registres nada.',
      },
      {
        key: 'articulation-participant-action',
        target: 'articulation-participant-action',
        title: 'Sumá participantes sin duplicarlos',
        description:
          'Para sumar a alguien, pulsá «Elegir persona u organización» y buscá un registro existente. Así vinculás a la misma persona u organización sin crear duplicados. Podés explicar en «Motivo» por qué participa. No confirmes ningún agregado durante esta guía.',
      },
      {
        key: 'articulation-participants',
        target: 'articulation-participants',
        title: 'Participantes vinculados',
        description:
          'En «Participantes» consultás las personas u organizaciones que intervienen y por qué fueron vinculadas. Este listado ayuda a saber con quién coordinar y a reconocer responsabilidades sin duplicar contactos.',
      },
      {
        key: 'articulation-followups',
        target: 'articulation-followups',
        title: 'Novedades y seguimiento',
        description:
          'En «Novedades y seguimiento» aparece la secuencia de acciones registradas, con su contenido y fecha. Leé esas entradas para retomar el trabajo, identificar compromisos pendientes y comprender cómo avanzó la articulación.',
      },
    ]
  }

  return contextualStageSTourSteps(pathname)
}

export function PanelTour({
  isBasicParticipant,
  canManageAccess,
  canReviewArticulations,
}: StageTourAudience) {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [availableSteps, setAvailableSteps] = useState<TourStep[]>([])
  const [layoutState, setLayoutState] = useState<{
    stepId: string
    layout: TourLayout
  } | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const steps = stepsForPath(pathname, {
        isBasicParticipant,
        canManageAccess,
        canReviewArticulations,
      }).filter(
        step => !step.target || Boolean(
          document.querySelector('[data-tour="' + step.target + '"]'),
        ),
      )
      setStepIndex(0)
      setLayoutState(null)
      setAvailableSteps(steps)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [pathname, isBasicParticipant, canManageAccess, canReviewArticulations])

  useEffect(() => {
    if (pathname !== '/panel' ||
        window.localStorage.getItem(storageKey) === 'true') return

    const timer = window.setTimeout(() => {
      setStepIndex(0)
      setLayoutState(null)
      setOpen(true)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [pathname])

  const activeStep = useMemo(
    () => availableSteps[stepIndex],
    [availableSteps, stepIndex],
  )
  const stepId = `${pathname}:${stepIndex}:${activeStep?.key ?? ''}`
  const isReady = open && layoutState?.stepId === stepId
  const side = isReady ? layoutState.layout.side : 'top'
  const spotlight = isReady ? layoutState.layout.spotlight : null

  // The two-layer UI (dialog + spotlight) only becomes visible after both
  // have been measured for the SAME step. No document padding is ever used.
  useLayoutEffect(() => {
    if (!open || !activeStep) {
      setLayoutState(null)
      return
    }

    const guide = dialogRef.current
    const target = activeStep.target
      ? document.querySelector<HTMLElement>(
          '[data-tour="' + activeStep.target + '"]',
        )
      : null

    if (!guide) return
    let frame = 0
    let disposed = false

    const measure = (initial: boolean) => {
      if (disposed) return
      const dialogHeight = guide.getBoundingClientRect().height
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      }

      if (target && initial) {
        let rect = target.getBoundingClientRect()
        const available = viewport.height - dialogHeight - 40
        // Preserve the existing scroll position whenever the target already
        // fits. Large sections are focused at their beginning if off-screen.
        if (rect.bottom < 32 || rect.top > viewport.height - 48 ||
            (rect.height > available && rect.top < 0)) {
          target.scrollIntoView({
            behavior: 'instant',
            block: rect.height > available ? 'start' : 'nearest',
          })
          rect = target.getBoundingClientRect()
        }

        const delta = getTourScrollAdjustment(
          rect,
          viewport.height,
          dialogHeight,
        )
        if (delta !== 0) {
          window.scrollBy({ top: delta, behavior: 'instant' })
        }
      }

      const rect = target?.getBoundingClientRect()
      const result = rect
        ? getTourLayout(rect, viewport, dialogHeight)
        : {
            side: 'top' as const,
            spotlight: null,
            visibleHeight: 0,
            freeHeight: viewport.height - dialogHeight - 40,
          }

      setLayoutState(previous => {
        const next = { stepId, layout: result }
        const a = previous?.layout.spotlight
        const b = result.spotlight
        if (
          previous?.stepId === stepId &&
          previous.layout.side === result.side &&
          ((!a && !b) || (
            a && b &&
            Math.abs(a.top - b.top) < 0.75 &&
            Math.abs(a.left - b.left) < 0.75 &&
            Math.abs(a.width - b.width) < 0.75 &&
            Math.abs(a.height - b.height) < 0.75
          ))
        ) return previous
        return next
      })
    }

    const schedule = (initial = false) => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => measure(initial))
    }

    // Cancel the previous step's highlighted area before the next layout.
    setLayoutState(null)
    schedule(true)

    const observer = new ResizeObserver(() => schedule(false))
    observer.observe(guide)
    if (target) observer.observe(target)

    const scroll = () => schedule(false)
    const resize = () => schedule(true)
    window.addEventListener('scroll', scroll, { capture: true, passive: true })
    window.addEventListener('resize', resize)

    return () => {
      disposed = true
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', scroll, true)
      window.removeEventListener('resize', resize)
    }
  }, [open, stepId, activeStep])

  useEffect(() => {
    if (!isReady) return
    dialogRef.current?.focus()
  }, [isReady, stepId])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.localStorage.setItem(storageKey, 'true')
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  function closeTour() {
    window.localStorage.setItem(storageKey, 'true')
    setLayoutState(null)
    setOpen(false)
  }

  function startTour() {
    setStepIndex(0)
    setLayoutState(null)
    setOpen(true)
  }

  function goToStep(index: number) {
    setLayoutState(null)
    setStepIndex(index)
  }

  if (!availableSteps.length) return null

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={startTour}
          className="fixed bottom-5 right-5 z-40 rounded-full bg-[#1E3A5F] px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-[#14263D] focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] focus:ring-offset-2 motion-reduce:transition-none"
        >
          Ver recorrido
        </button>
      )}

      {open && activeStep && (
        <div className="fixed inset-0 z-50">
          {spotlight ? (
            <div
              data-tour-spotlight={activeStep.key}
              aria-hidden="true"
              className="pointer-events-none fixed rounded-xl border-2 border-sky-300 motion-reduce:transition-none"
              style={{
                left: spotlight.left - 4,
                top: spotlight.top - 4,
                width: spotlight.width + 8,
                height: spotlight.height + 8,
                boxShadow: '0 0 0 9999px rgba(15,23,42,0.58)',
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
            data-tour-ready={isReady ? 'true' : 'false'}
            data-tour-step-key={activeStep.key}
            data-active-tour-target={isReady ? activeStep.target ?? '' : ''}
            role="dialog"
            aria-label="Recorrido guiado de MP25M"
            tabIndex={-1}
            aria-hidden={!isReady}
            style={{ visibility: isReady ? 'visible' : 'hidden' }}
            className={`fixed inset-x-3 ${side === 'top' ? 'top-3' : 'bottom-3'} z-10 mx-auto flex w-[min(760px,calc(100vw-1.5rem))] max-h-[min(44dvh,340px)] flex-col rounded-2xl bg-white p-3 text-slate-950 shadow-2xl ring-1 ring-slate-200 outline-none sm:p-4`}
          >
            <div className="mb-2 flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F5D8C]">
                Recorrido MP25M_S
              </p>
              <span className="text-[11px] text-slate-500">
                Guía contextual
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto">
              <h2 className="text-base font-semibold leading-5 sm:text-lg sm:leading-6">
                {activeStep.title}
              </h2>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600 sm:text-sm">
                {activeStep.description}
              </p>
            </div>

            <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-1 border-t border-slate-200 pt-2 sm:flex-nowrap sm:gap-2">
              <p className="shrink-0 text-[11px] font-medium text-slate-500 sm:text-xs">
                Paso {stepIndex + 1} de {availableSteps.length}
              </p>
              <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
                <button
                  type="button"
                  disabled={!isReady}
                  onClick={closeTour}
                  className="min-h-8 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none sm:text-sm"
                >
                  Salir
                </button>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => goToStep(stepIndex - 1)}
                    className="min-h-8 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1E3A5F] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none sm:text-sm"
                  >
                    Anterior
                  </button>
                )}
                <button
                  type="button"
                  disabled={!isReady}
                  onClick={() =>
                    stepIndex + 1 >= availableSteps.length
                      ? closeTour()
                      : goToStep(stepIndex + 1)
                  }
                  className="min-h-8 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#14263D] focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] focus:ring-offset-2 motion-reduce:transition-none sm:text-sm"
                >
                  {stepIndex + 1 >= availableSteps.length
                    ? 'Finalizar'
                    : 'Siguiente'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

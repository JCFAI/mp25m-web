'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { usePathname } from 'next/navigation'
import {
  getFloatingTourLayout,
  getTourScrollAdjustment,
  type FloatingTourLayout,
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
  emptyTitle?: string
  emptyDescription?: string
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
        emptyTitle: 'Articulaciones: todavía sin registros',
        emptyDescription:
          'Este es el directorio donde aparecerán las articulaciones cuando se registren. Ahora está vacío, por lo que no hay una ficha para abrir. En cuanto existan propuestas, podrás entrar a una y consultar sus estados, participantes e historial desde su propio recorrido. No crees ninguna articulación ficticia.',
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
  const autoOpenTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const openRef = useRef(open)
  openRef.current = open
  const [stepIndex, setStepIndex] = useState(0)
  const [availableSteps, setAvailableSteps] = useState<TourStep[]>([])
  const availableStepsRef = useRef(availableSteps)
  availableStepsRef.current = availableSteps
  const [emptyTarget, setEmptyTarget] = useState<{
    stepId: string
    isEmpty: boolean
  } | null>(null)
  const [layoutState, setLayoutState] = useState<{
    stepId: string
    layout: FloatingTourLayout
  } | null>(null)
  const [draggedPosition, setDraggedPosition] = useState<{
    stepId: string
    left: number
    top: number
  } | null>(null)
  const dragRef = useRef<{
    pointerId: number
    x: number
    y: number
    startLeft: number
    startTop: number
  } | null>(null)

  useEffect(() => {
    // Server components may arrive after hydration in a real Vercel preview.
    // Discover every available target as it renders, then freeze the sequence
    // once the visitor opens the tutorial (so steps never jump mid-tour).
    let frame = 0
    const refresh = () => {
      const steps = stepsForPath(pathname, {
        isBasicParticipant,
        canManageAccess,
        canReviewArticulations,
      }).filter(
        step => !step.target || Boolean(
          document.querySelector('[data-tour="' + step.target + '"]'),
        ),
      )
      if (openRef.current && availableStepsRef.current.length > 0) return
      setAvailableSteps(previous =>
        previous.length === steps.length &&
        previous.every((step, i) => step.key === steps[i]?.key)
          ? previous
          : steps,
      )
    }
    const schedule = () => {
      if (openRef.current && availableStepsRef.current.length > 0) return
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(refresh)
    }
    setStepIndex(0)
    setLayoutState(null)
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [pathname, isBasicParticipant, canManageAccess, canReviewArticulations])

  useEffect(() => {
    // A review link with ?tour=1 opens the floating explanation on ANY
    // supported panel route, even if this visitor already saw the tutorial.
    // It does not bypass authentication: /panel still requires a valid login.
    const forceOpen = new URLSearchParams(window.location.search)
      .get('tour') === '1'
    if (!forceOpen && (pathname !== '/panel' ||
        window.localStorage.getItem(storageKey) === 'true')) return

    autoOpenTimerRef.current = window.setTimeout(() => {
      autoOpenTimerRef.current = null
      if (!forceOpen && window.localStorage.getItem(storageKey) === 'true') return
      setStepIndex(0)
      setDraggedPosition(null)
      setLayoutState(null)
      setOpen(true)
    }, 300)

    return () => {
      if (autoOpenTimerRef.current !== null) {
        window.clearTimeout(autoOpenTimerRef.current)
        autoOpenTimerRef.current = null
      }
    }
  }, [pathname])

  const activeStep = useMemo(
    () => availableSteps[stepIndex],
    [availableSteps, stepIndex],
  )
  const stepId = `${pathname}:${stepIndex}:${activeStep?.key ?? ''}`
  const isReady = open && layoutState?.stepId === stepId
  const isEmpty = emptyTarget?.stepId === stepId && emptyTarget.isEmpty
  const spotlight = isReady ? layoutState.layout.spotlight : null
  const floatingPosition = draggedPosition?.stepId === stepId
    ? draggedPosition
    : layoutState?.stepId === stepId
      ? layoutState.layout
      : { left: 12, top: 12 }

  // Directory counts may change after the page hydrates (e.g. Temas).
  // Match the guidance to what is actually available, without inventing data.
  useLayoutEffect(() => {
    if (!open || !activeStep?.target) {
      setEmptyTarget(null)
      return
    }
    const root = document.querySelector<HTMLElement>(
      '[data-tour="' + activeStep.target + '"]',
    )
    if (!root) return

    const readEmpty = () => {
      const source = root.hasAttribute('data-tour-empty')
        ? root
        : root.querySelector<HTMLElement>('[data-tour-empty]')
      const isEmptyNow = source?.getAttribute('data-tour-empty') === 'true'
      setEmptyTarget(prev => prev?.stepId === stepId &&
        prev.isEmpty === isEmptyNow ? prev : { stepId, isEmpty: isEmptyNow })
    }

    readEmpty()
    const observer = new MutationObserver(readEmpty)
    observer.observe(root, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-tour-empty'],
    })
    return () => observer.disconnect()
  }, [open, stepId, activeStep?.target])

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
        // The first module directory is tall on mobile and laptops.
        // Focus its heading and first card, not a mostly empty viewport
        // where the directory only begins near the bottom of the screen.
        const focusModules = pathname === '/panel' &&
          activeStep.key === 'modules' && viewport.width <= 1100
        if (focusModules ||
            rect.bottom < 32 || rect.top > viewport.height - 48 ||
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
      const result = getFloatingTourLayout(
        rect ?? null,
        viewport,
        {
          width: guide.getBoundingClientRect().width,
          height: dialogHeight,
        },
      )

      setLayoutState(previous => {
        const next = { stepId, layout: result }
        const a = previous?.layout.spotlight
        const b = result.spotlight
        if (
          previous?.stepId === stepId &&
          previous.layout.placement === result.placement &&
          Math.abs(previous.layout.left - result.left) < 0.75 &&
          Math.abs(previous.layout.top - result.top) < 0.75 &&
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
    dragRef.current = null
    setDraggedPosition(null)
    setLayoutState(null)
    setOpen(false)
  }

  // Drag the explanation by its header. Spotlight remains on the target;
  // users can move the floating window without changing the page layout.
  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isReady || !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0)) return
    const guide = dialogRef.current
    if (!guide) return
    const rect = guide.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const guide = dialogRef.current
    if (!guide) return
    const inset = 12
    const left = Math.max(inset, Math.min(
      window.innerWidth - guide.offsetWidth - inset,
      drag.startLeft + event.clientX - drag.x,
    ))
    const top = Math.max(inset, Math.min(
      window.innerHeight - guide.offsetHeight - inset,
      drag.startTop + event.clientY - drag.y,
    ))
    setDraggedPosition({ stepId, left, top })
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function startTour() {
    // A manual start wins over the delayed automatic welcome.
    if (autoOpenTimerRef.current !== null) {
      window.clearTimeout(autoOpenTimerRef.current)
      autoOpenTimerRef.current = null
    }
    window.localStorage.setItem(storageKey, 'true')
    setStepIndex(0)
    setDraggedPosition(null)
    setLayoutState(null)
    setOpen(true)
  }

  function goToStep(index: number) {
    dragRef.current = null
    setDraggedPosition(null)
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
            data-tour-floating="true"
            data-tour-placement={isReady ? layoutState.layout.placement : 'pending'}
            data-tour-empty-state={isEmpty ? 'true' : 'false'}
            data-tour-step-key={activeStep.key}
            data-active-tour-target={isReady ? activeStep.target ?? '' : ''}
            role="dialog"
            aria-label="Recorrido guiado de MP25M"
            tabIndex={-1}
            aria-hidden={!isReady}
            className="pointer-events-auto fixed z-10 flex w-[min(440px,calc(100vw-1.5rem))] max-h-[min(48dvh,360px)] flex-col rounded-2xl border border-sky-200 bg-white p-3 text-slate-950 shadow-[0_18px_65px_rgba(2,6,23,0.33)] ring-1 ring-sky-100 outline-none sm:p-4"
            style={{
              left: floatingPosition.left,
              top: floatingPosition.top,
              visibility: isReady ? 'visible' : 'hidden',
            }}
          >
            <div
              data-tour-drag-handle="true"
              onPointerDown={beginDrag}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className="mb-2 flex shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-slate-100 pb-2 active:cursor-grabbing"
              title="Arrastrá para mover la descripción"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2F5D8C]">
                Recorrido MP25M_S
              </p>
              <span className="text-[11px] text-slate-500">
                ↔ Mover ventana
              </span>
            </div>

            <div className="min-h-0 overflow-y-auto">
              <h2 className="text-base font-semibold leading-5 sm:text-lg sm:leading-6">
                {isEmpty && activeStep.emptyTitle ? activeStep.emptyTitle : activeStep.title}
              </h2>
              <p className="mt-1.5 text-[13px] leading-5 text-slate-600 sm:text-sm">
                {isEmpty && activeStep.emptyDescription ? activeStep.emptyDescription : activeStep.description}
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

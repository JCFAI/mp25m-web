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
  getHomeIntroFloatingLayout,
  getHomeModuleBelowLayout,
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
          'Una articulación coordina personas y organizaciones para lograr un objetivo común. Puede comenzar sola: después se vinculan oportunidades, proyectos y otros recursos. Revisá su propósito antes de crearla.',
      },
      {
        key: 'articulation-create',
        target: 'articulation-create',
        title: 'Cómo registrar una articulación',
        description:
          'Indicá un nombre claro y el objetivo. Si ya hay alguien que coordine, elegí al responsable. El formulario permite guardar la nueva articulación; durante este recorrido solo vamos a conocerlo.',
      },
      {
        key: 'articulation-title',
        target: 'articulation-title',
        title: 'Nombre de la articulación',
        description:
          'Elegí un nombre breve para identificar el trabajo que se quiere coordinar. Este campo es obligatorio.',
      },
      {
        key: 'articulation-objective',
        target: 'articulation-objective',
        title: 'Objetivo inicial',
        description:
          'Explicá qué se quiere lograr y para quién. No hace falta cargar nada en esta demostración.',
      },
      {
        key: 'articulation-responsible',
        target: 'articulation-responsible',
        title: 'Responsable de coordinación',
        description:
          'Si se conoce a la persona que coordinará, se la puede seleccionar. También se permite comenzar sin responsable.',
      },
      {
        key: 'articulation-directory',
        target: 'articulation-directory',
        title: 'Abrí una articulación existente',
        description:
          'Aquí aparecen las articulaciones con su estado, responsable y participantes. Al terminar, abrí una ficha existente para explorar su historial, novedades y vínculos.',
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
          'Esta ficha muestra el objetivo, el responsable y el estado actual. Empezá por estos datos para entender qué se busca lograr y quién coordina el trabajo.',
      },
      {
        key: 'articulation-history',
        target: 'articulation-history',
        title: 'El historial conserva las decisiones',
        description:
          'Este historial conserva cada cambio de estado, su fecha, quién lo registró y el motivo. Consultalo antes de tomar una nueva decisión.',
      },
      {
        key: 'articulation-management',
        target: 'articulation-management',
        title: 'Gestioná la articulación',
        description:
          'Desde este bloque se gestiona la articulación: estado, responsable, participantes y novedades. Fijate en el primer formulario; los siguientes pasos explican cada acción por separado.',
      },
      {
        key: 'articulation-status',
        target: 'articulation-status',
        title: 'Estado y responsable',
        description:
          'Seleccioná el estado y la persona responsable. Escribí el motivo del cambio; el resumen de cierre se completa al finalizar. No guardes nada durante esta guía.',
      },
      {
        key: 'articulation-followup',
        target: 'articulation-followup',
        title: 'Registrá el seguimiento',
        description:
          'Registrá reuniones, contactos o compromisos indicando tipo y detalle. En este recorrido solo identificamos dónde hacerlo, sin guardar.',
      },
      {
        key: 'articulation-participant-action',
        target: 'articulation-participant-action',
        title: 'Sumá participantes sin duplicarlos',
        description:
          'Buscá una persona u organización existente antes de agregarla. Explicá en «Motivo» por qué participa; así evitamos duplicaciones. No confirmes cambios durante la guía.',
      },
      {
        key: 'articulation-participants',
        target: 'articulation-participants',
        title: 'Participantes vinculados',
        description:
          'Aquí se ven las personas y organizaciones vinculadas y el motivo de su participación. Consultalas para saber con quién coordinar.',
      },
      {
        key: 'articulation-followups',
        target: 'articulation-followups',
        title: 'Novedades y seguimiento',
        description:
          'Aquí se muestra la secuencia de novedades, fechas y compromisos. Revisala para comprender qué ocurrió y qué queda pendiente.',
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
    const params = new URLSearchParams(window.location.search)
    const forceOpen = params.get('tour') === '1'
    const requestedStep = Number.parseInt(params.get('tourStep') ?? '1', 10)
    const requestedIndex = Number.isFinite(requestedStep)
      ? Math.max(0, requestedStep - 1)
      : 0
    if (!forceOpen && (pathname !== '/panel' ||
        window.localStorage.getItem(storageKey) === 'true')) return

    autoOpenTimerRef.current = window.setTimeout(() => {
      autoOpenTimerRef.current = null
      if (!forceOpen && window.localStorage.getItem(storageKey) === 'true') return
      setStepIndex(requestedIndex)
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
  const isHomeIntro = pathname === '/panel' && activeStep?.key === 'modules'
  const isHomeNodes = pathname === '/panel' && activeStep?.key === 'nodes'
  const isHomeProfile = pathname === '/panel' && activeStep?.key === 'profile'
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
    // Each screen may identify the exact search/form control instead of
    // highlighting an entire, potentially thousand-pixel-tall directory.
    const focus = target?.querySelector<HTMLElement>(
      '[data-tour-focus="' + activeStep.key + '"]',
    ) ?? target

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

      if (focus && initial) {
        const rect = focus.getBoundingClientRect()
        if (isHomeIntro) {
          // Show the explanation at the TOP of the screen and bring the
          // module heading plus first complete card immediately BELOW it.
          const desiredTop = dialogHeight + 48
          const delta = rect.top - desiredTop
          if (Math.abs(delta) > 6) {
            window.scrollBy({ top: delta, behavior: 'instant' })
          }
        } else {
          const desiredTop = viewport.width < 640 ? 100 : 132
          if (rect.top < 60 || rect.top > viewport.height * 0.38 ||
              rect.bottom < 60 || rect.bottom > viewport.height - 20) {
            focus.scrollIntoView({ behavior: 'instant', block: 'start' })
            window.scrollBy({ top: -desiredTop, behavior: 'instant' })
          }
        }
      }

      const rect = focus?.getBoundingClientRect()
      const focusHeight = viewport.width < 640 ? 190 : 252
      const focusedRect = rect
        ? {
            top: rect.top,
            // Inicio introduces the complete module directory. Keep the
            // spotlight tied to the whole section so every module remains
            // illuminated as the visitor scrolls through the directory.
            bottom: isHomeIntro
              ? rect.bottom
              : Math.min(rect.bottom, rect.top + focusHeight),
            left: rect.left,
            right: rect.right,
          }
        : null
      const guideSize = {
        width: guide.getBoundingClientRect().width,
        height: dialogHeight,
      }
      const result = isHomeIntro
        ? getHomeIntroFloatingLayout(focusedRect, viewport, guideSize)
        : isHomeNodes
          ? getHomeModuleBelowLayout(focusedRect, viewport, guideSize)
          : isHomeProfile
            ? (() => {
                const base = getFloatingTourLayout(focusedRect, viewport, guideSize)
                // Raise the explanation only. Keep the spotlight anchored
                // to the actual "Mi perfil" card instead of drifting upward
                // into the surrounding "Tu cuenta y ayuda" section.
                const shift = Math.min(110, Math.max(0, base.top - 12))
                return {
                  ...base,
                  top: base.top - shift,
                }
              })()
            : getFloatingTourLayout(focusedRect, viewport, guideSize)

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
    if (focus && focus !== target) observer.observe(focus)
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
  }, [open, stepId, activeStep, isHomeIntro, isHomeNodes, isHomeProfile])

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
            data-tour-home-intro={isHomeIntro ? "true" : "false"}
            data-tour-placement={isReady ? layoutState.layout.placement : 'pending'}
            data-tour-empty-state={isEmpty ? 'true' : 'false'}
            data-tour-step-key={activeStep.key}
            data-active-tour-target={isReady ? activeStep.target ?? '' : ''}
            role="dialog"
            aria-label="Recorrido guiado de MP25M"
            tabIndex={-1}
            aria-hidden={!isReady}
            className={`pointer-events-auto fixed z-10 flex ${isHomeIntro ? 'w-[min(900px,calc(100vw-1.5rem))]' : 'w-[min(780px,calc(100vw-1.5rem))]'} max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 shadow-[0_24px_80px_rgba(2,6,23,0.33)] ring-1 ring-white/90 outline-none sm:px-6 sm:py-4`}
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
              className="mb-3 flex shrink-0 cursor-grab touch-none select-none items-center justify-between gap-2 border-b border-slate-100 pb-2.5 active:cursor-grabbing"
              title="Arrastrá para mover la descripción"
            >
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#2F5D8C]">
                Recorrido MP25M_S
              </p>
              <span className="text-xs font-medium text-slate-500">
                ↔ Mover ventana
              </span>
            </div>

            <div data-tour-copy="true" className="min-h-0">
              <h2 className="text-lg font-bold leading-6 tracking-tight sm:text-xl sm:leading-7">
                {isEmpty && activeStep.emptyTitle ? activeStep.emptyTitle : activeStep.title}
              </h2>
              <p className="mt-2 text-[15px] leading-[1.55] text-slate-700 sm:text-base sm:leading-6">
                {isEmpty && activeStep.emptyDescription ? activeStep.emptyDescription : activeStep.description}
              </p>
            </div>

            <div className="mt-3 flex shrink-0 flex-nowrap items-center justify-between gap-1 border-t border-slate-200 pt-3 sm:gap-3">
              <p className="shrink-0 text-[11px] font-semibold tabular-nums text-slate-500 sm:text-sm">
                Paso {stepIndex + 1} de {availableSteps.length}
              </p>
              <div className="flex min-w-0 shrink-0 items-center gap-0.5 sm:gap-2">
                <button
                  type="button"
                  disabled={!isReady}
                  onClick={closeTour}
                  className="min-h-9 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none sm:text-sm"
                >
                  Salir
                </button>
                {stepIndex > 0 && (
                  <button
                    type="button"
                    disabled={!isReady}
                    onClick={() => goToStep(stepIndex - 1)}
                    className="min-h-9 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1E3A5F] transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] motion-reduce:transition-none sm:text-sm"
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
                  className="min-h-9 rounded-lg bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#14263D] focus:outline-none focus:ring-2 focus:ring-[#2F5D8C] focus:ring-offset-2 motion-reduce:transition-none sm:text-sm"
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

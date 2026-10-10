'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { usePathname } from 'next/navigation'
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
  const dragStartRef = useRef<{
    x: number
    y: number
    left: number
    top: number
  } | null>(null)
  const [floatingPosition, setFloatingPosition] = useState<{
    left: number
    top: number
  } | null>(null)
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [availableSteps, setAvailableSteps] =
    useState<TourStep[]>([])
  const [targetRect, setTargetRect] =
    useState<DOMRect | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const nextSteps = stepsForPath(pathname, {
        isBasicParticipant,
        canManageAccess,
        canReviewArticulations,
      }).filter(
        (step) =>
          !step.target ||
          Boolean(
            document.querySelector(
              '[data-tour="' + step.target + '"]',
            ),
          ),
      )

      setStepIndex(0)
      setFloatingPosition(null)
      setAvailableSteps(nextSteps)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [pathname, isBasicParticipant, canManageAccess, canReviewArticulations])

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

      if (pathname === '/panel' && activeStep?.key === 'modules') {
        // Present the module overview below the guide, like the approved screenshot.
        const sectionTop = element.getBoundingClientRect().top + window.scrollY
        window.scrollTo({ top: Math.max(0, sectionTop - 340), behavior: 'auto' })
      } else if (pathname === '/panel/articulaciones') {
        if (activeStep?.key === 'articulation-directory') {
          // Bring the directory directly below the compact guide.
          const top = element.getBoundingClientRect().top + window.scrollY
          window.scrollTo({ top: Math.max(0, top - 430), behavior: 'auto' })
        } else {
          window.scrollTo({ top: 0, behavior: 'auto' })
        }
      } else if (pathname.startsWith('/panel/articulaciones/')) {
        // Reserve a clear area above the highlighted section for the guide.
        const pageTop = element.getBoundingClientRect().top + window.scrollY
        window.scrollTo({
          top: Math.max(0, pageTop - 430),
          behavior: 'auto',
        })
      } else {
        element.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'center',
        })
      }

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
  }, [activeStep, open, pathname])

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

  function closeTour() {
    window.localStorage.setItem(storageKey, 'true')
    setOpen(false)
  }

  function startTour() {
    setStepIndex(0)
    setFloatingPosition(null)
    setOpen(true)
  }

  function startDragging(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }

  function dragDialog(event: ReactPointerEvent<HTMLDivElement>) {
    const start = dragStartRef.current
    if (!start) return
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    const margin = 8
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin)
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin)
    setFloatingPosition({
      left: Math.max(margin, Math.min(maxLeft, start.left + event.clientX - start.x)),
      top: Math.max(margin, Math.min(maxTop, start.top + event.clientY - start.y)),
    })
  }

  function stopDragging(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  if (availableSteps.length === 0) {
    return null
  }

  const viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight
  const margin = 16
  const gap = 18
  const panelWidth = Math.min(viewportWidth >= 1000 ? 780 : viewportWidth >= 720 ? 600 : 360, viewportWidth - margin * 2)
  const estimatedPanelHeight = Math.min(viewportWidth >= 720 ? 250 : 350, viewportHeight - margin * 2)
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max))

  const popoverStyle: CSSProperties | undefined = targetRect
    ? (() => {
        // During articulation guidance, show the guide above the form/cards.
        // This avoids obscuring the very controls the user is learning about.
        if (pathname === '/panel' && activeStep?.key === 'modules') {
          return {
            left: clamp(
              (viewportWidth - panelWidth) / 2,
              margin,
              Math.max(margin, viewportWidth - panelWidth - margin),
            ),
            top: margin,
          }
        }
        if (
          pathname === '/panel/articulaciones' &&
          (activeStep?.key === 'articulation-create' ||
            activeStep?.key === 'articulation-directory') &&
          viewportWidth >= 720
        ) {
          return {
            left: clamp(
              targetRect.left + targetRect.width / 2 - panelWidth / 2 + 45,
              margin,
              Math.max(margin, viewportWidth - panelWidth - margin),
            ),
            // Shift the explanation slightly right while keeping it on-screen.
            // Position the compact horizontal guide at the top.
            // The form and directory remain below it and unobstructed.
            top: margin,
          }
        }
        if (pathname.startsWith('/panel/articulaciones/') && viewportWidth >= 900) {
          // Starting positions selected from the validated desktop walkthrough.
          // Users can still drag the guide elsewhere at any moment.
          const detailPositions: Record<string, { horizontal: number; vertical: number }> = {
            'articulation-management': { horizontal: 0.66, vertical: 0 },
            'articulation-status': { horizontal: 0.98, vertical: 0 },
            'articulation-followup': { horizontal: 0.30, vertical: 0 },
            'articulation-participant-action': { horizontal: 0.98, vertical: 0 },
            'articulation-followups': { horizontal: 0.64, vertical: 0.21 },
          }
          const preferred = detailPositions[activeStep?.key ?? '']
          if (preferred) {
            const horizontalRoom = Math.max(0, viewportWidth - panelWidth - margin * 2)
            return {
              left: margin + horizontalRoom * preferred.horizontal,
              top: Math.min(
                Math.max(margin, viewportHeight - 300),
                margin + viewportHeight * preferred.vertical,
              ),
            }
          }
        }
        if (pathname.startsWith('/panel/articulaciones/') && viewportWidth >= 720) {
          const left = clamp(
            targetRect.left + targetRect.width / 2 - panelWidth / 2,
            margin,
            Math.max(margin, viewportWidth - panelWidth - margin),
          )
          // Most targets are scrolled below this fixed guide. For the
          // first section near the page top, place it just below instead.
          const top = targetRect.top < 325 &&
            targetRect.bottom + 310 + gap < viewportHeight
              ? targetRect.bottom + gap
              : margin
          return { left, top }
        }
        const rightSpace = viewportWidth - targetRect.right
        const leftSpace = targetRect.left
        const belowSpace = viewportHeight - targetRect.bottom
        const aboveSpace = targetRect.top
        const sideTop = clamp(
          targetRect.top + targetRect.height / 2 - estimatedPanelHeight / 2,
          margin,
          Math.max(margin, viewportHeight - estimatedPanelHeight - margin),
        )
        // Prefer a wide, horizontal guide above or below large content regions.
        const isWideTarget = targetRect.width >= panelWidth
        if (!isWideTarget && rightSpace >= panelWidth + gap + margin) {
          return { left: targetRect.right + gap, top: sideTop }
        }
        if (!isWideTarget && leftSpace >= panelWidth + gap + margin) {
          return { left: targetRect.left - panelWidth - gap, top: sideTop }
        }
        const left = clamp(
          targetRect.left + targetRect.width / 2 - panelWidth / 2,
          margin,
          Math.max(margin, viewportWidth - panelWidth - margin),
        )
        if (belowSpace >= estimatedPanelHeight + gap + margin) {
          return { left, top: targetRect.bottom + gap }
        }
        if (aboveSpace >= estimatedPanelHeight + gap + margin) {
          return { left, top: targetRect.top - estimatedPanelHeight - gap }
        }
        // When the target fills the screen, keep controls on-screen.
        return { left, top: margin }
      })()
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
            style={{ ...popoverStyle, ...floatingPosition }}
            className={
              targetRect
                ? 'fixed z-10 w-[min(780px,calc(100vw-2rem))] flex max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-white p-5 text-slate-950 shadow-2xl ring-1 ring-slate-200 outline-none'
                : 'fixed inset-x-4 bottom-5 z-10 mx-auto max-w-md flex max-h-[calc(100dvh-2rem)] flex-col rounded-2xl bg-white p-5 text-slate-950 shadow-2xl outline-none'
            }
          >
            <div
              onPointerDown={startDragging}
              onPointerMove={dragDialog}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
              className="mb-3 flex cursor-grab touch-none select-none items-center justify-between gap-3 border-b border-slate-100 pb-3 active:cursor-grabbing"
              title="Arrastrá esta barra para mover la explicación"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
                Recorrido MP25M_S
              </p>
              <span className="text-xs text-slate-500">↕ Arrastrar</span>
            </div>
            <div className="min-h-0 overflow-y-auto">
            <h2 className="mt-2 text-lg font-semibold">
              {activeStep.title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {activeStep.description}
            </p>

            <p className="mt-4 text-xs font-medium text-slate-500">
              Paso {stepIndex + 1} de {availableSteps.length}
            </p>

            </div>
            <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
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
                    onClick={() => {
                      setFloatingPosition(null)
                      setStepIndex((index) => index - 1)
                    }}
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

                    setFloatingPosition(null)
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

/**
 * Position a contextual guide WITHOUT moving or padding the document.
 *
 * A step may highlight a very tall section (the whole module directory,
 * for example). In that case only the unobscured, visible portion is lit.
 */
export type TourRect = {
  top: number
  bottom: number
  left: number
  right: number
}

export type TourSide = 'top' | 'bottom'

export type TourLayout = {
  side: TourSide
  spotlight: {
    top: number
    left: number
    width: number
    height: number
  } | null
  visibleHeight: number
  freeHeight: number
}

export function getTourLayout(
  target: TourRect,
  viewport: { width: number; height: number },
  dialogHeight: number,
): TourLayout {
  const inset = 12
  const gap = 16
  const topSafeStart = inset + dialogHeight + gap
  const bottomSafeEnd = viewport.height - inset - dialogHeight - gap

  const visibleBetween = (start: number, end: number) =>
    Math.max(0, Math.min(target.bottom, end) - Math.max(target.top, start))

  const topVisible = visibleBetween(topSafeStart, viewport.height - inset)
  const bottomVisible = visibleBetween(inset, bottomSafeEnd)

  const mid = (target.top + target.bottom) / 2
  const targetHeight = target.bottom - target.top
  // A giant region starts at the top: keep its heading visible and dock the
  // guide at the bottom, rather than illuminating an arbitrary middle slice.
  const beginsAtViewportTop = targetHeight > bottomSafeEnd - inset &&
    target.top < 48 && target.bottom > bottomSafeEnd
  const side: TourSide = beginsAtViewportTop
    ? 'bottom'
    : Math.abs(topVisible - bottomVisible) < 1
      ? (mid <= viewport.height / 2 ? 'bottom' : 'top')
      : (bottomVisible > topVisible ? 'bottom' : 'top')

  const start = side === 'top' ? topSafeStart : inset
  const end = side === 'top' ? viewport.height - inset : bottomSafeEnd
  const clipTop = Math.max(target.top, start)
  const clipBottom = Math.min(target.bottom, end)
  const clipLeft = Math.max(inset, target.left)
  const clipRight = Math.min(viewport.width - inset, target.right)
  const visibleHeight = Math.max(0, clipBottom - clipTop)

  return {
    side,
    visibleHeight,
    freeHeight: Math.max(0, end - start),
    spotlight: visibleHeight > 0 && clipRight > clipLeft
      ? {
          top: clipTop,
          left: clipLeft,
          width: clipRight - clipLeft,
          height: visibleHeight,
        }
      : null,
  }
}

/**
 * Single short adjustment when a reasonably small target would otherwise
 * sit underneath either docked guide. No extra body spacing is ever added.
 */
export function getTourScrollAdjustment(
  target: TourRect,
  viewportHeight: number,
  dialogHeight: number,
): number {
  const layout = getTourLayout(
    { top: target.top, bottom: target.bottom, left: 0, right: 1 },
    { width: 100, height: viewportHeight },
    dialogHeight,
  )
  const height = target.bottom - target.top

  if (height <= 0 || height > layout.freeHeight || layout.visibleHeight >= height - 1) return 0

  const gap = 28
  const desiredTop = layout.side === 'top'
    ? dialogHeight + gap
    : Math.max(12, viewportHeight - dialogHeight - gap - height)

  // Positive scroll moves the content upward, negative downward.
  const delta = target.top - desiredTop
  return Math.abs(delta) > 14 ? delta : 0
}


/**
 * A real floating popover: it follows the highlighted element instead of
 * docking to the viewport edge. A large section is clipped to the part
 * visible beside the popover, without introducing document padding.
 */
export type FloatingTourPlacement = 'right' | 'left' | 'below' | 'above' | 'center'

export type FloatingTourLayout = {
  placement: FloatingTourPlacement
  top: number
  left: number
  spotlight: TourLayout['spotlight']
  visibleHeight: number
}

export function getFloatingTourLayout(
  target: TourRect | null,
  viewport: { width: number; height: number },
  dialog: { width: number; height: number },
): FloatingTourLayout {
  const inset = 12
  const gap = 18
  const width = Math.min(dialog.width, viewport.width - 2 * inset)
  const height = Math.min(dialog.height, viewport.height - 2 * inset)
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))
  const maxX = Math.max(inset, viewport.width - width - inset)
  const maxY = Math.max(inset, viewport.height - height - inset)

  if (!target) {
    return {
      placement: 'center',
      left: clamp((viewport.width - width) / 2, inset, maxX),
      top: clamp((viewport.height - height) / 2, inset, maxY),
      spotlight: null,
      visibleHeight: 0,
    }
  }

  const visible = {
    left: clamp(target.left, inset, viewport.width - inset),
    right: clamp(target.right, inset, viewport.width - inset),
    top: clamp(target.top, inset, viewport.height - inset),
    bottom: clamp(target.bottom, inset, viewport.height - inset),
  }

  if (visible.right <= visible.left || visible.bottom <= visible.top) {
    return getFloatingTourLayout(null, viewport, dialog)
  }

  const visibleHeight = visible.bottom - visible.top
  const isRoomRight = visible.right + gap + width <= viewport.width - inset
  const isRoomLeft = visible.left - gap - width >= inset

  let placement: FloatingTourPlacement
  let left: number
  let top: number
  let clipTop = visible.top
  let clipBottom = visible.bottom

  // On wide screens, show the explanatory window BESIDE the target.
  if (isRoomRight || isRoomLeft) {
    placement = isRoomRight ? 'right' : 'left'
    left = placement === 'right'
      ? visible.right + gap
      : visible.left - gap - width
    top = clamp(visible.top, inset, maxY)
  } else {
    // On narrow screens, show the window ABOVE or BELOW its target.
    // It remains a floating, positioned card rather than a docked bar.
    left = clamp(visible.left, inset, maxX)
    const aboveSpace = visible.top - inset - gap
    const belowSpace = viewport.height - inset - visible.bottom - gap

    if (belowSpace >= height || aboveSpace >= height) {
      placement = belowSpace >= height ? 'below' : 'above'
      top = placement === 'below'
        ? visible.bottom + gap
        : visible.top - gap - height
    } else {
      // An oversize section occupies most of the viewport. Illuminate its
      // START and place the explanation beside the visible portion.
      // If the section begins near the bottom, reverse the arrangement.
      const focusAbove = visible.top <= viewport.height / 2
      placement = focusAbove ? 'below' : 'above'
      if (focusAbove) {
        top = clamp(
          visible.top + Math.min(visibleHeight, viewport.height * 0.52),
          inset, maxY,
        )
      } else {
        top = clamp(visible.top - height - gap, inset, maxY)
      }
    }

    top = clamp(top, inset, maxY)
    // Spotlight and window never overlap, including on tall targets.
    if (placement === 'below') {
      clipBottom = Math.min(visible.bottom, top - gap)
    } else {
      clipTop = Math.max(visible.top, top + height + gap)
    }
  }

  const litHeight = Math.max(0, clipBottom - clipTop)
  const spotlight = litHeight >= 30
    ? {
        top: clipTop,
        left: visible.left,
        width: visible.right - visible.left,
        height: litHeight,
      }
    : null

  return {
    placement,
    left: clamp(left, inset, maxX),
    top: clamp(top, inset, maxY),
    spotlight,
    visibleHeight: litHeight,
  }
}


/**
 * Inicio / Módulos: the introduction is the only step that describes a
 * *collection* of cards. Put the readable window ABOVE the collection,
 * then illuminate its heading and complete first card below it.
 * Individual module cards get their own subsequent steps.
 */
export function getHomeIntroFloatingLayout(
  target: TourRect | null,
  viewport: { width: number; height: number },
  dialog: { width: number; height: number },
): FloatingTourLayout {
  const inset = 12
  const gap = 24
  const width = Math.min(dialog.width, viewport.width - inset * 2)
  const left = Math.max(inset, (viewport.width - width) / 2)
  const top = inset
  const bottomOfWindow = top + dialog.height
  const safeSpotTop = bottomOfWindow + gap
  if (!target) {
    return {
      placement: 'above',
      left,
      top,
      spotlight: null,
      visibleHeight: 0,
    }
  }
  const clipTop = Math.max(target.top, safeSpotTop)
  const clipBottom = Math.min(target.bottom, viewport.height - inset)
  const clipLeft = Math.max(target.left, inset)
  const clipRight = Math.min(target.right, viewport.width - inset)
  const height = Math.max(0, clipBottom - clipTop)
  const spotlight = height >= 30 && clipRight - clipLeft >= 30
    ? { top: clipTop, left: clipLeft, width: clipRight - clipLeft, height }
    : null
  return {
    placement: 'above',
    left,
    top,
    spotlight,
    visibleHeight: spotlight?.height ?? 0,
  }
}


/**
 * Inicio / tarjeta individual: keep the complete card illuminated and place
 * the explanation immediately below it, horizontally centered on the card.
 */
export function getHomeModuleBelowLayout(
  target: TourRect | null,
  viewport: { width: number; height: number },
  dialog: { width: number; height: number },
): FloatingTourLayout {
  const inset = 12
  const gap = 28
  const width = Math.min(dialog.width, viewport.width - inset * 2)
  const height = Math.min(dialog.height, viewport.height - inset * 2)
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))
  const maxX = Math.max(inset, viewport.width - width - inset)
  const maxY = Math.max(inset, viewport.height - height - inset)

  if (!target) {
    return {
      placement: 'center',
      left: clamp((viewport.width - width) / 2, inset, maxX),
      top: clamp((viewport.height - height) / 2, inset, maxY),
      spotlight: null,
      visibleHeight: 0,
    }
  }

  const left = clamp(
    (target.left + target.right - width) / 2,
    inset,
    maxX,
  )
  const top = clamp(target.bottom + gap, inset, maxY)
  const clipLeft = Math.max(inset, target.left)
  const clipRight = Math.min(viewport.width - inset, target.right)
  const clipTop = Math.max(inset, target.top)
  const clipBottom = Math.min(viewport.height - inset, target.bottom)
  const litHeight = Math.max(0, clipBottom - clipTop)

  return {
    placement: 'below',
    left,
    top,
    spotlight: litHeight >= 30 && clipRight > clipLeft
      ? {
          top: clipTop,
          left: clipLeft,
          width: clipRight - clipLeft,
          height: litHeight,
        }
      : null,
    visibleHeight: litHeight,
  }
}

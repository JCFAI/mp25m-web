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

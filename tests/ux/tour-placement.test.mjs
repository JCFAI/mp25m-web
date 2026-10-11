import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTourLayout,
  getFloatingTourLayout,
  getTourScrollAdjustment,
} from '../../lib/tour/placement.ts'

test('target near top: dock guide below without covering it', () => {
  const target = { left: 620, right: 1000, top: 120, bottom: 380 }
  const layout = getTourLayout(target, { width: 1440, height: 900 }, 180)
  assert.equal(layout.side, 'bottom')
  assert.equal(layout.spotlight?.height, 260)
  assert.equal(getTourScrollAdjustment(target, 900, 180), 0)
})

test('target near bottom: dock guide above', () => {
  const target = { left: 620, right: 1000, top: 600, bottom: 790 }
  const layout = getTourLayout(target, { width: 1440, height: 900 }, 180)
  assert.equal(layout.side, 'top')
  assert.equal(layout.spotlight?.height, 190)
  assert.equal(getTourScrollAdjustment(target, 900, 180), 0)
})

test('very tall target: show the beginning without covering it', () => {
  const target = { left: 250, right: 1180, top: 0, bottom: 1600 }
  const layout = getTourLayout(target, { width: 1440, height: 900 }, 180)
  assert.equal(layout.side, 'bottom')
  assert.equal(layout.spotlight?.top, 12)
  assert.equal(layout.spotlight?.height, 680)
  assert.equal(getTourScrollAdjustment(target, 900, 180), 0)
})

test('mobile: oversized content is clipped to the visible side', () => {
  const target = { left: 8, right: 382, top: 20, bottom: 1200 }
  const layout = getTourLayout(target, { width: 390, height: 844 }, 220)
  assert.equal(layout.side, 'bottom')
  assert.ok(layout.spotlight)
  assert.ok(layout.spotlight?.height > 300)
  assert.ok(layout.spotlight?.top >= 12)
  assert.ok(layout.spotlight?.top + layout.spotlight?.height < 620)
})

test('scroll only when a small highlighted region is partly concealed', () => {
  const target = { left: 400, right: 780, top: 160, bottom: 800 }
  const amount = getTourScrollAdjustment(target, 900, 180)
  assert.ok(amount < 0)
  const shifted = { ...target, top: target.top - amount, bottom: target.bottom - amount }
  const visible = getTourLayout(shifted, { width: 1440, height: 900 }, 180)
  assert.equal(visible.spotlight?.height, 640)
})

test('spotlight never uses offscreen or negative dimensions', () => {
  const layout = getTourLayout(
    { left: -90, right: 480, top: -100, bottom: 1100 },
    { width: 390, height: 844 },
    260,
  )
  assert.ok(layout.spotlight)
  assert.ok(layout.spotlight?.left >= 12)
  assert.ok(layout.spotlight?.width <= 366)
  assert.ok(layout.spotlight?.height <= 844 - 12 - 260 - 16)
})

test('DOMRect properties may be getters rather than own enumerable keys', () => {
  const rect = {}
  for (const [key, value] of Object.entries({
    top: 160, bottom: 800, left: 20, right: 800,
  })) {
    Object.defineProperty(rect, key, { get: () => value })
  }

  assert.equal(Object.keys(rect).length, 0)
  assert.equal(getTourScrollAdjustment(rect, 900, 180), -48)
})


test('floating descriptions appear beside a narrow target on desktop', () => {
  const target = { left: 270, right: 580, top: 180, bottom: 350 }
  const popup = { width: 440, height: 220 }
  const layout = getFloatingTourLayout(target, { width: 1440, height: 900 }, popup)
  assert.equal(layout.placement, 'right')
  assert.equal(layout.left, target.right + 18)
  assert.equal(layout.top, target.top)
  assert.equal(layout.spotlight?.height, 170)
  assert.ok(layout.left >= target.right + 16)
})

test('floating popup follows sections above and below them', () => {
  const viewport = { width: 1024, height: 768 }
  const popup = { width: 440, height: 210 }
  const aboveTarget = { left: 270, right: 1010, top: 500, bottom: 620 }
  const above = getFloatingTourLayout(aboveTarget, viewport, popup)
  assert.equal(above.placement, 'above')
  assert.ok(above.top + popup.height + 16 <= aboveTarget.top)
  assert.ok(above.spotlight)

  const belowTarget = { left: 270, right: 1010, top: 70, bottom: 180 }
  const below = getFloatingTourLayout(belowTarget, viewport, popup)
  assert.equal(below.placement, 'below')
  assert.ok(below.top >= belowTarget.bottom + 16)
  assert.ok(below.spotlight)
})

test('mobile: tall target lights its beginning above a floating window', () => {
  const viewport = { width: 390, height: 844 }
  const popup = { width: 366, height: 250 }
  const target = { left: 8, right: 382, top: 0, bottom: 1600 }
  const layout = getFloatingTourLayout(target, viewport, popup)
  assert.equal(layout.placement, 'below')
  assert.ok(layout.top > viewport.height * 0.48)
  assert.ok(layout.top + popup.height <= viewport.height - 12)
  assert.ok(layout.spotlight)
  assert.ok(layout.spotlight.top >= 12)
  assert.ok(layout.spotlight.top + layout.spotlight.height <= layout.top - 16)
})

test('floating dialog never covers its highlighted region', () => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ]
  const targets = [
    { left: 20, right: 370, top: -40, bottom: 1300 },
    { left: 280, right: 900, top: 140, bottom: 520 },
    { left: 100, right: 400, top: 550, bottom: 750 },
    { left: 500, right: 670, top: 200, bottom: 370 },
    { left: 280, right: 1400, top: 420, bottom: 800 },
  ]
  for (const viewport of viewports) {
    const card = { width: Math.min(440, viewport.width - 24), height: 220 }
    for (const target of targets) {
      const layout = getFloatingTourLayout(target, viewport, card)
      assert.ok(layout.left >= 12 && layout.top >= 12)
      assert.ok(layout.left + card.width <= viewport.width - 12)
      assert.ok(layout.top + card.height <= viewport.height - 12)
      if (!layout.spotlight) continue
      const s = layout.spotlight
      assert.ok(s.left >= 12 && s.top >= 12)
      assert.ok(s.left + s.width <= viewport.width - 12)
      assert.ok(s.top + s.height <= viewport.height - 12)
      const overlapX = Math.max(0,
        Math.min(layout.left + card.width, s.left + s.width) -
        Math.max(layout.left, s.left))
      const overlapY = Math.max(0,
        Math.min(layout.top + card.height, s.top + s.height) -
        Math.max(layout.top, s.top))
      assert.equal(overlapX * overlapY, 0)
    }
  }
})

test('a step without target floats near the middle of viewport', () => {
  const layout = getFloatingTourLayout(null,
    { width: 1440, height: 900 }, { width: 440, height: 240 })
  assert.equal(layout.placement, 'center')
  assert.equal(layout.left, 500)
  assert.equal(layout.top, 330)
  assert.equal(layout.spotlight, null)
})

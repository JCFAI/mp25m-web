import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTourLayout,
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
  assert.ok(layout.spotlight!.height > 300)
  assert.ok(layout.spotlight!.top >= 12)
  assert.ok(layout.spotlight!.top + layout.spotlight!.height < 620)
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
  assert.ok(layout.spotlight!.left >= 12)
  assert.ok(layout.spotlight!.width <= 366)
  assert.ok(layout.spotlight!.height <= 844 - 12 - 260 - 16)
})

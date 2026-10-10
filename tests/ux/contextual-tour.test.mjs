import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '../..')

function source(path) {
  return readFileSync(resolve(root, path), 'utf8')
}

test('contextual MP25M_S tour only highlights available panel surfaces', () => {
  const tour = source('components/panel-tour.tsx')

  assert.match(tour, /Ver recorrido/)
  assert.match(tour, /motion-reduce:transition-none/)
  assert.match(tour, /Novedades y seguimiento/)
  assert.match(tour, /ResizeObserver/)
  assert.match(tour, /data-active-tour-target/)
  assert.match(tour, /paddingBottom/)
  assert.match(tour, /paddingTop/)
  assert.doesNotMatch(tour, /setFloatingPosition/)
  assert.doesNotMatch(tour, /dragDialog/)
  assert.doesNotMatch(tour, /Vincular oportunidad/)
  assert.doesNotMatch(tour, /Economía operativa/)

  assert.match(
    source('app/panel/layout.tsx'),
    /PanelTour/,
  )
  assert.match(
    source('app/panel/page.tsx'),
    /data-tour="panel-hero"/,
  )
  assert.match(
    source('app/panel/page.tsx'),
    /data-tour="panel-modules"/,
  )
  assert.match(
    source('app/panel/page.tsx'),
    /module-articulations/,
  )
  assert.match(
    source('app/panel/articulaciones/page.tsx'),
    /articulations-intro/,
  )
  assert.match(
    source('app/panel/articulaciones/articulation-forms.tsx'),
    /articulation-create/,
  )
  assert.match(
    source('app/panel/articulaciones/[id]/page.tsx'),
    /articulation-summary/,
  )
  assert.match(
    source('app/panel/articulaciones/articulation-controls.tsx'),
    /articulation-followup/,
  )
})

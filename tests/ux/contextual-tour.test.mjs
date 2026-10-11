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
  assert.match(tour, /getFloatingTourLayout/)
  assert.match(tour, /data-tour-floating="true"/)
  assert.match(tour, /data-tour-drag-handle="true"/)
  assert.match(tour, /onPointerMove=\{moveDrag\}/)
  assert.match(tour, /w-\[min\(440px/)
  assert.doesNotMatch(tour, /fixed inset-x-3/)
  assert.doesNotMatch(tour, /bottom-3'} z-10 mx-auto/)
  assert.match(tour, /data-tour-step-key/)
  assert.match(tour, /data-tour-ready/)
  assert.match(tour, /data-tour-spotlight/)
  assert.doesNotMatch(tour, /document\.body\.style\.padding/)
  assert.doesNotMatch(tour, /document\.body\.style\.margin/)
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

test('tour focuses the first module and uses explicit empty-directory guidance', () => {
  const tour = source('components/panel-tour.tsx')
  const steps = source('lib/tour/stage-s-steps.ts')

  assert.match(tour, /activeStep\.key === 'modules'/)
  assert.match(tour, /focusModules/)
  assert.match(tour, /MutationObserver/)
  assert.match(tour, /data-tour-empty-state/)
  assert.match(tour, /Articulaciones: todavía sin registros/)

  assert.match(steps, /Proyectos: todavía sin registros/)
  assert.match(steps, /Temas: sin resultados en el directorio/)
  assert.match(steps, /key: 'skills-review'/)
  assert.match(steps, /s-skills-search/)
  assert.match(steps, /s-skills-review/)

  const skills = source('app/panel/habilidades/page.tsx')
  assert.match(skills, /data-tour="s-skills-search"/)
  assert.match(skills, /data-tour="s-skills-review"/)
  assert.match(source('app/panel/articulaciones/page.tsx'), /data-tour-empty=/)
  assert.match(source('app/panel/proyectos/page.tsx'), /data-tour-empty=/)
  assert.match(source('app/panel/temas/theme-directory.tsx'), /data-tour-empty=/)
  assert.match(steps, /Identidad en el panel/)
})

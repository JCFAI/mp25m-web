import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  homeStageSTourSteps,
  contextualStageSTourSteps,
} from '../../lib/tour/stage-s-steps.ts'

const basic = {
  isBasicParticipant: true,
  canManageAccess: false,
  canReviewArticulations: false,
}

const elevated = {
  isBasicParticipant: false,
  canManageAccess: true,
  canReviewArticulations: true,
}

test('la bienvenida comienza por el panorama de módulos y no termina en Articulaciones', () => {
  const steps = homeStageSTourSteps(elevated)
  const keys = steps.map((item) => item.key)

  assert.equal(keys[0], 'modules')
  assert.ok(keys.indexOf('projects') > keys.indexOf('articulations'))
  assert.ok(keys.indexOf('themes') > keys.indexOf('projects'))
  assert.ok(keys.indexOf('feedback') > keys.indexOf('themes'))
  assert.equal(keys.at(-1), 'finish')
})

test('el participante básico ve sólo la guía de sus funciones reales', () => {
  const keys = homeStageSTourSteps(basic).map((item) => item.key)
  assert.deepEqual(keys, [
    'modules',
    'people',
    'nodes',
    'organizations',
    'skills',
    'profile',
    'feedback',
    'finish',
  ])
})

test('el recorrido elevado respeta permisos de revisión y administración', () => {
  const restricted = homeStageSTourSteps({
    isBasicParticipant: false,
    canManageAccess: false,
    canReviewArticulations: false,
  }).map((item) => item.key)

  assert.equal(restricted.includes('articulations'), false)
  assert.equal(restricted.includes('access'), false)
  assert.equal(restricted.includes('projects'), true)

  const keys = homeStageSTourSteps(elevated).map((item) => item.key)
  assert.equal(keys.includes('articulations'), true)
  assert.equal(keys.includes('access'), true)
})

test('las pantallas principales de S tienen un recorrido contextual', () => {
  for (const pathname of [
    '/panel/personas',
    '/panel/nodos',
    '/panel/organizaciones',
    '/panel/habilidades',
    '/panel/proyectos',
    '/panel/temas',
    '/panel/perfil',
    '/panel/comentarios-piloto',
  ]) {
    assert.ok(
      contextualStageSTourSteps(pathname).length >= 2,
      `Sin recorrido contextual para ${pathname}`,
    )
  }
})

test('cada paso apunta a un elemento real de su pantalla', async () => {
  const pages = [
    'personas',
    'nodos',
    'organizaciones',
    'habilidades',
    'proyectos',
    'temas',
    'perfil',
    'comentarios-piloto',
  ]

  for (const page of pages) {
    const filename = `app/panel/${page}/page.tsx`
    const source = await readFile(filename, 'utf8')

    for (const step of contextualStageSTourSteps(`/panel/${page}`)) {
      assert.ok(
        step.target && source.includes(`data-tour="${step.target}"`),
        `${filename} no contiene el destino del paso ${step.key}`,
      )
    }
  }

  const home = await readFile('app/panel/page.tsx', 'utf8')
  for (const step of homeStageSTourSteps(elevated)) {
    if (step.target) {
      assert.ok(
        home.includes(`'${step.target}'`) ||
          home.includes(`data-tour="${step.target}"`),
        `Inicio no contiene el destino de ${step.key}`,
      )
    }
  }
})

test('la visita guiada no escribe datos de práctica', async () => {
  const source = await readFile('components/panel-tour.tsx', 'utf8')
  assert.equal(source.includes('fetch('), false)
  assert.equal(source.includes('supabase.'), false)
  assert.equal(source.includes('form action='), false)
})

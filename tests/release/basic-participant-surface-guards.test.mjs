import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const elevatedApiRoutes = [
  'app/api/panel/agenda/origins/route.ts',
  'app/api/panel/agenda/route.ts',
  'app/api/panel/comunicaciones/recipients/route.ts',
  'app/api/panel/comunicaciones/referencias/route.ts',
  'app/api/panel/comunicaciones/route.ts',
  'app/api/panel/necesidades-ofertas/route.ts',
  'app/api/panel/oportunidades/[id]/matches/[matchId]/evidence/route.ts',
  'app/api/panel/oportunidades/[id]/requirements/[revisionId]/candidates/route.ts',
  'app/api/panel/oportunidades/actores/route.ts',
  'app/api/panel/oportunidades/nodos/route.ts',
  'app/api/panel/oportunidades/referencias/route.ts',
  'app/api/panel/resultados/actores/route.ts',
  'app/api/panel/temas/route.ts',
]

test('las APIs de módulos elevados bloquean al participante básico', async () => {
  for (const route of elevatedApiRoutes) {
    const source = await readFile(route, 'utf8')

    assert.match(
      source,
      /isBasicParticipantAccess\(access\)/,
      `${route} debe bloquear explícitamente al participante básico`,
    )
  }
})

test('la revisión de actores pendientes usa el guard elevado', async () => {
  const source = await readFile(
    'app/panel/actores-pendientes/layout.tsx',
    'utf8',
  )

  assert.match(
    source,
    /requireElevatedPanelAccess\(\)/,
  )
})

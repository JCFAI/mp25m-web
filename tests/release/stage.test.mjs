import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '../..')

function load(path) {
  const code = ts.transpileModule(
    readFileSync(resolve(root, path), 'utf8'),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText

  const loaded = { exports: {} }

  new Function(
    'module',
    'exports',
    code,
  )(loaded, loaded.exports)

  return loaded.exports
}

const releaseStage = load(
  'lib/release-stage.ts',
)

function withReleaseStage(value, callback) {
  const previous =
    process.env.MP25M_RELEASE_STAGE

  if (value === undefined) {
    delete process.env.MP25M_RELEASE_STAGE
  } else {
    process.env.MP25M_RELEASE_STAGE = value
  }

  try {
    callback()
  } finally {
    if (previous === undefined) {
      delete process.env.MP25M_RELEASE_STAGE
    } else {
      process.env.MP25M_RELEASE_STAGE = previous
    }
  }
}

test('MP25M_S is the safe default and stages are ordered', () => {
  withReleaseStage(undefined, () => {
    assert.equal(
      releaseStage.getCurrentReleaseStage(),
      'S',
    )
  })

  withReleaseStage('l', () => {
    assert.equal(
      releaseStage.getCurrentReleaseStage(),
      'L',
    )
  })

  withReleaseStage('unexpected', () => {
    assert.equal(
      releaseStage.getCurrentReleaseStage(),
      'S',
    )
  })

  assert.equal(
    releaseStage.isReleaseStageAvailable('S', 'M'),
    false,
  )
  assert.equal(
    releaseStage.isReleaseStageAvailable('M', 'M'),
    true,
  )
  assert.equal(
    releaseStage.isReleaseStageAvailable('L', 'M'),
    true,
  )
  assert.equal(
    releaseStage.isReleaseStageAvailable('XL', 'XL'),
    true,
  )
})

test('future modules are classified by their routes', () => {
  const cases = [
    ['/panel/agenda', 'agenda'],
    ['/api/panel/agenda/origins', 'agenda'],
    ['/panel/informes', 'reports'],
    ['/panel/comunicaciones/nueva', 'communications'],
    ['/api/panel/comunicaciones/recipients', 'communications'],
    ['/panel/oportunidades/example', 'opportunities'],
    ['/api/panel/oportunidades/actores', 'opportunities'],
    ['/panel/necesidades-ofertas/nuevo', 'needs_offers'],
    ['/api/panel/necesidades-ofertas', 'needs_offers'],
    ['/panel/actividades/propuestas', 'activities'],
    ['/panel/actores-pendientes/example', 'activities'],
    ['/api/panel/resultados/actores', 'results'],
    ['/panel/articulaciones', undefined],
    ['/panel/agendario', undefined],
  ]

  for (const [pathname, expectedKey] of cases) {
    assert.equal(
      releaseStage.getReleaseModuleForPath(
        pathname,
      )?.key,
      expectedKey,
      pathname,
    )
  }
})

test('registered modules retain their agreed release stage', () => {
  assert.equal(
    releaseStage.getReleaseModuleByKey('agenda')
      ?.availableFrom,
    'M',
  )
  assert.equal(
    releaseStage.getReleaseModuleByKey('reports')
      ?.availableFrom,
    'M',
  )
  assert.equal(
    releaseStage.getReleaseModuleByKey('opportunities')
      ?.availableFrom,
    'L',
  )
  assert.equal(
    releaseStage.getReleaseModuleByKey('economics')
      ?.availableFrom,
    'XL',
  )
  assert.equal(
    releaseStage.getReleaseModuleByKey('unknown'),
    undefined,
  )
})

test('embedded economics and results are available only from XL', () => {
  for (const stage of ['S', 'M', 'L']) {
    withReleaseStage(stage, () => {
      assert.equal(releaseStage.isReleaseModuleEnabled('economics'), false)
      assert.equal(releaseStage.isReleaseModuleEnabled('results'), false)
    })
  }
  withReleaseStage('XL', () => {
    assert.equal(releaseStage.isReleaseModuleEnabled('economics'), true)
    assert.equal(releaseStage.isReleaseModuleEnabled('results'), true)
  })
})

test('embedded UI and all seven server writes retain release checks', () => {
  for (const path of [
    'app/panel/articulaciones/[id]/page.tsx',
    'app/panel/proyectos/[id]/page.tsx',
  ]) {
    const content = readFileSync(resolve(root, path), 'utf8')
    assert.ok(content.includes("isReleaseModuleEnabled('economics')"), path)
    assert.ok(content.includes("isReleaseModuleEnabled('results')"), path)
    assert.match(content, /\{resultsEnabled \? \(\s*<ResultSection/)
    assert.match(content, /\{canManageEconomics \? \(\s*<EconomicSection/)
  }

  for (const { path, key, names } of [
    {
      path: 'app/panel/economia/actions.ts',
      key: 'economics',
      names: ['saveEconomicProfileAction'],
    },
    {
      path: 'app/panel/resultados/actions.ts',
      key: 'results',
      names: [
        'createResultAction',
        'updateResultAction',
        'voidResultAction',
        'addResultContributionAction',
        'updateResultContributionAction',
        'removeResultContributionAction',
      ],
    },
  ]) {
    const content = readFileSync(resolve(root, path), 'utf8')
    for (const name of names) {
      const start = content.indexOf(`export async function ${name}(`)
      assert.notEqual(start, -1, `Falta la acción ${name}`)
      const next = content.indexOf('export async function ', start + 1)
      const section = content.slice(start, next < 0 ? undefined : next)
      assert.ok(
        section.includes(`if (!isReleaseModuleEnabled('${key}'))`),
        `Falta protección ${key} en ${name}`,
      )
    }
  }
})

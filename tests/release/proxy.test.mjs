import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'

const root = resolve(import.meta.dirname, '../..')

function load(path, mocks) {
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
    'require',
    'module',
    'exports',
    code,
  )((name) => {
    if (name in mocks) {
      return mocks[name]
    }

    throw new Error(
      `Dependencia no simulada: ${name}`,
    )
  }, loaded, loaded.exports)

  return loaded.exports
}

function request(pathname, method = 'GET') {
  return {
    method,
    url: `https://mp25m.test${pathname}`,
    nextUrl: { pathname },
  }
}

test('MP25M_S redirects future pages and rejects their APIs', async () => {
  const previous =
    process.env.MP25M_RELEASE_STAGE

  process.env.MP25M_RELEASE_STAGE = 'S'

  const calls = []
  const NextResponse = {
    json(body, init) {
      return {
        kind: 'json',
        body,
        status: init.status,
      }
    },
    redirect(url) {
      return {
        kind: 'redirect',
        location: url.toString(),
      }
    },
  }

  try {
    const releaseStage = load(
      'lib/release-stage.ts',
      {},
    )

    const { proxy } = load('proxy.ts', {
      'next/server': { NextResponse },
      './lib/release-stage': releaseStage,
      './lib/supabase/proxy': {
        updateSession: async (receivedRequest) => {
          calls.push(receivedRequest.nextUrl.pathname)

          return { kind: 'session' }
        },
      },
    })

    const agendaPage = await proxy(
      request('/panel/agenda'),
    )

    assert.equal(agendaPage.kind, 'redirect')
    assert.equal(
      agendaPage.location,
      'https://mp25m.test/panel?release=unavailable&module=agenda',
    )

    const opportunitiesApi = await proxy(
      request('/api/panel/oportunidades/actores'),
    )

    assert.deepEqual(opportunitiesApi, {
      kind: 'json',
      status: 403,
      body: {
        error:
          'Oportunidades estará disponible en MP25M_M.',
      },
    })

    const agendaPost = await proxy(
      request('/panel/agenda', 'POST'),
    )

    assert.equal(agendaPost.kind, 'json')
    assert.equal(agendaPost.status, 403)

    const articulations = await proxy(
      request('/panel/articulaciones'),
    )

    assert.deepEqual(articulations, {
      kind: 'session',
    })
    assert.deepEqual(calls, [
      '/panel/articulaciones',
    ])
  } finally {
    if (previous === undefined) {
      delete process.env.MP25M_RELEASE_STAGE
    } else {
      process.env.MP25M_RELEASE_STAGE = previous
    }
  }
})

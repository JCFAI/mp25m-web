import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { after, before, test } from 'node:test'
import { chromium } from 'playwright'
import ts from 'typescript'

// Browser component tests with installed React, real DOM and controlled promises.
// No dev server, database, credentials or network requests are needed.
const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../..')
const modules = new Map()
const aliases = {
  react: resolve(dirname(require.resolve('react')), 'cjs/react.production.js'),
  'react/jsx-runtime': resolve(dirname(require.resolve('react')), 'cjs/react-jsx-runtime.production.js'),
  'react-dom': resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom.production.js'),
  'react-dom/client': resolve(dirname(require.resolve('react-dom')), 'cjs/react-dom-client.production.js'),
  scheduler: resolve(dirname(require.resolve('scheduler')), 'cjs/scheduler.production.js'),
}
function bundleModule(file) {
  if (modules.has(file)) return file
  modules.set(file, '')
  let code = file.endsWith('/app/login/actions.ts')
    ? 'exports.login = () => new Promise(resolve => { window.loginCalls++; window.finishLogin = resolve })'
    : readFileSync(file, 'utf8')
  if (/\.tsx?$/.test(file)) {
    code = ts.transpileModule(code, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    } }).outputText
  }
  code = code.replace(/require\(["']([^"']+)["']\)/g, (_, name) => {
    const local = resolve(dirname(file), name)
    const target = aliases[name] ?? [local, local + '.ts', local + '.tsx']
      .find((candidate) => existsSync(candidate))
    if (!target) throw new Error('Unresolved test import: ' + name)
    return 'require(' + JSON.stringify(bundleModule(target)) + ')'
  })
  modules.set(file, code)
  return file
}
const ids = {}
for (const [name, file] of Object.entries({
  hook: 'hooks/use-remote-reference-list.ts',
  pagination: 'components/remote-list-pagination.tsx',
  dialog: 'components/reference-list-dialog.tsx',
  login: 'app/login/login-form.tsx',
})) ids[name] = bundleModule(resolve(root, file))
for (const file of Object.values(aliases)) bundleModule(file)
const bundle = '(function(){const modules={' + [...modules].map(([id, code]) =>
  JSON.stringify(id) + ':function(module,exports,require){' + code + '\n}'
).join(',') + '};const cache={};window.loadTestModule=function require(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,require);return m.exports}})()'

let browser
before(async () => { browser = await chromium.launch() })
after(async () => { await browser?.close() })

async function fixture(t, { dialog = false, observer = 'mock', enabledInitially = false } = {}) {
  const page = await browser.newPage()
  t.after(() => page.close())
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.setContent('<div id="root"></div>')
  await page.addScriptTag({ content: bundle })
  await page.evaluate(({ ids, aliases, dialog, observer, enabledInitially }) => {
    const React = window.loadTestModule(aliases.react)
    const { createRoot } = window.loadTestModule(aliases['react-dom/client'])
    const { useRemoteReferenceList } = window.loadTestModule(ids.hook)
    const { RemoteListPagination } = window.loadTestModule(ids.pagination)
    const { ReferenceListDialog } = window.loadTestModule(ids.dialog)
    window.requests = []
    window.observers = []
    if (observer === 'mock') window.IntersectionObserver = class {
      constructor(callback) { this.callback = callback; window.observers.push(this) }
      observe() { this.active = true }
      disconnect() { this.active = false }
    }
    if (observer === 'absent') window.IntersectionObserver = undefined
    function Harness() {
      const [context, setContext] = React.useState('A')
      const list = useRemoteReferenceList({
        contextKey: context,
        getItemKey: (item) => item.id,
        fetchPage: (input) => new Promise((resolve, reject) => {
          window.requests.push({ ...input, context, resolve, reject })
        }),
        enabledInitially,
      })
      React.useEffect(() => { window.list = list; window.setContext = setContext }, [list])
      if (dialog) return React.createElement(ReferenceListDialog, {
        title: 'Referencias', description: 'Explorar', emptyMessage: 'Sin resultados',
        items: list.items, getItemKey: (item) => item.id,
        getItemSearchText: (item) => item.id, renderItem: (item) => item.id,
        onOpen: list.open, onSelect: () => {},
        remote: {
          ...list, onQueryChange: list.setQuery, onRetry: list.retry,
          onLoadMore: list.loadMore, autoLoad: true,
        },
      })
      return React.createElement(React.Fragment, null,
        React.createElement('output', null, list.status),
        React.createElement(RemoteListPagination, {
          key: list.paginationKey,
          ...list, error: list.loadMoreError, onLoadMore: list.loadMore,
        }))
    }
    window.testRoot = createRoot(document.getElementById('root'))
    window.testRoot.render(React.createElement(Harness))
  }, { ids, aliases, dialog, observer, enabledInitially })
  await page.waitForFunction(() => Boolean(window.list))
  return page
}
async function resolvePage(page, index, items, nextCursor) {
  await page.evaluate(({ index, items, nextCursor }) => {
    window.requests[index].resolve({ items: items.map((id) => ({ id })), nextCursor })
  }, { index, items, nextCursor })
}
async function requestCount(page, count) {
  await page.waitForFunction((count) => window.requests.length === count, count)
}
async function status(page, value) {
  await page.waitForFunction((value) => window.list.status === value, value)
}

test('enabledInitially preloads the first page without an explicit open action', async (t) => {
  const page = await fixture(t, {
    observer: 'absent',
    enabledInitially: true,
  })

  await requestCount(page, 1)

  assert.deepEqual(
    await page.evaluate(() => {
      const { query, cursor, context } = window.requests[0]
      return { query, cursor, context }
    }),
    { query: '', cursor: null, context: 'A' }
  )

  await resolvePage(page, 0, ['one', 'two'], 'next')
  await status(page, 'ready')

  assert.deepEqual(
    await page.evaluate(() => window.list.items),
    [{ id: 'one' }, { id: 'two' }]
  )
})

test('Personas paginates remotely while Nodos caches and filters locally', () => {
  const personSource = readFileSync(
    resolve(root, 'app/panel/personas/person-search.tsx'),
    'utf8'
  )
  const nodeSource = readFileSync(
    resolve(root, 'app/panel/nodos/node-search.tsx'),
    'utf8'
  )
  const nodeCacheSource = readFileSync(
    resolve(root, 'lib/nodes/client-directory-cache.ts'),
    'utf8'
  )
  const nodeServerSource = readFileSync(
    resolve(root, 'lib/nodes/search.ts'),
    'utf8'
  )
  const dialogSource = readFileSync(
    resolve(root, 'components/reference-list-dialog.tsx'),
    'utf8'
  )
  const paginationSource = readFileSync(
    resolve(root, 'lib/reference-pagination.ts'),
    'utf8'
  )
  const peopleSearchSource = readFileSync(
    resolve(root, 'lib/people/search.ts'),
    'utf8'
  )
  const actorSearchSource = readFileSync(
    resolve(root, 'lib/opportunities/actors.ts'),
    'utf8'
  )

  // Personas: grande/dinámico -> remoto + cursor.
  assert.match(personSource, /enabledInitially:\s*true/)
  assert.match(personSource, /minimumQueryLength:\s*1/)
  assert.match(personSource, /<RemoteListPagination/)
  assert.match(personSource, /rootRef=\{inlineListRef\}/)

  // Nodos: catálogo chico/estable -> carga completa,
  // cache de sesión y filtrado local.
  assert.match(nodeSource, /loadNodeDirectory/)
  assert.match(nodeSource, /matchesNodeFilter/)
  assert.match(
    nodeSource,
    /matchesFilter=\{\s*matchesNodeFilter\s*\}/
  )
  assert.doesNotMatch(
    nodeSource,
    /<RemoteListPagination/
  )
  assert.doesNotMatch(
    nodeSource,
    /useRemoteReferenceList/
  )

  assert.match(
    nodeCacheSource,
    /sessionStorage/
  )
  assert.match(
    nodeCacheSource,
    /memoryCache/
  )
  assert.match(
    nodeCacheSource,
    /pendingRequest/
  )

  // El diálogo admite semántica de filtrado específica
  // para evitar mezclar campos accidentalmente.
  assert.match(
    dialogSource,
    /matchesFilter\?/
  )

  // El endpoint no recorta el catálogo de nodos.
  assert.doesNotMatch(
    nodeServerSource,
    /REFERENCE_NODE_LIST_LIMIT/
  )

  // El contrato general conserva mínimo 2 salvo que
  // un consumidor pida explícitamente otra cosa.
  assert.match(
    paginationSource,
    /minimumQueryLength = 2/
  )
  assert.match(
    peopleSearchSource,
    /minimumQueryLength:\s*1/
  )
  assert.match(
    actorSearchSource,
    /minimumQueryLength = 2/
  )
})

test('setQuery immediately blocks loadMore from the previous query and cursor', async (t) => {
  const page = await fixture(t)
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  assert.equal(await page.evaluate(() => window.requests[0].query), '')
  await resolvePage(page, 0, ['one'], 'old-cursor')
  await status(page, 'ready')
  await page.evaluate(() => {
    window.list.setQuery('x')
    window.list.loadMore()
  })
  await status(page, 'minimum-query')
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => window.requests.length), 1)

  await page.evaluate(() => {
    window.list.setQuery('valid')
    window.list.loadMore()
  })
  await requestCount(page, 2)
  assert.deepEqual(await page.evaluate(() => {
    const { query, cursor } = window.requests[1]
    return { query, cursor }
  }), { query: 'valid', cursor: null })
  await resolvePage(page, 1, ['valid-result'], 'valid-cursor')
  await status(page, 'ready')
  await page.evaluate(() => {
    window.list.setQuery('')
    window.list.loadMore()
  })
  await requestCount(page, 3)
  assert.deepEqual(await page.evaluate(() => {
    const { query, cursor } = window.requests[2]
    return { query, cursor }
  }), { query: '', cursor: null })
})

for (const changeFirst of [true, false]) {
  test(`context change and immediate loadMore never fetch the previous cursor (change first: ${changeFirst})`, async (t) => {
    const page = await fixture(t, { observer: 'absent' })
    await page.evaluate(() => window.list.open())
    await requestCount(page, 1)
    await resolvePage(page, 0, ['A'], 'old-cursor')
    await status(page, 'ready')
    const immediateCount = await page.evaluate((changeFirst) => {
      if (changeFirst) window.setContext('B')
      window.list.loadMore()
      if (!changeFirst) window.setContext('B')
      return window.requests.length
    }, changeFirst)
    assert.equal(immediateCount, 1)
    await requestCount(page, 2)
    assert.deepEqual(await page.evaluate(() => window.requests.map(({ context, query, cursor }) => ({ context, query, cursor }))), [
      { context: 'A', query: '', cursor: null },
      { context: 'B', query: '', cursor: null },
    ])
    await resolvePage(page, 1, ['B'], null)
    await status(page, 'ready')
    assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'B' }])
  })
}

test('A to B to A cannot revive the old A cursor or a retained loadMore callback', async (t) => {
  const page = await fixture(t, { observer: 'absent' })
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await resolvePage(page, 0, ['old-A'], 'old-A-cursor')
  await status(page, 'ready')
  await page.evaluate(() => {
    window.oldLoadMore = window.list.loadMore
    window.setContext('B')
    window.list.loadMore()
  })
  await requestCount(page, 2)
  await resolvePage(page, 1, ['B'], 'B-cursor')
  await status(page, 'ready')
  await page.evaluate(() => {
    window.setContext('A')
    window.list.loadMore()
    window.oldLoadMore()
  })
  await requestCount(page, 3)
  assert.deepEqual(await page.evaluate(() => window.requests.map(({ context, cursor }) => ({ context, cursor }))), [
    { context: 'A', cursor: null }, { context: 'B', cursor: null }, { context: 'A', cursor: null },
  ])
  await resolvePage(page, 2, ['fresh-A'], 'fresh-A-cursor')
  await status(page, 'ready')
  await page.evaluate(() => window.oldLoadMore())
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.requests.length), 3)
  await page.evaluate(() => { window.list.loadMore(); window.list.loadMore() })
  await requestCount(page, 4)
  assert.equal(await page.evaluate(() => window.requests[3].cursor), 'fresh-A-cursor')
  await resolvePage(page, 3, ['next-A'], null)
  await status(page, 'ready')
  assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'fresh-A' }, { id: 'next-A' }])
})

test('real observer does not chain pages while the sentinel remains visible', async (t) => {
  // This fixture intentionally renders no rows: the sentinel stays in view
  // even after new items arrive, including short/deduplicated result pages.
  const page = await fixture(t, { observer: 'real' })
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await resolvePage(page, 0, ['one'], 'cursor1')
  await requestCount(page, 2)
  await resolvePage(page, 1, ['two'], 'cursor2')
  await status(page, 'ready')
  await page.waitForTimeout(350)
  assert.equal(await page.evaluate(() => window.requests.length), 2)
  assert.equal(await page.getByRole('button', { name: 'Cargar más' }).isEnabled(), true)
  // Manual fallback still works without leaving the observation zone.
  await page.getByRole('button', { name: 'Cargar más' }).click()
  await requestCount(page, 3)
  await resolvePage(page, 2, ['three'], 'cursor3')
  await status(page, 'ready')
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => window.requests.length), 3)
})

test('real observer rearms when the sentinel leaves and reenters the zone', async (t) => {
  const page = await fixture(t, { observer: 'real' })
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await resolvePage(page, 0, ['one'], 'cursor1')
  await requestCount(page, 2)
  await resolvePage(page, 1, ['two'], 'cursor2')
  await status(page, 'ready')
  await page.addStyleTag({ content: '#root > div { margin-top: 2000px; }' })
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => window.requests.length), 2)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await requestCount(page, 3)
  assert.equal(await page.evaluate(() => window.requests[2].cursor), 'cursor2')
  await resolvePage(page, 2, ['three'], null)
  await status(page, 'ready')
  await page.waitForTimeout(150)
  assert.equal(await page.evaluate(() => window.requests.length), 3)
})

for (const change of ['context', 'query']) {
  test(`real observer starts a new session on ${change} change during a pending page`, async (t) => {
    const page = await fixture(t, { observer: 'real' })
    await page.evaluate(() => window.list.open())
    await requestCount(page, 1)
    await resolvePage(page, 0, ['one'], 'old-cursor')
    await requestCount(page, 2)
    await page.evaluate((change) => {
      if (change === 'context') window.setContext('B')
      else window.list.setQuery('new')
    }, change)
    await requestCount(page, 3)
    assert.equal(await page.evaluate(() => window.requests[1].signal.aborted), true)
    assert.equal(await page.getByText('No hay más resultados.', { exact: true }).count(), 0)
    assert.deepEqual(await page.evaluate(() => {
      const { context, query, cursor } = window.requests[2]
      return { context, query, cursor }
    }), { context: change === 'context' ? 'B' : 'A', query: change === 'query' ? 'new' : '', cursor: null })
    await resolvePage(page, 2, ['fresh'], 'new-cursor')
    await requestCount(page, 4)
    assert.equal(await page.evaluate(() => window.requests[3].cursor), 'new-cursor')
    await resolvePage(page, 1, ['stale'], 'stale-cursor')
    await resolvePage(page, 3, ['fresh-two'], 'next')
    await status(page, 'ready')
    await page.waitForTimeout(150)
    assert.equal(await page.evaluate(() => window.requests.length), 4)
    assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'fresh' }, { id: 'fresh-two' }])
  })
}

for (const dialog of [false, true]) {
  test(`keyboard pagination ends with focus on a noninteractive completion message${dialog ? ' inside dialog' : ''}`, async (t) => {
    const page = await fixture(t, { dialog, observer: 'absent' })
    if (dialog) await page.getByRole('button', { name: 'Ver lista' }).click()
    else await page.evaluate(() => window.list.open())
    await requestCount(page, 1)
    await resolvePage(page, 0, ['one'], 'last-page')
    await status(page, 'ready')
    await page.getByRole('button', { name: 'Cargar más' }).focus()
    await page.keyboard.press('Enter')
    await requestCount(page, 2)
    await page.waitForTimeout(100)
    await resolvePage(page, 1, ['two'], null)
    await status(page, 'ready')
    const completion = page.getByRole('status').filter({ hasText: 'No hay más resultados.' })
    assert.equal(await completion.evaluate((el) => el === document.activeElement), true)
    assert.equal(await completion.getAttribute('tabindex'), '-1')
    assert.equal(await page.getByRole('button', { name: /Cargar más|Cargando más/ }).count(), 0)
    if (dialog) {
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('button', { name: 'Ver lista' }).evaluate((el) => el === document.activeElement), true)
    }
  })
}

for (const dialog of [false, true]) {
  for (const activation of ['keyboard', 'click']) {
    test(`intermediate page restores the manual button focus (${activation}, dialog: ${dialog})`, async (t) => {
      const page = await fixture(t, { dialog, observer: 'absent' })
      if (dialog) await page.getByRole('button', { name: 'Ver lista' }).click()
      else await page.evaluate(() => window.list.open())
      await requestCount(page, 1)
      await resolvePage(page, 0, ['one'], 'cursor1')
      await status(page, 'ready')
      const button = page.getByRole('button', { name: 'Cargar más' })
      if (activation === 'keyboard') {
        await button.focus()
        await page.keyboard.press('Enter')
      } else await button.click()
      await requestCount(page, 2)
      await page.waitForTimeout(100)
      await resolvePage(page, 1, ['two'], 'cursor2')
      await status(page, 'ready')
      assert.equal(await button.evaluate((el) => el === document.activeElement), true)
      assert.equal(await button.isEnabled(), true)
      // Continue immediately with the keyboard from the restored position.
      await page.keyboard.press('Enter')
      await requestCount(page, 3)
      assert.equal(await page.evaluate(() => window.requests[2].cursor), 'cursor2')
      await resolvePage(page, 2, ['three'], null)
      await status(page, 'ready')
    })
  }
  for (const finalPage of [false, true]) {
    test(`manual loading does not steal focus (final: ${finalPage}, dialog: ${dialog})`, async (t) => {
      const page = await fixture(t, { dialog, observer: 'absent' })
      if (dialog) await page.getByRole('button', { name: 'Ver lista' }).click()
      else {
        await page.evaluate(() => {
          const input = document.createElement('input')
          input.setAttribute('aria-label', 'Otro control')
          document.body.append(input)
          window.list.open()
        })
      }
      await requestCount(page, 1)
      await resolvePage(page, 0, ['one'], 'next')
      await status(page, 'ready')
      await page.getByRole('button', { name: 'Cargar más' }).focus()
      await page.keyboard.press('Enter')
      await requestCount(page, 2)
      await page.getByRole('textbox').focus()
      await resolvePage(page, 1, ['two'], finalPage ? null : 'cursor2')
      await status(page, 'ready')
      assert.equal(await page.getByRole('textbox').evaluate((el) => el === document.activeElement), true)
    })
  }
}

test('minimum-query, debouncing, stale responses, filter cursor isolation and deduplication', async (t) => {
  const page = await fixture(t)
  await status(page, 'idle')
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await resolvePage(page, 0, ['one', 'one'], 'A1')
  await status(page, 'ready')
  assert.equal(await page.evaluate(() => window.list.items.length), 1)
  await page.evaluate(() => { window.list.loadMore(); window.list.loadMore() })
  await requestCount(page, 2)
  await page.evaluate(() => window.list.setQuery('a!'))
  await status(page, 'minimum-query')
  assert.equal(await page.evaluate(() => window.requests[1].signal.aborted), true)
  await resolvePage(page, 1, ['stale'], null)
  await page.waitForTimeout(300)
  assert.equal(await page.evaluate(() => window.requests.length), 2)
  assert.deepEqual(await page.evaluate(() => window.list.items), [])
  await page.evaluate(() => { window.list.setQuery('alpha'); window.setContext('B') })
  await requestCount(page, 3)
  assert.deepEqual(await page.evaluate(() => {
    const { context, query, cursor } = window.requests[2]
    return { context, query, cursor }
  }), { context: 'B', query: 'alpha', cursor: null })
  await page.evaluate(() => window.list.setQuery('beta'))
  await requestCount(page, 4)
  await resolvePage(page, 3, ['fresh'], 'B1')
  await status(page, 'ready')
  await resolvePage(page, 2, ['stale'], 'old')
  assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'fresh' }])
  await page.evaluate(() => window.setContext('A'))
  await status(page, 'loading')
  await requestCount(page, 5)
  assert.equal(await page.evaluate(() => window.requests[4].cursor), null)
  await resolvePage(page, 4, [], null)
  await status(page, 'empty')
})

test('observer bursts, manual fallback, load error and retry preserve existing items', async (t) => {
  const page = await fixture(t)
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await resolvePage(page, 0, ['one'], 'cursor1')
  await status(page, 'ready')
  await page.waitForFunction(() => window.observers.some((entry) => entry.active))
  await page.evaluate(() => {
    const observer = window.observers.findLast((entry) => entry.active)
    observer.callback([{ isIntersecting: true }])
    observer.callback([{ isIntersecting: true }])
    window.list.loadMore()
  })
  await requestCount(page, 2)
  await page.evaluate(() => window.requests[1].reject(new Error('network')))
  await status(page, 'loadMoreError')
  assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'one' }])
  // Even a new intersection cannot retry an error without manual intervention.
  await page.evaluate(() => {
    const observer = window.observers.findLast((entry) => entry.active)
    observer.callback([{ isIntersecting: false }])
    observer.callback([{ isIntersecting: true }])
  })
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.requests.length), 2)
  await page.getByRole('button', { name: 'Reintentar carga' }).click()
  await requestCount(page, 3)
  assert.equal(await page.evaluate(() => window.requests[2].cursor), 'cursor1')
  await resolvePage(page, 2, ['one', 'two'], null)
  await status(page, 'ready')
  assert.deepEqual(await page.evaluate(() => window.list.items), [{ id: 'one' }, { id: 'two' }])
  assert.equal(await page.getByRole('button').count(), 0)
  assert.equal(await page.evaluate(() => window.observers.some((entry) => entry.active)), false)
  // A queued callback from a disconnected observer must also be harmless.
  await page.evaluate(() => {
    for (const observer of window.observers) {
      observer.callback([{ isIntersecting: false }, { isIntersecting: true }])
    }
  })
  assert.equal(await page.evaluate(() => window.requests.length), 3)
})

test('manual load remains usable without IntersectionObserver; initial errors can be retried', async (t) => {
  const page = await fixture(t, { observer: 'absent' })
  await page.evaluate(() => window.list.open())
  await requestCount(page, 1)
  await page.evaluate(() => window.requests[0].reject(new Error('network')))
  await status(page, 'error')
  await page.evaluate(() => window.list.retry())
  await requestCount(page, 2)
  await resolvePage(page, 1, ['one'], 'next')
  await status(page, 'ready')
  await page.getByRole('button', { name: 'Cargar más' }).click()
  await requestCount(page, 3)
  await resolvePage(page, 2, ['two'], null)
  await status(page, 'ready')
})

test('dialog focus, minimum-query message, Escape, return focus and no loading while closed', async (t) => {
  const page = await fixture(t, { dialog: true })
  await page.getByRole('button', { name: 'Ver lista' }).click()
  await requestCount(page, 1)
  await resolvePage(page, 0, ['one'], 'next')
  await status(page, 'ready')
  assert.equal(await page.getByRole('textbox').evaluate((el) => el === document.activeElement), true)
  await page.getByRole('textbox').fill('x')
  await status(page, 'minimum-query')
  assert.equal(await page.getByRole('button', { name: /Reintentar/ }).count(), 0)
  assert.equal(await page.getByRole('dialog').getByText(/Ingresá al menos 2 caracteres/).count(), 2)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: 'Ver lista' }).evaluate((el) => el === document.activeElement), true)
  assert.equal(await page.evaluate(() => window.observers.some((entry) => entry.active)), false)
})

test('Login blocks two submits in one frame and restores availability after completion', async (t) => {
  const page = await fixture(t)
  await page.evaluate(({ ids, reactId }) => {
    window.loginCalls = 0
    const { LoginForm } = window.loadTestModule(ids.login)
    window.testRoot.render(window.loadTestModule(reactId).createElement(LoginForm))
  }, { ids, reactId: aliases.react })
  await page.getByLabel('Email', { exact: true }).fill('test@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-only')
  await page.locator('form').evaluate((form) => { form.requestSubmit(); form.requestSubmit() })
  await page.getByRole('button', { name: 'Ingresando…' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Ingresando…' }).isDisabled(), true)
  assert.equal(await page.evaluate(() => window.loginCalls), 1)
  await page.evaluate(() => window.finishLogin())
  await page.getByRole('button', { name: 'Ingresar', exact: true }).waitFor()
  await page.getByLabel('Email', { exact: true }).fill('test@example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('test-only')
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  assert.equal(await page.evaluate(() => window.loginCalls), 2)
  await page.evaluate(() => window.finishLogin())
})

test('real IntersectionObserver uses the dialog scroll root and appends without a scroll jump', async (t) => {
  const page = await fixture(t, { dialog: true, observer: 'real' })
  await page.addStyleTag({ content: [
    'dialog {height: 550px; width: 500px;}',
    'dialog > div {height: 100%; display: flex; flex-direction: column;}',
    'dialog > div > div:first-child {flex: none;}',
    'dialog > div > div:last-child {overflow-y: auto; min-height: 0; flex: 1;}',
    'dialog button {display: block; min-height: 40px;}',
    '.sr-only {position: absolute; width: 1px; height: 1px; overflow: hidden;}',
  ].join('') })
  await page.getByRole('button', { name: 'Ver lista' }).click()
  await requestCount(page, 1)
  await resolvePage(page, 0, Array.from({ length: 50 }, (_, i) => 'item-' + i), 'next')
  await status(page, 'ready')
  await page.waitForTimeout(100)
  assert.equal(await page.evaluate(() => window.requests.length), 1)
  const scroll = page.locator('dialog > div > div').last()
  const before = await scroll.evaluate((el) => {
    el.scrollTop = el.scrollHeight - el.clientHeight - 100
    return el.scrollTop
  })
  await requestCount(page, 2)
  await resolvePage(page, 1, Array.from({ length: 50 }, (_, i) => 'item-' + (50 + i)), null)
  await status(page, 'ready')
  assert.equal(await scroll.evaluate((el) => el.scrollTop), before)
  await page.keyboard.press('Escape')
  assert.equal(await page.getByRole('button', { name: 'Ver lista' }).evaluate((el) => el === document.activeElement), true)
})

test('compiled sidebar CSS stays sticky, scrolls internally and hides on mobile', async (t) => {
  const staticDirectory = resolve(root, '.next/static')
  assert.ok(existsSync(staticDirectory), 'Missing production CSS: run npm run build before this suite.')
  function collectCss(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory() ? collectCss(path) : entry.name.endsWith('.css') ? [path] : []
    })
  }
  // Turbopack writes hashed CSS in static/chunks; Webpack uses static/css.
  const cssFiles = collectCss(staticDirectory).sort()
  assert.ok(cssFiles.length, 'No compiled CSS found under .next/static; run npm run build.')
  const page = await browser.newPage({ viewport: { width: 1200, height: 500 } })
  t.after(() => page.close())
  const layout = readFileSync(resolve(root, 'app/panel/layout.tsx'), 'utf8')
  const main = layout.match(/<main className="([^"]+)"/)[1]
  const aside = layout.match(/<aside className="([^"]+)"/)[1]
  const grid = layout.match(/<div className="([^"]*md:grid-cols-\[270px_1fr\][^"]*)"/)[1]
  await page.setContent('<main class="' + main + '"><div class="' + grid + '">' +
    '<aside class="' + aside + '"><div style="min-height:900px">Menú</div></aside>' +
    '<section style="height:3000px">Contenido</section></div></main>')
  for (const file of cssFiles) {
    await page.addStyleTag({ content: readFileSync(file, 'utf8') })
  }
  assert.deepEqual(await page.locator('main').evaluate((el) => ({
    x: getComputedStyle(el).overflowX, y: getComputedStyle(el).overflowY,
  })), { x: 'clip', y: 'visible' })
  assert.deepEqual(await page.locator('aside').evaluate((el) => ({
    position: getComputedStyle(el).position, overflow: getComputedStyle(el).overflowY,
  })), { position: 'sticky', overflow: 'auto' })
  await page.evaluate(() => window.scrollTo(0, 600))
  assert.equal(await page.evaluate(() => window.scrollY), 600)
  const position = await page.locator('aside').evaluate((el) => ({
    top: el.getBoundingClientRect().top, height: el.clientHeight,
    scrollable: el.scrollHeight > el.clientHeight,
  }))
  assert.deepEqual(position, { top: 0, height: 500, scrollable: true })
  await page.locator('aside').evaluate((el) => { el.scrollTop = 200 })
  assert.equal(await page.locator('aside').evaluate((el) => el.scrollTop), 200)
  assert.equal(await page.evaluate(() => window.scrollY), 600)
  await page.setViewportSize({ width: 390, height: 844 })
  assert.equal(await page.locator('aside').isVisible(), false)
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../..')
// Run actual TS modules, substituting only framework I/O and database boundaries.
function load(path, mocks = {}) {
  const code = ts.transpileModule(readFileSync(resolve(root, path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const loaded = { exports: {} }
  new Function('require', 'module', 'exports', code)((name) => {
    if (name in mocks) return mocks[name]
    if (name === 'server-only') return {}
    if (name.startsWith('react')) return require(name)
    throw new Error('Unmocked dependency: ' + name)
  }, loaded, loaded.exports)
  return loaded.exports
}
const id = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
const access = [{ internal_user_id: id }]
const auth = { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: id } } }) } }) }
const pagination = load('lib/reference-pagination.ts')

test('standalone and N:M detail render without reading the legacy opportunity', async () => {
  for (const count of [0, 2]) {
    const reads = []
    const articulation = {
      articulation_id: id, title: 'Autónoma', objective: 'Coordinación', status: 'draft',
      responsible_display_name: null, closing_summary: null,
      get opportunity_id() { throw new Error('Legacy access') },
    }
    const list = (name, items) => async (value) => { reads.push([name, value]); return items }
    const { default: Page } = load('app/panel/articulaciones/[id]/page.tsx', {
      'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
      'next/navigation': { notFound: () => { throw new Error('Not found') } },
      '../../../../lib/opportunities/articulations': {
        getArticulation: async () => articulation,
        canManageArticulation: async () => true,
        listArticulationParticipants: list('participants', []),
        listArticulationFollowups: list('followups', []),
        listArticulationOpportunityLinks: list('links', Array.from({ length: count }, (_, index) => ({
          link_id: `link${index}`, opportunity_id: `opportunity${index}`, opportunity_title: `Oportunidad ${index}`, relation_type: 'related',
        }))),
      },
      '../../../../lib/auth/internal-access': { getInternalAccess: async () => access },
      '../../../../lib/opportunities/detail': { canManageOpportunity: () => true, listOpportunityAssigneeOptions: async () => [] },
      '../../../../lib/projects/projects': { listProjectsByArticulation: list('projects', Array.from({ length: count }, (_, index) => ({ project_id: `project${index}`, title: `Proyecto ${index}` }))) },
      '../../../../lib/results/results': {
        listResultsForSource: async (sourceType, sourceId) => {
          assert.equal(sourceType, 'articulation')
          assert.equal(sourceId, id)
          return []
        },
        listResultContributorCandidates: async (sourceType, sourceId) => {
          assert.equal(sourceType, 'articulation')
          assert.equal(sourceId, id)
          return []
        },
        listResultContributions: async (resultIds) => {
          assert.deepEqual(resultIds, [])
          return []
        },
      },
      '../../../../lib/supabase/server': auth,
      '../../resultados/result-section': {
        ResultSection: ({ sourceType, sourceId }) => {
          assert.equal(sourceType, 'articulation')
          assert.equal(sourceId, id)
          return React.createElement('span', null, 'Resultados estructurados')
        },
      },
      '../articulation-controls': { AutonomousArticulationControls: () => React.createElement('span', null, 'Controles autónomos') },
    })
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id }) }))
    assert.match(html, /Controles autónomos/)
    assert.match(html, /Resultados estructurados/)
    assert.equal(reads.length, 4)
    for (const [, readId] of reads) assert.equal(readId, id)
    if (!count) assert.match(html, /No hay oportunidades vinculadas/)
    else for (let index = 0; index < count; index++) {
      assert.match(html, new RegExp(`/panel/oportunidades/opportunity${index}`))
      assert.match(html, new RegExp(`/panel/proyectos/project${index}`))
    }
    assert.doesNotMatch(html, /\/null|oportunidad de origen/)
  }
})

test('opportunity reference pages are bounded, keyset-based and reject foreign cursors', async () => {
  const calls = []
  let rows = [{ id, title: 'Uno', status: 'open' }, { id: otherId, title: 'Dos', status: 'open' }]
  const chain = {}
  for (const method of ['from', 'select', 'neq', 'order', 'limit', 'ilike', 'gt']) {
    chain[method] = (...args) => { calls.push([method, ...args]); return chain }
  }
  chain.then = (resolve) => resolve({ data: rows, error: null })
  const { listOpportunityReferencePage } = load('lib/opportunities/reference.ts', {
    '../reference-pagination': pagination, '../supabase/admin': { createAdminClient: () => chain },
  })
  const first = await listOpportunityReferencePage({ query: '', limit: 1, cursor: null })
  assert.deepEqual(first.items.map((item) => item.id), [id])
  assert.ok(first.nextCursor)
  assert.ok(calls.some(([method, value]) => method === 'limit' && value === 2))
  assert.ok(
    calls.some(
      ([method, column, value]) =>
        method === 'neq' &&
        column === 'status' &&
        value === 'discarded',
    ),
  )
  rows = rows.slice(1)
  const second = await listOpportunityReferencePage({ query: '', limit: 1, cursor: first.nextCursor })
  assert.equal(second.nextCursor, null)
  assert.ok(calls.some(([method, column, value]) => method === 'gt' && column === 'id' && value === id))
  const before = calls.length
  await assert.rejects(() => listOpportunityReferencePage({ query: 'otra', limit: 1, cursor: first.nextCursor }), /cursor/)
  await assert.rejects(() => listOpportunityReferencePage({ query: 'a', limit: 1, cursor: null }), /búsqueda/)
  assert.equal(calls.length, before)
})

test('generic actions operate on articulation IDs, validate inputs and invalidate N:M surfaces', async () => {
  const calls = [], invalidated = []
  const functions = {}
  for (const name of ['transitionOpportunityArticulation', 'addOpportunityArticulationParticipant', 'removeOpportunityArticulationParticipant', 'createOpportunityArticulationFollowup', 'linkArticulationOpportunity', 'unlinkArticulationOpportunity']) {
    functions[name] = async (receivedAccess, input) => { assert.equal(receivedAccess, access); calls.push([name, input]) }
  }
  functions.listArticulationParticipants = async () => [{ participant_id: otherId }]
  const actions = load('app/panel/articulaciones/actions.ts', {
    'next/cache': { revalidatePath: (...args) => invalidated.push(args) },
    'next/navigation': { redirect: () => { throw new Error('redirect') } },
    '../../../lib/auth/internal-access': { getInternalAccess: async () => access },
    '../../../lib/opportunities/articulations': functions,
    '../../../lib/supabase/server': auth,
  })
  const data = (fields) => { const result = new FormData(); for (const [key, value] of Object.entries(fields)) result.set(key, value); return result }
  const idle = { status: 'idle', message: null }
  const cases = [
    ['transitionArticulationAction', { status: 'draft', rationale: 'Cambiar responsable' }],
    ['addArticulationParticipantAction', { actor: `person:${otherId}`, rationale: 'Participación autónoma' }],
    ['createArticulationFollowupAction', { followup_type: 'general', detail: 'Primera novedad' }],
    ['linkArticulationOpportunityAction', { opportunity_id: otherId, relation_type: 'context', relationship_note: 'Contexto' }],
  ]
  for (const [name, fields] of cases) assert.equal((await actions[name](id, idle, data(fields))).status, 'success')
  for (const name of ['removeArticulationParticipantAction', 'unlinkArticulationOpportunityAction']) {
    assert.equal((await actions[name](id, otherId, idle, data({ rationale: 'Ya no participa' }))).status, 'success')
  }
  assert.equal(calls.length, 6)
  assert.equal(calls[1][1].personId, otherId)
  assert.equal(calls[1][1].organizationId, null)
  assert.equal(calls[3][1].relationType, 'context')
  assert.ok(invalidated.some(([path, type]) => path === '/panel/oportunidades/[id]' && type === 'page'))
  assert.equal((await actions.addArticulationParticipantAction(id, idle, data({ actor: `candidate:${otherId}`, rationale: 'No canónico' }))).status, 'error')
  assert.equal(calls.length, 6)
})

test('project link consistency keeps legacy fields out of N:M behavior', () => {
  const migration = readFileSync(
    resolve(
      root,
      'supabase/migrations/20260927120244_project_link_consistency.sql'
    ),
    'utf8'
  )

  assert.match(
    migration,
    /from mp25m\.project_opportunities link/
  )

  assert.doesNotMatch(
    migration,
    /articulation\.opportunity_id/
  )

  assert.doesNotMatch(
    migration,
    /from mp25m\.project_articulations/
  )

  const projectListPage = readFileSync(
    resolve(
      root,
      'app/panel/proyectos/page.tsx'
    ),
    'utf8'
  )

  assert.doesNotMatch(
    projectListPage,
    /project\.source_articulation_title/
  )

  assert.doesNotMatch(
    projectListPage,
    /project\.opportunity_title/
  )

  assert.match(
    projectListPage,
    /Los vínculos con oportunidades y articulaciones/
  )

  const projectDetailPage = readFileSync(
    resolve(
      root,
      'app/panel/proyectos/\[id\]/page.tsx'
    ),
    'utf8'
  )

  assert.match(
    projectDetailPage,
    /opportunity\.status\s*!==\s*'discarded'/
  )
})

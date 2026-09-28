import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const root = resolve(import.meta.dirname, '../..')

function load(path, mocks = {}) {
  const code = ts.transpileModule(
    readFileSync(
      resolve(root, path),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText

  const loaded = {
    exports: {},
  }

  new Function(
    'require',
    'module',
    'exports',
    code,
  )(
    (name) => {
      if (name in mocks) {
        return mocks[name]
      }

      if (name === 'server-only') {
        return {}
      }

      if (name.startsWith('react')) {
        return require(name)
      }

      throw new Error(
        'Unmocked dependency: ' + name,
      )
    },
    loaded,
    loaded.exports,
  )

  return loaded.exports
}

const actorId =
  '00000000-0000-4000-8000-000000000001'

const articulationId =
  '00000000-0000-4000-8000-000000000002'

const projectId =
  '00000000-0000-4000-8000-000000000003'

const resultId =
  '00000000-0000-4000-8000-000000000004'

const contributionId =
  '00000000-0000-4000-8000-000000000005'

const personId =
  '00000000-0000-4000-8000-000000000006'

const organizationId =
  '00000000-0000-4000-8000-000000000007'

const access = [
  {
    internal_user_id: actorId,
  },
]

function form(fields) {
  const data = new FormData()

  for (
    const [key, value]
    of Object.entries(fields)
  ) {
    data.set(key, value)
  }

  return data
}

test('results data layer keeps Articulation and Project origins direct', async () => {
  const calls = []
  let rows = []

  const chain = {}

  for (
    const method
    of [
      'from',
      'select',
      'eq',
      'order',
      'in',
      'maybeSingle',
    ]
  ) {
    chain[method] = (...args) => {
      calls.push([
        method,
        ...args,
      ])

      return chain
    }
  }

  chain.then = (resolvePromise) =>
    resolvePromise({
      data: rows,
      error: null,
    })

  chain.rpc = async (
    name,
    args,
  ) => {
    calls.push([
      'rpc',
      name,
      args,
    ])

    if (
      name === 'create_result'
    ) {
      return {
        data: [
          {
            result_id: resultId,
          },
        ],
        error: null,
      }
    }

    if (
      name ===
      'add_result_contribution'
    ) {
      return {
        data: contributionId,
        error: null,
      }
    }

    return {
      data: true,
      error: null,
    }
  }

  const results = load(
    'lib/results/results.ts',
    {
      '../supabase/admin': {
        createAdminClient:
          () => chain,
      },
    },
  )

  rows = []

  await results.listResultsForSource(
    'project',
    projectId,
  )

  assert.ok(
    calls.some(
      ([method, column, value]) =>
        method === 'eq' &&
        column ===
          'source_type' &&
        value === 'project',
    ),
  )

  assert.ok(
    calls.some(
      ([method, column, value]) =>
        method === 'eq' &&
        column ===
          'source_id' &&
        value === projectId,
    ),
  )

  calls.length = 0

  await results.createResult(
    access,
    {
      sourceType:
        'articulation',
      sourceId:
        articulationId,
      resultType:
        'productive',
      title:
        'Primer resultado',
      description:
        'Resultado documentado.',
      resultDate:
        '2026-09-28',
      evidenceReference:
        null,
    },
  )

  const articulationCreate =
    calls.find(
      ([method, name]) =>
        method === 'rpc' &&
        name === 'create_result',
    )

  assert.ok(
    articulationCreate,
  )

  assert.equal(
    articulationCreate[2]
      .p_articulation_id,
    articulationId,
  )

  assert.equal(
    articulationCreate[2]
      .p_project_id,
    null,
  )

  calls.length = 0

  await results.createResult(
    access,
    {
      sourceType: 'project',
      sourceId: projectId,
      resultType: 'learning',
      title:
        'Aprendizaje',
      description:
        'Aprendizaje documentado.',
      resultDate:
        '2026-09-28',
      evidenceReference:
        'Acta de reunión',
    },
  )

  const projectCreate =
    calls.find(
      ([method, name]) =>
        method === 'rpc' &&
        name === 'create_result',
    )

  assert.ok(projectCreate)

  assert.equal(
    projectCreate[2]
      .p_articulation_id,
    null,
  )

  assert.equal(
    projectCreate[2]
      .p_project_id,
    projectId,
  )

  calls.length = 0

  await results.addResultContribution(
    access,
    {
      resultId,
      personId,
      organizationId: null,
      contributionSummary:
        'Aportó conocimiento técnico.',
      evidenceReference:
        null,
    },
  )

  const contribution =
    calls.find(
      ([method, name]) =>
        method === 'rpc' &&
        name ===
          'add_result_contribution',
    )

  assert.ok(contribution)

  assert.equal(
    contribution[2].p_person_id,
    personId,
  )

  assert.equal(
    contribution[2]
      .p_organization_id,
    null,
  )
})

test('result actions validate canonical actors and source ownership', async () => {
  const calls = []
  let currentResult = {
    result_id: resultId,
    source_type:
      'articulation',
    source_id:
      articulationId,
  }

  const resultFunctions = {
    RESULT_TYPES: [
      'productive',
      'economic',
      'territorial',
      'organizational',
      'strategic',
      'institutional',
      'communication',
      'learning',
      'other',
    ],

    createResult:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'createResult',
          input,
        ])

        return resultId
      },

    getResult:
      async () =>
        currentResult,

    getResultContribution:
      async () => ({
        contribution_id:
          contributionId,
        result_id:
          resultId,
      }),

    updateResult:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'updateResult',
          input,
        ])
      },

    voidResult:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'voidResult',
          input,
        ])
      },

    addResultContribution:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'addResultContribution',
          input,
        ])

        return contributionId
      },

    updateResultContribution:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'updateResultContribution',
          input,
        ])
      },

    removeResultContribution:
      async (
        receivedAccess,
        input,
      ) => {
        assert.equal(
          receivedAccess,
          access,
        )

        calls.push([
          'removeResultContribution',
          input,
        ])
      },
  }

  const invalidated = []

  const actions = load(
    'app/panel/resultados/actions.ts',
    {
      'next/cache': {
        revalidatePath:
          (...args) =>
            invalidated.push(
              args,
            ),
      },

      'next/navigation': {
        redirect: (path) => {
          throw new Error(
            `redirect:${path}`,
          )
        },
      },

      '../../../lib/auth/internal-access': {
        getInternalAccess:
          async () => access,
      },

      '../../../lib/results/results':
        resultFunctions,

      '../../../lib/supabase/server': {
        createClient:
          async () => ({
            auth: {
              getClaims:
                async () => ({
                  data: {
                    claims: {
                      sub:
                        actorId,
                    },
                  },
                }),
            },
          }),
      },
    },
  )

  const idle = {
    status: 'idle',
    message: null,
  }

  const created =
    await actions.createResultAction(
      'articulation',
      articulationId,
      idle,
      form({
        result_type:
          'productive',
        title:
          'Resultado productivo',
        description:
          'Se documentó una mejora.',
        result_date:
          '2026-09-28',
        evidence_reference:
          '',
      }),
    )

  assert.equal(
    created.status,
    'success',
  )

  assert.equal(
    calls[0][0],
    'createResult',
  )

  assert.equal(
    calls[0][1].sourceType,
    'articulation',
  )

  const added =
    await actions.addResultContributionAction(
      'articulation',
      articulationId,
      resultId,
      idle,
      form({
        actor:
          `person:${personId}`,
        contribution_summary:
          'Aportó el diseño.',
        evidence_reference:
          '',
      }),
    )

  assert.equal(
    added.status,
    'success',
  )

  const addCall =
    calls.find(
      ([name]) =>
        name ===
          'addResultContribution',
    )

  assert.ok(addCall)

  assert.equal(
    addCall[1].personId,
    personId,
  )

  assert.equal(
    addCall[1].organizationId,
    null,
  )

  const beforeInvalidActor =
    calls.length

  const invalidActor =
    await actions.addResultContributionAction(
      'articulation',
      articulationId,
      resultId,
      idle,
      form({
        actor:
          `candidate:${personId}`,
        contribution_summary:
          'No debería entrar.',
        evidence_reference:
          '',
      }),
    )

  assert.equal(
    invalidActor.status,
    'error',
  )

  assert.equal(
    calls.length,
    beforeInvalidActor,
  )

  currentResult = {
    result_id: resultId,
    source_type: 'project',
    source_id: projectId,
  }

  const beforeForeign =
    calls.length

  const previousError =
    console.error

  console.error = () => {}

  try {
    const foreign =
      await actions.updateResultAction(
        'articulation',
        articulationId,
        resultId,
        idle,
        form({
          result_type:
            'productive',
          title:
            'Intento inválido',
          description:
            'No debe cambiar el origen.',
          result_date:
            '2026-09-28',
          evidence_reference:
            '',
          rationale:
            'Prueba de protección.',
        }),
      )

    assert.equal(
      foreign.status,
      'error',
    )
  } finally {
    console.error =
      previousError
  }

  assert.equal(
    calls.length,
    beforeForeign,
  )

  assert.ok(
    invalidated.some(
      ([path]) =>
        path ===
        `/panel/articulaciones/${articulationId}`,
    ),
  )
})

test('ResultSection renders active, historical and voided traceability', () => {
  const idle = {
    status: 'idle',
    message: null,
  }

  const noOp =
    async () => idle

  const {
    ResultSection,
  } = load(
    'app/panel/resultados/result-section.tsx',
    {
      react: {
        useActionState:
          (action, state) => [
            state,
            action,
            false,
          ],
      },

      './actions': {
        createResultAction:
          noOp,
        updateResultAction:
          noOp,
        voidResultAction:
          noOp,
        addResultContributionAction:
          noOp,
        updateResultContributionAction:
          noOp,
        removeResultContributionAction:
          noOp,
      },

      './result-actor-picker': {
        ResultActorPicker:
          () =>
            React.createElement(
              'span',
              null,
              'Selector histórico y canónico',
            ),
      },
    },
  )

  const activeResult = {
    result_id: resultId,
    articulation_id:
      articulationId,
    project_id: null,
    source_type:
      'articulation',
    source_id:
      articulationId,
    source_title:
      'Articulación',
    result_type:
      'productive',
    title:
      'Resultado productivo',
    description:
      'Descripción comprobable.',
    result_date:
      '2026-09-28',
    evidence_reference:
      'Acta 1',
    created_by_internal_user_id:
      actorId,
    created_by_display_name:
      'Usuario',
    created_at:
      '2026-09-28T12:00:00Z',
    updated_at:
      '2026-09-28T12:00:00Z',
    voided_at: null,
    voided_by_internal_user_id:
      null,
    voided_by_display_name:
      null,
    void_rationale:
      null,
    active_contribution_count:
      1,
  }

  const activeContribution = {
    contribution_id:
      contributionId,
    result_id:
      resultId,
    person_id:
      personId,
    organization_id:
      null,
    actor_type:
      'person',
    actor_id:
      personId,
    display_name:
      'Persona Uno',
    contribution_summary:
      'Aporte verificable.',
    evidence_reference:
      null,
    added_by_internal_user_id:
      actorId,
    added_by_display_name:
      'Usuario',
    added_at:
      '2026-09-28T12:00:00Z',
    updated_at:
      '2026-09-28T12:00:00Z',
    removed_at:
      null,
    removed_by_internal_user_id:
      null,
    removed_by_display_name:
      null,
    removal_rationale:
      null,
  }

  const removedContribution = {
    ...activeContribution,
    contribution_id:
      '00000000-0000-4000-8000-000000000008',
    organization_id:
      organizationId,
    person_id: null,
    actor_type:
      'organization',
    actor_id:
      organizationId,
    display_name:
      'Organización Uno',
    removed_at:
      '2026-09-28T15:00:00Z',
    removed_by_internal_user_id:
      actorId,
    removed_by_display_name:
      'Usuario',
    removal_rationale:
      'Corrección histórica.',
  }

  const html =
    renderToStaticMarkup(
      React.createElement(
        ResultSection,
        {
          sourceType:
            'articulation',
          sourceId:
            articulationId,
          results: [
            activeResult,
          ],
          contributions: [
            activeContribution,
            removedContribution,
          ],
          candidates: [],
          canManage: true,
        },
      ),
    )

  assert.match(
    html,
    />Resultados</,
  )

  assert.match(
    html,
    /Resultado productivo/,
  )

  assert.match(
    html,
    /Contribuciones/,
  )

  assert.match(
    html,
    /Aporte verificable/,
  )

  assert.match(
    html,
    /Ver contribuciones/,
  )

  assert.match(
    html,
    /Corrección histórica/,
  )

  assert.match(
    html,
    /Registrar resultado/,
  )

  assert.match(
    html,
    /Corregir resultado/,
  )

  assert.match(
    html,
    /Anular resultado/,
  )

  assert.match(
    html,
    /Registrar contribución/,
  )

  assert.match(
    html,
    /Selector histórico y canónico/,
  )

  const voidedHtml =
    renderToStaticMarkup(
      React.createElement(
        ResultSection,
        {
          sourceType:
            'project',
          sourceId:
            projectId,
          results: [
            {
              ...activeResult,
              result_id:
                '00000000-0000-4000-8000-000000000009',
              articulation_id:
                null,
              project_id:
                projectId,
              source_type:
                'project',
              source_id:
                projectId,
              voided_at:
                '2026-09-28T16:00:00Z',
              voided_by_internal_user_id:
                actorId,
              voided_by_display_name:
                'Usuario',
              void_rationale:
                'Registro duplicado.',
            },
          ],
          contributions: [],
          candidates: [],
          canManage: true,
        },
      ),
    )

  assert.match(
    voidedHtml,
    /Ver resultados anulados/,
  )

  assert.match(
    voidedHtml,
    /Anulado/,
  )

  assert.match(
    voidedHtml,
    /Registro duplicado/,
  )

  assert.match(
    voidedHtml,
    /Todavía no hay resultados[^<]*estructurados activos/,
  )

  assert.doesNotMatch(
    voidedHtml,
    /Corregir resultado/,
  )

  assert.doesNotMatch(
    voidedHtml,
    /Registrar contribución/,
  )
})

test('both source detail pages mount ResultSection with their own identity', () => {
  const articulationPage =
    readFileSync(
      resolve(
        root,
        'app/panel/articulaciones/[id]/page.tsx',
      ),
      'utf8',
    )

  const projectPage =
    readFileSync(
      resolve(
        root,
        'app/panel/proyectos/[id]/page.tsx',
      ),
      'utf8',
    )

  assert.match(
    articulationPage,
    /listResultsForSource\('articulation', id\)/,
  )

  assert.match(
    articulationPage,
    /sourceType="articulation"/,
  )

  assert.match(
    projectPage,
    /listResultsForSource\('project', id\)/,
  )

  assert.match(
    projectPage,
    /sourceType="project"/,
  )

  assert.match(
    projectPage,
    /canManageResultSource\([\s\S]*'project',[\s\S]*id/,
  )
})


test('Result contributor picker uses the dedicated archived-capable canonical search', () => {
  const picker = readFileSync(
    resolve(
      root,
      'app/panel/resultados/result-actor-picker.tsx',
    ),
    'utf8',
  )

  const route = readFileSync(
    resolve(
      root,
      'app/api/panel/resultados/actores/route.ts',
    ),
    'utf8',
  )

  const referenceHelper = readFileSync(
    resolve(
      root,
      'lib/results/contributor-references.ts',
    ),
    'utf8',
  )

  assert.match(
    picker,
    /\/api\/panel\/resultados\/actores/,
  )

  assert.doesNotMatch(
    picker,
    /\/api\/panel\/oportunidades\/actores/,
  )

  assert.match(
    picker,
    /actor\.record_status ===[\s\S]*'archived'/,
  )

  assert.match(
    route,
    /listResultContributorReferencePage/,
  )

  assert.match(
    referenceHelper,
    /result_contributor_reference_page/,
  )

  assert.doesNotMatch(
    referenceHelper,
    /canonical_actor_reference_page/,
  )
})

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const supabaseCli = resolve(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js')
const opportunityIdIndex = process.argv.indexOf('--opportunity-id')
const opportunityId = opportunityIdIndex >= 0
  ? process.argv[opportunityIdIndex + 1]
  : undefined

function parseEnvironment(output) {
  const values = new Map()

  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) continue

    let [, name, value] = match
    value = value.trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    values.set(name, value)
  }

  return values
}

function firstPresent(values, names) {
  for (const name of names) {
    const value = values.get(name)
    if (value) return value
  }
  return undefined
}

if (!opportunityId || !/^[0-9a-f-]{36}$/i.test(opportunityId)) {
  console.error('Usá --opportunity-id con el UUID de la oportunidad a medir.')
  process.exit(1)
}

if (!existsSync(supabaseCli)) {
  console.error('No se encontró el CLI local de Supabase. Ejecutá npm install antes de continuar.')
  process.exit(1)
}

const status = spawnSync(process.execPath, [supabaseCli, 'status', '-o', 'env'], {
  cwd: projectRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
})

if (status.error || status.status !== 0) {
  console.error('El stack local de Supabase no está disponible. Ejecutá supabase start antes de continuar.')
  process.exit(1)
}

const environment = parseEnvironment(status.stdout)
const apiUrl = environment.get('API_URL')
const secretKey = firstPresent(environment, ['SECRET_KEY', 'SERVICE_ROLE_KEY'])
const databaseUrl = environment.get('DB_URL')

if (!apiUrl || !secretKey || !databaseUrl) {
  console.error('Supabase local no devolvió las credenciales requeridas.')
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1, prepare: false })
const supabase = createClient(apiUrl, secretKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  db: {
    schema: 'mp25m_api',
  },
})

try {
  const [actor] = await sql`
    select id
    from mp25m.internal_users
    where display_name = 'Pruebas E2E local'
      and status = 'active'
      and deleted_at is null
    limit 1
  `

  if (!actor) {
    throw new Error('No se encontró la cuenta local de pruebas. Ejecutá npm run test:e2e:setup.')
  }

  const startedAt = performance.now()
  const { data, error } = await supabase.rpc('create_opportunity_requirement', {
    p_actor_internal_user_id: actor.id,
    p_opportunity_id: opportunityId,
    p_name: `Diagnóstico RPC E2E ${Date.now()}`,
    p_description: 'Registro técnico local para medir la llamada RPC.',
    p_requirement_type: 'other',
    p_is_mandatory: false,
    p_weight: 1,
    p_satisfaction_criteria: 'La API devuelve una revisión declarada.',
    p_skill_id: null,
    p_activity_id: null,
    p_conditions: {},
    p_provenance_kind: 'human_entry',
    p_source_id: null,
    p_ingestion_record_id: null,
    p_source_locator: null,
    p_source_excerpt: null,
  })
  const elapsed = Math.round(performance.now() - startedAt)

  if (error) {
    throw new Error(`La API local devolvió un error en ${elapsed} ms: ${error.message}`)
  }

  console.log(`RPC create_opportunity_requirement: ${elapsed} ms`)
  console.log(`Resultado: ${JSON.stringify(data)}`)
} finally {
  await sql.end({ timeout: 3 })
}

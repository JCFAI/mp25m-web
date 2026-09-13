import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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

const databaseUrl = parseEnvironment(status.stdout).get('DB_URL')
if (!databaseUrl) {
  console.error('Supabase local no devolvió la conexión de base requerida.')
  process.exit(1)
}

const sql = postgres(databaseUrl, { max: 1, prepare: false })
const checks = [
  ['requerimientos', 'mp25m_api.opportunity_requirement_list'],
  ['revisiones', 'mp25m_api.opportunity_requirement_revision_list'],
  ['coincidencias', 'mp25m_api.opportunity_requirement_match_list'],
  ['evaluaciones de coincidencia', 'mp25m_api.opportunity_requirement_match_assessment_list'],
  ['evaluaciones de cobertura', 'mp25m_api.opportunity_requirement_coverage_evaluation_list'],
]

try {
  for (const [name, relation] of checks) {
    const startedAt = performance.now()
    const [result] = await sql.unsafe(
      `select count(*)::integer as count from ${relation} where opportunity_id = $1`,
      [opportunityId],
    )
    const elapsed = Math.round(performance.now() - startedAt)
    console.log(`${name}: ${result.count} registros en ${elapsed} ms`)
  }
} finally {
  await sql.end({ timeout: 3 })
}

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const LOCAL_API_URL = 'http://127.0.0.1:54321'
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const supabaseCli = resolve(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js')
const nextCli = resolve(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next')

function parseEnvOutput(output) {
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

export function assertLocalApiUrl(apiUrl) {
  if (apiUrl !== LOCAL_API_URL) {
    throw new Error(
      `El endpoint local de Supabase debe ser exactamente ${LOCAL_API_URL}. Next.js no se inició.`
    )
  }
}

function readLocalSupabaseEnvironment() {
  if (!existsSync(supabaseCli)) {
    throw new Error('No se encontró el CLI local de Supabase. Ejecutá npm install antes de continuar.')
  }

  const result = spawnSync(process.execPath, [supabaseCli, 'status', '-o', 'env'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.error || result.status !== 0) {
    throw new Error('El stack local de Supabase no está disponible. Ejecutá supabase start antes de continuar.')
  }

  const values = parseEnvOutput(result.stdout)
  const apiUrl = values.get('API_URL')
  const publishableKey = firstPresent(values, ['PUBLISHABLE_KEY', 'ANON_KEY'])
  const secretKey = firstPresent(values, ['SECRET_KEY', 'SERVICE_ROLE_KEY'])

  assertLocalApiUrl(apiUrl)

  if (!publishableKey || !secretKey) {
    throw new Error('El stack local de Supabase no devolvió las credenciales requeridas. Next.js no se inició.')
  }

  return { apiUrl, publishableKey, secretKey }
}

function runNext(command) {
  if (!existsSync(nextCli)) {
    throw new Error('No se encontró Next.js local. Ejecutá npm install antes de continuar.')
  }

  const { apiUrl, publishableKey, secretKey } = readLocalSupabaseEnvironment()
  console.log(`Supabase local detectado en ${apiUrl}`)
  console.log('Iniciando Next.js con configuración local...')

  const child = spawn(process.execPath, [nextCli, command], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: apiUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_SECRET_KEY: secretKey,
    },
    stdio: 'inherit',
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal))
  }

  child.on('error', () => {
    console.error('No se pudo iniciar Next.js.')
    process.exitCode = 1
  })
  child.on('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0)
  })
}

function main() {
  const [command] = process.argv.slice(2)
  if (!['dev', 'build'].includes(command) || process.argv.length !== 3) {
    console.error('Uso: node scripts/run-local-next.mjs <dev|build>')
    process.exitCode = 1
    return
  }

  try {
    runNext(command)
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo iniciar Next.js local.')
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}

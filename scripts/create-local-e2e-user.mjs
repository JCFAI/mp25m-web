import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const supabaseCli = resolve(projectRoot, 'node_modules', 'supabase', 'dist', 'supabase.js')
const localApiUrl = 'http://127.0.0.1:54321'
const email = process.env.MP25M_E2E_EMAIL ?? 'e2e-admin@mp25m.local'
const password = process.env.MP25M_E2E_PASSWORD

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

function localEnvironment() {
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

  const values = parseEnvironment(result.stdout)
  const apiUrl = values.get('API_URL')
  const secretKey = firstPresent(values, ['SECRET_KEY', 'SERVICE_ROLE_KEY'])
  const databaseUrl = values.get('DB_URL')

  if (apiUrl !== localApiUrl || !secretKey || !databaseUrl) {
    throw new Error('Supabase local no devolvió las credenciales requeridas.')
  }

  return { apiUrl, secretKey, databaseUrl }
}

if (!password || password.length < 12) {
  console.error('Definí MP25M_E2E_PASSWORD con al menos 12 caracteres antes de crear la cuenta local.')
  process.exit(1)
}

const { apiUrl, secretKey, databaseUrl } = localEnvironment()
const supabase = createClient(apiUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const sql = postgres(databaseUrl, { max: 1, prepare: false })

try {
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })

  if (userListError) throw userListError

  const existingUser = userList.users.find((user) => user.email === email)
  const { data: authData, error: authError } = existingUser
    ? await supabase.auth.admin.updateUserById(existingUser.id, {
        email_confirm: true,
        password,
      })
    : await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password,
      })

  if (authError || !authData.user) throw authError ?? new Error('No se pudo crear la cuenta local.')

  const [internalUser] = await sql`
    insert into mp25m.internal_users (
      auth_user_id,
      status,
      display_name,
      notes
    )
    values (
      ${authData.user.id}::uuid,
      'active',
      'Pruebas E2E local',
      'Cuenta exclusiva para pruebas automatizadas locales.'
    )
    on conflict (auth_user_id) do update
    set
      status = 'active',
      display_name = excluded.display_name,
      notes = excluded.notes,
      deleted_at = null,
      updated_at = now()
    returning id
  `

  const [globalScope] = await sql`
    select id
    from mp25m.access_scopes
    where scope_type = 'global'
      and is_active = true
      and deleted_at is null
    order by created_at
    limit 1
  `

  if (!globalScope) throw new Error('No se encontró el alcance global local.')

  await sql`
    insert into mp25m.access_role_assignments (
      internal_user_id,
      access_role_code,
      access_scope_id,
      status,
      reason
    )
    select
      ${internalUser.id}::uuid,
      'administrator',
      ${globalScope.id}::uuid,
      'active',
      'Pruebas automatizadas locales'
    where not exists (
      select 1
      from mp25m.access_role_assignments
      where internal_user_id = ${internalUser.id}::uuid
        and access_role_code = 'administrator'
        and access_scope_id = ${globalScope.id}::uuid
        and status = 'active'
        and revoked_at is null
        and valid_from <= now()
        and (valid_until is null or valid_until > now())
    )
  `

  console.log(`Cuenta local de pruebas lista: ${email}`)
  console.log('Tiene alcance administrador global y sólo existe en Supabase local.')
} finally {
  await sql.end({ timeout: 3 })
}

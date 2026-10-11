// Exclusivo para Supabase local. Imprime sólo el ID de la Articulación.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'node_modules/supabase/dist/supabase.js')
const adminEmail = 'e2e-admin@mp25m.local'
const participantEmail = 'e2e-participant-s@mp25m.local'
const password = process.env.MP25M_E2E_PASSWORD
if (!password || password.length < 12) throw Error('Falta MP25M_E2E_PASSWORD local.')
if (!existsSync(cli)) throw Error('Falta Supabase CLI local.')

const result = spawnSync(process.execPath, [cli, 'status', '-o', 'env'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
})
if (result.status !== 0 || result.error) throw Error('Supabase local no disponible.')
const env = new Map()
for (const line of result.stdout.split(/\r?\n/)) {
  const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
  if (match) env.set(match[1], match[2].trim().replace(/^["']|["']$/g, ''))
}
const apiUrl = env.get('API_URL')
const databaseUrl = env.get('DB_URL')
const key = env.get('SECRET_KEY') ?? env.get('SERVICE_ROLE_KEY')
if (apiUrl !== 'http://127.0.0.1:54321' || !databaseUrl || !key) {
  throw Error('DETENIDO: Supabase API no es el endpoint local autorizado.')
}
const url = new URL(databaseUrl)
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.port !== '54322' || url.pathname !== '/postgres') {
  throw Error('DETENIDO: PostgreSQL no es 127.0.0.1:54322/postgres.')
}
const db = postgres(databaseUrl, { max: 1, prepare: false })
const query = (statement, params = []) => db.unsafe(statement, params)
const auth = createClient(apiUrl, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

try {
  const [admin] = await query(
    "select u.id from mp25m.internal_users u " +
    "join auth.users au on au.id=u.auth_user_id " +
    "join mp25m.access_role_assignments a on a.internal_user_id=u.id " +
    "join mp25m.access_scopes s on s.id=a.access_scope_id " +
    "where au.email=$1 and a.access_role_code='administrator' " +
    "and a.status='active' and a.revoked_at is null " +
    "and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now()) " +
    "and s.scope_type='global' and u.status='active' and u.deleted_at is null " +
    "limit 1", [adminEmail],
  )
  if (!admin) throw Error('Falta el administrador local; ejecutá test:e2e:setup.')
  const [scope] = await query(
    "select id from mp25m.access_scopes where scope_type='global' " +
    "and is_active=true and deleted_at is null limit 1",
  )
  if (!scope) throw Error('No existe alcance global local.')

  const { data: users, error: listError } = await auth.auth.admin.listUsers({
    page: 1, perPage: 1000,
  })
  if (listError) throw listError
  const existing = users.users.find(u => u.email === participantEmail)
  const reply = existing
    ? await auth.auth.admin.updateUserById(existing.id, {
        password, email_confirm: true,
      })
    : await auth.auth.admin.createUser({
        email: participantEmail, password, email_confirm: true,
      })
  if (reply.error || !reply.data.user) throw reply.error ?? Error('Cuenta local no creada.')

  const [participant] = await query(
    "insert into mp25m.internal_users (auth_user_id,status,display_name,notes) " +
    "values ($1::uuid,'active','E2E Participante S (sólo local)'," +
    "'Cuenta sintética para auditoría funcional S exclusivamente local.') " +
    "on conflict (auth_user_id) do update set status='active',deleted_at=null," +
    "display_name=excluded.display_name,notes=excluded.notes returning id",
    [reply.data.user.id],
  )
  const extras = await query(
    "select access_role_code from mp25m.access_role_assignments " +
    "where internal_user_id=$1::uuid and status='active' and revoked_at is null " +
    "and valid_from<=now() and (valid_until is null or valid_until>now()) " +
    "and access_role_code<>'participant'", [participant.id],
  )
  if (extras.length) throw Error('DETENIDO: la cuenta participante tiene otros roles activos.')
  await query(
    "insert into mp25m.access_role_assignments " +
    "(internal_user_id,access_role_code,access_scope_id,status,reason) " +
    "select $1::uuid,'participant',$2::uuid,'active','Prueba MP25M_S local' " +
    "where not exists (select 1 from mp25m.access_role_assignments " +
    "where internal_user_id=$1::uuid and access_role_code='participant' " +
    "and access_scope_id=$2::uuid and status='active')",
    [participant.id, scope.id],
  )

  // Reuse a previous synthetic Articulation when retrying a failed E2E run.
  // This prevents creating duplicate fixtures after a local schema repair.
  const reusableId = process.env.MP25M_E2E_ARTICULATION_ID
  if (reusableId) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reusableId)) {
      throw Error('Identificador de Articulación de prueba inválido.')
    }
    const [fixture] = await query(
      "select a.id, a.title, " +
      "(select count(*)::int from mp25m.opportunity_articulation_status_history h " +
      " where h.articulation_id=a.id) as history, " +
      "(select count(*)::int from mp25m.opportunity_articulation_participants p " +
      " where p.articulation_id=a.id) as people, " +
      "(select count(*)::int from mp25m.opportunity_articulation_followups f " +
      " where f.articulation_id=a.id) as followups " +
      "from mp25m.opportunity_articulations a where a.id=$1::uuid",
      [reusableId],
    )
    if (!fixture?.title?.startsWith('E2E LOCAL S - Materiales ') ||
        fixture.history < 3 || fixture.people < 1 || fixture.followups < 2) {
      throw Error('No se reutiliza la Articulación: no es una fixture local S válida.')
    }
    console.error('PASS: reutilizada Articulación sintética local y cuenta participante actualizada.')
    process.stdout.write(fixture.id + '\n')
  } else {
  const code = Math.random().toString(36).slice(2, 10)
  const title = 'E2E LOCAL S - Materiales ' + code
  const [person] = await query(
    "select mp25m_api.create_person($1::uuid,$2::text) as id",
    [admin.id, 'E2E LOCAL S Persona ' + code],
  )
  const [art] = await query(
    "select articulation_id from mp25m_api.create_articulation(" +
    "$1::uuid,$2::text,$3::text,$1::uuid)",
    [admin.id, title,
     'Coordinación ficticia de materiales para capacitación, exclusivamente local.'],
  )
  const id = art?.articulation_id
  if (!id) throw Error('No se creó la Articulación local.')
  await query(
    "select * from mp25m_api.transition_opportunity_articulation(" +
    "$1::uuid,$2::uuid,'active','Se inicia la actividad ficticia',$1::uuid,null::text)",
    [admin.id, id],
  )
  await query(
    "select mp25m_api.add_opportunity_articulation_participant(" +
    "$1::uuid,$2::uuid,$3::uuid,null::uuid," +
    "'Participa en la entrega ficticia de materiales')",
    [admin.id, id, person.id],
  )
  await query(
    "select mp25m_api.create_opportunity_articulation_followup(" +
    "$1::uuid,$2::uuid,'meeting','Reunión ficticia: planificación de la entrega')",
    [admin.id, id],
  )
  await query(
    "select * from mp25m_api.transition_opportunity_articulation(" +
    "$1::uuid,$2::uuid,'follow_up'," +
    "'Continúa el seguimiento de la entrega ficticia',$1::uuid,null::text)",
    [admin.id, id],
  )
  await query(
    "select mp25m_api.create_opportunity_articulation_followup(" +
    "$1::uuid,$2::uuid,'commitment'," +
    "'Compromiso ficticio: confirmar disponibilidad de materiales')",
    [admin.id, id],
  )

  const [counts] = await query(
    "select " +
    "(select count(*)::int from mp25m.opportunity_articulation_status_history " +
    " where articulation_id=$1::uuid) as history," +
    "(select count(*)::int from mp25m.opportunity_articulation_participants " +
    " where articulation_id=$1::uuid) as people," +
    "(select count(*)::int from mp25m.opportunity_articulation_followups " +
    " where articulation_id=$1::uuid) as followups",
    [id],
  )
  if (counts.history < 3 || counts.people < 1 || counts.followups < 2) {
    throw Error('Fixture sintética incompleta.')
  }

  console.error('PASS: Participante básico con rol participant exclusivamente local.')
  console.error('PASS: Articulación local con responsable, tres estados, participante y dos novedades.')
  process.stdout.write(id + '\n')
  }
} finally {
  await db.end({ timeout: 3 })
}

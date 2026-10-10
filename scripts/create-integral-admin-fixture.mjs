import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, writeFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const repo = process.cwd()
const home = process.env.HOME
const workdir = home + '/mp25m-integral-validation'
const container = 'supabase_db_mp25m-integral-validation'
const credentials = workdir + '/admin-fixture-credentials.txt'
const expectedUrl = 'http://127.0.0.1:55421'
const cli = repo + '/node_modules/supabase/dist/supabase.js'

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { encoding: 'utf8', ...opts })
  if (result.status !== 0) throw Error(cmd + ' failed: ' + (result.stderr || '').slice(0,300))
  return result.stdout
}
if (existsSync(credentials)) throw Error('DETENIDO: credenciales de prueba ya existen; no se duplican usuarios.')
const names = run('docker',['ps','--format','{{.Names}}']).split('\n')
if (!names.includes(container)) throw Error('DETENIDO: Supabase temporal no disponible.')
const output = run(process.execPath,[cli,'status','--workdir',workdir,'-o','env'])
const env = new Map(output.split(/\r?\n/).map(l => {
  const m=l.match(/^(?:export )?([A-Z][A-Z0-9_]*)=(.*)$/)
  return m ? [m[1],m[2].replace(/^["']|["']$/g,'')] : ['', '']
}))
const url = env.get('API_URL')
const key = env.get('SECRET_KEY') || env.get('SERVICE_ROLE_KEY')
if (url !== expectedUrl || !key) throw Error('DETENIDO: identidad del Supabase temporal incorrecta.')
const count = run('docker',['exec',container,'psql','-X','-At','-U','postgres','-d','postgres','-c',
  '(SELECT count(*) FROM auth.users)'])
if (count.trim() !== '0') throw Error('DETENIDO: la base temporal ya tiene cuentas. Revisar antes.')
const email = 'mp25m-integral-admin@example.invalid'
const password = 'Tmp!' + randomBytes(20).toString('base64url') + '9'
const supabase = createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
const {data,error} = await supabase.auth.admin.createUser({
  email,password,email_confirm:true,user_metadata:{display_name:'Administrador de prueba'}
})
if (error || !data?.user?.id) throw Error('Falló el alta ficticia en Auth: ' + (error?.message ?? 'sin ID'))
const id = data.user.id
if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error('ID de Auth inesperado')
const sql = `BEGIN;
INSERT INTO mp25m.internal_users(auth_user_id,display_name)
VALUES ('${id}', 'Administrador de prueba');
INSERT INTO mp25m.access_role_assignments
 (internal_user_id, access_role_code, access_scope_id)
SELECT u.id,'administrator',s.id
FROM mp25m.internal_users u CROSS JOIN mp25m.access_scopes s
WHERE u.auth_user_id='${id}' AND s.scope_type='global'
 AND s.is_active AND s.deleted_at IS NULL;
DO $check$
BEGIN
 IF (SELECT count(*) FROM mp25m.access_role_assignments a
 JOIN mp25m.internal_users u ON u.id=a.internal_user_id
 WHERE u.auth_user_id='${id}' AND a.access_role_code='administrator') <> 1
 THEN RAISE EXCEPTION 'Admin fixture failed'; END IF;
END; $check$;
COMMIT;`
run('docker',['exec','-i',container,'psql','-X','-v','ON_ERROR_STOP=1',
  '-U','postgres','-d','postgres'],{input:sql})
writeFileSync(credentials,
  'Solo para pruebas locales, no compartir.\nURL: http://127.0.0.1:55430/login\nEmail: '+email+'\nContraseña: '+password+'\n',
  {mode:0o600})
chmodSync(credentials,0o600)
console.log('PASS: Administrador General ficticio creado en Supabase temporal.')
console.log('PASS: asignación global existente y audit de producción sin tocar.')
console.log('Credenciales guardadas localmente (no copiarlas a ChatGPT): '+credentials)

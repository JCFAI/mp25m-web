import { ApprovalForm } from './approval-form'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import { createClient } from '../../../../lib/supabase/server'
import { createAdminClient } from '../../../../lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function SolicitudesAccesoPage() {
  const supabase = await createClient()
  const { data: claims, error } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub
  if (error || !authUserId) redirect('/login')

  const access = await getInternalAccess(authUserId)
  if (!access.some(item =>
    item.access_role_code === 'administrator' && item.scope_type === 'global'
  )) redirect('/panel')

  // Server-only: list Auth users only after a fresh global-admin check.
  // Listing does not create internal users or grant privileges.
  const admin = createAdminClient()
  const { data: usersPage, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 50,
  })
  if (usersError) throw new Error('No se pudo consultar la lista de cuentas.')

  const users = usersPage.users
  const ids = users.map(user => user.id)
  const { data: activeAccess, error: accessError } = ids.length
    ? await admin.from('active_internal_access')
        .select('auth_user_id')
        .in('auth_user_id', ids)
    : { data: [], error: null }

  if (accessError) throw new Error('No se pudo comprobar los permisos existentes.')

  const enabledIds = new Set((activeAccess ?? []).map(item => item.auth_user_id))
  const withoutAccess = users.filter(user => !enabledIds.has(user.id))

  const approvalsEnabled = process.env.MP25M_ENABLE_ACCESS_APPROVALS === 'true'
  const { data: scopeRows, error: scopeError } = approvalsEnabled
    ? await admin.from('access_approval_scopes').select('id,scope_type,name').order('name')
    : { data: [], error: null }
  if (scopeError) throw new Error('No se pudieron consultar los ámbitos disponibles.')
  const scopes = scopeRows ?? []

  return (
    <div className="space-y-6">
      <Link href="/panel/accesos" className="text-sm font-medium text-[#2F5D8C] underline">
        Volver a Administración de accesos
      </Link>
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Cuentas sin acceso vigente</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Vista de consulta exclusiva para Administradores Generales.
          Muestra las cuentas sin permisos activos dentro de las primeras 50 cuentas
          registradas en Supabase Auth. No todas son necesariamente solicitudes nuevas:
          también pueden incluir cuentas suspendidas o sin asignaciones vigentes.
          La aprobación solo se habilita cuando el administrador activa expresamente
          el circuito de aprobación y verifica cada cuenta.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          {withoutAccess.length} cuenta(s) sin acceso vigente en esta página.
        </p>
        {withoutAccess.length ? (
          <ul className="mt-5 divide-y divide-slate-200">
            {withoutAccess.map(user => (
              <li key={user.id} className="py-4">
                <p className="font-medium text-slate-900">{user.email ?? 'Correo no disponible'}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Registro: {new Date(user.created_at).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                  {' · '}
                  {user.email_confirmed_at ? 'Correo confirmado' : 'Correo sin confirmar'}
                </p>
                {approvalsEnabled && user.email_confirmed_at ? (
                  <ApprovalForm
                    authUserId={user.id}
                    displayName={typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name : ''}
                    scopes={scopes}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-slate-600">No se encontraron cuentas sin acceso vigente en esta página.</p>
        )}
        {users.length === 50 ? (
          <p className="mt-4 text-sm text-amber-800">
            Hay un límite de 50 cuentas por consulta. Esta vista todavía no permite recorrer otras páginas.
          </p>
        ) : null}
      </section>
    </div>
  )
}

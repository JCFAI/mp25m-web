import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

const roleLabels: Record<string, string> = {
  administrator: 'Administrador General',
  local_administrator: 'Administrador Local',
  founder_access: 'Fundador',
  node_referent: 'Referente',
  participant: 'Participante',
  validator: 'Validador',
  articulator: 'Articulador',
  authority_analyst: 'Analista',
}

export default async function AccessGovernancePage() {
  const client = await createClient()
  const { data, error } = await client.auth.getClaims()
  const authUserId = data?.claims?.sub
  if (error || !authUserId) redirect('/login')

  const access = await getInternalAccess(authUserId)
  if (access.length === 0) redirect('/sin-acceso')

  const isGlobalAdmin = access.some(item =>
    item.access_role_code === 'administrator' && item.scope_type === 'global'
  )

  const canManage = access.some(
    item =>
      (item.access_role_code === 'administrator' && item.scope_type === 'global') ||
      (item.access_role_code === 'local_administrator' && item.scope_type === 'node') ||
      (item.access_role_code === 'founder_access' && item.scope_type === 'node')
  )

  return (
    <div className="space-y-7">
      <section className="rounded-3xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-7 text-white shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-100/70">
          Seguridad interna
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Administración de accesos
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-50/80">
          Consultá tus autorizaciones vigentes y los ámbitos en los que podés actuar.
          Las operaciones de alta, modificación y revocación todavía no están habilitadas.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Mis permisos vigentes</h2>
        <p className="mt-2 text-sm text-slate-600">
          Una misma persona puede tener distintos roles en diferentes nodos.
        </p>
        <ul className="mt-5 divide-y divide-slate-100">
          {access.map(item => (
            <li key={item.assignment_id} className="flex flex-wrap items-start justify-between gap-3 py-4">
              <div>
                <p className="font-semibold text-slate-900">
                  {roleLabels[item.access_role_code] ?? item.access_role_name}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {item.scope_type === 'global'
                    ? 'Ámbito global'
                    : item.scope_name ?? 'Nodo autorizado'}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Vigente
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isGlobalAdmin ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Cuentas sin acceso vigente</h2>
          <p className="mt-2 text-sm text-slate-600">
            Revisá las cuentas registradas que todavía no tienen permisos activos.
            Esta vista es solo de consulta.
          </p>
          <Link href="/panel/accesos/solicitudes" className="mt-4 inline-block font-semibold text-[#2F5D8C] underline">
            Consultar cuentas
          </Link>
        </section>
      ) : null}

      {canManage ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Gestión de autorizaciones
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Las migraciones y los permisos ya superaron las pruebas sobre un Supabase aislado.
            Falta implementar y validar el registro pendiente, la aprobación de cuentas
            y los controles de acceso desde la interfaz. Hasta entonces esta sección
            es solo de consulta.
          </p>
        </section>
      ) : null}
    </div>
  )
}

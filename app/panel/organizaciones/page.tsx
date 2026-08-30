import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  canManageOrganizations,
  listOrganizationTypeOptions,
} from '../../../lib/organizations/manage'
import { createClient } from '../../../lib/supabase/server'
import { OrganizationSearch } from './organization-search'

export const dynamic = 'force-dynamic'

export default async function OrganizationsPage() {
  const supabase = await createClient()

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims()

  const authUserId =
    claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const canCreate =
    canManageOrganizations(access)

  const organizationTypes =
    await listOrganizationTypeOptions()

  return (
    <div className="space-y-7">
      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
              Organizaciones
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              Directorio de organizaciones
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
              Accedé al registro canónico de empresas,
              cooperativas, instituciones, sindicatos,
              universidades y otras organizaciones vinculadas
              con la red productiva y territorial del MP25M.
            </p>
          </div>

          {canCreate ? (
            <Link
              href="/panel/organizaciones/nueva"
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#1E3A5F] transition hover:bg-blue-50"
            >
              Nueva organización
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <OrganizationSearch
          organizationTypes={organizationTypes}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm leading-6 text-slate-600">
          El directorio solo muestra organizaciones
          canónicas. Menciones territoriales o referencias
          documentales no se convierten automáticamente
          en organizaciones confirmadas.
        </p>
      </section>
    </div>
  )
}

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
    <div className="space-y-5 sm:space-y-7">
      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
              Organizaciones
            </p>

            <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
              Directorio de organizaciones
            </h1>

            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
              Accedé al registro canónico de empresas,
              cooperativas, instituciones, sindicatos,
              universidades y otras organizaciones vinculadas
              con la red productiva y territorial del MP25M.
            </p>
          </div>

          {canCreate ? (
            <Link
              href="/panel/organizaciones/nueva"
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-xl bg-[#1E3A5F] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14263D] sm:w-auto md:bg-white md:text-[#1E3A5F] md:hover:bg-blue-50"
            >
              Nueva organización
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <OrganizationSearch
          organizationTypes={organizationTypes}
        />
      </section>

      <section className="border-l-4 border-[#2F5D8C]/25 bg-transparent pl-4">
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

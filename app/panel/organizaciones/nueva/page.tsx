import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../../lib/auth/internal-access'
import {
  canManageOrganizations,
  listOrganizationTypeOptions,
} from '../../../../lib/organizations/manage'
import { createClient } from '../../../../lib/supabase/server'
import { NewOrganizationForm } from './new-organization-form'

export const dynamic = 'force-dynamic'

export default async function NewOrganizationPage() {
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
      <Link
        href="/panel/organizaciones"
        className="inline-flex min-h-11 items-center text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Organizaciones
      </Link>

      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Nueva organización
        </p>

        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
          Alta canónica
        </h1>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          El alta crea únicamente la identidad canónica
          de la organización. La presencia territorial,
          las capacidades y las articulaciones se
          administran por separado.
        </p>
      </section>

      {!canCreate ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
          <p className="text-sm font-semibold text-amber-900">
            No tenés permisos para crear
            organizaciones canónicas.
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-800">
            Esta acción requiere rol global de
            administrador o validador.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-7">
          <div className="border-b border-slate-100 pb-4 sm:pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Identidad canónica
            </p>

            <h2 className="mt-2 break-words text-lg font-semibold text-slate-950 sm:text-2xl">
              Registrar organización
            </h2>

            <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-500">
              Antes de crearla, el sistema normaliza el
              nombre y bloquea coincidencias nominales
              fuertes para revisión manual.
            </p>
          </div>

          {organizationTypes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 sm:px-5">
              No hay tipos de organización disponibles.
              Revisá el catálogo antes de continuar.
            </div>
          ) : null}

          <NewOrganizationForm
            organizationTypes={organizationTypes}
          />
        </section>
      )}
    </div>
  )
}

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
    <div className="space-y-7">
      <Link
        href="/panel/organizaciones"
        className="inline-flex text-sm font-medium text-[#2F5D8C] transition hover:text-[#1E3A5F]"
      >
        ← Volver a Organizaciones
      </Link>

      <section className="rounded-3xl bg-gradient-to-br from-[#12648d] via-[#124f75] to-[#14263D] px-7 py-7 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
          Nueva organización
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Alta canónica
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-50">
          El alta crea únicamente la identidad canónica
          de la organización. La presencia territorial,
          las capacidades y las articulaciones se
          administran por separado.
        </p>
      </section>

      {!canCreate ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
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
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="border-b border-slate-100 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
              Identidad canónica
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Registrar organización
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Antes de crearla, el sistema normaliza el
              nombre y bloquea coincidencias nominales
              fuertes para revisión manual.
            </p>
          </div>

          {organizationTypes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
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

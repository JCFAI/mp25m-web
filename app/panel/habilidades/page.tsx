import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { listSkillCategoryOptions } from '../../../lib/skills/search'
import { createClient } from '../../../lib/supabase/server'
import { SkillSearch } from './skill-search'

export const dynamic = 'force-dynamic'

export default async function SkillsPage() {
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

  const categories =
    await listSkillCategoryOptions()

  return (
    <div className="space-y-5 sm:space-y-7">
      <section className="rounded-2xl border border-sky-100 bg-white px-4 py-5 text-slate-950 shadow-sm md:rounded-3xl md:border-0 md:bg-gradient-to-br md:from-[#12648d] md:via-[#124f75] md:to-[#14263D] md:px-7 md:py-7 md:text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C] md:text-blue-100">
          Habilidades
        </p>

        <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">
          Directorio de habilidades y capacidades
        </h1>

        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-slate-600 md:mt-3 md:text-blue-50">
          Explorá capacidades personales, oficios,
          saberes productivos y capacidades
          organizacionales relevadas en la red del MP25M.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <SkillSearch categories={categories} />
      </section>

      <section className="border-l-4 border-[#2F5D8C]/25 bg-transparent pl-4">
        <p className="text-sm leading-6 text-slate-600">
          Una capacidad puede provenir de formación,
          oficio, experiencia laboral, práctica productiva
          o saber territorial. El directorio no exige
          credenciales formales para representar el aporte
          de una persona u organización.
        </p>
      </section>
    </div>
  )
}

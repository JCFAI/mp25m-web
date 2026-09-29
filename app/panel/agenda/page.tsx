import { redirect } from 'next/navigation'

import {
  listAgendaUserOptions,
} from '../../../lib/agenda/agenda'
import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import { AgendaWorkspace } from './agenda-workspace'

export const dynamic = 'force-dynamic'

function operationalToday() {
  const parts =
    new Intl.DateTimeFormat(
      'en',
      {
        timeZone:
          'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(new Date())

  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    )

  return [
    values.year,
    values.month,
    values.day,
  ].join('-')
}

export default async function AgendaPage() {
  const supabase =
    await createClient()

  const { data } =
    await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    redirect('/login')
  }

  const access =
    await getInternalAccess(
      data.claims.sub
    )

  if (!access.length) {
    redirect('/sin-acceso')
  }

  const users =
    await listAgendaUserOptions()

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#2F5D8C] to-[#14263D] p-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
          Incremento 12A
        </p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Agenda operativa
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-100/80">
          Reúne fechas operativas existentes y actividades
          registradas manualmente sin reemplazar ni crear
          relaciones entre oportunidades, articulaciones,
          proyectos, temas o necesidades y ofertas.
        </p>
      </section>

      <AgendaWorkspace
        users={users}
        today={operationalToday()}
      />
    </div>
  )
}

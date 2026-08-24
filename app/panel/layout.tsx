import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../lib/auth/internal-access'
import { createClient } from '../../lib/supabase/server'
import { PanelNavigation } from './panel-navigation'

export const dynamic = 'force-dynamic'

type PanelLayoutProps = {
  children: ReactNode
}

export default async function PanelLayout({
  children,
}: PanelLayoutProps) {
  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const access = await getInternalAccess(authUserId)

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  const primaryAccess = access[0]

  const roleName = primaryAccess.access_role_name

  const scopeName =
    primaryAccess.scope_name ??
    (primaryAccess.scope_type === 'global'
      ? 'Global'
      : primaryAccess.scope_type)

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-screen max-w-[1600px] md:grid md:grid-cols-[270px_1fr]">
        <aside className="bg-[#1E3A5F] text-white md:min-h-screen">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-6">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-sm font-black tracking-wide text-[#1E3A5F] shadow-sm">
              25M
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-100/70">
                Movimiento Productivo
              </p>

              <p className="mt-1 text-lg font-semibold">
                Sistema MP25M
              </p>
            </div>
          </div>

          <PanelNavigation />

          <div className="border-t border-white/10 px-5 py-5 md:mt-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/50">
              Acceso actual
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                {roleName}
              </span>

              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-slate-50/80">
                {scopeName}
              </span>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="flex min-h-20 items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7 lg:px-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#2F5D8C]">
                MP25M
              </p>

              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                Panel interno
              </h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {roleName}
                </p>

                <p className="text-xs text-slate-500">
                  Ámbito {scopeName}
                </p>
              </div>

              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cerrar sesión
                </button>
              </form>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-10">
            {children}
          </div>
        </section>
      </div>
    </main>
  )
}
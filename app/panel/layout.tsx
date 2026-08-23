import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../lib/auth/internal-access'
import { createClient } from '../../lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              MP25M
            </p>
            <p className="text-lg font-semibold text-slate-900">
              Panel interno
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {primaryAccess.access_role_name}
              </p>
              <p className="text-xs text-slate-500">
                {primaryAccess.scope_name ?? primaryAccess.scope_type}
              </p>
            </div>

            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      {children}
    </div>
  )
}

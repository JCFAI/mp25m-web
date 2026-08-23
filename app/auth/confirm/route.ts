import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''

  if (tokenHash && type === 'recovery') {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token_hash: tokenHash,
    })

    if (!error) {
      redirectTo.pathname = '/cambiar-clave'
      return NextResponse.redirect(redirectTo)
    }
  }

  redirectTo.pathname = '/recuperar-clave'
  redirectTo.searchParams.set('error', 'enlace')

  return NextResponse.redirect(redirectTo)
}

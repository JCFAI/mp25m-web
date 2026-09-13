import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')

  const redirectTo = request.nextUrl.clone()
  redirectTo.search = ''

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      redirectTo.pathname = '/cambiar-clave'
      return NextResponse.redirect(redirectTo)
    }
  }

  if (tokenHash && type === 'recovery') {
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

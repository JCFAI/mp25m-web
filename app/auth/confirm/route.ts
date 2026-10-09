import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '../../../lib/supabase/server'

/**
 * Recovery and registration confirmation are different flows.
 * An untyped legacy PKCE recovery callback keeps its historical behavior.
 * A sign-up callback never redirects to the password-changing screen.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const isSignUp = type === 'signup' || type === 'email'
  const isRecovery = type === 'recovery'
  const destination = request.nextUrl.clone()
  destination.search = ''

  const supabase = await createClient()

  if (tokenHash && (isRecovery || isSignUp)) {
    const { error } = await supabase.auth.verifyOtp({
      type: isRecovery ? 'recovery' : 'email',
      token_hash: tokenHash,
    })
    if (!error) {
      destination.pathname = isRecovery ? '/cambiar-clave' : '/sin-acceso'
      return NextResponse.redirect(destination)
    }
  } else if (code && (isRecovery || isSignUp || !type)) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      destination.pathname = isSignUp ? '/sin-acceso' : '/cambiar-clave'
      return NextResponse.redirect(destination)
    }
  }

  destination.pathname = isSignUp ? '/login' : '/recuperar-clave'
  destination.searchParams.set('error', 'enlace')
  return NextResponse.redirect(destination)
}

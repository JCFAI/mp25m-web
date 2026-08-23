'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

export async function requestPasswordReset(formData: FormData) {
  const emailValue = formData.get('email')

  if (
    typeof emailValue !== 'string' ||
    !emailValue.trim()
  ) {
    redirect('/recuperar-clave?error=email')
  }

  const requestHeaders = await headers()

  const origin =
    requestHeaders.get('origin') ??
    `${requestHeaders.get('x-forwarded-proto') ?? 'http'}://${requestHeaders.get('host') ?? 'localhost:3000'}`

  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(
    emailValue.trim(),
    {
      redirectTo: `${origin}/auth/confirm`,
    }
  )

  if (error) {
    redirect('/recuperar-clave?error=envio')
  }

  redirect('/recuperar-clave?estado=enviado')
}

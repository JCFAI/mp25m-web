'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function guardarMensajeInicial(formData: FormData) {
  const supabase = await createClient()

  const { data: claims, error: claimsError } = await supabase.auth.getClaims()
  const authUserId = claims?.claims?.sub

  if (claimsError || !authUserId) {
    redirect('/login')
  }

  const rawMessage = formData.get('message')
  const message = typeof rawMessage === 'string' ? rawMessage.trim() : ''

  if (message.length > 1000) {
    redirect('/sin-acceso?mensaje=error')
  }

  const { error } = await supabase.auth.updateUser({
    data: {
      access_message: message || null,
    },
  })

  if (error) {
    redirect('/sin-acceso?mensaje=error')
  }

  redirect('/sin-acceso?mensaje=ok')
}

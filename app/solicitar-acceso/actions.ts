'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../lib/supabase/server'

export async function solicitarAcceso(formData: FormData) {
  // Explicit opt-in: never open public registrations as a side effect of deploying.
  if (process.env.MP25M_ENABLE_ACCESS_REQUESTS !== 'true') {
    redirect('/login')
  }

  const email = formData.get('email')
  const password = formData.get('password')
  const name = formData.get('name')

  if (
    typeof email !== 'string' || typeof password !== 'string' ||
    typeof name !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim()) ||
    name.trim().length < 2 || name.trim().length > 120 ||
    password.length < 12 || password.length > 128
  ) {
    redirect('/solicitar-acceso?error=datos')
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { display_name: name.trim() },
    },
  })

  if (error) {
    // Do not reveal account existence or server-side provider error messages.
    redirect('/solicitar-acceso?error=registro')
  }

  // No mp25m.internal_users or access_role_assignments rows are created.
  // An administrator must separately approve and assign access.
  redirect('/solicitar-acceso/recibida')
}

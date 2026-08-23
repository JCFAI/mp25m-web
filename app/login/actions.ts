'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../lib/auth/internal-access'
import { createClient } from '../../lib/supabase/server'

export async function login(formData: FormData) {
  const emailValue = formData.get('email')
  const passwordValue = formData.get('password')

  if (
    typeof emailValue !== 'string' ||
    typeof passwordValue !== 'string' ||
    !emailValue.trim() ||
    !passwordValue
  ) {
    redirect('/login?error=campos')
  }

  const supabase = await createClient()

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: emailValue.trim(),
    password: passwordValue,
  })

  if (signInError) {
    redirect('/login?error=credenciales')
  }

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    await supabase.auth.signOut()
    redirect('/login?error=sesion')
  }

  const access = await getInternalAccess(authUserId)

  revalidatePath('/', 'layout')

  if (access.length === 0) {
    redirect('/sin-acceso')
  }

  redirect('/panel')
}

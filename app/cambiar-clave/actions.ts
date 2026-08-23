'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../lib/supabase/server'

export async function changePassword(formData: FormData) {
  const passwordValue = formData.get('password')
  const confirmationValue = formData.get('password_confirmation')

  if (
    typeof passwordValue !== 'string' ||
    typeof confirmationValue !== 'string'
  ) {
    redirect('/cambiar-clave?error=campos')
  }

  if (passwordValue.length < 12) {
    redirect('/cambiar-clave?error=longitud')
  }

  if (passwordValue !== confirmationValue) {
    redirect('/cambiar-clave?error=no-coinciden')
  }

  const supabase = await createClient()

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims()

  if (claimsError || !claimsData?.claims?.sub) {
    redirect('/recuperar-clave?error=sesion')
  }

  const { error: updateError } =
    await supabase.auth.updateUser({
      password: passwordValue,
    })

  if (updateError) {
    redirect('/cambiar-clave?error=actualizacion')
  }

  await supabase.auth.signOut()

  revalidatePath('/', 'layout')

  redirect('/login?reset=ok')
}

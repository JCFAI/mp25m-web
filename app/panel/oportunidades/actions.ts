'use server'

import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createOpportunity } from '../../../lib/opportunities/server'
import { createClient } from '../../../lib/supabase/server'

export async function createOpportunityAction(
  formData: FormData
) {
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

  const title = String(formData.get('title') ?? '')
  const description = String(
    formData.get('description') ?? ''
  )

  const kind = String(formData.get('kind') ?? '')
  const priority = String(
    formData.get('priority') ?? ''
  )

  const sourceText = String(
    formData.get('source_text') ?? ''
  )

  const dueDate = String(
    formData.get('due_date') ?? ''
  )

  const nodeIds = formData
    .getAll('node_ids')
    .map((value) => String(value))
    .filter(Boolean)

  if (
    kind !== 'opportunity' &&
    kind !== 'need'
  ) {
    redirect(
      '/panel/oportunidades?error=tipo-invalido'
    )
  }

  if (
    priority !== 'low' &&
    priority !== 'normal' &&
    priority !== 'high' &&
    priority !== 'urgent'
  ) {
    redirect(
      '/panel/oportunidades?error=prioridad-invalida'
    )
  }

  try {
    await createOpportunity(access, {
      title,
      description,
      kind,
      status: 'open',
      priority,
      sourceText,
      dueDate: dueDate || null,
      nodeIds,
    })
  } catch {
    redirect(
      '/panel/oportunidades?error=no-se-pudo-crear'
    )
  }

  redirect('/panel/oportunidades?created=1')
}
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import { createClient } from '../../../lib/supabase/server'
import { isIsoInstant } from '../../../lib/themes/date-time'
import {
  addThemeResponsibility,
  createTheme,
  createThemeFollowup,
  removeThemeResponsibility,
  transitionTheme,
  updateTheme,
  type ThemeFollowupType,
  type ThemePriority,
  type ThemeResponsibilityRole,
  type ThemeStatus,
} from '../../../lib/themes/themes'

export type ThemeActionState = { status: 'idle' | 'success' | 'error'; message: string | null }

async function currentAccess() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const access = await getInternalAccess(data.claims.sub)
  if (!access.length) redirect('/sin-acceso')
  return access
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function optionalText(formData: FormData, name: string) {
  return text(formData, name) || null
}

function optionalInstant(formData: FormData, name: string) {
  const value = optionalText(formData, name)
  if (value === null) return { valid: true, value: null }
  if (!isIsoInstant(value)) return { valid: false, value: null }
  return { valid: true, value: new Date(value).toISOString() }
}

export async function createThemeAction(_state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const input = {
    name: text(formData, 'name'), description: text(formData, 'description'), purpose: text(formData, 'purpose'),
    priority: text(formData, 'priority') as ThemePriority, startDate: text(formData, 'start_date'),
    currentSummary: optionalText(formData, 'current_summary'), territorialScopeSummary: optionalText(formData, 'territorial_scope_summary'),
    principalInternalUserId: optionalText(formData, 'principal_internal_user_id'), rationale: text(formData, 'rationale'),
  }
  if (input.name.length < 3 || input.description.length < 10 || input.purpose.length < 3 || !input.startDate || input.rationale.length < 3) {
    return { status: 'error', message: 'Completá nombre, descripción, propósito, fecha y fundamento.' }
  }
  let themeId: string
  try { themeId = await createTheme(await currentAccess(), input) }
  catch (error) { console.error('[MP25M] Theme creation failed:', error); return { status: 'error', message: 'No se pudo crear el tema. Revisá los datos y permisos.' } }
  revalidatePath('/panel/temas')
  redirect(`/panel/temas/${themeId}`)
}

export async function updateThemeAction(themeId: string, _state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const input = {
    themeId, name: text(formData, 'name'), description: text(formData, 'description'), purpose: text(formData, 'purpose'),
    priority: text(formData, 'priority') as ThemePriority, startDate: text(formData, 'start_date'),
    currentSummary: optionalText(formData, 'current_summary'), territorialScopeSummary: optionalText(formData, 'territorial_scope_summary'),
    rationale: text(formData, 'rationale'),
  }
  if (input.name.length < 3 || input.description.length < 10 || input.purpose.length < 3 || !input.startDate || input.rationale.length < 3) {
    return { status: 'error', message: 'Completá los campos obligatorios y el fundamento.' }
  }
  try { await updateTheme(await currentAccess(), input) }
  catch (error) { console.error('[MP25M] Theme update failed:', error); return { status: 'error', message: 'No se pudo actualizar el tema.' } }
  revalidatePath('/panel/temas'); revalidatePath(`/panel/temas/${themeId}`)
  return { status: 'success', message: 'El tema fue actualizado.' }
}

export async function transitionThemeAction(themeId: string, _state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const status = text(formData, 'status') as ThemeStatus
  const rationale = text(formData, 'rationale')
  const closingSummary = optionalText(formData, 'closing_summary')
  if (rationale.length < 3 || (status === 'closed' && (closingSummary?.length ?? 0) < 3)) return { status: 'error', message: 'Explicá el cambio y, si cerrás, agregá una síntesis final.' }
  try { await transitionTheme(await currentAccess(), { themeId, status, rationale, closingSummary }) }
  catch (error) { console.error('[MP25M] Theme transition failed:', error); return { status: 'error', message: 'No se pudo cambiar el estado del tema.' } }
  revalidatePath('/panel/temas'); revalidatePath(`/panel/temas/${themeId}`)
  return { status: 'success', message: 'El estado fue actualizado.' }
}

export async function addThemeResponsibilityAction(themeId: string, _state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const internalUserId = text(formData, 'internal_user_id')
  const role = text(formData, 'responsibility_role') as ThemeResponsibilityRole
  const rationale = text(formData, 'rationale')
  if (!internalUserId || rationale.length < 3) return { status: 'error', message: 'Elegí una persona y explicá la asignación.' }
  try { await addThemeResponsibility(await currentAccess(), { themeId, internalUserId, role, rationale }) }
  catch (error) { console.error('[MP25M] Theme responsibility failed:', error); return { status: 'error', message: 'No se pudo asignar la responsabilidad. Revisá si ya existe o si el principal está ocupado.' } }
  revalidatePath(`/panel/temas/${themeId}`)
  return { status: 'success', message: 'La responsabilidad fue asignada.' }
}

export async function removeThemeResponsibilityAction(themeId: string, responsibilityId: string, _state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const rationale = text(formData, 'rationale')
  if (rationale.length < 3) return { status: 'error', message: 'Indicá el motivo de finalización.' }
  try { await removeThemeResponsibility(await currentAccess(), { responsibilityId, rationale }) }
  catch (error) { console.error('[MP25M] Theme responsibility removal failed:', error); return { status: 'error', message: 'No se pudo finalizar la responsabilidad.' } }
  revalidatePath(`/panel/temas/${themeId}`)
  return { status: 'success', message: 'La responsabilidad fue finalizada.' }
}

export async function createThemeFollowupAction(themeId: string, _state: ThemeActionState, formData: FormData): Promise<ThemeActionState> {
  const occurredAt = optionalInstant(formData, 'occurred_at')
  const nextDueAt = optionalInstant(formData, 'next_due_at')
  if (!occurredAt.valid || !nextDueAt.valid) {
    return { status: 'error', message: 'Revisá las fechas y horas del seguimiento.' }
  }
  const input = {
    themeId, followupType: text(formData, 'followup_type') as ThemeFollowupType, detail: text(formData, 'detail'),
    occurredAt: occurredAt.value, responsibleInternalUserId: optionalText(formData, 'responsible_internal_user_id'),
    nextDueAt: nextDueAt.value,
  }
  if (input.detail.length < 3) return { status: 'error', message: 'Describí el seguimiento.' }
  try { await createThemeFollowup(await currentAccess(), input) }
  catch (error) { console.error('[MP25M] Theme follow-up failed:', error); return { status: 'error', message: 'No se pudo registrar el seguimiento.' } }
  revalidatePath('/panel/temas'); revalidatePath(`/panel/temas/${themeId}`)
  return { status: 'success', message: 'El seguimiento fue registrado.' }
}

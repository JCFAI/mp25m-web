'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { getInternalAccess } from '../../../lib/auth/internal-access'
import {
  addManualPerson,
  confirmRecipients,
  createCommunication,
  replaceAudience,
  resolveAudience,
  setRecipientIncluded,
  updateCommunication,
  type CommunicationType,
} from '../../../lib/communications/communications'
import { createClient } from '../../../lib/supabase/server'

export type CommunicationActionState = { status: 'idle' | 'success' | 'error'; message: string | null }
const types = new Set<CommunicationType>(['general', 'convocation', 'reminder', 'follow_up', 'request_information', 'update'])
const contextNames = new Set(['person', 'node', 'organization', 'opportunity', 'articulation', 'project', 'theme', 'need_offer', 'agenda_entry', 'independent'])

async function access() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims()
  if (!data?.claims?.sub) redirect('/login')
  const current = await getInternalAccess(data.claims.sub)
  if (!current.length) redirect('/sin-acceso')
  return current
}
function errorState(message: string): CommunicationActionState { return { status: 'error', message } }
function text(data: FormData, key: string) { return String(data.get(key) ?? '').trim() }

export async function createCommunicationAction(_previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  const type = text(formData, 'communication_type') as CommunicationType; const subject = text(formData, 'subject'); const body = text(formData, 'body')
  const contextType = text(formData, 'context_type'); const contextId = text(formData, 'context_id')
  const channels = ['email', 'whatsapp'].filter((channel) => formData.get(`channel_${channel}`) === 'on')
  if (!types.has(type) || subject.length < 3 || body.length < 3) return errorState('Completá tipo, asunto y cuerpo (al menos 3 caracteres).')
  if (!contextNames.has(contextType) || (contextType !== 'independent' && !contextId)) return errorState('Elegí un contexto válido o seleccioná “Sin contexto”.')
  let id: string
  try { id = await createCommunication(await access(), { type, channels, subject, body, context: contextType === 'independent' ? {} : { [contextType]: contextId } }) }
  catch (error) { console.error('[MP25M] Communication creation failed:', error); return errorState('No se pudo crear el borrador. Verificá el contexto y tus permisos.') }
  revalidatePath('/panel/comunicaciones')
  redirect(`/panel/comunicaciones/${id}`)
}
export async function updateCommunicationAction(id: string, _previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  const subject = text(formData, 'subject'), body = text(formData, 'body'), rationale = text(formData, 'rationale')
  const channels = ['email', 'whatsapp'].filter((channel) => formData.get(`channel_${channel}`) === 'on')
  if (subject.length < 3 || body.length < 3) return errorState('El asunto y el cuerpo deben tener al menos 3 caracteres.')
  try { await updateCommunication(await access(), id, { subject, body, channels, rationale }); revalidatePath(`/panel/comunicaciones/${id}`); revalidatePath('/panel/comunicaciones'); return { status: 'success', message: 'Borrador actualizado.' } }
  catch (error) { console.error('[MP25M] Communication update failed:', error); return errorState('No se pudo actualizar el borrador.') }
}
export async function replaceAudienceAction(id: string, _previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  const raw = text(formData, 'criteria_json'); let criteria: unknown
  try { criteria = JSON.parse(raw) } catch { return errorState('La definición de audiencia no es válida.') }
  if (!Array.isArray(criteria) || criteria.length === 0) return errorState('Agregá al menos un criterio de inclusión.')
  try { await replaceAudience(await access(), id, criteria, text(formData, 'rationale') || undefined); revalidatePath(`/panel/comunicaciones/${id}`); return { status: 'success', message: 'Audiencia guardada. Ahora podés resolverla.' } }
  catch (error) { console.error('[MP25M] Audience replace failed:', error); return errorState('No se pudo guardar la audiencia. Revisá los criterios y tus permisos.') }
}
export async function resolveAudienceAction(id: string, _previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  try { await resolveAudience(await access(), id, text(formData, 'rationale') || undefined); revalidatePath(`/panel/comunicaciones/${id}`); revalidatePath('/panel/comunicaciones'); return { status: 'success', message: 'Audiencia resuelta. Revisá los destinatarios antes de confirmar.' } }
  catch (error) { console.error('[MP25M] Audience resolve failed:', error); return errorState('No se pudo resolver la audiencia. Debe existir una definición vigente.') }
}
export async function setRecipientIncludedAction(id: string, recipientId: string, included: boolean, previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  void previous
  void formData

  try { await setRecipientIncluded(await access(), recipientId, included); revalidatePath(`/panel/comunicaciones/${id}`); return { status: 'success', message: included ? 'Destinatario reincorporado.' : 'Destinatario excluido de esta resolución.' } }
  catch (error) { console.error('[MP25M] Recipient update failed:', error); return errorState('No se pudo actualizar el destinatario.') }
}
export async function addManualPersonAction(id: string, resolutionId: string, _previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  const personId = text(formData, 'person_id'), reason = text(formData, 'reason'); if (!personId || reason.length < 3) return errorState('Elegí una Persona canónica e indicá un motivo de al menos 3 caracteres.')
  try { await addManualPerson(await access(), resolutionId, personId, reason); revalidatePath(`/panel/comunicaciones/${id}`); return { status: 'success', message: 'Persona agregada a esta resolución.' } }
  catch (error) { console.error('[MP25M] Manual recipient failed:', error); return errorState('No se pudo agregar la Persona. Puede estar ya incluida o la resolución estar cerrada.') }
}
export async function confirmRecipientsAction(id: string, resolutionId: string, _previous: CommunicationActionState, formData: FormData): Promise<CommunicationActionState> {
  try { await confirmRecipients(await access(), id, resolutionId, text(formData, 'reason') || undefined); revalidatePath(`/panel/comunicaciones/${id}`); revalidatePath('/panel/comunicaciones'); return { status: 'success', message: 'Destinatarios confirmados. No se realizó ningún envío.' } }
  catch (error) { console.error('[MP25M] Recipient confirmation failed:', error); return errorState('No se pudieron confirmar los destinatarios.') }
}

import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type OpportunityRequirementType =
  | 'skill_knowledge' | 'productive_capacity' | 'activity_service'
  | 'resource_equipment' | 'certification_authorization' | 'scale_volume'
  | 'location_territory' | 'availability_deadline' | 'language' | 'logistics'
  | 'financial' | 'administrative_legal' | 'institutional_access' | 'other'

export type OpportunityRequirementValidationStatus = 'declared' | 'pending' | 'validated' | 'rejected'
export type OpportunityRequirementRecordStatus = 'active' | 'withdrawn'
export type OpportunityRequirementProvenanceKind = 'human_entry' | 'source_explicit' | 'human_inference' | 'system_suggestion'

export const requirementTypeLabels: Record<OpportunityRequirementType, string> = {
  skill_knowledge: 'Habilidad / conocimiento',
  productive_capacity: 'Capacidad productiva',
  activity_service: 'Actividad / servicio',
  resource_equipment: 'Recurso / equipamiento',
  certification_authorization: 'Certificación / habilitación',
  scale_volume: 'Escala / volumen',
  location_territory: 'Ubicación / territorio',
  availability_deadline: 'Disponibilidad / plazo',
  language: 'Idioma',
  logistics: 'Logística',
  financial: 'Financiero',
  administrative_legal: 'Administrativo / legal',
  institutional_access: 'Acceso institucional',
  other: 'Otro',
}

export const requirementValidationLabels: Record<OpportunityRequirementValidationStatus, string> = {
  declared: 'Declarado',
  pending: 'Pendiente de validación',
  validated: 'Validado',
  rejected: 'Rechazado',
}

export type OpportunityRequirement = {
  requirement_id: string
  opportunity_id: string
  record_status: OpportunityRequirementRecordStatus
  // LEFT JOIN preserves stable identities even before their first revision.
  revision_id: string | null
  revision_no: number | null
  revision_count: number
  name: string | null
  description: string | null
  requirement_type: OpportunityRequirementType | null
  is_mandatory: boolean | null
  weight: number | null
  satisfaction_criteria: string | null
  skill_id: string | null
  skill_name: string | null
  activity_id: string | null
  activity_name: string | null
  conditions: Record<string, unknown> | null
  provenance_kind: OpportunityRequirementProvenanceKind | null
  source_id: string | null
  source_name: string | null
  source_type: string | null
  ingestion_record_id: string | null
  source_locator: string | null
  source_excerpt: string | null
  validation_status: OpportunityRequirementValidationStatus | null
  submitted_by_internal_user_id: string | null
  submitted_at: string | null
  reviewed_by_internal_user_id: string | null
  reviewed_at: string | null
  review_reason: string | null
  created_by_internal_user_id: string
  revision_created_by_internal_user_id: string | null
  created_at: string
  updated_at: string
  revision_created_at: string | null
  revision_updated_at: string | null
}

// Called only from the authenticated internal opportunity page; no browser API.
export async function listOpportunityRequirements(opportunityId: string): Promise<OpportunityRequirement[]> {
  const supabase = createAdminClient()
  const requirements: OpportunityRequirement[] = []
  const pageSize = 500

  // Explicit pagination avoids silently dropping requirements at the API row cap.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('opportunity_requirement_list')
      .select(`
        requirement_id, opportunity_id, record_status, revision_id, revision_no,
        revision_count, name, description, requirement_type, is_mandatory, weight,
        satisfaction_criteria, skill_id, skill_name, activity_id, activity_name,
        conditions, provenance_kind, source_id, source_name, source_type,
        ingestion_record_id::text, source_locator, source_excerpt, validation_status,
        submitted_by_internal_user_id, submitted_at, reviewed_by_internal_user_id,
        reviewed_at, review_reason, created_by_internal_user_id,
        revision_created_by_internal_user_id, created_at, updated_at,
        revision_created_at, revision_updated_at
      `)
      .eq('opportunity_id', opportunityId)
      .order('record_status', { ascending: true })
      .order('is_mandatory', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: true })
      .order('requirement_id', { ascending: true })
      .range(offset, offset + pageSize - 1)

    if (error) throw new Error(`Unable to load opportunity requirements: ${error.message}`)
    requirements.push(...((data ?? []) as OpportunityRequirement[]))
    if (!data || data.length < pageSize) return requirements
  }
}

import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'

export type PersonSkillDetailsInput = {
  proficiencyLevel?: number | null
  experienceRange?: string | null
  experienceNotes?: string | null
  notes?: string | null
  evidenceText?: string | null
}

export type AddPersonSkillInput =
  PersonSkillDetailsInput & {
    personId: string
    skillId: string
  }

export type UpdatePersonSkillInput =
  PersonSkillDetailsInput & {
    personId: string
    personSkillId: string
  }

export type ResolvePersonSkillAction =
  | 'confirmed'
  | 'rejected'

export type ResolvePersonSkillInput = {
  personId: string
  personSkillId: string
  resolutionAction: ResolvePersonSkillAction
  reason: string
}

export type DeactivatePersonSkillInput = {
  personId: string
  personSkillId: string
  reason: string
}

const PERSON_SKILL_GLOBAL_ROLES = new Set([
  'administrator',
  'validator',
])

const EXPERIENCE_RANGES = new Set([
  'lt_1',
  '1_3',
  '4_7',
  '8_15',
  'gt_15',
  'unspecified',
])

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getGlobalPersonSkillAccess(
  access: InternalAccess[]
) {
  return access.find(
    (item) =>
      item.scope_type === 'global' &&
      PERSON_SKILL_GLOBAL_ROLES.has(
        item.access_role_code
      )
  )
}

export function canManagePersonSkills(
  access: InternalAccess[]
) {
  return Boolean(
    getGlobalPersonSkillAccess(access)
  )
}

function getActorInternalUserId(
  access: InternalAccess[]
) {
  const personSkillAccess =
    getGlobalPersonSkillAccess(access)

  if (!personSkillAccess) {
    throw new Error(
      'The current internal user cannot manage person skills'
    )
  }

  return personSkillAccess.internal_user_id
}

function normalizeOptionalText(
  value: string | null | undefined
) {
  return value?.trim() || null
}

function validateUuid(value: string, label: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

function validateDetails(
  input: PersonSkillDetailsInput
) {
  const proficiencyLevel =
    input.proficiencyLevel ?? null

  if (
    proficiencyLevel !== null &&
    (
      !Number.isInteger(proficiencyLevel) ||
      proficiencyLevel < 1 ||
      proficiencyLevel > 5
    )
  ) {
    throw new Error(
      'Invalid person skill proficiency level'
    )
  }

  const experienceRange =
    normalizeOptionalText(
      input.experienceRange
    )

  if (
    experienceRange &&
    !EXPERIENCE_RANGES.has(experienceRange)
  ) {
    throw new Error(
      'Invalid person skill experience range'
    )
  }

  const experienceNotes =
    normalizeOptionalText(
      input.experienceNotes
    )
  const notes =
    normalizeOptionalText(input.notes)
  const evidenceText =
    normalizeOptionalText(
      input.evidenceText
    )

  for (const [label, value] of [
    ['experience notes', experienceNotes],
    ['notes', notes],
    ['evidence', evidenceText],
  ] as const) {
    if (value && value.length > 2000) {
      throw new Error(
        `Invalid person skill ${label}`
      )
    }
  }

  return {
    proficiencyLevel,
    experienceRange,
    experienceNotes,
    notes,
    evidenceText,
  }
}

function validateReason(
  reason: string,
  label: string
) {
  const normalizedReason = reason.trim()

  if (
    normalizedReason.length < 3 ||
    normalizedReason.length > 2000
  ) {
    throw new Error(`Invalid ${label}`)
  }

  return normalizedReason
}

export async function addPersonSkill(
  access: InternalAccess[],
  input: AddPersonSkillInput
): Promise<string> {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const personId = input.personId.trim()
  const skillId = input.skillId.trim()

  validateUuid(personId, 'person')
  validateUuid(skillId, 'skill')

  const details = validateDetails(input)

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'add_person_skill',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_person_id: personId,
      p_skill_id: skillId,
      p_proficiency_level:
        details.proficiencyLevel,
      p_experience_range:
        details.experienceRange,
      p_experience_notes:
        details.experienceNotes,
      p_notes: details.notes,
      p_evidence_text:
        details.evidenceText,
    }
  )

  if (error) {
    throw new Error(
      `Unable to add person skill: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Person skill creation did not return an identifier'
    )
  }

  return data
}

export async function updatePersonSkill(
  access: InternalAccess[],
  input: UpdatePersonSkillInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const personId = input.personId.trim()
  const personSkillId =
    input.personSkillId.trim()

  validateUuid(personId, 'person')
  validateUuid(
    personSkillId,
    'person skill'
  )

  const details = validateDetails(input)

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'update_person_skill',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_person_id: personId,
      p_person_skill_id:
        personSkillId,
      p_proficiency_level:
        details.proficiencyLevel,
      p_experience_range:
        details.experienceRange,
      p_experience_notes:
        details.experienceNotes,
      p_notes: details.notes,
      p_evidence_text:
        details.evidenceText,
    }
  )

  if (error) {
    throw new Error(
      `Unable to update person skill: ${error.message}`
    )
  }
}

export async function resolvePersonSkill(
  access: InternalAccess[],
  input: ResolvePersonSkillInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const personId = input.personId.trim()
  const personSkillId =
    input.personSkillId.trim()
  const reason = validateReason(
    input.reason,
    'person skill resolution reason'
  )

  validateUuid(personId, 'person')
  validateUuid(
    personSkillId,
    'person skill'
  )

  if (
    input.resolutionAction !== 'confirmed' &&
    input.resolutionAction !== 'rejected'
  ) {
    throw new Error(
      'Invalid person skill resolution action'
    )
  }

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'resolve_person_skill',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_person_id: personId,
      p_person_skill_id:
        personSkillId,
      p_resolution_action:
        input.resolutionAction,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to resolve person skill: ${error.message}`
    )
  }
}

export async function deactivatePersonSkill(
  access: InternalAccess[],
  input: DeactivatePersonSkillInput
) {
  const actorInternalUserId =
    getActorInternalUserId(access)

  const personId = input.personId.trim()
  const personSkillId =
    input.personSkillId.trim()
  const reason = validateReason(
    input.reason,
    'person skill deactivation reason'
  )

  validateUuid(personId, 'person')
  validateUuid(
    personSkillId,
    'person skill'
  )

  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'deactivate_person_skill',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_person_id: personId,
      p_person_skill_id:
        personSkillId,
      p_reason: reason,
    }
  )

  if (error) {
    throw new Error(
      `Unable to deactivate person skill: ${error.message}`
    )
  }
}

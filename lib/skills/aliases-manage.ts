import 'server-only'

import type { InternalAccess } from '../auth/internal-access'
import { createAdminClient } from '../supabase/admin'
import { getSkillCatalogActorId } from './governance'

export type AddSkillAliasInput = {
  skillId: string
  alias: string
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateUuid(
  value: string,
  label: string
) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}`)
  }
}

export async function addSkillAlias(
  access: InternalAccess[],
  input: AddSkillAliasInput
): Promise<string> {
  const actorInternalUserId =
    getSkillCatalogActorId(access)

  const skillId = input.skillId.trim()
  const alias = input.alias.trim()

  validateUuid(skillId, 'skill')

  if (
    alias.length < 2 ||
    alias.length > 180
  ) {
    throw new Error(
      'Invalid skill alias'
    )
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase.rpc(
    'add_skill_alias',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_skill_id: skillId,
      p_alias: alias,
    }
  )

  if (error) {
    throw new Error(
      `Unable to add skill alias: ${error.message}`
    )
  }

  if (typeof data !== 'string' || data.length === 0) {
    throw new Error(
      'Skill alias creation did not return an identifier'
    )
  }

  return data
}

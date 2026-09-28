import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'node:test'

const root = resolve(import.meta.dirname, '../..')

const migration = readFileSync(
  resolve(
    root,
    'supabase/migrations/20260928213559_incremento_11a_resultados_aprendizaje.sql'
  ),
  'utf8'
)

const contributorReferenceMigration = readFileSync(
  resolve(
    root,
    'supabase/migrations/20260928232137_result_contributor_reference_page.sql'
  ),
  'utf8'
)

function functionBody(name) {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+mp25m_api\\.${name}\\s*\\(`,
    'i'
  )

  const match = pattern.exec(migration)

  assert.ok(match, `Missing function ${name}`)

  const tail = migration.slice(match.index)
  const end = tail.search(/\$function\$;/i)

  assert.notEqual(end, -1, `Missing function terminator for ${name}`)

  return tail.slice(0, end + '$function$;'.length)
}

test('results have exactly one autonomous Articulation or Project origin', () => {
  assert.match(
    migration,
    /create table mp25m\.results/
  )

  assert.match(
    migration,
    /constraint results_origin_xor[\s\S]*articulation_id is not null[\s\S]*<>[\s\S]*project_id is not null/
  )

  assert.doesNotMatch(
    migration,
    /\bopportunity_id\b/
  )

  assert.doesNotMatch(
    migration,
    /\bproject_articulations\b/
  )

  assert.doesNotMatch(
    migration,
    /\barticulation_opportunities\b/
  )

  assert.doesNotMatch(
    migration,
    /\bopportunity_nodes\b/
  )

  const permission = functionBody('can_manage_result')

  assert.match(
    permission,
    /mp25m_api\.can_manage_articulation/
  )

  assert.match(
    permission,
    /mp25m_api\.can_manage_project/
  )

  assert.doesNotMatch(
    permission,
    /\bopportunity_id\b/
  )
})

test('result contributions preserve actor identity and historical participation', () => {
  assert.match(
    migration,
    /create unique index result_contributions_active_person_uidx[\s\S]*where removed_at is null[\s\S]*person_id is not null/
  )

  assert.match(
    migration,
    /create unique index result_contributions_active_organization_uidx[\s\S]*where removed_at is null[\s\S]*organization_id is not null/
  )

  const add = functionBody('add_result_contribution')

  assert.match(
    add,
    /from mp25m\.persons person/
  )

  assert.match(
    add,
    /from mp25m\.organizations organization/
  )

  assert.doesNotMatch(
    add,
    /\brecord_status\b/
  )

  const update = functionBody('update_result_contribution')

  const updateSet = update.match(
    /update mp25m\.result_contributions\s+set([\s\S]*?)where id = p_contribution_id/i
  )

  assert.ok(updateSet, 'Missing contribution UPDATE statement')

  assert.doesNotMatch(
    updateSet[1],
    /\bresult_id\s*=/
  )

  assert.doesNotMatch(
    updateSet[1],
    /\bperson_id\s*=/
  )

  assert.doesNotMatch(
    updateSet[1],
    /\borganization_id\s*=/
  )

  const remove = functionBody('remove_result_contribution')

  assert.match(
    remove,
    /removed_at\s*=\s*v_removed_at/
  )

  assert.doesNotMatch(
    remove,
    /\bdelete\s+from\b/i
  )

  assert.match(
    migration,
    /create view mp25m_api\.result_contributor_candidate_list/
  )

  assert.match(
    migration,
    /from mp25m\.opportunity_articulation_participants participant/
  )

  assert.match(
    migration,
    /from mp25m\.project_participants participant/
  )

  assert.match(
    migration,
    /bool_or\([\s\S]*candidate\.removed_at is null[\s\S]*\)[\s\S]*as is_current_participant/
  )

  assert.match(
    migration,
    /max\(candidate\.added_at\)[\s\S]*as last_participated_at/
  )
})

test('result writes are invoker-only, audited and use logical invalidation', () => {
  const functions = [
    'can_manage_result',
    'create_result',
    'update_result',
    'void_result',
    'add_result_contribution',
    'update_result_contribution',
    'remove_result_contribution',
  ]

  for (const name of functions) {
    assert.match(
      functionBody(name),
      /\bsecurity invoker\b/i,
      `${name} must be SECURITY INVOKER`
    )
  }

  for (const action of [
    'result.create',
    'result.update',
    'result.void',
    'result.contribution.add',
    'result.contribution.update',
    'result.contribution.remove',
  ]) {
    const escaped = action.replaceAll('.', '\\.')
    const matches = migration.match(
      new RegExp(`'${escaped}'`, 'g')
    ) ?? []

    assert.equal(
      matches.length,
      1,
      `${action} must appear exactly once`
    )
  }

  assert.match(
    functionBody('create_result'),
    /p_result_date > current_date/
  )

  assert.match(
    functionBody('update_result'),
    /p_result_date > current_date/
  )

  assert.match(
    functionBody('update_result'),
    /Voided result cannot be updated/
  )

  assert.match(
    functionBody('add_result_contribution'),
    /Cannot add contribution to voided result/
  )

  assert.doesNotMatch(
    migration,
    /\bdelete\s+from\s+mp25m\.(results|result_contributions)\b/i
  )
})

test('11A restricts direct database privileges to the application contract', () => {
  assert.match(
    migration,
    /revoke all\s+on table mp25m\.results\s+from public, anon, authenticated, service_role;/
  )

  assert.match(
    migration,
    /revoke all\s+on table mp25m\.result_contributions\s+from public, anon, authenticated, service_role;/
  )

  assert.match(
    migration,
    /grant select, insert, update\s+on table mp25m\.results\s+to service_role;/
  )

  assert.match(
    migration,
    /grant select, insert, update\s+on table mp25m\.result_contributions\s+to service_role;/
  )

  assert.match(
    migration,
    /revoke all\s+on mp25m_api\.result_list,[\s\S]*mp25m_api\.result_contribution_list,[\s\S]*mp25m_api\.result_contributor_candidate_list\s+from public, anon, authenticated, service_role;/
  )

  assert.match(
    migration,
    /grant select\s+on mp25m_api\.result_list,[\s\S]*mp25m_api\.result_contribution_list,[\s\S]*mp25m_api\.result_contributor_candidate_list\s+to service_role;/
  )

  assert.doesNotMatch(
    migration,
    /grant\s+delete[\s\S]*mp25m\.(results|result_contributions)/i
  )
})


test('Result contributor reference search includes archived canonical actors without changing opportunity search', () => {
  assert.match(
    contributorReferenceMigration,
    /create or replace function mp25m_api\.result_contributor_reference_page/
  )

  assert.match(
    contributorReferenceMigration,
    /person_record\.record_status\s+in\s+\('active',\s*'archived'\)/
  )

  assert.match(
    contributorReferenceMigration,
    /organization_record\.record_status\s+in\s+\('active',\s*'archived'\)/
  )

  assert.doesNotMatch(
    contributorReferenceMigration,
    /canonical_actor_reference_page/
  )

  assert.doesNotMatch(
    contributorReferenceMigration,
    /record_status\s*=\s*'active'/
  )

  assert.match(
    contributorReferenceMigration,
    /revoke all[\s\S]*result_contributor_reference_page[\s\S]*from public, anon, authenticated, service_role;/
  )

  assert.match(
    contributorReferenceMigration,
    /grant execute[\s\S]*result_contributor_reference_page[\s\S]*to service_role;/
  )
})

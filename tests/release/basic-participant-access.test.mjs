import test from 'node:test'
import assert from 'node:assert/strict'

import { isBasicParticipantAccess } from '../../lib/auth/basic-participant.ts'

test('detecta acceso exclusivamente participante', () => {
  assert.equal(
    isBasicParticipantAccess([
      { access_role_code: 'participant' },
    ]),
    true,
  )

  assert.equal(
    isBasicParticipantAccess([
      { access_role_code: 'participant' },
      { access_role_code: 'participant' },
    ]),
    true,
  )
})

test('un rol elevado deja de ser participante básico', () => {
  assert.equal(
    isBasicParticipantAccess([
      { access_role_code: 'participant' },
      { access_role_code: 'node_referent' },
    ]),
    false,
  )

  assert.equal(
    isBasicParticipantAccess([
      { access_role_code: 'administrator' },
    ]),
    false,
  )
})

test('sin accesos no se clasifica como participante básico', () => {
  assert.equal(isBasicParticipantAccess([]), false)
})

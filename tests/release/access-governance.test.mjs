import test from 'node:test'
import assert from 'node:assert/strict'
import { canAssignRole } from '../../lib/auth/access-governance.ts'

const general = [{ role: 'administrator', scopeType: 'global', scopeEntityId: null }]
const localA = [{ role: 'local_administrator', scopeType: 'node', scopeEntityId: 'nodo-a' }]
const founderA = [{ role: 'founder_access', scopeType: 'node', scopeEntityId: 'nodo-a' }]
const allowed = (grants, role, scope, node = null, self = false) =>
  canAssignRole(grants, role, scope, node, self).allowed

test('administrador general designa a otro administrador general', () => {
  assert.equal(allowed(general, 'administrator', 'global'), true)
})

test('nadie puede asignarse roles a sí mismo', () => {
  assert.equal(allowed(general, 'administrator', 'global', null, true), false)
  assert.equal(allowed(localA, 'node_referent', 'node', 'nodo-a', true), false)
})

test('administrador local opera solo en su nodo', () => {
  assert.equal(allowed(localA, 'participant', 'node', 'nodo-a'), true)
  assert.equal(allowed(localA, 'node_referent', 'node', 'nodo-a'), true)
  assert.equal(allowed(localA, 'participant', 'node', 'nodo-b'), false)
  assert.equal(allowed(localA, 'administrator', 'global'), false)
  assert.equal(allowed(localA, 'local_administrator', 'node', 'nodo-a'), false)
})

test('fundador solo puede nombrar referentes de su nodo', () => {
  assert.equal(allowed(founderA, 'node_referent', 'node', 'nodo-a'), true)
  assert.equal(allowed(founderA, 'node_referent', 'node', 'nodo-b'), false)
  assert.equal(allowed(founderA, 'administrator', 'global'), false)
  assert.equal(allowed(founderA, 'participant', 'node', 'nodo-a'), false)
})

test('participante y usuario sin roles no otorgan permisos', () => {
  assert.equal(allowed([{ role: 'participant', scopeType: 'node', scopeEntityId: 'nodo-a' }], 'node_referent', 'node', 'nodo-a'), false)
  assert.equal(allowed([], 'participant', 'node', 'nodo-a'), false)
})

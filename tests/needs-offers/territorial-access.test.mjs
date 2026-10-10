import test from 'node:test'
import assert from 'node:assert/strict'

import {
  canReadNeedOffer,
  canAssignNeedOfferNode,
  canChangeNeedOfferNode,
} from '../../lib/needs-offers/authorize.ts'

const USER = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const NODE_A = '00000000-0000-4000-8000-00000000000a'
const NODE_B = '00000000-0000-4000-8000-00000000000b'

const grant = ({
  user = USER,
  role = 'participant',
  scopeType = 'node',
  scopeEntityId = NODE_A,
} = {}) => ({
  internal_user_id: user,
  access_role_code: role,
  scope_type: scopeType,
  scope_entity_id: scopeEntityId,
})

const record = ({
  responsible = OTHER,
  nodeId = NODE_A,
} = {}) => ({
  responsible_internal_user_id: responsible,
  node_id: nodeId,
})

test('global scope can read any need or offer', () => {
  const access = [grant({ scopeType: 'global', scopeEntityId: null })]
  assert.equal(canReadNeedOffer(access, record({ nodeId: NODE_B })), true)
})

test('node-scoped access reads its own node only', () => {
  const access = [grant()]
  assert.equal(canReadNeedOffer(access, record({ nodeId: NODE_A })), true)
  assert.equal(canReadNeedOffer(access, record({ nodeId: NODE_B })), false)
})

test('responsible user can read own record even without node', () => {
  const access = [grant()]
  assert.equal(
    canReadNeedOffer(access, record({ responsible: USER, nodeId: null })),
    true,
  )
})

test('unrelated node-scoped user cannot read an unscoped record', () => {
  const access = [grant()]
  assert.equal(canReadNeedOffer(access, record({ nodeId: null })), false)
})

test('node-scoped user can only assign nodes inside own scope', () => {
  const access = [grant()]
  assert.equal(canAssignNeedOfferNode(access, NODE_A), true)
  assert.equal(canAssignNeedOfferNode(access, NODE_B), false)
})

test('global administrator can assign any node or no node', () => {
  const access = [
    grant({
      role: 'administrator',
      scopeType: 'global',
      scopeEntityId: null,
    }),
  ]

  assert.equal(canAssignNeedOfferNode(access, NODE_A), true)
  assert.equal(canAssignNeedOfferNode(access, NODE_B), true)
  assert.equal(canAssignNeedOfferNode(access, null), true)
})


test('directory filtering keeps global access unrestricted', () => {
  const access = [
    grant({
      role: 'administrator',
      scopeType: 'global',
      scopeEntityId: null,
    }),
  ]

  const records = [
    record({ nodeId: NODE_A }),
    record({ nodeId: NODE_B }),
    record({ nodeId: null, responsible: USER }),
  ]

  assert.deepEqual(
    records.filter((item) => canReadNeedOffer(access, item)),
    records,
  )
})

test('directory filtering keeps own node plus own unscoped records only', () => {
  const access = [grant()]

  const ownNode = record({ nodeId: NODE_A })
  const otherNode = record({ nodeId: NODE_B })
  const ownUnscoped = record({ nodeId: null, responsible: USER })
  const foreignUnscoped = record({ nodeId: null, responsible: OTHER })

  assert.deepEqual(
    [ownNode, otherNode, ownUnscoped, foreignUnscoped].filter(
      (item) => canReadNeedOffer(access, item),
    ),
    [ownNode, ownUnscoped],
  )
})


test('responsible can keep current node but cannot move outside scope', () => {
  const access = [grant()]

  assert.equal(
    canChangeNeedOfferNode(access, NODE_A, NODE_A),
    true,
  )

  assert.equal(
    canChangeNeedOfferNode(access, NODE_A, NODE_B),
    false,
  )
})

test('responsible can keep an unscoped record unscoped', () => {
  const access = [grant()]

  assert.equal(
    canChangeNeedOfferNode(access, null, null),
    true,
  )

  assert.equal(
    canChangeNeedOfferNode(access, null, NODE_A),
    true,
  )

  assert.equal(
    canChangeNeedOfferNode(access, null, NODE_B),
    false,
  )
})

test('global administrator can move a record between any scopes', () => {
  const access = [
    grant({
      role: 'administrator',
      scopeType: 'global',
      scopeEntityId: null,
    }),
  ]

  assert.equal(
    canChangeNeedOfferNode(access, NODE_A, NODE_B),
    true,
  )

  assert.equal(
    canChangeNeedOfferNode(access, NODE_A, null),
    true,
  )
})

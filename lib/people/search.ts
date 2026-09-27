import 'server-only'

import {
  listCanonicalActorReferencePage,
  type CanonicalActorReference,
} from '../opportunities/actors'
import type { ReferencePage } from '../reference-pagination'

export type PersonReference = {
  id: string
  display_name: string
  node_names: string[]
  role_names: string[]
}

type ListPersonReferencesInput = {
  query: string
  cursor?: string | null
  limit: number
}

function toPersonReference(
  actor: CanonicalActorReference
): PersonReference {
  return {
    id: actor.actor_id,
    display_name: actor.display_name,
    node_names: actor.node_names,
    role_names: actor.role_names,
  }
}

export async function listPersonReferencePage({
  query,
  cursor,
  limit,
}: ListPersonReferencesInput): Promise<
  ReferencePage<PersonReference>
> {
  const page = await listCanonicalActorReferencePage({
    query,
    actorTypes: ['person'],
    cursor,
    limit,
    minimumQueryLength: 1,
  })

  return {
    items: page.items.map(toPersonReference),
    nextCursor: page.nextCursor,
  }
}

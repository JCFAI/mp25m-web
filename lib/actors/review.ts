import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type ActorCandidateReview = {
  id: string
  actor_kind: string
  display_name: string
  context_text: string | null
  status: string
  node_names: string[]
  opportunity_ids: string[]
  opportunity_titles: string[]
}

export type ActorCandidatePersonMatch = {
  person_id: string
  display_name: string
  normalized_name: string | null
  record_status: string
  similarity_score: number
  node_names: string[]
  node_verification_statuses: string[]
}

export async function getActorCandidateReview(
  candidateId: string
): Promise<{
  candidate: ActorCandidateReview
  matches: ActorCandidatePersonMatch[]
}> {
  const supabase = createAdminClient()

  const [
    candidateResult,
    matchesResult,
  ] = await Promise.all([
    supabase
      .from('actor_candidate_review')
      .select(`
        id,
        actor_kind,
        display_name,
        context_text,
        status,
        node_names,
        opportunity_ids,
        opportunity_titles
      `)
      .eq('id', candidateId)
      .single(),

    supabase.rpc(
      'actor_candidate_person_matches',
      {
        p_candidate_id: candidateId,
        p_limit: 10,
      }
    ),
  ])

  if (candidateResult.error) {
    throw new Error(
      `Unable to load actor candidate: ${candidateResult.error.message}`
    )
  }

  if (matchesResult.error) {
    throw new Error(
      `Unable to load actor candidate matches: ${matchesResult.error.message}`
    )
  }

  const candidate =
    candidateResult.data as ActorCandidateReview

  if (candidate.actor_kind !== 'person') {
    throw new Error(
      'Only person candidates are supported by this review screen'
    )
  }

  return {
    candidate: {
      ...candidate,
      node_names:
        candidate.node_names ?? [],
      opportunity_ids:
        candidate.opportunity_ids ?? [],
      opportunity_titles:
        candidate.opportunity_titles ?? [],
    },

    matches:
      (matchesResult.data ?? []).map(
        (
          item: {
            person_id: string
            display_name: string
            normalized_name: string | null
            record_status: string
            similarity_score: number | string
            node_names: string[] | null
            node_verification_statuses:
              string[] | null
          }
        ): ActorCandidatePersonMatch => ({
          person_id: item.person_id,
          display_name: item.display_name,
          normalized_name:
            item.normalized_name,
          record_status:
            item.record_status,
          similarity_score:
            Number(item.similarity_score),
          node_names:
            item.node_names ?? [],
          node_verification_statuses:
            item.node_verification_statuses ?? [],
        })
      ),
  }
}
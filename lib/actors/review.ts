import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type ActorCandidateReview = {
  id: string
  actor_kind: string
  display_name: string
  context_text: string | null
  status: string
  resolved_person_id: string | null
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

export type ActorCandidateTerritorialContext = {
  node_id: string
  node_name: string
  has_canonical_participation: boolean
  participation_id: string | null
  participation_status: string | null
  participation_verification_status: string | null
  role_codes: string[]
  role_names: string[]
  role_verification_statuses: string[]
  reported_by_candidate: boolean
}

export async function getActorCandidateReview(
  candidateId: string
): Promise<{
  candidate: ActorCandidateReview
  matches: ActorCandidatePersonMatch[]
  territorialContext: ActorCandidateTerritorialContext[]
}> {
  const supabase = createAdminClient()

  const [
    candidateResult,
    matchesResult,
    territorialContextResult,
  ] = await Promise.all([
    supabase
      .from('actor_candidate_review')
      .select(`
        id,
        actor_kind,
        display_name,
        context_text,
        status,
        resolved_person_id,
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

    supabase.rpc(
      'actor_candidate_territorial_context',
      {
        p_candidate_id: candidateId,
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

  if (territorialContextResult.error) {
    throw new Error(
      `Unable to load territorial context: ${territorialContextResult.error.message}`
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

    territorialContext:
      (territorialContextResult.data ?? []).map(
        (
          item: {
            node_id: string
            node_name: string
            has_canonical_participation: boolean
            participation_id: string | null
            participation_status: string | null
            participation_verification_status: string | null
            role_codes: string[] | null
            role_names: string[] | null
            role_verification_statuses: string[] | null
            reported_by_candidate: boolean
          }
        ): ActorCandidateTerritorialContext => ({
          node_id: item.node_id,
          node_name: item.node_name,
          has_canonical_participation:
            item.has_canonical_participation,
          participation_id:
            item.participation_id,
          participation_status:
            item.participation_status,
          participation_verification_status:
            item.participation_verification_status,
          role_codes:
            item.role_codes ?? [],
          role_names:
            item.role_names ?? [],
          role_verification_statuses:
            item.role_verification_statuses ?? [],
          reported_by_candidate:
            item.reported_by_candidate,
        })
      ),
  }
}

export async function resolveActorCandidateExistingPerson(
  actorInternalUserId: string,
  candidateId: string,
  personId: string,
  reason: string
) {
  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'resolve_actor_candidate_existing_person',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_candidate_id:
        candidateId,
      p_person_id:
        personId,
      p_reason:
        reason,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}

export async function approveActorCandidateNewPerson(
  actorInternalUserId: string,
  candidateId: string,
  reason: string
): Promise<string> {
  const supabase = createAdminClient()

  const {
    data,
    error,
  } = await supabase.rpc(
    'approve_actor_candidate_new_person',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_candidate_id:
        candidateId,
      p_reason:
        reason || null,
    }
  )

  if (error) {
    throw new Error(error.message)
  }

  if (!data) {
    throw new Error(
      'The candidate was resolved without returning a person id'
    )
  }

  return String(data)
}

export async function rejectActorCandidate(
  actorInternalUserId: string,
  candidateId: string,
  reason: string
) {
  const supabase = createAdminClient()

  const { error } = await supabase.rpc(
    'reject_actor_candidate',
    {
      p_actor_internal_user_id:
        actorInternalUserId,
      p_candidate_id:
        candidateId,
      p_reason:
        reason,
    }
  )

  if (error) {
    throw new Error(error.message)
  }
}
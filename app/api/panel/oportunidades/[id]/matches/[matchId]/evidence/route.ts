import { NextRequest, NextResponse } from 'next/server'

import { getInternalAccess } from '../../../../../../../../lib/auth/internal-access'
import {
  canOperateOpportunityRequirementEvaluation,
  getMatchFoundationEvidenceSearchContext,
  listAlreadyAddedEvidenceIdentities,
  searchActorEvidence,
  type ActorSearchEvidence,
  type FoundationRelationKind,
} from '../../../../../../../../lib/opportunities/analysis'
import { getOpportunityDetail } from '../../../../../../../../lib/opportunities/detail'
import { createClient } from '../../../../../../../../lib/supabase/server'

type RouteContext = {
  params: Promise<{
    id: string
    matchId: string
  }>
}

function candidateIsOperational(
  candidate: {
    status: string
    resolved_person_id: string | null
    resolved_organization_id: string | null
  } | null
) {
  return Boolean(
    candidate &&
    (candidate.status === 'pending' || candidate.status === 'approved') &&
    !candidate.resolved_person_id &&
    !candidate.resolved_organization_id
  )
}

function allowedRelationKinds(
  evidence: ActorSearchEvidence,
  context: {
    actor_kind: string
    required_skill_id: string | null
    required_activity_id: string | null
  }
): FoundationRelationKind[] {
  if (context.actor_kind === 'candidate') return ['contextual']

  const directEligible = Boolean(
    (context.required_skill_id && evidence.skill_id === context.required_skill_id) ||
    (context.required_activity_id && evidence.activity_id === context.required_activity_id)
  )

  return directEligible
    ? ['direct', 'related', 'contextual']
    : ['related', 'contextual']
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id: opportunityId, matchId } = await context.params
  const query = request.nextUrl.searchParams.get('q') ?? ''

  if (query.trim().length > 120) {
    return NextResponse.json({ error: 'Invalid search query' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims()
  const authUserId = claimsData?.claims?.sub

  if (claimsError || !authUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const access = await getInternalAccess(authUserId)
  if (access.length === 0) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const opportunity = await getOpportunityDetail(opportunityId)
  if (!opportunity) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!canOperateOpportunityRequirementEvaluation(access, {
    assigned_to_internal_user_id: opportunity.opportunity.assigned_to_internal_user_id,
    node_ids: opportunity.opportunity.node_ids,
  })) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const match = await getMatchFoundationEvidenceSearchContext(opportunityId, matchId)
  if (!match) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (match.match_status !== 'accepted_for_analysis') {
    return NextResponse.json({ error: 'Match is not accepted for analysis' }, { status: 409 })
  }

  if (
    !match.is_current_revision ||
    match.requirement_record_status !== 'active' ||
    match.validation_status !== 'validated'
  ) {
    return NextResponse.json({ error: 'Requirement revision is not operational' }, { status: 409 })
  }

  if (
    match.actor_kind === 'candidate' &&
    !candidateIsOperational(match.candidate_state)
  ) {
    return NextResponse.json({ error: 'Candidate is not operational' }, { status: 409 })
  }

  const evidence = await searchActorEvidence({
    actorKind: match.actor_kind,
    actorId: match.actor_id,
    query,
  })
  const alreadyAdded = await listAlreadyAddedEvidenceIdentities(match.match_id, evidence)

  return NextResponse.json(
    evidence.map((item) => ({
      source_record_type: item.source_record_type,
      source_record_id: item.source_record_id,
      evidence_kind: item.evidence_kind,
      evidence_text: item.evidence_text,
      skill_name: item.skill_name,
      activity_name: item.activity_name,
      verification_status: item.verification_status,
      node_name: item.node_name,
      source_name: item.source_name,
      source_locator: item.source_locator,
      allowed_relation_kinds: allowedRelationKinds(item, match),
      already_added: alreadyAdded.has(
        `${item.source_record_type}\u0000${item.source_record_id}`
      ),
    })),
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

import 'server-only'

import { createAdminClient } from '../supabase/admin'
import {
  resolveReportPeriod,
  type ReportCustomRange,
  type ReportPeriod,
  type ReportPeriodPreset,
} from './periods'

export {
  normalizeReportPeriodPreset,
  validateReportCustomRange,
  type ReportPeriodPreset,
} from './periods'

export type ReportFilters = {
  nodeId?: string | null
  responsibleInternalUserId?: string | null
}

export type ReportNodeOption = {
  id: string
  display_name: string
}

export type ReportResponsibleOption = {
  id: string
  display_name: string
}

export type NetworkSummary = {
  activePeople: number
  activeNodes: number
  activeOrganizations: number
  confirmedPersonSkills: number
  confirmedOrganizationCapabilities: number
}

export type NeedsOffersSummary = {
  activeNeeds: number
  activeOffers: number
}

export type OpportunitySummary = {
  detectedInPeriod: number
  active: number
  analysisStarted: number
  analysisStartedPercent: number | null
  analysisStartedDenominator: number
  averageCompleteness: number | null
  completenessSampleCount: number
  withoutRegisteredFollowup: number
}

export type RequirementSummary = {
  active: number
  evaluated: number
  covered: number
  partial: number
  missing: number
  unevaluated: number
  currentMatches: number
  suggestedMatches: number
  acceptedMatches: number
}

export type GapSummary = {
  open: number
  resolved: number
  closedUnresolved: number
  cancelled: number
}

export type ExecutionSummary = {
  articulationsStarted: number
  projectsStarted: number
  projectsCompleted: number
}

export type ReportsDashboard = {
  period: ReportPeriod
  network: NetworkSummary
  needsOffers: NeedsOffersSummary
  opportunities: OpportunitySummary
  requirements: RequirementSummary
  gaps: GapSummary
  execution: ExecutionSummary
}

type OpportunityRow = {
  id: string
}

type OpportunityReferenceRow = {
  opportunity_id: string
}

type CoverageSummaryRow = {
  opportunity_id: string
  active_requirement_count: number
  evaluated_requirement_count: number
  unevaluated_requirement_count: number
}

type CurrentCoverageRow = {
  opportunity_id: string
  coverage_evaluation_id: string | null
  network_coverage_status:
    | 'covered'
    | 'partial'
    | 'missing'
    | null
}

const ACTIVE_OPPORTUNITY_STATUSES = [
  'open',
  'under_analysis',
  'in_progress',
] as const

const CURRENT_MATCH_STATUSES = [
  'suggested',
  'accepted_for_analysis',
] as const

function fail(
  error: { message: string } | null,
  context: string
) {
  if (error) {
    throw new Error(
      `${context}: ${error.message}`
    )
  }
}

function countValue(
  count: number | null
) {
  return count ?? 0
}

const TRANSIENT_JWT_RETRY_DELAYS_MS = [
  350,
  900,
  1800,
]

function isTransientJwtIssuedAtFuture(
  error: unknown
) {
  return (
    error instanceof Error &&
    error.message.includes(
      'JWT issued at future'
    )
  )
}

async function withTransientJwtRetry<T>(
  operation: () => Promise<T>
): Promise<T> {
  for (
    let attempt = 0;
    ;
    attempt += 1
  ) {
    try {
      return await operation()
    } catch (error) {
      const delay =
        TRANSIENT_JWT_RETRY_DELAYS_MS[
          attempt
        ]

      if (
        !isTransientJwtIssuedAtFuture(
          error
        ) ||
        delay === undefined
      ) {
        throw error
      }

      await new Promise<void>(
        (resolve) => {
          setTimeout(
            resolve,
            delay
          )
        }
      )
    }
  }
}


async function getBaseReportsDashboard(
  preset: ReportPeriodPreset,
  customRange?: ReportCustomRange
): Promise<ReportsDashboard> {
  const period =
    resolveReportPeriod(
      preset,
      customRange
    )

  const supabase =
    createAdminClient()

  const [
    peopleResult,
    nodesResult,
    organizationsResult,
    personSkillsResult,
    organizationCapabilitiesResult,
    needsResult,
    offersResult,
    detectedOpportunitiesResult,
    activeOpportunitiesResult,
    currentMatchesResult,
    suggestedMatchesResult,
    acceptedMatchesResult,
    openGapsResult,
    resolvedGapsResult,
    closedUnresolvedGapsResult,
    cancelledGapsResult,
    articulationsResult,
    projectsStartedResult,
    projectsCompletedResult,
  ] = await Promise.all([
    supabase
      .from('person_profile')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'record_status',
        'active'
      ),

    supabase
      .from('node_directory')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'status',
        'active'
      ),

    supabase
      .from('organization_directory')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'record_status',
        'active'
      ),

    supabase
      .from('person_skill_list')
      .select(
        'person_skill_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'active',
        true
      )
      .eq(
        'verification_status',
        'confirmed'
      ),

    supabase
      .from(
        'organization_capability_list'
      )
      .select(
        'organization_capability_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'verification_status',
        'confirmed'
      ),

    supabase
      .from('need_offer_list')
      .select(
        'need_offer_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'record_type',
        'need'
      )
      .eq(
        'status',
        'active'
      ),

    supabase
      .from('need_offer_list')
      .select(
        'need_offer_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'record_type',
        'offer'
      )
      .eq(
        'status',
        'active'
      ),

    supabase
      .from('opportunity_list')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .gte(
        'created_at',
        period.fromIso
      )
      .lt(
        'created_at',
        period.toExclusiveIso
      ),

    supabase
      .from('opportunity_list')
      .select('id')
      .in(
        'status',
        [
          ...ACTIVE_OPPORTUNITY_STATUSES,
        ]
      )
      .limit(10000),

    supabase
      .from(
        'opportunity_requirement_match_list'
      )
      .select(
        'match_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'is_current_revision',
        true
      )
      .eq(
        'requirement_record_status',
        'active'
      )
      .in(
        'status',
        [
          ...CURRENT_MATCH_STATUSES,
        ]
      ),

    supabase
      .from(
        'opportunity_requirement_match_list'
      )
      .select(
        'match_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'is_current_revision',
        true
      )
      .eq(
        'requirement_record_status',
        'active'
      )
      .eq(
        'status',
        'suggested'
      ),

    supabase
      .from(
        'opportunity_requirement_match_list'
      )
      .select(
        'match_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'is_current_revision',
        true
      )
      .eq(
        'requirement_record_status',
        'active'
      )
      .eq(
        'status',
        'accepted_for_analysis'
      ),

    supabase
      .from('opportunity_gap_list')
      .select(
        'gap_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .in(
        'status',
        [
          'open',
          'in_treatment',
          'blocked',
        ]
      ),

    supabase
      .from('opportunity_gap_list')
      .select(
        'gap_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'status',
        'resolved'
      ),

    supabase
      .from('opportunity_gap_list')
      .select(
        'gap_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'status',
        'closed_unresolved'
      ),

    supabase
      .from('opportunity_gap_list')
      .select(
        'gap_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'status',
        'cancelled'
      ),

    supabase
      .from(
        'opportunity_articulation_list'
      )
      .select(
        'articulation_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .gte(
        'created_at',
        period.fromIso
      )
      .lt(
        'created_at',
        period.toExclusiveIso
      ),

    supabase
      .from('project_list')
      .select(
        'project_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .gte(
        'created_at',
        period.fromIso
      )
      .lt(
        'created_at',
        period.toExclusiveIso
      ),

    supabase
      .from('project_list')
      .select(
        'project_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'status',
        'completed'
      )
      .gte(
        'completed_at',
        period.fromIso
      )
      .lt(
        'completed_at',
        period.toExclusiveIso
      ),
  ])

  const baseResults = [
    [peopleResult, 'Unable to count active people'],
    [nodesResult, 'Unable to count active nodes'],
    [organizationsResult, 'Unable to count active organizations'],
    [personSkillsResult, 'Unable to count confirmed person skills'],
    [organizationCapabilitiesResult, 'Unable to count confirmed organization capabilities'],
    [needsResult, 'Unable to count active needs'],
    [offersResult, 'Unable to count active offers'],
    [detectedOpportunitiesResult, 'Unable to count detected opportunities'],
    [activeOpportunitiesResult, 'Unable to load active opportunities'],
    [currentMatchesResult, 'Unable to count current matches'],
    [suggestedMatchesResult, 'Unable to count suggested matches'],
    [acceptedMatchesResult, 'Unable to count accepted matches'],
    [openGapsResult, 'Unable to count open gaps'],
    [resolvedGapsResult, 'Unable to count resolved gaps'],
    [closedUnresolvedGapsResult, 'Unable to count unresolved closed gaps'],
    [cancelledGapsResult, 'Unable to count cancelled gaps'],
    [articulationsResult, 'Unable to count articulations'],
    [projectsStartedResult, 'Unable to count projects'],
    [projectsCompletedResult, 'Unable to count completed projects'],
  ] as const

  for (
    const [result, message]
    of baseResults
  ) {
    fail(
      result.error,
      message
    )
  }

  const activeOpportunityRows =
    (
      activeOpportunitiesResult.data ??
      []
    ) as OpportunityRow[]

  const activeOpportunityIds =
    activeOpportunityRows.map(
      (row) => row.id
    )

  let analysisStarted = 0
  let withoutRegisteredFollowup =
    activeOpportunityIds.length

  let coverageRows:
    CoverageSummaryRow[] = []

  let currentCoverageRows:
    CurrentCoverageRow[] = []

  if (activeOpportunityIds.length) {
    const [
      requirementResult,
      coverageResult,
      currentCoverageResult,
      followupResult,
    ] = await Promise.all([
      supabase
        .from(
          'opportunity_requirement_list'
        )
        .select(
          'opportunity_id'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .eq(
          'record_status',
          'active'
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_coverage_summary_list'
        )
        .select(
          'opportunity_id, active_requirement_count, evaluated_requirement_count, unevaluated_requirement_count'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_requirement_current_coverage_list'
        )
        .select(
          'opportunity_id, coverage_evaluation_id, network_coverage_status'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_history'
        )
        .select(
          'opportunity_id'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .eq(
          'action',
          'opportunity.followup.create'
        )
        .limit(10000),
    ])

    fail(
      requirementResult.error,
      'Unable to load opportunity requirements'
    )

    fail(
      coverageResult.error,
      'Unable to load current coverage summaries'
    )

    fail(
      currentCoverageResult.error,
      'Unable to load current requirement coverage'
    )

    fail(
      followupResult.error,
      'Unable to load opportunity followup history'
    )

    const requirementOpportunityIds =
      new Set(
        (
          requirementResult.data ??
          []
        ).map(
          (row) =>
            (
              row as OpportunityReferenceRow
            ).opportunity_id
        )
      )

    analysisStarted =
      requirementOpportunityIds.size

    const followedOpportunityIds =
      new Set(
        (
          followupResult.data ??
          []
        ).map(
          (row) =>
            (
              row as OpportunityReferenceRow
            ).opportunity_id
        )
      )

    withoutRegisteredFollowup =
      activeOpportunityIds.filter(
        (id) =>
          !followedOpportunityIds.has(id)
      ).length

    coverageRows =
      (
        coverageResult.data ??
        []
      ) as CoverageSummaryRow[]

    currentCoverageRows =
      (
        currentCoverageResult.data ??
        []
      ) as CurrentCoverageRow[]
  }

  const completenessValues =
    coverageRows
      .filter(
        (row) =>
          row.active_requirement_count > 0
      )
      .map(
        (row) =>
          (
            row.evaluated_requirement_count /
            row.active_requirement_count
          ) * 100
      )

  const averageCompleteness =
    completenessValues.length
      ? completenessValues.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        completenessValues.length
      : null

  const activeRequirements =
    currentCoverageRows.length

  const evaluatedRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.coverage_evaluation_id !==
        null
    ).length

  const coveredRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'covered'
    ).length

  const partialRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'partial'
    ).length

  const missingRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'missing'
    ).length

  const unevaluatedRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.coverage_evaluation_id ===
        null
    ).length

  const activeOpportunityCount =
    activeOpportunityIds.length

  const analysisStartedPercent =
    activeOpportunityCount
      ? (
          analysisStarted /
          activeOpportunityCount
        ) * 100
      : null

  return {
    period,

    network: {
      activePeople:
        countValue(
          peopleResult.count
        ),

      activeNodes:
        countValue(
          nodesResult.count
        ),

      activeOrganizations:
        countValue(
          organizationsResult.count
        ),

      confirmedPersonSkills:
        countValue(
          personSkillsResult.count
        ),

      confirmedOrganizationCapabilities:
        countValue(
          organizationCapabilitiesResult.count
        ),
    },

    needsOffers: {
      activeNeeds:
        countValue(
          needsResult.count
        ),

      activeOffers:
        countValue(
          offersResult.count
        ),
    },

    opportunities: {
      detectedInPeriod:
        countValue(
          detectedOpportunitiesResult.count
        ),

      active:
        activeOpportunityCount,

      analysisStarted,

      analysisStartedPercent,

      analysisStartedDenominator:
        activeOpportunityCount,

      averageCompleteness,

      completenessSampleCount:
        completenessValues.length,

      withoutRegisteredFollowup,
    },

    requirements: {
      active:
        activeRequirements,

      evaluated:
        evaluatedRequirements,

      covered:
        coveredRequirements,

      partial:
        partialRequirements,

      missing:
        missingRequirements,

      unevaluated:
        unevaluatedRequirements,

      currentMatches:
        countValue(
          currentMatchesResult.count
        ),

      suggestedMatches:
        countValue(
          suggestedMatchesResult.count
        ),

      acceptedMatches:
        countValue(
          acceptedMatchesResult.count
        ),
    },

    gaps: {
      open:
        countValue(
          openGapsResult.count
        ),

      resolved:
        countValue(
          resolvedGapsResult.count
        ),

      closedUnresolved:
        countValue(
          closedUnresolvedGapsResult.count
        ),

      cancelled:
        countValue(
          cancelledGapsResult.count
        ),
    },

    execution: {
      articulationsStarted:
        countValue(
          articulationsResult.count
        ),

      projectsStarted:
        countValue(
          projectsStartedResult.count
        ),

      projectsCompleted:
        countValue(
          projectsCompletedResult.count
        ),
    },
  }
}


export function normalizeReportFilterValue(
  value: string | null | undefined
) {
  const normalized =
    value?.trim() ?? ''

  return normalized || null
}

async function listReportFilterOptionsOnce() {
  const supabase =
    createAdminClient()

  const [
    nodesResult,
    responsiblesResult,
  ] = await Promise.all([
    supabase
      .from('node_directory')
      .select('id, display_name')
      .eq('status', 'active')
      .order('display_name', {
        ascending: true,
      }),

    supabase
      .from(
        'internal_user_profile'
      )
      .select('id, display_name')
      .eq('status', 'active')
      .order('display_name', {
        ascending: true,
      }),
  ])

  fail(
    nodesResult.error,
    'Unable to load report node options'
  )

  fail(
    responsiblesResult.error,
    'Unable to load report responsible options'
  )

  return {
    nodes:
      (nodesResult.data ??
        []) as ReportNodeOption[],

    responsibles:
      (responsiblesResult.data ??
        []) as ReportResponsibleOption[],
  }
}

export async function listReportFilterOptions() {
  return withTransientJwtRetry(
    () =>
      listReportFilterOptionsOnce()
  )
}

type AdminClient =
  ReturnType<typeof createAdminClient>

async function loadOpportunityIds(
  supabase: AdminClient,
  filters: ReportFilters,
  activeOnly: boolean
) {
  let query =
    supabase
      .from('opportunity_list')
      .select('id')

  if (activeOnly) {
    query =
      query.in(
        'status',
        [
          ...ACTIVE_OPPORTUNITY_STATUSES,
        ]
      )
  }

  if (filters.nodeId) {
    query =
      query.contains(
        'node_ids',
        [filters.nodeId]
      )
  }

  if (
    filters.responsibleInternalUserId
  ) {
    query =
      query.eq(
        'assigned_to_internal_user_id',
        filters.responsibleInternalUserId
      )
  }

  const { data, error } =
    await query.limit(10000)

  fail(
    error,
    'Unable to load filtered opportunity scope'
  )

  return (
    data ?? []
  ).map(
    (row) => row.id
  )
}

async function countFilteredNeedOffer(
  supabase: AdminClient,
  recordType: 'need' | 'offer',
  filters: ReportFilters
) {
  let query =
    supabase
      .from('need_offer_list')
      .select(
        'need_offer_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'record_type',
        recordType
      )
      .eq(
        'status',
        'active'
      )

  if (filters.nodeId) {
    query =
      query.eq(
        'node_id',
        filters.nodeId
      )
  }

  if (
    filters.responsibleInternalUserId
  ) {
    query =
      query.eq(
        'responsible_internal_user_id',
        filters.responsibleInternalUserId
      )
  }

  const { count, error } =
    await query

  fail(
    error,
    `Unable to count filtered ${recordType}`
  )

  return countValue(count)
}

async function countFilteredDetectedOpportunities(
  supabase: AdminClient,
  period: ReportPeriod,
  filters: ReportFilters
) {
  let query =
    supabase
      .from('opportunity_list')
      .select(
        'id',
        {
          count: 'exact',
          head: true,
        }
      )
      .gte(
        'created_at',
        period.fromIso
      )
      .lt(
        'created_at',
        period.toExclusiveIso
      )

  if (filters.nodeId) {
    query =
      query.contains(
        'node_ids',
        [filters.nodeId]
      )
  }

  if (
    filters.responsibleInternalUserId
  ) {
    query =
      query.eq(
        'assigned_to_internal_user_id',
        filters.responsibleInternalUserId
      )
  }

  const { count, error } =
    await query

  fail(
    error,
    'Unable to count filtered detected opportunities'
  )

  return countValue(count)
}

async function countFilteredMatches(
  supabase: AdminClient,
  opportunityIds: string[],
  statuses: string[]
) {
  if (!opportunityIds.length) {
    return 0
  }

  const { count, error } =
    await supabase
      .from(
        'opportunity_requirement_match_list'
      )
      .select(
        'match_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .eq(
        'is_current_revision',
        true
      )
      .eq(
        'requirement_record_status',
        'active'
      )
      .in(
        'status',
        statuses
      )
      .in(
        'opportunity_id',
        opportunityIds
      )

  fail(
    error,
    'Unable to count filtered matches'
  )

  return countValue(count)
}

async function countFilteredGaps(
  supabase: AdminClient,
  opportunityIds:
    | string[]
    | null,
  filters: ReportFilters,
  statuses: string[]
) {
  if (
    opportunityIds !== null &&
    !opportunityIds.length
  ) {
    return 0
  }

  let query =
    supabase
      .from('opportunity_gap_list')
      .select(
        'gap_id',
        {
          count: 'exact',
          head: true,
        }
      )
      .in(
        'status',
        statuses
      )

  if (opportunityIds !== null) {
    query =
      query.in(
        'opportunity_id',
        opportunityIds
      )
  }

  if (
    filters.responsibleInternalUserId
  ) {
    query =
      query.eq(
        'responsible_internal_user_id',
        filters.responsibleInternalUserId
      )
  }

  const { count, error } =
    await query

  fail(
    error,
    'Unable to count filtered gaps'
  )

  return countValue(count)
}

async function getFilteredReportsDashboard(
  base: ReportsDashboard,
  filters: ReportFilters
): Promise<ReportsDashboard> {
  const supabase =
    createAdminClient()

  const [
    activeOpportunityIds,
    analysisOpportunityIds,
    nodeOpportunityIds,
    activeNeeds,
    activeOffers,
    detectedInPeriod,
  ] = await Promise.all([
    loadOpportunityIds(
      supabase,
      filters,
      true
    ),

    loadOpportunityIds(
      supabase,
      filters,
      false
    ),

    filters.nodeId
      ? loadOpportunityIds(
          supabase,
          {
            nodeId:
              filters.nodeId,
          },
          false
        )
      : Promise.resolve(null),

    countFilteredNeedOffer(
      supabase,
      'need',
      filters
    ),

    countFilteredNeedOffer(
      supabase,
      'offer',
      filters
    ),

    countFilteredDetectedOpportunities(
      supabase,
      base.period,
      filters
    ),
  ])

  let analysisStarted = 0
  let withoutRegisteredFollowup =
    activeOpportunityIds.length

  let coverageRows:
    CoverageSummaryRow[] = []

  let currentCoverageRows:
    CurrentCoverageRow[] = []

  if (activeOpportunityIds.length) {
    const [
      requirementResult,
      coverageResult,
      currentCoverageResult,
      followupResult,
    ] = await Promise.all([
      supabase
        .from(
          'opportunity_requirement_list'
        )
        .select(
          'opportunity_id'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .eq(
          'record_status',
          'active'
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_coverage_summary_list'
        )
        .select(
          'opportunity_id, active_requirement_count, evaluated_requirement_count, unevaluated_requirement_count'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_requirement_current_coverage_list'
        )
        .select(
          'opportunity_id, coverage_evaluation_id, network_coverage_status'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .limit(10000),

      supabase
        .from(
          'opportunity_history'
        )
        .select(
          'opportunity_id'
        )
        .in(
          'opportunity_id',
          activeOpportunityIds
        )
        .eq(
          'action',
          'opportunity.followup.create'
        )
        .limit(10000),
    ])

    fail(
      requirementResult.error,
      'Unable to load filtered requirements'
    )

    fail(
      coverageResult.error,
      'Unable to load filtered coverage'
    )

    fail(
      currentCoverageResult.error,
      'Unable to load filtered requirement coverage'
    )

    fail(
      followupResult.error,
      'Unable to load filtered followups'
    )

    analysisStarted =
      new Set(
        (
          requirementResult.data ??
          []
        ).map(
          (row) =>
            row.opportunity_id
        )
      ).size

    const followed =
      new Set(
        (
          followupResult.data ??
          []
        ).map(
          (row) =>
            row.opportunity_id
        )
      )

    withoutRegisteredFollowup =
      activeOpportunityIds.filter(
        (id) =>
          !followed.has(id)
      ).length

    coverageRows =
      (
        coverageResult.data ??
        []
      ) as CoverageSummaryRow[]

    currentCoverageRows =
      (
        currentCoverageResult.data ??
        []
      ) as CurrentCoverageRow[]
  }

  const completenessValues =
    coverageRows
      .filter(
        (row) =>
          row.active_requirement_count > 0
      )
      .map(
        (row) =>
          (
            row.evaluated_requirement_count /
            row.active_requirement_count
          ) * 100
      )

  const averageCompleteness =
    completenessValues.length
      ? completenessValues.reduce(
          (sum, value) =>
            sum + value,
          0
        ) /
        completenessValues.length
      : null

  const activeRequirements =
    currentCoverageRows.length

  const evaluatedRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.coverage_evaluation_id !==
        null
    ).length

  const coveredRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'covered'
    ).length

  const partialRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'partial'
    ).length

  const missingRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.network_coverage_status ===
        'missing'
    ).length

  const unevaluatedRequirements =
    currentCoverageRows.filter(
      (row) =>
        row.coverage_evaluation_id ===
        null
    ).length

  const [
    currentMatches,
    suggestedMatches,
    acceptedMatches,
    openGaps,
    resolvedGaps,
    closedUnresolvedGaps,
    cancelledGaps,
  ] = await Promise.all([
    countFilteredMatches(
      supabase,
      analysisOpportunityIds,
      [
        'suggested',
        'accepted_for_analysis',
      ]
    ),

    countFilteredMatches(
      supabase,
      analysisOpportunityIds,
      ['suggested']
    ),

    countFilteredMatches(
      supabase,
      analysisOpportunityIds,
      ['accepted_for_analysis']
    ),

    countFilteredGaps(
      supabase,
      nodeOpportunityIds,
      filters,
      [
        'open',
        'in_treatment',
        'blocked',
      ]
    ),

    countFilteredGaps(
      supabase,
      nodeOpportunityIds,
      filters,
      ['resolved']
    ),

    countFilteredGaps(
      supabase,
      nodeOpportunityIds,
      filters,
      ['closed_unresolved']
    ),

    countFilteredGaps(
      supabase,
      nodeOpportunityIds,
      filters,
      ['cancelled']
    ),
  ])

  let articulationsStarted =
    base.execution.articulationsStarted

  let projectsStarted =
    base.execution.projectsStarted

  let projectsCompleted =
    base.execution.projectsCompleted

  if (
    filters.responsibleInternalUserId
  ) {
    const [
      articulationResult,
      projectStartedResult,
      projectCompletedResult,
    ] = await Promise.all([
      supabase
        .from(
          'opportunity_articulation_list'
        )
        .select(
          'articulation_id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'responsible_internal_user_id',
          filters.responsibleInternalUserId
        )
        .gte(
          'created_at',
          base.period.fromIso
        )
        .lt(
          'created_at',
          base.period.toExclusiveIso
        ),

      supabase
        .from('project_list')
        .select(
          'project_id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'responsible_internal_user_id',
          filters.responsibleInternalUserId
        )
        .gte(
          'created_at',
          base.period.fromIso
        )
        .lt(
          'created_at',
          base.period.toExclusiveIso
        ),

      supabase
        .from('project_list')
        .select(
          'project_id',
          {
            count: 'exact',
            head: true,
          }
        )
        .eq(
          'responsible_internal_user_id',
          filters.responsibleInternalUserId
        )
        .eq(
          'status',
          'completed'
        )
        .gte(
          'completed_at',
          base.period.fromIso
        )
        .lt(
          'completed_at',
          base.period.toExclusiveIso
        ),
    ])

    fail(
      articulationResult.error,
      'Unable to count filtered articulations'
    )

    fail(
      projectStartedResult.error,
      'Unable to count filtered projects'
    )

    fail(
      projectCompletedResult.error,
      'Unable to count filtered completed projects'
    )

    articulationsStarted =
      countValue(
        articulationResult.count
      )

    projectsStarted =
      countValue(
        projectStartedResult.count
      )

    projectsCompleted =
      countValue(
        projectCompletedResult.count
      )
  }

  const activeOpportunityCount =
    activeOpportunityIds.length

  return {
    ...base,

    needsOffers: {
      activeNeeds,
      activeOffers,
    },

    opportunities: {
      detectedInPeriod,

      active:
        activeOpportunityCount,

      analysisStarted,

      analysisStartedPercent:
        activeOpportunityCount
          ? (
              analysisStarted /
              activeOpportunityCount
            ) * 100
          : null,

      analysisStartedDenominator:
        activeOpportunityCount,

      averageCompleteness,

      completenessSampleCount:
        completenessValues.length,

      withoutRegisteredFollowup,
    },

    requirements: {
      active:
        activeRequirements,

      evaluated:
        evaluatedRequirements,

      covered:
        coveredRequirements,

      partial:
        partialRequirements,

      missing:
        missingRequirements,

      unevaluated:
        unevaluatedRequirements,

      currentMatches,
      suggestedMatches,
      acceptedMatches,
    },

    gaps: {
      open: openGaps,
      resolved: resolvedGaps,
      closedUnresolved:
        closedUnresolvedGaps,
      cancelled:
        cancelledGaps,
    },

    execution: {
      articulationsStarted,
      projectsStarted,
      projectsCompleted,
    },
  }
}

async function getReportsDashboardOnce(
  preset: ReportPeriodPreset,
  filters: ReportFilters = {},
  customRange?: ReportCustomRange
): Promise<ReportsDashboard> {
  const base =
    await getBaseReportsDashboard(
      preset,
      customRange
    )

  if (
    !filters.nodeId &&
    !filters.responsibleInternalUserId
  ) {
    return base
  }

  return getFilteredReportsDashboard(
    base,
    filters
  )
}

export async function getReportsDashboard(
  preset: ReportPeriodPreset,
  filters: ReportFilters = {},
  customRange?: ReportCustomRange
): Promise<ReportsDashboard> {
  return withTransientJwtRetry(
    () =>
      getReportsDashboardOnce(
        preset,
        filters,
        customRange
      )
  )
}

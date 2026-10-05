import 'server-only'

import { createAdminClient } from '../supabase/admin'

export type ReportPeriodPreset =
  | '30d'
  | '90d'
  | 'year'

export type ReportPeriod = {
  preset: ReportPeriodPreset
  dateFrom: string
  dateTo: string
  fromIso: string
  toExclusiveIso: string
  label: string
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

function operationalToday() {
  const parts =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          'America/Argentina/Buenos_Aires',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }
    ).formatToParts(new Date())

  const values =
    Object.fromEntries(
      parts.map((part) => [
        part.type,
        part.value,
      ])
    )

  return [
    values.year,
    values.month,
    values.day,
  ].join('-')
}

function addDays(
  date: string,
  days: number
) {
  const instant =
    new Date(`${date}T12:00:00Z`)

  instant.setUTCDate(
    instant.getUTCDate() + days
  )

  return instant
    .toISOString()
    .slice(0, 10)
}

function formatDate(
  date: string
) {
  const [year, month, day] =
    date.split('-')

  return `${day}/${month}/${year}`
}

export function normalizeReportPeriodPreset(
  value: string | null | undefined
): ReportPeriodPreset {
  if (
    value === '30d' ||
    value === '90d' ||
    value === 'year'
  ) {
    return value
  }

  return '90d'
}

export function resolveReportPeriod(
  preset: ReportPeriodPreset
): ReportPeriod {
  const dateTo =
    operationalToday()

  let dateFrom: string

  if (preset === '30d') {
    dateFrom =
      addDays(dateTo, -29)
  } else if (preset === '90d') {
    dateFrom =
      addDays(dateTo, -89)
  } else {
    dateFrom =
      `${dateTo.slice(0, 4)}-01-01`
  }

  const nextDate =
    addDays(dateTo, 1)

  return {
    preset,
    dateFrom,
    dateTo,

    fromIso:
      `${dateFrom}T00:00:00-03:00`,

    toExclusiveIso:
      `${nextDate}T00:00:00-03:00`,

    label:
      `${formatDate(dateFrom)} al ${formatDate(dateTo)}`,
  }
}

export async function getReportsDashboard(
  preset: ReportPeriodPreset
): Promise<ReportsDashboard> {
  const period =
    resolveReportPeriod(preset)

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

  if (activeOpportunityIds.length) {
    const [
      requirementResult,
      coverageResult,
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
    coverageRows.reduce(
      (sum, row) =>
        sum +
        row.active_requirement_count,
      0
    )

  const evaluatedRequirements =
    coverageRows.reduce(
      (sum, row) =>
        sum +
        row.evaluated_requirement_count,
      0
    )

  const unevaluatedRequirements =
    coverageRows.reduce(
      (sum, row) =>
        sum +
        row.unevaluated_requirement_count,
      0
    )

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

export const RELEASE_STAGES =
  ['S', 'M', 'L', 'XL'] as const

export type ReleaseStage =
  (typeof RELEASE_STAGES)[number]

export type ReleaseModuleKey =
  | 'agenda'
  | 'reports'
  | 'communications'
  | 'opportunities'
  | 'needs_offers'
  | 'activities'
  | 'results'
  | 'economics'

export type ReleaseGateModule = {
  key: ReleaseModuleKey
  label: string
  availableFrom: ReleaseStage
  pathPrefixes: readonly string[]
}

const stageRank:
  Record<ReleaseStage, number> = {
    S: 0,
    M: 1,
    L: 2,
    XL: 3,
  }

export const RELEASE_MODULES = [
  {
    key: 'agenda',
    label: 'Agenda',
    availableFrom: 'M',
    pathPrefixes: [
      '/panel/agenda',
      '/api/panel/agenda',
    ],
  },
  {
    key: 'reports',
    label: 'Informes',
    availableFrom: 'M',
    pathPrefixes: ['/panel/informes'],
  },
  {
    key: 'communications',
    label: 'Comunicaciones',
    availableFrom: 'L',
    pathPrefixes: [
      '/panel/comunicaciones',
      '/api/panel/comunicaciones',
    ],
  },
  {
    key: 'opportunities',
    label: 'Oportunidades',
    availableFrom: 'L',
    pathPrefixes: [
      '/panel/oportunidades',
      '/api/panel/oportunidades',
    ],
  },
  {
    key: 'needs_offers',
    label: 'Necesidades y ofertas',
    availableFrom: 'L',
    pathPrefixes: [
      '/panel/necesidades-ofertas',
      '/api/panel/necesidades-ofertas',
    ],
  },
  {
    key: 'activities',
    label: 'Actividades',
    availableFrom: 'XL',
    pathPrefixes: [
      '/panel/actividades',
      '/api/panel/actividades',
      '/panel/actores-pendientes',
    ],
  },
  {
    key: 'results',
    label: 'Resultados',
    availableFrom: 'XL',
    pathPrefixes: ['/api/panel/resultados'],
  },
  {
    key: 'economics',
    label: 'Economía operativa',
    availableFrom: 'XL',
    pathPrefixes: [],
  },
] as const satisfies readonly ReleaseGateModule[]

function isReleaseStage(
  value: string | undefined,
): value is ReleaseStage {
  return (
    typeof value === 'string' &&
    RELEASE_STAGES.includes(
      value as ReleaseStage,
    )
  )
}

export function getCurrentReleaseStage() {
  const candidate =
    process.env.MP25M_RELEASE_STAGE
      ?.trim()
      .toUpperCase()

  return isReleaseStage(candidate)
    ? candidate
    : 'S'
}

export function isReleaseStageAvailable(
  currentStage: ReleaseStage,
  availableFrom: ReleaseStage,
) {
  return (
    stageRank[currentStage] >=
    stageRank[availableFrom]
  )
}

export function getReleaseModuleByKey(
  key: unknown,
) {
  if (typeof key !== 'string') {
    return undefined
  }

  return RELEASE_MODULES.find(
    (module) => module.key === key,
  )
}

export function getReleaseModuleForPath(
  pathname: string,
) {
  return RELEASE_MODULES.find((module) =>
    module.pathPrefixes.some(
      (prefix) =>
        pathname === prefix ||
        pathname.startsWith(`${prefix}/`),
    ),
  )
}

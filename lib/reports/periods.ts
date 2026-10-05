export type ReportPeriodPreset =
  | '30d'
  | '90d'
  | 'year'
  | 'custom'

export type ReportCustomRange = {
  dateFrom: string
  dateTo: string
}

export type ReportPeriod = {
  preset: ReportPeriodPreset
  dateFrom: string
  dateTo: string
  fromIso: string
  toExclusiveIso: string
  label: string
}

export type ReportCustomRangeValidation = {
  range: ReportCustomRange | null
  error: string | null
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

function isCalendarDate(
  value: string
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false
  }

  const parsed =
    new Date(
      `${value}T12:00:00Z`
    )

  return (
    !Number.isNaN(
      parsed.getTime()
    ) &&
    parsed
      .toISOString()
      .slice(0, 10) === value
  )
}

export function normalizeReportPeriodPreset(
  value: string | null | undefined
): ReportPeriodPreset {
  if (
    value === '30d' ||
    value === '90d' ||
    value === 'year' ||
    value === 'custom'
  ) {
    return value
  }

  return '90d'
}

export function validateReportCustomRange(
  rawDateFrom:
    | string
    | null
    | undefined,
  rawDateTo:
    | string
    | null
    | undefined
): ReportCustomRangeValidation {
  const dateFrom =
    rawDateFrom?.trim() ?? ''

  const dateTo =
    rawDateTo?.trim() ?? ''

  if (!dateFrom || !dateTo) {
    return {
      range: null,
      error:
        'Para usar un rango personalizado elegí una fecha Desde y una fecha Hasta.',
    }
  }

  if (
    !isCalendarDate(dateFrom) ||
    !isCalendarDate(dateTo)
  ) {
    return {
      range: null,
      error:
        'El rango personalizado contiene una fecha inválida.',
    }
  }

  if (dateFrom > dateTo) {
    return {
      range: null,
      error:
        'La fecha Desde no puede ser posterior a la fecha Hasta.',
    }
  }

  return {
    range: {
      dateFrom,
      dateTo,
    },
    error: null,
  }
}

export function resolveReportPeriod(
  preset: ReportPeriodPreset,
  customRange?: ReportCustomRange
): ReportPeriod {
  const operationalDate =
    operationalToday()

  let dateFrom: string
  let dateTo: string

  if (preset === 'custom') {
    if (!customRange) {
      throw new Error(
        'Custom report period requires dateFrom and dateTo'
      )
    }

    dateFrom =
      customRange.dateFrom

    dateTo =
      customRange.dateTo
  } else {
    dateTo =
      operationalDate

    if (preset === '30d') {
      dateFrom =
        addDays(dateTo, -29)
    } else if (
      preset === '90d'
    ) {
      dateFrom =
        addDays(dateTo, -89)
    } else {
      dateFrom =
        `${dateTo.slice(0, 4)}-01-01`
    }
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

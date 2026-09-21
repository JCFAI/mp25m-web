const ISO_INSTANT_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i

export function localDateTimeToIso(value: string) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) {
    throw new Error('Invalid local date and time')
  }
  return date.toISOString()
}

export function isIsoInstant(value: string) {
  return ISO_INSTANT_PATTERN.test(value) && !Number.isNaN(new Date(value).getTime())
}

export function currentLocalDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

import 'server-only'

export const DEFAULT_REFERENCE_PAGE_LIMIT = 25
export const MAX_REFERENCE_PAGE_LIMIT = 50

export type ReferencePage<Item> = {
  items: Item[]
  nextCursor: string | null
}

type CursorEnvelope = {
  version: 1
  kind: string
  context: string
  position: unknown
}

export class ReferenceRequestError extends Error {
  readonly code: 'invalid_cursor' | 'invalid_limit' | 'invalid_query'

  constructor(
    code: ReferenceRequestError['code'],
    message: string
  ) {
    super(message)
    this.name = 'ReferenceRequestError'
    this.code = code
  }
}

export function normalizeReferenceQuery(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (normalized.length === 1) {
    throw new ReferenceRequestError(
      'invalid_query',
      'La búsqueda debe estar vacía o tener al menos dos caracteres.'
    )
  }

  return normalized
}

export function parseReferenceLimit(value: string | null) {
  if (value === null || value === '') {
    return DEFAULT_REFERENCE_PAGE_LIMIT
  }

  if (!/^\d+$/.test(value)) {
    throw new ReferenceRequestError(
      'invalid_limit',
      'El límite debe ser un número entero entre 1 y 50.'
    )
  }

  const limit = Number(value)

  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_REFERENCE_PAGE_LIMIT
  ) {
    throw new ReferenceRequestError(
      'invalid_limit',
      'El límite debe ser un número entero entre 1 y 50.'
    )
  }

  return limit
}

export function createReferenceContext(
  value: Record<string, unknown>
) {
  return JSON.stringify(value)
}

export function encodeReferenceCursor(
  kind: string,
  context: string,
  position: unknown
) {
  const envelope: CursorEnvelope = {
    version: 1,
    kind,
    context,
    position,
  }

  return Buffer.from(
    JSON.stringify(envelope),
    'utf8'
  ).toString('base64url')
}

export function decodeReferenceCursor(
  value: string | null,
  expectedKind: string,
  expectedContext: string
) {
  if (!value) {
    return null
  }

  if (
    value.length > 4096 ||
    !/^[A-Za-z0-9_-]+$/.test(value)
  ) {
    throw new ReferenceRequestError(
      'invalid_cursor',
      'El cursor no es válido.'
    )
  }

  try {
    const decoded = Buffer.from(
      value,
      'base64url'
    ).toString('utf8')
    const parsed = JSON.parse(decoded) as Partial<CursorEnvelope>

    if (
      parsed.version !== 1 ||
      parsed.kind !== expectedKind ||
      parsed.context !== expectedContext ||
      !Object.prototype.hasOwnProperty.call(
        parsed,
        'position'
      )
    ) {
      throw new Error('Cursor context mismatch')
    }

    return parsed.position
  } catch {
    throw new ReferenceRequestError(
      'invalid_cursor',
      'El cursor no es válido para esta consulta.'
    )
  }
}

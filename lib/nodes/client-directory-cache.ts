'use client'

export type NodeDirectoryItem = {
  id: string
  node_number: number | null
  display_name: string
  status: string
  jurisdiction_name: string | null
  jurisdiction_type_name: string | null
}

const STORAGE_KEY =
  'mp25m:node-directory:v1'

let memoryCache: NodeDirectoryItem[] | null =
  null

let pendingRequest:
  Promise<NodeDirectoryItem[]> | null = null

function readSessionCache() {
  if (memoryCache) {
    return memoryCache
  }

  try {
    const raw =
      window.sessionStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return null
    }

    memoryCache =
      parsed as NodeDirectoryItem[]

    return memoryCache
  } catch {
    return null
  }
}

function storeSessionCache(
  nodes: NodeDirectoryItem[]
) {
  memoryCache = nodes

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nodes)
    )
  } catch {
    // El cache en memoria sigue siendo suficiente
    // si sessionStorage no está disponible.
  }
}

async function requestNodeDirectory() {
  const response = await fetch(
    '/api/panel/nodos?mode=reference',
    {
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    throw new Error(
      'No se pudo cargar el directorio.'
    )
  }

  return (await response.json()) as
    NodeDirectoryItem[]
}

export function loadNodeDirectory(
  {
    force = false,
  }: {
    force?: boolean
  } = {}
) {
  if (!force) {
    const cached = readSessionCache()

    if (cached) {
      return Promise.resolve(cached)
    }

    if (pendingRequest) {
      return pendingRequest
    }
  }

  const request = requestNodeDirectory().then(
    (nodes) => {
      storeSessionCache(nodes)

      if (pendingRequest === request) {
        pendingRequest = null
      }

      return nodes
    },
    (error) => {
      if (pendingRequest === request) {
        pendingRequest = null
      }

      throw error
    }
  )

  pendingRequest = request

  return request
}

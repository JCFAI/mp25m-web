import { type NextRequest } from 'next/server'
import { updateSession } from './lib/supabase/proxy'
import {
  getCurrentReleaseStage,
  getReleaseModuleForPath,
  isReleaseStageAvailable,
  type ReleaseGateModule,
} from './lib/release-stage'
import { NextResponse } from 'next/server'

function unavailableModuleResponse(
  request: NextRequest,
  releaseModule: ReleaseGateModule,
) {
  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    (
      request.method !== 'GET' &&
      request.method !== 'HEAD'
    )
  ) {
    return NextResponse.json(
      {
        error: `${releaseModule.label} estará disponible en MP25M_${releaseModule.availableFrom}.`,
      },
      { status: 403 },
    )
  }

  const url = new URL(
    '/panel',
    request.url,
  )

  url.searchParams.set(
    'release',
    'unavailable',
  )
  url.searchParams.set('module', releaseModule.key)

  return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
  const releaseModule = getReleaseModuleForPath(
    request.nextUrl.pathname,
  )

  if (
    releaseModule &&
    !isReleaseStageAvailable(
      getCurrentReleaseStage(),
      releaseModule.availableFrom,
    )
  ) {
    return unavailableModuleResponse(
      request,
      releaseModule,
    )
  }

  return updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

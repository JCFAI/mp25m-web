import type { ReactNode } from 'react'

import { requireElevatedPanelAccess } from '../../../lib/auth/require-elevated-panel-access'

export default async function ElevatedModuleLayout({
  children,
}: {
  children: ReactNode
}) {
  await requireElevatedPanelAccess()

  return children
}

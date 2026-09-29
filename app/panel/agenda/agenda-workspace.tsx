'use client'

import {
  useCallback,
  useState,
} from 'react'

import type {
  AgendaUserOption,
} from '../../../lib/agenda/agenda'
import { AgendaCreateForm } from './agenda-create-form'
import { AgendaDirectory } from './agenda-directory'

export function AgendaWorkspace({
  users,
  today,
}: {
  users: AgendaUserOption[]
  today: string
}) {
  const [
    revision,
    setRevision,
  ] =
    useState(0)

  const handleCreated =
    useCallback(() => {
      setRevision(
        (current) =>
          current + 1
      )
    }, [])

  return (
    <div className="space-y-6">
      <AgendaCreateForm
        users={users}
        onCreated={handleCreated}
      />

      <AgendaDirectory
        users={users}
        today={today}
        revision={revision}
      />
    </div>
  )
}

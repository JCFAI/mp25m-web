export type AccessRoleLike = {
  access_role_code: string
}

export function isBasicParticipantAccess(
  access: readonly AccessRoleLike[]
) {
  return (
    access.length > 0 &&
    access.every(
      item =>
        item.access_role_code ===
        'participant'
    )
  )
}

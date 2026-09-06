export type PendingSkillProposalReferenceOption = {
  proposal_id: string
  proposed_name: string
  normalized_name: string
}

export type HandledSkillProposalTerm = {
  label: string
  source: 'submitted' | 'pending'
}

export type SkillProposalTermMatch =
  HandledSkillProposalTerm & {
    matchKind: 'exact' | 'related'
  }

const RELATED_PREFIX_MINIMUM_LENGTH = 8
const RELATED_PREFIX_MAX_EXTRA_LENGTH = 24

export function normalizeSkillProposalTerm(
  value: string
) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function mapPendingSkillProposalReferencesToTerms(
  proposals: PendingSkillProposalReferenceOption[]
) {
  const terms =
    new Map<string, HandledSkillProposalTerm>()

  for (const proposal of proposals) {
    const normalizedName =
      proposal.normalized_name ||
      normalizeSkillProposalTerm(
        proposal.proposed_name
      )

    if (!normalizedName) {
      continue
    }

    terms.set(normalizedName, {
      label: proposal.proposed_name,
      source: 'pending',
    })
  }

  return terms
}

export function combineSkillProposalTerms(
  serverTerms: Map<
    string,
    HandledSkillProposalTerm
  >,
  sessionTerms: Map<
    string,
    HandledSkillProposalTerm
  >
) {
  const combined = new Map(serverTerms)

  for (const [
    normalizedTerm,
    proposal,
  ] of sessionTerms) {
    combined.set(normalizedTerm, proposal)
  }

  return combined
}

export function findSkillProposalTermMatch(
  normalizedTerm: string,
  handledTerms: Map<
    string,
    HandledSkillProposalTerm
  >
): SkillProposalTermMatch | null {
  if (!normalizedTerm) {
    return null
  }

  for (const [
    handledTerm,
    handledProposal,
  ] of handledTerms) {
    if (handledTerm === normalizedTerm) {
      return {
        ...handledProposal,
        matchKind: 'exact',
      }
    }

    if (
      normalizedTerm.length >=
        RELATED_PREFIX_MINIMUM_LENGTH &&
      handledTerm.startsWith(normalizedTerm)
    ) {
      return {
        ...handledProposal,
        matchKind: 'related',
      }
    }

    if (
      handledTerm.length >=
        RELATED_PREFIX_MINIMUM_LENGTH &&
      normalizedTerm.startsWith(handledTerm) &&
      normalizedTerm.length -
        handledTerm.length <=
        RELATED_PREFIX_MAX_EXTRA_LENGTH
    ) {
      return {
        ...handledProposal,
        matchKind: 'related',
      }
    }
  }

  return null
}

export function skillProposalTermMessage(
  match: SkillProposalTermMatch | null
) {
  if (!match) {
    return null
  }

  if (match.matchKind === 'related') {
    return `Ya existe una propuesta relacionada pendiente: "${match.label}".`
  }

  if (match.source === 'submitted') {
    return `Ya propusiste "${match.label}". La propuesta está pendiente de revisión del catálogo.`
  }

  return `Ya existe una propuesta pendiente para "${match.label}".`
}

export function isPendingSkillProposalDuplicateMessage(
  message: string | null | undefined
) {
  return Boolean(
    message &&
      /ya existe una propuesta pendiente|pending skill proposal/i.test(
        message
      )
  )
}

export function pendingSkillProposalDuplicateNotice(
  label: string
) {
  const trimmed = label.trim()

  if (!trimmed) {
    return 'Esta habilidad ya fue propuesta y está pendiente de revisión del catálogo.'
  }

  return `Ya existe una propuesta pendiente para "${trimmed}".`
}

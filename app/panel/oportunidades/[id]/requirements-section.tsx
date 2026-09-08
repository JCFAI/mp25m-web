import 'server-only'

import type {
  InternalAccess,
} from '../../../../lib/auth/internal-access'

import {
  canFormulateOpportunityRequirement,
  canManageOpportunityRequirementLifecycle,
  canValidateOpportunityRequirement,
  listOpportunityRequirementRevisions,
  listOpportunityRequirements,
  requirementTypeLabels,
  requirementValidationLabels,
} from '../../../../lib/opportunities/requirements'

import {
  OpportunityRequirementForm,
} from './requirement-form'

import {
  OpportunityRequirementWorkflowControls,
} from './requirement-workflow-controls'

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(
    new Date(value)
  )
}

export async function OpportunityRequirementsSection({
  opportunityId,
  access,
  assignedToInternalUserId,
  nodeIds,
}: {
  opportunityId: string
  access: InternalAccess[]
  assignedToInternalUserId: string | null
  nodeIds: string[]
}) {
  const requirements =
    access.length > 0
      ? await listOpportunityRequirements(
          opportunityId
        )
      : []

  const requirementRevisions =
    access.length > 0
      ? await listOpportunityRequirementRevisions(
          opportunityId
        )
      : []

  const requirementPermissionContext = {
    assigned_to_internal_user_id:
      assignedToInternalUserId,
    node_ids:
      nodeIds,
  }

  const canFormulateRequirements =
    canFormulateOpportunityRequirement(
      access,
      requirementPermissionContext
    )

  const canValidateRequirements =
    canValidateOpportunityRequirement(
      access,
      requirementPermissionContext
    )

  const canLifecycleRequirements =
    canManageOpportunityRequirementLifecycle(
      access,
      requirementPermissionContext
    )

  const revisionsByRequirement =
    new Map<
      string,
      typeof requirementRevisions
    >()

  for (
    const revision
    of requirementRevisions
  ) {
    const current =
      revisionsByRequirement.get(
        revision.requirement_id
      ) ?? []

    current.push(revision)

    revisionsByRequirement.set(
      revision.requirement_id,
      current
    )
  }

  return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">
            Análisis productivo
          </p>

          <h2 className="mt-2 text-lg font-semibold text-slate-950">
            Requerimientos{' '}
            <span className="text-sm font-normal text-slate-500">
              ({requirements.length})
            </span>
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Los requerimientos describen las condiciones que deberán
            analizarse para determinar si esta oportunidad puede ser
            abordada.
          </p>

          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            Registrar una habilidad, capacidad o actividad canónica no
            crea por sí sola una relación operativa ni asigna quién debe
            cumplir el requerimiento.
          </p>
        </div>

        {canFormulateRequirements ? (
          <details className="mt-5 rounded-2xl border border-[#C8D6E5] bg-slate-50">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#1E3A5F]">
              + Registrar nuevo requerimiento
            </summary>

            <div className="border-t border-slate-200 p-4">
              <OpportunityRequirementForm
                opportunityId={opportunityId}
                mode="create"
              />
            </div>
          </details>
        ) : null}

        {requirements.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Todavía no hay requerimientos registrados para esta oportunidad.
          </p>
        ) : (
          <div className="mt-5 grid gap-4">
            {requirements.map((requirement) => {
              const revisions =
                revisionsByRequirement.get(
                  requirement.requirement_id
                ) ?? []

              const formProvenance =
                requirement.provenance_kind === 'human_entry' ||
                requirement.provenance_kind === 'source_explicit' ||
                requirement.provenance_kind === 'human_inference'
                  ? requirement.provenance_kind
                  : 'human_inference'

              const canCreateRevision =
                canFormulateRequirements &&
                requirement.record_status === 'active' &&
                requirement.revision_id !== null &&
                requirement.validation_status !== null &&
                requirement.validation_status !== 'pending'

              return (
                <article
                  key={requirement.requirement_id}
                  className={
                    requirement.record_status === 'withdrawn'
                      ? 'min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 opacity-80 sm:p-5'
                      : 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5'
                  }
                >
                  <h3 className="break-words font-semibold text-slate-900">
                    {requirement.name ??
                      'Requerimiento sin revisión registrada'}
                  </h3>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-700">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {requirement.record_status === 'withdrawn'
                        ? 'Retirado'
                        : 'Activo'}
                    </span>

                    {requirement.is_mandatory !== null ? (
                      <span
                        className={
                          requirement.is_mandatory
                            ? 'rounded-full bg-amber-50 px-2 py-1 text-amber-800'
                            : 'rounded-full bg-sky-50 px-2 py-1 text-sky-800'
                        }
                      >
                        {requirement.is_mandatory
                          ? 'Obligatorio'
                          : 'Opcional'}
                      </span>
                    ) : null}

                    {requirement.validation_status ? (
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {
                          requirementValidationLabels[
                            requirement.validation_status
                          ]
                        }
                      </span>
                    ) : null}

                    {requirement.revision_no !== null ? (
                      <span className="px-2 py-1 text-slate-500">
                        Revisión actual: {requirement.revision_no}
                      </span>
                    ) : null}
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    {requirement.requirement_type ? (
                      <div>
                        <dt className="text-slate-500">
                          Tipo
                        </dt>

                        <dd className="mt-0.5 font-medium text-slate-700">
                          {
                            requirementTypeLabels[
                              requirement.requirement_type
                            ]
                          }
                        </dd>
                      </div>
                    ) : null}

                    {requirement.weight !== null ? (
                      <div>
                        <dt className="text-slate-500">
                          Importancia
                        </dt>

                        <dd className="mt-0.5 font-medium text-slate-700">
                          {requirement.weight} de 5
                        </dd>
                      </div>
                    ) : null}

                    {requirement.description ? (
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">
                          Descripción
                        </dt>

                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">
                          {requirement.description}
                        </dd>
                      </div>
                    ) : null}

                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">
                        Criterio de satisfacción
                      </dt>

                      {requirement.satisfaction_criteria ? (
                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">
                          {requirement.satisfaction_criteria}
                        </dd>
                      ) : (
                        <dd className="mt-0.5 text-amber-700">
                          Pendiente de completar antes de enviar a
                          validación.
                        </dd>
                      )}
                    </div>

                    {requirement.skill_name ? (
                      <div>
                        <dt className="text-slate-500">
                          Habilidad / capacidad canónica
                        </dt>

                        <dd className="mt-0.5 break-words font-medium text-slate-700">
                          {requirement.skill_name}
                        </dd>
                      </div>
                    ) : null}

                    {requirement.activity_name ? (
                      <div>
                        <dt className="text-slate-500">
                          Actividad canónica
                        </dt>

                        <dd className="mt-0.5 break-words font-medium text-slate-700">
                          {requirement.activity_name}
                        </dd>
                      </div>
                    ) : null}

                    {requirement.source_locator ? (
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">
                          Referencia de origen
                        </dt>

                        <dd className="mt-0.5 break-words text-slate-700">
                          {requirement.source_locator}
                        </dd>
                      </div>
                    ) : null}

                    {requirement.source_excerpt ? (
                      <div className="sm:col-span-2">
                        <dt className="text-slate-500">
                          Evidencia de origen
                        </dt>

                        <dd className="mt-0.5 whitespace-pre-wrap break-words text-slate-700">
                          {requirement.source_excerpt}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {requirement.revision_id &&
                  requirement.validation_status ? (
                    <OpportunityRequirementWorkflowControls
                      key={`${requirement.requirement_id}:${requirement.revision_id}:${requirement.record_status}:${requirement.validation_status}`}
                      opportunityId={opportunityId}
                      requirementId={requirement.requirement_id}
                      revisionId={requirement.revision_id}
                      validationStatus={requirement.validation_status}
                      recordStatus={requirement.record_status}
                      canFormulate={canFormulateRequirements}
                      canValidate={canValidateRequirements}
                      canLifecycle={canLifecycleRequirements}
                    />
                  ) : null}

                  {canCreateRevision &&
                  requirement.revision_id ? (
                    <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                        Crear nueva revisión
                      </summary>

                      <div className="border-t border-slate-200 p-4">
                        <OpportunityRequirementForm
                          opportunityId={opportunityId}
                          mode="revise"
                          requirementId={requirement.requirement_id}
                          expectedRevisionId={requirement.revision_id}

                          initialValues={{
                            name: requirement.name ?? '',
                            description:
                              requirement.description ?? '',
                            requirementType:
                              requirement.requirement_type ?? 'other',
                            isMandatory:
                              requirement.is_mandatory ?? false,
                            weight: requirement.weight ?? 1,
                            satisfactionCriteria:
                              requirement.satisfaction_criteria ?? '',
                            provenanceKind: formProvenance,
                            sourceLocator:
                              requirement.source_locator ?? '',
                            sourceExcerpt:
                              requirement.source_excerpt ?? '',
                            skillId: requirement.skill_id,
                            skillName: requirement.skill_name,
                            activityId: requirement.activity_id,
                            activityName: requirement.activity_name,
                          }}
                        />
                      </div>
                    </details>
                  ) : null}

                  {revisions.length > 0 ? (
                    <details className="mt-4 rounded-xl border border-slate-200">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                        Historial de revisiones ({revisions.length})
                      </summary>

                      <div className="border-t border-slate-200">
                        {revisions.map((revision) => (
                          <div
                            key={
                              revision.revision_id ??
                              `${revision.requirement_id}:${revision.revision_no}`
                            }
                            className="border-b border-slate-100 px-4 py-4 last:border-b-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-800">
                                Revisión {revision.revision_no}
                              </span>

                              {revision.validation_status ? (
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                                  {
                                    requirementValidationLabels[
                                      revision.validation_status
                                    ]
                                  }
                                </span>
                              ) : null}
                            </div>

                            {revision.name ? (
                              <p className="mt-2 text-sm font-medium text-slate-700">
                                {revision.name}
                              </p>
                            ) : null}

                            {revision.satisfaction_criteria ? (
                              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                                Criterio:{' '}
                                {revision.satisfaction_criteria}
                              </p>
                            ) : null}

                            {revision.review_reason ? (
                              <p className="mt-2 whitespace-pre-wrap text-xs italic leading-5 text-slate-500">
                                “{revision.review_reason}”
                              </p>
                            ) : null}

                            {revision.revision_created_at ? (
                              <p className="mt-2 text-xs text-slate-400">
                                {formatDateTime(
                                  revision.revision_created_at
                                )}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
  )
}
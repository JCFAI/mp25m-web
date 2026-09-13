import type {
  OpportunityCoverageSnapshot,
  OpportunityCoverageSummary,
} from '../../../../lib/opportunities/analysis'
import { CoverageSnapshotForm } from './coverage-snapshot-form'

function percent(value: number | null) {
  return value === null ? 'Aún no calculable' : `${value.toLocaleString('es-AR')} %`
}

function SnapshotHistory({ snapshots }: { snapshots: OpportunityCoverageSnapshot[] }) {
  if (snapshots.length === 0) return null

  return (
    <div className="mt-4 border-t border-[#C8D6E5] pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Snapshots históricos</p>
      <ul className="mt-2 space-y-2 text-xs text-slate-600">
        {snapshots.map((snapshot) => (
          <li key={snapshot.snapshot_id} className="rounded-lg bg-white px-3 py-2">
            #{snapshot.snapshot_no}: red {percent(snapshot.network_coverage_percent)}, ampliada {percent(snapshot.expanded_coverage_percent)}; {snapshot.evaluated_requirement_count} / {snapshot.active_requirement_count} evaluados. Creado el {new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(snapshot.created_at))}{snapshot.created_by_display_name ? ` por ${snapshot.created_by_display_name}` : ''}.
          </li>
        ))}
      </ul>
    </div>
  )
}

export function OpportunityCoverageSummaryCard({
  opportunityId,
  summary,
  snapshots,
  canCreateSnapshot,
}: {
  opportunityId: string
  summary: OpportunityCoverageSummary | null
  snapshots: OpportunityCoverageSnapshot[]
  canCreateSnapshot: boolean
}) {
  if (!summary || summary.active_requirement_count === 0) {
    return (
      <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">Cobertura global</h3>
        <p className="mt-2 text-sm text-slate-600">Todavía no hay requerimientos activos para calcular cobertura ni completitud.</p>
        {canCreateSnapshot ? <CoverageSnapshotForm opportunityId={opportunityId} /> : null}
        <SnapshotHistory snapshots={snapshots} />
      </section>
    )
  }

  return (
    <section className="mt-5 rounded-2xl border border-[#C8D6E5] bg-[#F8FAFC] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#2F5D8C]">Cobertura global</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Red MP25M</p><p className="mt-1 text-lg font-semibold text-slate-900">{percent(summary.network_coverage_percent)}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Ampliada Argentina</p><p className="mt-1 text-lg font-semibold text-slate-900">{percent(summary.expanded_coverage_percent)}</p></div>
        <div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Completitud</p><p className="mt-1 text-lg font-semibold text-slate-900">{summary.evaluated_requirement_count} / {summary.active_requirement_count}</p></div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">Ambas capas usan los mismos {summary.evaluated_requirement_count} requerimientos evaluados. Quedan {summary.unevaluated_requirement_count} sin evaluar.</p>
      {summary.mandatory_missing_count + summary.mandatory_partial_count + summary.mandatory_unevaluated_count > 0 ? (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Obligatorios: {summary.mandatory_missing_count} faltantes, {summary.mandatory_partial_count} parciales y {summary.mandatory_unevaluated_count} sin evaluar.</p>
      ) : null}
      {canCreateSnapshot ? <CoverageSnapshotForm opportunityId={opportunityId} /> : null}
      <SnapshotHistory snapshots={snapshots} />
    </section>
  )
}
